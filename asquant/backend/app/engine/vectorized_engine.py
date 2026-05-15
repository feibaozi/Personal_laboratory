"""Vectorized portfolio backtesting engine."""
import numpy as np
import pandas as pd
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.market import DailyQuote, Stock
from .factor_computer import FactorComputer
from .portfolio_constructor import equal_weight, risk_parity_weights, mean_variance_weights
from .performance import compute_all_metrics


class VectorizedBacktester:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run(self, config: dict) -> dict:
        """Run a vectorized backtest.

        config keys:
            start_date, end_date: str
            factor_names: list[str]
            factor_weights: list[float] (optional, defaults to equal)
            top_n: int
            rebalance_freq: "monthly" | "weekly"
            weighting: "equal" | "risk_parity" | "mean_variance"
            transaction_cost: float (e.g., 0.0003)
            slippage: float (e.g., 0.001)
            benchmark_code: str (e.g., "000300")
            initial_capital: float
        """
        start = date.fromisoformat(config["start_date"])
        end = date.fromisoformat(config["end_date"])
        factor_names = config.get("factor_names", ["return_1m"])
        factor_weights = config.get("factor_weights")
        top_n = config.get("top_n", 50)
        freq = config.get("rebalance_freq", "monthly")
        weighting = config.get("weighting", "equal")
        cost = config.get("transaction_cost", 0.0003)
        slippage = config.get("slippage", 0.001)
        benchmark_code = config.get("benchmark", "000300")
        initial_capital = config.get("initial_capital", 1_000_000)
        step = 21 if freq == "monthly" else 5

        if not factor_weights:
            factor_weights = [1.0 / len(factor_names)] * len(factor_names)

        # 1. Load universe and prices
        codes_result = await self.db.execute(select(DailyQuote.stock_code).distinct())
        all_codes = [r[0] for r in codes_result.all()]
        if not all_codes:
            raise ValueError("No stock data available")

        prices, dates, code_list = await self._load_price_matrix(all_codes, start, end)
        if prices.empty or len(dates) < 20:
            raise ValueError("Insufficient price data for backtest")

        # 2. Compute factor scores at each rebalance date
        computer = FactorComputer(self.db)
        rebalance_dates = dates[::step]
        if not rebalance_dates:
            rebalance_dates = [dates[0]]

        factor_scores: dict[date, dict[str, float]] = {}
        factor_values_all: dict[str, dict[date, dict[str, float]]] = {fn: {} for fn in factor_names}

        for rd in rebalance_dates:
            rd_date = date.fromisoformat(rd) if isinstance(rd, str) else rd
            composite = {}
            for fn, fw in zip(factor_names, factor_weights):
                vals = await computer.compute_one(fn, all_codes, rd_date)
                if isinstance(rd, str):
                    factor_values_all[fn][date.fromisoformat(rd)] = vals
                else:
                    factor_values_all[fn][rd] = vals
                if not vals:
                    continue
                vals_list = list(vals.values())
                mean_v = sum(vals_list) / len(vals_list)
                std_v = (sum((v - mean_v) ** 2 for v in vals_list) / len(vals_list)) ** 0.5 or 1
                for code, v in vals.items():
                    z = (v - mean_v) / std_v
                    composite[code] = composite.get(code, 0) + fw * z
            factor_scores[rd_date] = composite

        # 3. Run backtest
        daily_values = []
        daily_returns = []
        daily_turnovers = []
        benchmark_values = []
        benchmark_returns = []

        portfolio_value = initial_capital
        cash = 0.0
        positions: dict[str, float] = {}  # stock_code -> shares
        active_positions: set[str] = set()
        bm_scale = None  # Scale benchmark to start at initial_capital

        prev_rm_idx = -1
        for i, d in enumerate(dates):
            dt = date.fromisoformat(d) if isinstance(d, str) else d

            is_rebalance = dt in factor_scores or (i > 0 and i % step == 0)
            if (is_rebalance and (i > 0 or i == 0)):
                scores = factor_scores.get(dt)
                if not scores:
                    continue
                ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
                selected = [code for code, _ in ranked[:top_n] if code in code_list]

                if selected:
                    price_row = prices.iloc[i]
                    current_prices = {}
                    for code in selected:
                        if code in price_row.index and not pd.isna(price_row[code]):
                            current_prices[code] = float(price_row[code])

                    if len(current_prices) >= 3:
                        prices_ser = pd.Series(current_prices)

                        if weighting == "equal":
                            weights = equal_weight(len(current_prices))
                        elif weighting == "risk_parity":
                            ret_mat = self._build_ret_matrix(prices, selected, i, 60)
                            if ret_mat.shape[1] >= 2:
                                weights = risk_parity_weights(ret_mat)
                            else:
                                weights = equal_weight(len(current_prices))
                        elif weighting == "mean_variance":
                            ret_mat = self._build_ret_matrix(prices, selected, i, 60)
                            if ret_mat.shape[1] >= 2:
                                weights = mean_variance_weights(ret_mat)
                            else:
                                weights = equal_weight(len(current_prices))
                        else:
                            weights = equal_weight(len(current_prices))

                        new_positions: dict[str, float] = {}
                        for code, w in zip(current_prices.keys(), weights):
                            price = current_prices[code]
                            target_value = portfolio_value * float(w)
                            shares = target_value / price if price > 0 else 0
                            new_positions[code] = shares

                        # Calculate turnover
                        if prev_rm_idx >= 0 and active_positions:
                            intersection = set(new_positions.keys()) & active_positions
                            total_traded = 1 - len(intersection) / max(len(active_positions), 1)
                            daily_turnovers.append(float(total_traded))
                        else:
                            daily_turnovers.append(0.0)

                        # Apply cost
                        if prev_rm_idx >= 0:
                            trade_cost = cost
                            portfolio_value *= (1 - trade_cost * len(new_positions))

                        positions = new_positions
                        active_positions = set(new_positions.keys())

            # Mark to market
            prev_value = portfolio_value
            total_value = cash
            for code, shares in positions.items():
                if code in prices.columns and i < len(prices):
                    px = prices.iloc[i][code]
                    if not pd.isna(px):
                        total_value += shares * float(px)
                    else:
                        total_value += shares * float(prices.iloc[i - 1][code]) if i > 0 and code in prices.columns and not pd.isna(prices.iloc[i - 1][code]) else 0
                else:
                    total_value += shares * float(prices.iloc[i - 1][code]) if i > 0 and code in prices.columns and not pd.isna(prices.iloc[i - 1][code]) else 0

            portfolio_value = total_value if positions else portfolio_value
            daily_values.append(portfolio_value)
            if i > 0 and daily_values[i - 1] > 0:
                daily_returns.append(portfolio_value / daily_values[i - 1] - 1)
            else:
                daily_returns.append(0.0)

            # Benchmark
            bm_val = await self._benchmark_value(benchmark_code, dt)
            if bm_val:
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
                prev_rm_idx = i

        # 4. Build daily series
        result_daily = []
        for i, d in enumerate(dates):
            bm_val = benchmark_values[i] if i < len(benchmark_values) else initial_capital
            result_daily.append({
                "trade_date": d,
                "portfolio_value": round(daily_values[i], 2) if i < len(daily_values) else initial_capital,
                "benchmark_value": round(bm_val, 2),
                "cash": 0.0,
                "daily_return": round(daily_returns[i], 6) if i < len(daily_returns) else 0,
                "benchmark_return": round(benchmark_returns[i], 6) if i < len(benchmark_returns) else 0,
                "turnover": round(daily_turnovers[i], 4) if i < len(daily_turnovers) else 0,
                "positions_json": "",
            })

        # 5. Compute summary metrics
        ret_arr = np.array(daily_returns)
        val_arr = np.array(daily_values)
        bm_arr = np.array(benchmark_returns)
        metrics = compute_all_metrics(ret_arr, val_arr, bm_arr)

        return {
            "daily": result_daily,
            "summary": metrics,
        }

    async def _load_price_matrix(self, codes: list[str], start: date, end: date) -> tuple[pd.DataFrame, list, list]:
        lookback = start - timedelta(days=400)
        result = await self.db.execute(
            select(DailyQuote.stock_code, DailyQuote.trade_date, DailyQuote.close)
            .where(DailyQuote.stock_code.in_(codes[:500]))
            .where(DailyQuote.trade_date >= lookback)
            .where(DailyQuote.trade_date <= end)
            .order_by(DailyQuote.trade_date)
        )
        rows = result.all()
        df = pd.DataFrame(rows, columns=["code", "date", "close"])
        prices = df.pivot(index="date", columns="code", values="close")
        prices.sort_index(inplace=True)

        all_dates = [d for d in prices.index if start <= d <= end]
        prices = prices.loc[all_dates]
        codes_list = list(prices.columns)
        return prices, all_dates, codes_list

    def _build_ret_matrix(self, prices: pd.DataFrame, codes: list[str], current_idx: int, window: int) -> pd.DataFrame:
        """Build return matrix for risk model estimation."""
        start_idx = max(0, current_idx - window)
        available_codes = [c for c in codes if c in prices.columns]
        if len(available_codes) < 2:
            return pd.DataFrame()
        sub = prices.iloc[start_idx:current_idx + 1][available_codes]
        rets = sub.pct_change().dropna(how="all")
        return rets.dropna(axis=1)

    async def _benchmark_value(self, benchmark_code: str, d: date) -> float | None:
        from ..models.market import IndexDaily
        result = await self.db.execute(
            select(IndexDaily.close).where(
                IndexDaily.index_code == benchmark_code,
                IndexDaily.trade_date <= d,
            ).order_by(IndexDaily.trade_date.desc()).limit(1)
        )
        val = result.scalar_one_or_none()
        return float(val) if val else None
