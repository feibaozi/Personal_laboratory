import json
import asyncio
import numpy as np
import pandas as pd
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.market import DailyQuote, Stock
from .factor_computer import FactorComputer
from .portfolio_constructor import equal_weight, risk_parity_weights, mean_variance_weights
from .performance import compute_all_metrics
from .constraints import (
    get_limit_constraints, compute_buy_cost, compute_sell_cost,
    dynamic_slippage, apply_position_constraints, round_shares,
    apply_liquidity_filter, MAX_POSITION_WEIGHT,
)
from .risk_manager import RiskManager
from .position_sizer import PositionSizer
from .progress_tracker import ProgressTracker


class VectorizedBacktester:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run(self, config: dict) -> dict:
        start = date.fromisoformat(config["start_date"])
        end = date.fromisoformat(config["end_date"])
        run_id = config.get("run_id", "unknown")
        factor_names = config.get("factor_names", ["return_1m"])
        factor_weights = config.get("factor_weights")
        top_n = config.get("top_n", 50)
        freq = config.get("rebalance_freq", "monthly")
        weighting = config.get("weighting", "equal")
        cost_config = config.get("transaction_cost", 0.0003)
        slippage_config = config.get("slippage", 0.001)
        benchmark_code = config.get("benchmark", "000300")
        initial_capital = config.get("initial_capital", 1_000_000)
        step = 21 if freq == "monthly" else 5

        risk_config = {
            "max_drawdown_limit": config.get("max_drawdown_limit", 0.0),
            "daily_loss_limit": config.get("daily_loss_limit", 0.0),
            "volatility_target": config.get("volatility_target", 0.0),
        }
        position_sizing_method = config.get("position_sizing", weighting)

        if not factor_weights:
            factor_weights = [1.0 / len(factor_names)] * len(factor_names)

        all_codes_result = await self.db.execute(select(DailyQuote.stock_code).distinct())
        all_codes = [r[0] for r in all_codes_result.all()]
        if not all_codes:
            raise ValueError("No stock data available")

        max_stocks = config.get("max_stocks", 3000)
        prices, dates, code_list, quotes_df = await self._load_price_matrix(all_codes, start, end, max_stocks)
        if prices.empty or len(dates) < 20:
            raise ValueError("Insufficient price data for backtest")

        ProgressTracker.update(run_id, step="加载价格数据完成", progress=0.1)

        # P7.2.1: Pre-load benchmark data (avoid per-day DB query)
        bm_series = await self._load_benchmark_series(benchmark_code, start, end)

        computer = FactorComputer(self.db)
        risk_mgr = RiskManager(risk_config)
        sizer = PositionSizer()
        rebalance_dates = dates[::step]
        if not rebalance_dates:
            rebalance_dates = [dates[0]]

        sectors_map = await self._load_sectors_map()

        factor_scores: dict[date, dict[str, float]] = {}
        for idx, rd in enumerate(rebalance_dates):
            if ProgressTracker.is_cancelled(run_id):
                raise asyncio.CancelledError("Backtest cancelled")
            rd_date = date.fromisoformat(rd) if isinstance(rd, str) else rd
            active_codes = await self._get_active_codes(rd_date)
            composite = {}
            for fn, fw in zip(factor_names, factor_weights):
                vals = await computer.compute_one(fn, active_codes, rd_date)
                if not vals:
                    continue
                vals_list = list(vals.values())
                mean_v = sum(vals_list) / len(vals_list)
                std_v = (sum((v - mean_v) ** 2 for v in vals_list) / len(vals_list)) ** 0.5 or 1
                for code, v in vals.items():
                    z = (v - mean_v) / std_v
                    composite[code] = composite.get(code, 0) + fw * z
            factor_scores[rd_date] = composite
            ProgressTracker.update(
                run_id, step=f"计算因子 {idx + 1}/{len(rebalance_dates)}",
                progress=0.1 + 0.2 * (idx + 1) / len(rebalance_dates),
                current_step=idx + 1, total_steps=len(rebalance_dates),
            )

        daily_values = []
        daily_returns = []
        daily_turnovers = []
        daily_cash_values = []
        benchmark_values = []
        benchmark_returns = []
        all_trades = []

        # P7.1.1: Per-day position snapshots
        daily_snapshots: list[dict] = []

        portfolio_value = initial_capital
        cash = float(initial_capital)
        positions: dict[str, int] = {}
        position_avg_costs: dict[str, float] = {}
        active_positions: set[str] = set()
        current_weights: dict[str, float] = {}
        current_sector_weights: dict[str, float] = {}
        cumulative_pnl: dict[str, float] = {}
        bm_scale = None
        prev_i = -1

        for i, d in enumerate(dates):
            dt = date.fromisoformat(d) if isinstance(d, str) else d

            if i % 50 == 0 and ProgressTracker.is_cancelled(run_id):
                raise asyncio.CancelledError("Backtest cancelled")

            is_rebalance = dt in factor_scores or (i > 0 and i % step == 0)
            if is_rebalance:
                scores = factor_scores.get(dt)
                if not scores:
                    continue
                ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)

                qdf = quotes_df[quotes_df["date"] == dt]
                limit_map = get_limit_constraints(qdf, code_list) if not qdf.empty else {}

                selected = []
                for code, score in ranked[:top_n * 2]:
                    if len(selected) >= top_n:
                        break
                    if code not in code_list:
                        continue
                    info = limit_map.get(code, {})
                    if info.get("suspended", False):
                        continue
                    if not info.get("can_buy", True):
                        continue
                    selected.append(code)

                min_daily_amount = config.get("min_daily_amount", 5_000_000)
                if min_daily_amount > 0 and not qdf.empty:
                    selected = apply_liquidity_filter(
                        selected, qdf, limit_map, min_daily_amount=min_daily_amount,
                    )

                if selected:
                    price_row = prices.iloc[i]
                    current_prices = {}
                    for code in selected:
                        if code in price_row.index and not pd.isna(price_row[code]):
                            current_prices[code] = float(price_row[code])

                    if len(current_prices) >= 3:
                        # P7.2.5: Build ret_matrix once, reuse for weighting and sizing
                        ret_mat = None
                        if weighting in ("risk_parity", "mean_variance"):
                            ret_mat = self._build_ret_matrix(prices, selected, i, 60)

                        if weighting == "equal":
                            weights = equal_weight(len(current_prices))
                        elif weighting == "risk_parity":
                            if ret_mat is not None and ret_mat.shape[1] >= 2:
                                weights = risk_parity_weights(ret_mat)
                            else:
                                weights = equal_weight(len(current_prices))
                        elif weighting == "mean_variance":
                            if ret_mat is not None and ret_mat.shape[1] >= 2:
                                weights = mean_variance_weights(ret_mat)
                            else:
                                weights = equal_weight(len(current_prices))
                        else:
                            weights = equal_weight(len(current_prices))

                        weights = sizer.size(
                            position_sizing_method, weights,
                            ret_mat=ret_mat,
                            market_caps=None,
                        )

                        weights = apply_position_constraints(weights, MAX_POSITION_WEIGHT)

                        new_positions: dict[str, int] = {}
                        sell_cost_total = 0.0
                        buy_cost_total = 0.0
                        buy_amount_total = 0.0
                        daily_trades = []

                        for old_code in list(positions.keys()):
                            old_info = limit_map.get(old_code, {})
                            if old_code not in current_prices:
                                # Stock not in today's price data — keep position, don't sell
                                new_positions[old_code] = positions[old_code]
                                continue
                            if not old_info.get("can_sell", True):
                                # Can't sell (limit down) — keep position
                                new_positions[old_code] = positions[old_code]
                                continue
                            price = current_prices[old_code]
                            slippage = dynamic_slippage(
                                positions[old_code] * price,
                                old_info.get("daily_amount", 0),
                                slippage_config,
                            )
                            sell_px = price * (1 - slippage)
                            sell_amount = positions[old_code] * sell_px
                            sell_cost = compute_sell_cost(sell_amount)
                            sell_cost_total += sell_cost
                            cash += sell_amount
                            daily_trades.append({
                                "trade_date": dt.isoformat(),
                                "stock_code": old_code,
                                "direction": "sell",
                                "shares": positions[old_code],
                                "price": round(sell_px, 2),
                                "amount": round(sell_amount, 2),
                                "cost": round(sell_cost, 2),
                                "slippage": round(slippage, 6),
                            })

                        positions.clear()

                        # After selling, deduct sell costs before calculating available capital
                        cash -= sell_cost_total
                        total_capital = cash
                        codes_order = list(current_prices.keys())
                        for code, w in zip(codes_order, weights):
                            price = current_prices[code]
                            info = limit_map.get(code, {})
                            effective_slippage = dynamic_slippage(
                                total_capital * float(w),
                                info.get("daily_amount", 0),
                                slippage_config,
                            )
                            buy_px = price * (1 + effective_slippage)
                            target_value = total_capital * float(w)
                            raw_shares = target_value / buy_px if buy_px > 0 else 0
                            shares = round_shares(raw_shares)
                            if shares > 0:
                                new_positions[code] = shares
                                buy_amount = shares * buy_px
                                buy_cost = compute_buy_cost(buy_amount)
                                buy_cost_total += buy_cost
                                buy_amount_total += buy_amount
                                daily_trades.append({
                                    "trade_date": dt.isoformat(),
                                    "stock_code": code,
                                    "direction": "buy",
                                    "shares": shares,
                                    "price": round(buy_px, 2),
                                    "amount": round(buy_amount, 2),
                                    "cost": round(buy_cost, 2),
                                    "slippage": round(effective_slippage, 6),
                                })

                        if prev_i >= 0 and active_positions:
                            intersection = set(new_positions.keys()) & active_positions
                            total_traded = 1 - len(intersection) / max(len(active_positions), 1)
                            daily_turnovers.append(float(total_traded))
                        elif daily_trades:
                            total_buy = sum(t["amount"] for t in daily_trades if t["direction"] == "buy")
                            total_sell = sum(t["amount"] for t in daily_trades if t["direction"] == "sell")
                            total_traded_amt = (total_buy + total_sell) / 2
                            bilateral = total_traded_amt / portfolio_value if portfolio_value > 0 else 0
                            daily_turnovers.append(float(bilateral))
                        else:
                            daily_turnovers.append(0.0)

                        positions = new_positions
                        # Preserve avg costs for carried positions, set new for bought positions
                        new_avg_costs = {}
                        for code, shares in new_positions.items():
                            if code in position_avg_costs and code not in current_prices:
                                # Carried position without price data — keep old avg cost
                                new_avg_costs[code] = position_avg_costs[code]
                            elif code in current_prices:
                                new_avg_costs[code] = current_prices[code]
                        position_avg_costs = new_avg_costs
                        active_positions = set(new_positions.keys())
                        # Deduct buy amounts and costs from cash
                        cash -= buy_amount_total
                        cash -= buy_cost_total

                        current_weights = {}
                        total_pos_value = 0.0
                        for c in new_positions:
                            if c in current_prices:
                                total_pos_value += new_positions[c] * current_prices[c]
                            elif c in prices.columns and i < len(prices):
                                px = prices.iloc[i][c]
                                if not pd.isna(px):
                                    total_pos_value += new_positions[c] * float(px)
                        if total_pos_value > 0:
                            for c in new_positions:
                                if c in current_prices:
                                    current_weights[c] = (new_positions[c] * current_prices[c]) / total_pos_value
                                elif c in prices.columns and i < len(prices):
                                    px = prices.iloc[i][c]
                                    if not pd.isna(px):
                                        current_weights[c] = (new_positions[c] * float(px)) / total_pos_value

                        current_sector_weights = {}
                        for c, w in current_weights.items():
                            sec = sectors_map.get(c, "Unknown")
                            current_sector_weights[sec] = current_sector_weights.get(sec, 0) + w

                        all_trades.extend(daily_trades)

                    prev_i = i

            total_value = cash
            for code, shares in positions.items():
                if code in prices.columns and i < len(prices):
                    px = prices.iloc[i][code]
                    if not pd.isna(px):
                        total_value += shares * float(px)
                    elif i > 0 and code in prices.columns and not pd.isna(prices.iloc[i - 1][code]):
                        total_value += shares * float(prices.iloc[i - 1][code])
                elif i > 0 and code in prices.columns and not pd.isna(prices.iloc[i - 1][code]):
                    total_value += shares * float(prices.iloc[i - 1][code])

            portfolio_value = total_value
            daily_values.append(portfolio_value)
            daily_cash_values.append(cash)

            cumulative_pnl = {}
            for code, shares in positions.items():
                if code in prices.columns and i < len(prices):
                    px = prices.iloc[i][code]
                    if not pd.isna(px) and code in position_avg_costs:
                        cumulative_pnl[code] = round(float(px - position_avg_costs[code]) * shares, 2)

            # P7.1.1: Save per-day snapshot
            daily_snapshots.append({
                "positions": dict(positions),
                "weights": {k: round(v, 6) for k, v in current_weights.items()},
                "sector_weights": {k: round(v, 6) for k, v in current_sector_weights.items()},
                "cumulative_pnl": dict(cumulative_pnl),
            })

            if i > 0 and daily_values[i - 1] > 0:
                daily_ret = portfolio_value / daily_values[i - 1] - 1
            else:
                daily_ret = 0.0
            daily_returns.append(daily_ret)

            # Progress update every 50 days
            if i % 50 == 0:
                ProgressTracker.update(
                    run_id, step=f"模拟回测 {i + 1}/{len(dates)}",
                    progress=0.3 + 0.5 * (i + 1) / len(dates),
                    current_step=i + 1, total_steps=len(dates),
                    message=f"净值: {portfolio_value:.0f}",
                )

            risk_action = risk_mgr.check(
                portfolio_value=portfolio_value,
                daily_return=daily_ret,
                daily_returns=daily_returns,
                initial_capital=initial_capital,
            )
            # P7.2.4: Apply vol_scale from risk manager
            if risk_action.get("reduce"):
                reduce_ratio = risk_action["reduce_ratio"]
                for code in list(positions.keys()):
                    reduce_shares = int(positions[code] * reduce_ratio / 100) * 100
                    if reduce_shares > 0 and code in prices.columns:
                        px = prices.iloc[i][code] if i < len(prices) else None
                        if px and not pd.isna(px):
                            positions[code] -= reduce_shares
                            cash += reduce_shares * float(px) * (1 - 0.002)
                    if positions.get(code, 0) <= 0:
                        positions.pop(code, None)
            elif risk_action.get("vol_scale", 1.0) < 1.0:
                vol_scale = risk_action["vol_scale"]
                for code in list(positions.keys()):
                    reduce_shares = int(positions[code] * (1 - vol_scale) / 100) * 100
                    if reduce_shares > 0 and code in prices.columns:
                        px = prices.iloc[i][code] if i < len(prices) else None
                        if px and not pd.isna(px):
                            positions[code] -= reduce_shares
                            cash += reduce_shares * float(px) * (1 - 0.001)
                    if positions.get(code, 0) <= 0:
                        positions.pop(code, None)

            # P7.2.1: Use pre-loaded benchmark series instead of per-day DB query
            bm_val = bm_series.get(dt)
            if bm_val is not None:
                if bm_scale is None:
                    bm_scale = initial_capital / bm_val
                scaled_bm = bm_val * bm_scale
                benchmark_values.append(scaled_bm)
                if len(benchmark_values) >= 2 and benchmark_values[-2] > 0:
                    benchmark_returns.append(scaled_bm / benchmark_values[-2] - 1)
                else:
                    benchmark_returns.append(0.0)
            else:
                benchmark_values.append(benchmark_values[-1] if benchmark_values else initial_capital)
                benchmark_returns.append(0.0)

            if i > 0:
                prev_i = i

        # P7.1.1: Use per-day snapshots for positions_json
        result_daily = []
        for i, d in enumerate(dates):
            bm_val = benchmark_values[i] if i < len(benchmark_values) else initial_capital
            snapshot = daily_snapshots[i] if i < len(daily_snapshots) else {
                "positions": {}, "weights": {}, "sector_weights": {}, "cumulative_pnl": {},
            }
            result_daily.append({
                "trade_date": d,
                "portfolio_value": round(daily_values[i], 2) if i < len(daily_values) else initial_capital,
                "benchmark_value": round(bm_val, 2),
                "cash": round(daily_cash_values[i], 2) if i < len(daily_cash_values) else initial_capital,
                "daily_return": round(daily_returns[i], 6) if i < len(daily_returns) else 0,
                "benchmark_return": round(benchmark_returns[i], 6) if i < len(benchmark_returns) else 0,
                "turnover": round(daily_turnovers[i], 4) if i < len(daily_turnovers) else 0,
                "positions_json": json.dumps(snapshot, ensure_ascii=False),
            })

        ProgressTracker.update(run_id, step="计算绩效指标", progress=0.9)

        ret_arr = np.array(daily_returns)
        val_arr = np.array(daily_values)
        bm_arr = np.array(benchmark_returns)
        metrics = compute_all_metrics(ret_arr, val_arr, bm_arr, dates=dates)

        ProgressTracker.update(run_id, step="回测完成", progress=1.0, message="done")

        return {
            "daily": result_daily,
            "summary": metrics,
            "trades": all_trades,
        }

    async def _load_price_matrix(self, codes: list[str], start: date, end: date,
                                 max_stocks: int = 3000) -> tuple[pd.DataFrame, list, list, pd.DataFrame]:
        lookback = start - timedelta(days=400)
        codes = codes[:max_stocks]

        batch_size = 500
        all_rows = []
        for batch_start in range(0, len(codes), batch_size):
            batch_codes = codes[batch_start:batch_start + batch_size]
            result = await self.db.execute(
                select(DailyQuote.stock_code, DailyQuote.trade_date, DailyQuote.close,
                       DailyQuote.open, DailyQuote.high, DailyQuote.low,
                       DailyQuote.pre_close, DailyQuote.volume, DailyQuote.amount)
                .where(DailyQuote.stock_code.in_(batch_codes))
                .where(DailyQuote.trade_date >= lookback)
                .where(DailyQuote.trade_date <= end)
                .order_by(DailyQuote.trade_date)
            )
            all_rows.extend(result.all())

        if not all_rows:
            return pd.DataFrame(), [], [], pd.DataFrame()
        cols = ["code", "date", "close", "open", "high", "low", "pre_close", "volume", "amount"]
        df = pd.DataFrame(all_rows, columns=cols)

        prices = df.pivot(index="date", columns="code", values="close")
        prices.sort_index(inplace=True)

        all_dates = [d for d in prices.index if start <= d <= end]
        prices = prices.loc[all_dates]
        codes_list = list(prices.columns)

        quotes_df = df[df["date"].isin(all_dates)].copy()
        return prices, all_dates, codes_list, quotes_df

    def _build_ret_matrix(self, prices: pd.DataFrame, codes: list[str], current_idx: int, window: int) -> pd.DataFrame:
        start_idx = max(0, current_idx - window)
        available_codes = [c for c in codes if c in prices.columns]
        if len(available_codes) < 2:
            return pd.DataFrame()
        sub = prices.iloc[start_idx:current_idx + 1][available_codes]
        rets = sub.pct_change().dropna(how="all")
        return rets.dropna(axis=1)

    async def _get_active_codes(self, target_date: date) -> list[str]:
        from ..models.market import Stock as StockModel
        result = await self.db.execute(
            select(StockModel.code)
            .where(StockModel.list_date <= target_date)
            .where((StockModel.out_date.is_(None)) | (StockModel.out_date > target_date))
        )
        codes = [r[0] for r in result.all()]
        if not codes:
            dq_result = await self.db.execute(
                select(DailyQuote.stock_code).distinct()
            )
            codes = [r[0] for r in dq_result.all()]
        return codes

    async def _load_sectors_map(self) -> dict[str, str]:
        from ..models.market import Stock as StockModel
        result = await self.db.execute(
            select(StockModel.code, StockModel.industry)
        )
        mapping = {}
        for row in result.all():
            code, industry = row
            if industry and industry.strip():
                mapping[code] = industry.strip()
            else:
                mapping[code] = "Unknown"
        return mapping

    async def _load_benchmark_series(self, benchmark_code: str, start: date, end: date) -> dict[date, float]:
        """P7.2.1: Pre-load all benchmark data for the backtest period."""
        from ..models.market import IndexDaily
        result = await self.db.execute(
            select(IndexDaily.trade_date, IndexDaily.close)
            .where(
                IndexDaily.index_code == benchmark_code,
                IndexDaily.trade_date >= start,
                IndexDaily.trade_date <= end,
            )
            .order_by(IndexDaily.trade_date)
        )
        return {row[0]: float(row[1]) for row in result.all() if row[1] is not None}
