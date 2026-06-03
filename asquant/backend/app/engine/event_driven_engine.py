import json
import logging
import numpy as np
import pandas as pd
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.market import MinuteQuote, DailyQuote, IndexDaily
from ..engine.performance import compute_all_metrics
from ..engine.constraints import (
    is_limit_up, is_limit_down, is_suspended,
    compute_buy_cost, compute_sell_cost, dynamic_slippage,
    MIN_SHARES,
)
from ..engine.progress_tracker import ProgressTracker

logger = logging.getLogger(__name__)

STRATEGIES = {
    "intraday_momentum": "Intraday Momentum — buy top N by last K minutes return",
    "mean_reversion": "Mean Reversion — buy when price deviates below MA",
    "breakout": "Breakout — buy when price breaks above N-minute high",
}


class EventDrivenBacktester:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run(self, config: dict) -> dict:
        start = date.fromisoformat(config["start_date"])
        end = date.fromisoformat(config["end_date"])
        freq = config.get("freq", "5")
        strategy = config.get("strategy", "intraday_momentum")
        lookback = config.get("lookback", 20)
        hold_period = config.get("hold_period", 10)
        stop_loss = config.get("stop_loss", -0.02)
        take_profit = config.get("take_profit", 0.03)
        max_positions = config.get("max_positions", 5)
        position_size = config.get("position_size", 0.2)
        cost_config = config.get("transaction_cost", 0.0003)
        slippage_config = config.get("slippage", 0.001)
        initial_capital = config.get("initial_capital", 1_000_000)
        force_close_eod = config.get("force_close_eod", True)
        top_n = config.get("top_n", 10)
        benchmark_code = config.get("benchmark", "000300")
        run_id = config.get("run_id", "")

        ProgressTracker.update(run_id, step="加载分钟数据", progress=0.05)

        # Load minute data in batches (remove hard limit)
        result = await self.db.execute(
            select(MinuteQuote)
            .where(MinuteQuote.freq == freq)
            .where(MinuteQuote.trade_date >= start)
            .where(MinuteQuote.trade_date <= end)
            .order_by(MinuteQuote.stock_code, MinuteQuote.trade_time)
        )
        rows = result.scalars().all()
        if not rows:
            return {"error": "No minute data available. Sync minute data first.", "daily": [], "summary": {}, "trades": []}

        df = pd.DataFrame([{
            "code": r.stock_code, "time": r.trade_time, "date": r.trade_date,
            "open": r.open, "high": r.high, "low": r.low, "close": r.close,
            "volume": r.volume or 0, "amount": r.amount or 0,
        } for r in rows])
        df = df.sort_values(["code", "time"]).reset_index(drop=True)

        codes = df["code"].unique().tolist()
        if len(codes) < 3:
            return {"error": f"Need at least 3 stocks, got {len(codes)}", "daily": [], "summary": {}, "trades": []}

        ProgressTracker.update(run_id, step="构建数据索引", progress=0.1)

        # Pre-build O(1) lookup index: (code, time) -> row dict
        data_index: dict[tuple[str, object], dict] = {}
        for _, row in df.iterrows():
            data_index[(row["code"], row["time"])] = {
                "open": row["open"], "high": row["high"], "low": row["low"],
                "close": row["close"], "volume": row["volume"], "amount": row["amount"],
            }

        # Pre-build per-code sorted time series for signal generation
        code_times: dict[str, list] = {}
        code_time_idx: dict[str, dict[object, int]] = {}
        for code in codes:
            code_df = df[df["code"] == code]
            times = code_df["time"].tolist()
            code_times[code] = times
            code_time_idx[code] = {t: i for i, t in enumerate(times)}

        ProgressTracker.update(run_id, step="加载日频数据", progress=0.15)

        daily_quote_cache = await self._load_daily_quotes(codes, start, end)

        # Load benchmark series
        bm_series = await self._load_benchmark_series(benchmark_code, start, end)

        all_times = sorted(df["time"].unique())
        all_times = all_times[lookback:]

        capital = float(initial_capital)
        positions: dict[str, dict] = {}
        daily_values = []
        daily_returns = []
        daily_cash_values = []
        all_trades = []

        # Track benchmark
        bm_scale = None
        benchmark_values = []
        benchmark_returns = []

        # Track per-day data for output
        daily_snapshots = []

        prev_time = None
        total_steps = len(all_times)

        ProgressTracker.update(run_id, step="开始日内回测", progress=0.2)

        for t_idx, current_time in enumerate(all_times):
            # Check cancellation
            if run_id and t_idx % 100 == 0 and ProgressTracker.is_cancelled(run_id):
                return {"error": "Cancelled", "daily": [], "summary": {}, "trades": []}

            if isinstance(current_time, pd.Timestamp):
                current_date = current_time.date()
            elif hasattr(current_time, "date"):
                current_date = current_date.date() if callable(current_date.date) else current_date.date
            else:
                current_date = current_date.date() if hasattr(current_date, "date") else None

            # --- Close positions that hit stop-loss / take-profit / hold period ---
            closed = []
            for code, pos in list(positions.items()):
                bar = data_index.get((code, current_time))
                if bar is None:
                    continue
                px = float(bar["close"])
                ret = (px - pos["entry_price"]) / pos["entry_price"]
                hold_minutes = (current_time - pos["entry_time"]).total_seconds() / 60

                should_close = (ret <= stop_loss or ret >= take_profit or hold_minutes >= hold_period)
                if should_close:
                    dq = daily_quote_cache.get((code, current_date))
                    if dq and not dq.get("can_sell", True):
                        continue

                    slippage = dynamic_slippage(
                        pos["shares"] * px,
                        float(bar.get("amount", 0) or 0),
                        slippage_config,
                    )
                    exit_px = px * (1 - slippage)
                    sell_amount = pos["shares"] * exit_px
                    sell_cost = compute_sell_cost(sell_amount)
                    capital += sell_amount
                    capital -= sell_cost
                    closed.append(code)

                    # Record trade
                    all_trades.append({
                        "trade_date": current_date,
                        "stock_code": code,
                        "direction": "sell",
                        "shares": pos["shares"],
                        "price": round(exit_px, 4),
                        "amount": round(sell_amount, 2),
                        "cost": round(sell_cost, 2),
                        "slippage": round(slippage, 6),
                    })

            for code in closed:
                del positions[code]

            # --- Force close EOD ---
            if force_close_eod and prev_time:
                prev_date = prev_time.date() if hasattr(prev_time, "date") and callable(prev_time.date) else prev_time.date if hasattr(prev_time, "date") else None
                if current_date != prev_date:
                    for code, pos in list(positions.items()):
                        bar = data_index.get((code, prev_time))
                        if bar is not None:
                            px = float(bar["close"])
                            slippage = dynamic_slippage(
                                pos["shares"] * px,
                                float(bar.get("amount", 0) or 0),
                                slippage_config,
                            )
                            exit_px = px * (1 - slippage)
                            sell_amount = pos["shares"] * exit_px
                            sell_cost = compute_sell_cost(sell_amount)
                            capital += sell_amount
                            capital -= sell_cost

                            all_trades.append({
                                "trade_date": prev_date,
                                "stock_code": code,
                                "direction": "sell",
                                "shares": pos["shares"],
                                "price": round(exit_px, 4),
                                "amount": round(sell_amount, 2),
                                "cost": round(sell_cost, 2),
                                "slippage": round(slippage, 6),
                            })
                    positions.clear()

            # --- Open new positions ---
            if len(positions) < max_positions:
                signals = self._generate_signals(
                    data_index, code_times, code_time_idx, codes,
                    current_time, strategy, lookback, top_n,
                )
                for code, score in signals[:max_positions - len(positions)]:
                    dq = daily_quote_cache.get((code, current_date))
                    if dq and not dq.get("can_buy", True):
                        continue

                    bar = data_index.get((code, current_time))
                    if bar is None:
                        continue
                    px = float(bar["close"])
                    slippage = dynamic_slippage(
                        capital * position_size,
                        float(bar.get("amount", 0) or 0),
                        slippage_config,
                    )
                    entry_px = px * (1 + slippage)
                    trade_capital = capital * position_size
                    raw_shares = trade_capital / entry_px
                    shares = int(raw_shares / MIN_SHARES) * MIN_SHARES
                    if shares > 0 and trade_capital < capital * 0.95:
                        cost = shares * entry_px
                        buy_cost = compute_buy_cost(cost)
                        capital -= cost
                        capital -= buy_cost
                        positions[code] = {"shares": shares, "entry_price": entry_px, "entry_time": current_time}

                        all_trades.append({
                            "trade_date": current_date,
                            "stock_code": code,
                            "direction": "buy",
                            "shares": shares,
                            "price": round(entry_px, 4),
                            "amount": round(cost, 2),
                            "cost": round(buy_cost, 2),
                            "slippage": round(slippage, 6),
                        })

            # --- Calculate total value ---
            total_value = capital
            pos_weights = {}
            for code, pos in positions.items():
                bar = data_index.get((code, current_time))
                if bar is not None:
                    mkt_val = pos["shares"] * float(bar["close"])
                    total_value += mkt_val

            # Calculate weights
            if total_value > 0:
                for code, pos in positions.items():
                    bar = data_index.get((code, current_time))
                    if bar is not None:
                        pos_weights[code] = round(pos["shares"] * float(bar["close"]) / total_value, 6)

            daily_values.append(total_value)
            daily_cash_values.append(capital)

            # Snapshot
            daily_snapshots.append({
                "positions": {code: pos["shares"] for code, pos in positions.items()},
                "weights": pos_weights,
                "sector_weights": {},
                "cumulative_pnl": {},
            })

            if len(daily_values) >= 2 and daily_values[-2] > 0:
                daily_returns.append(total_value / daily_values[-2] - 1)
            else:
                daily_returns.append(0.0)

            # Benchmark
            bm_val = bm_series.get(current_date)
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

            # Progress update every 200 steps
            if run_id and t_idx % 200 == 0:
                ProgressTracker.update(
                    run_id, step=f"日内回测 {t_idx + 1}/{total_steps}",
                    progress=0.2 + 0.6 * (t_idx + 1) / total_steps,
                    current_step=t_idx + 1, total_steps=total_steps,
                    message=f"净值: {total_value:.0f}",
                )

            prev_time = current_time

        ProgressTracker.update(run_id, step="计算绩效指标", progress=0.9)

        ret_arr = np.array(daily_returns)
        val_arr = np.array(daily_values)
        bm_arr = np.array(benchmark_returns)
        dates_list = []
        for t in all_times:
            if isinstance(t, pd.Timestamp):
                dates_list.append(t.date())
            elif hasattr(t, "date"):
                d = t.date() if callable(t.date) else t.date
                dates_list.append(d)
            else:
                dates_list.append(None)
        metrics = compute_all_metrics(ret_arr, val_arr, bm_arr, dates=dates_list)

        # Build daily output aligned with vectorized engine format
        daily_out = []
        for i, t in enumerate(all_times):
            bm_val = benchmark_values[i] if i < len(benchmark_values) else initial_capital
            snapshot = daily_snapshots[i] if i < len(daily_snapshots) else {
                "positions": {}, "weights": {}, "sector_weights": {}, "cumulative_pnl": {},
            }
            daily_out.append({
                "trade_date": t,
                "portfolio_value": round(daily_values[i], 2) if i < len(daily_values) else initial_capital,
                "benchmark_value": round(bm_val, 2),
                "cash": round(daily_cash_values[i], 2) if i < len(daily_cash_values) else initial_capital,
                "daily_return": round(daily_returns[i], 6) if i < len(daily_returns) else 0,
                "benchmark_return": round(benchmark_returns[i], 6) if i < len(benchmark_returns) else 0,
                "turnover": 0,
                "positions_json": json.dumps(snapshot, ensure_ascii=False),
            })

        ProgressTracker.update(run_id, step="回测完成", progress=1.0, message="done")

        return {"daily": daily_out, "summary": metrics, "trades": all_trades}

    async def _load_daily_quotes(self, codes: list[str], start: date, end: date) -> dict[tuple[str, date], dict]:
        result = await self.db.execute(
            select(DailyQuote)
            .where(DailyQuote.stock_code.in_(codes))
            .where(DailyQuote.trade_date >= start)
            .where(DailyQuote.trade_date <= end)
        )
        rows = result.scalars().all()
        cache = {}
        for r in rows:
            suspended = is_suspended(r.volume or 0)
            cache[(r.stock_code, r.trade_date)] = {
                "can_buy": not is_limit_up(r.stock_code, r.close or 0, r.pre_close or 0) and not suspended,
                "can_sell": not is_limit_down(r.stock_code, r.close or 0, r.pre_close or 0) and not suspended,
                "suspended": suspended,
                "close": r.close,
                "pre_close": r.pre_close,
                "daily_amount": r.amount or 0,
            }
        return cache

    async def _load_benchmark_series(self, benchmark_code: str, start: date, end: date) -> dict[date, float]:
        """Load benchmark daily close prices for the backtest period."""
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

    def _generate_signals(
        self,
        data_index: dict[tuple[str, object], dict],
        code_times: dict[str, list],
        code_time_idx: dict[str, dict[object, int]],
        codes: list[str],
        current_time,
        strategy: str,
        lookback: int,
        top_n: int,
    ) -> list[tuple[str, float]]:
        """Generate trading signals using pre-built index for O(1) lookups."""
        signals = []
        for code in codes:
            times = code_times.get(code, [])
            if len(times) < lookback + 1:
                continue
            idx_map = code_time_idx.get(code, {})
            idx = idx_map.get(current_time)
            if idx is None:
                continue
            start_idx = max(0, idx - lookback)

            # Collect window data from index
            window_closes = []
            window_opens = []
            window_highs = []
            first_open = None
            last_close = None
            for w_i in range(start_idx, idx + 1):
                t = times[w_i]
                bar = data_index.get((code, t))
                if bar is None:
                    continue
                window_closes.append(float(bar["close"]))
                window_opens.append(float(bar["open"]))
                window_highs.append(float(bar["high"]))
                if first_open is None:
                    first_open = float(bar["open"])
                last_close = float(bar["close"])

            if len(window_closes) < lookback or first_open is None or last_close is None:
                continue

            if strategy == "intraday_momentum":
                ret = (last_close / first_open - 1) if first_open > 0 else 0
                signals.append((code, ret))
            elif strategy == "mean_reversion":
                ma = sum(window_closes) / len(window_closes)
                dev = (ma - last_close) / ma if ma > 0 else 0
                signals.append((code, dev))
            elif strategy == "breakout":
                # High of all bars except the last one
                high_n = max(window_highs[:-1]) if len(window_highs) > 1 else 0
                brk = (last_close - high_n) / high_n if high_n > 0 else -1
                signals.append((code, brk))

        signals.sort(key=lambda x: x[1], reverse=True)
        return signals[:top_n]
