from datetime import date, timedelta
import pandas as pd
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.market import DailyQuote, Stock


async def load_price_matrix(
    db: AsyncSession,
    stock_codes: list[str],
    start_date: date,
    end_date: date,
) -> pd.DataFrame:
    """Load close prices into a stocks×dates DataFrame."""
    padded_start = start_date - timedelta(days=365)
    result = await db.execute(
        select(DailyQuote.stock_code, DailyQuote.trade_date, DailyQuote.close)
        .where(DailyQuote.stock_code.in_(stock_codes))
        .where(DailyQuote.trade_date >= padded_start)
        .where(DailyQuote.trade_date <= end_date)
        .order_by(DailyQuote.trade_date)
    )
    rows = result.all()
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows, columns=["stock_code", "trade_date", "close"])
    prices = df.pivot(index="trade_date", columns="stock_code", values="close")
    prices.sort_index(inplace=True)
    return prices


def compute_returns(prices: pd.DataFrame, periods: list[int] = [1, 5, 21, 63, 126, 252]) -> dict[int, pd.DataFrame]:
    """Compute forward returns for different horizons."""
    returns = {}
    for p in periods:
        fwd = prices.shift(-p) / prices - 1
        returns[p] = fwd
    return returns


def compute_backward_returns(prices: pd.DataFrame, window: int) -> pd.DataFrame:
    """Backward return over `window` trading days."""
    return prices / prices.shift(window) - 1


async def load_financial_data(
    db: AsyncSession,
    stock_codes: list[str],
    fields: list[str],
) -> pd.DataFrame:
    """Load PE/PB from daily_quotes table."""
    padded_start = date.today() - timedelta(days=365)
    result = await db.execute(
        select(
            DailyQuote.stock_code, DailyQuote.trade_date,
            DailyQuote.pe_ratio, DailyQuote.pb_ratio, DailyQuote.volume, DailyQuote.close
        )
        .where(DailyQuote.stock_code.in_(stock_codes))
        .where(DailyQuote.trade_date >= padded_start)
        .order_by(DailyQuote.trade_date)
    )
    rows = result.all()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["stock_code", "trade_date", "pe_ratio", "pb_ratio", "volume", "close"])
    return df


def resample_ohlc(daily_df: pd.DataFrame, freq: str) -> pd.DataFrame:
    """Resample daily OHLC to weekly ('W') or monthly ('M').

    Args:
        daily_df: DataFrame with columns [date, open, high, low, close, volume] indexed by date
        freq: 'W' for weekly, 'M' for monthly

    Returns:
        DataFrame with aggregated OHLCV + pre_close, change_pct
    """
    if daily_df.empty:
        return daily_df
    df = daily_df.copy()
    df.index = pd.to_datetime(df.index)

    agg = df.resample(freq).agg({
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum",
    })
    if "amount" in df.columns:
        agg["amount"] = df["amount"].resample(freq).sum()
    agg["pre_close"] = agg["close"].shift(1)
    agg["change_pct"] = (agg["close"] / agg["pre_close"] - 1) * 100
    agg = agg.dropna(subset=["open"])
    agg.index = agg.index.date
    return agg


async def load_universe(db: AsyncSession, board: str | None = None) -> list[str]:
    """Get list of stock codes, optionally filtered by board."""
    q = select(Stock.code)
    if board:
        q = q.where(Stock.exchange == board)
    result = await db.execute(q)
    return [r[0] for r in result.all()]
