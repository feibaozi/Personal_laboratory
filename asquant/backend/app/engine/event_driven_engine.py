"""Event-driven backtest engine for intraday/minute-level strategies."""
import logging
import numpy as np
import pandas as pd
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.market import MinuteQuote, DailyQuote
from ..engine.performance import compute_all_metrics

logger = logging.getLogger(__name__)

STRATEGIES = {
    "intraday_momentum": "Intraday Momentum — buy top N by last K minutes return",
    "mean_reversion": "Mean Reversion — buy when price deviates below MA",
    "breakout": "Breakout — buy when price breaks above N-minute high",
}


class EventDrivenBacktester:
    """Event-driven backtester for minute-level data.

    Config keys:
        strategy: "intraday_momentum" | "mean_reversion" | "breakout"
        start_date, end_date: str
        freq: "5" (default)
        top_n: int (for momentum)
        lookback: int (minutes, default 20)
        hold_period: int (minutes, default 10)
        stop_loss: float (e.g., -0.02)
        take_profit: float (e.g., 0.03)
        max_positions: int (default 5)
        position_size: float (fraction of capital per trade, default 0.2)
        transaction_cost: float (default 0.0003)
        slippage: float (default 0.001)
        initial_capital: float
        force_close_eod: bool (default True)
    """

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
        cost = config.get("transaction_cost", 0.0003)
        slippage = config.get("slippage", 0.001)
        initial_capital = config.get("initial_capital", 1_000_000)
        force_close_eod = config.get("force_close_eod", True)
        top_n = config.get("top_n", 10)

        # Load minute data
        result = await self.db.execute(
            select(MinuteQuote)
            .where(MinuteQuote.freq == freq)
            .where(MinuteQuote.trade_date >= start)
            .where(MinuteQuote.trade_date <= end)
            .order_by(MinuteQuote.stock_code, MinuteQuote.trade_time)
            .limit(200000)
        )
        rows = result.scalars().all()
        if not rows:
            return {"error": "No minute data available. Sync minute data first.", "daily": [], "summary": {}}

        df = pd.DataFrame([{
            "code": r.stock_code, "time": r.trade_time, "date": r.trade_date,
            "open": r.open, "high": r.high, "low": r.low, "close": r.close,
            "volume": r.volume or 0, "amount": r.amount or 0,
        } for r in rows])
        df = df.sort_values(["code", "time"]).reset_index(drop=True)

        codes = df["code"].unique().tolist()
        if len(codes) < 3:
            return {"error": f"Need at least 3 stocks, got {len(codes)}", "daily": [], "summary": {}}

        # Build time index
        all_times = sorted(df["time"].unique())
        all_times = all_times[lookback:]  # Skip warmup

        # Run event-driven loop
        capital = initial_capital
        positions: dict[str, dict] = {}  # code -> {shares, entry_price, entry_time}
        daily_values = []
        daily_returns = []

        prev_time = None
        for t_idx, current_time in enumerate(all_times):
            if isinstance(current_time, pd.Timestamp):
                current_date = current_time.date()
            elif hasattr(current_time, "date"):
                current_date = current_time.date() if callable(current_time.date) else current_time.date
            else:
                current_date = current_time.date() if hasattr(current_time, "date") else None

            # Check stop-loss / take-profit for existing positions
            closed = []
            for code, pos in list(positions.items()):
                bar = df[(df["code"] == code) & (df["time"] == current_time)]
                if bar.empty:
                    continue
                px = float(bar.iloc[0]["close"])
                ret = (px - pos["entry_price"]) / pos["entry_price"]
                hold_minutes = (current_time - pos["entry_time"]).total_seconds() / 60
                if ret <= stop_loss or ret >= take_profit or hold_minutes >= hold_period:
                    exit_px = px * (1 - slippage)
                    capital += pos["shares"] * exit_px * (1 - cost)
                    closed.append(code)

            for code in closed:
                del positions[code]

            # Force close at EOD
            if force_close_eod and prev_time:
                prev_date = prev_time.date() if hasattr(prev_time, "date") and callable(prev_time.date) else prev_time.date() if hasattr(prev_time, "date") else None
                if current_date != prev_date:
                    for code, pos in list(positions.items()):
                        bar = df[(df["code"] == code) & (df["time"] == prev_time)]
                        if not bar.empty:
                            px = float(bar.iloc[0]["close"])
                            capital += pos["shares"] * px * (1 - slippage) * (1 - cost)
                    positions.clear()

            # Generate signals
            if len(positions) < max_positions:
                signals = self._generate_signals(df, codes, current_time, strategy, lookback, top_n)
                for code, score in signals[:max_positions - len(positions)]:
                    bar = df[(df["code"] == code) & (df["time"] == current_time)]
                    if bar.empty:
                        continue
                    px = float(bar.iloc[0]["close"])
                    entry_px = px * (1 + slippage)
                    trade_capital = capital * position_size
                    shares = trade_capital / entry_px  # Fractional shares
                    if shares > 0 and trade_capital < capital * 0.95:
                        capital -= shares * entry_px  # Deduct purchase cost
                        capital -= shares * entry_px * cost  # Transaction cost
                        positions[code] = {"shares": shares, "entry_price": entry_px, "entry_time": current_time}

            # Mark to market
            total_value = capital
            for code, pos in positions.items():
                bar = df[(df["code"] == code) & (df["time"] == current_time)]
                if not bar.empty:
                    total_value += pos["shares"] * float(bar.iloc[0]["close"])

            daily_values.append(total_value)
            if len(daily_values) >= 2 and daily_values[-2] > 0:
                daily_returns.append(total_value / daily_values[-2] - 1)
            else:
                daily_returns.append(0.0)

            prev_time = current_time

        # Compute summary
        ret_arr = np.array(daily_returns)
        val_arr = np.array(daily_values)
        summary = compute_all_metrics(ret_arr, val_arr)

        # Build daily output (aggregate to daily for display)
        daily_out = []
        sampled = all_times[::max(1, len(all_times) // 500)]
        for i, t in enumerate(sampled):
            idx = all_times.index(t)
            daily_out.append({
                "trade_date": t,
                "portfolio_value": round(daily_values[idx], 2) if idx < len(daily_values) else initial_capital,
                "benchmark_value": initial_capital,
                "cash": capital,
                "daily_return": round(daily_returns[idx], 6) if idx < len(daily_returns) else 0,
                "benchmark_return": 0,
                "turnover": 0,
                "positions_json": str(len(positions)),
            })

        return {"daily": daily_out, "summary": summary}

    def _generate_signals(
        self, df: pd.DataFrame, codes: list[str], current_time,
        strategy: str, lookback: int, top_n: int,
    ) -> list[tuple[str, float]]:
        signals = []
        for code in codes:
            code_df = df[df["code"] == code]
            if len(code_df) < lookback + 1:
                continue
            current_idx = code_df[code_df["time"] == current_time].index
            if current_idx.empty:
                continue
            idx = current_idx[0]
            start_idx = max(0, idx - lookback)
            window = code_df.iloc[start_idx:idx + 1]
            if len(window) < lookback:
                continue

            if strategy == "intraday_momentum":
                ret = (float(window.iloc[-1]["close"]) / float(window.iloc[0]["open"]) - 1) if window.iloc[0]["open"] > 0 else 0
                signals.append((code, ret))
            elif strategy == "mean_reversion":
                ma = float(window["close"].mean())
                px = float(window.iloc[-1]["close"])
                dev = (ma - px) / ma if ma > 0 else 0  # Positive = below MA (buy signal)
                signals.append((code, dev))
            elif strategy == "breakout":
                high_n = float(window["high"].iloc[:-1].max())
                px = float(window.iloc[-1]["close"])
                brk = (px - high_n) / high_n if high_n > 0 else -1
                signals.append((code, brk))

        signals.sort(key=lambda x: x[1], reverse=True)
        return signals[:top_n]
