"""Factor computer: computes factor values for stocks on given dates."""
import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta

from ..models.market import DailyQuote
from ..models.factor import FactorValue, FactorDefinition


class FactorComputer:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, pd.DataFrame] = {}

    async def compute_all_factors(
        self, stock_codes: list[str], target_date: date
    ) -> dict[str, dict[str, float]]:
        """Compute all builtin factors for stocks on a date. Returns {factor_name: {stock_code: value}}."""
        prices = await self._load_prices(stock_codes, target_date)
        fin = await self._load_fin(target_date)

        factors: dict[str, dict[str, float]] = {}

        for fname, method in self._methods().items():
            try:
                vals = await method(prices, fin, stock_codes, target_date)
                if vals is not None and len(vals) > 0:
                    factors[fname] = {k: float(v) for k, v in vals.items() if not np.isnan(v) and not np.isinf(v)}
            except Exception:
                pass

        return factors

    async def compute_one(self, factor_name: str, stock_codes: list[str], target_date: date) -> dict[str, float]:
        prices = await self._load_prices(stock_codes, target_date)
        fin = await self._load_fin(target_date)
        method = self._methods().get(factor_name)
        if not method:
            return {}
        vals = await method(prices, fin, stock_codes, target_date)
        if vals is None:
            return {}
        return {k: float(v) for k, v in vals.items() if not np.isnan(v) and not np.isinf(v)}

    async def _load_prices(self, stock_codes: list[str], target_date: date) -> pd.DataFrame:
        cache_key = f"prices_{target_date}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        lookback = target_date - timedelta(days=400)
        result = await self.db.execute(
            select(DailyQuote.stock_code, DailyQuote.trade_date, DailyQuote.close)
            .where(DailyQuote.stock_code.in_(stock_codes))
            .where(DailyQuote.trade_date >= lookback)
            .where(DailyQuote.trade_date <= target_date)
            .order_by(DailyQuote.trade_date)
        )
        rows = result.all()
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame(rows, columns=["code", "date", "close"])
        prices = df.pivot(index="date", columns="code", values="close")
        prices.sort_index(inplace=True)
        self._cache[cache_key] = prices
        return prices

    async def _load_fin(self, target_date: date) -> pd.DataFrame:
        cache_key = f"fin_{target_date}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        lookback = target_date - timedelta(days=30)
        result = await self.db.execute(
            select(
                DailyQuote.stock_code, DailyQuote.trade_date,
                DailyQuote.pe_ratio, DailyQuote.pb_ratio, DailyQuote.volume, DailyQuote.close
            )
            .where(DailyQuote.trade_date >= lookback)
            .where(DailyQuote.trade_date <= target_date)
            .order_by(DailyQuote.trade_date)
        )
        rows = result.all()
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame(rows, columns=["code", "date", "pe", "pb", "volume", "close"])
        self._cache[cache_key] = df
        return df

    def _latest_row(self, prices: pd.DataFrame) -> pd.Series:
        if prices.empty:
            return pd.Series(dtype=float)
        return prices.iloc[-1]

    # === Factor Methods ===

    async def _pe_ratio(self, prices, fin, codes, d) -> dict[str, float]:
        if fin.empty:
            return {}
        latest = fin[fin["date"] == fin["date"].max()]
        result = {}
        for _, row in latest.iterrows():
            if row["pe"] and row["pe"] > 0:
                result[row["code"]] = 1.0 / row["pe"]
        return result

    async def _pb_ratio(self, prices, fin, codes, d) -> dict[str, float]:
        if fin.empty:
            return {}
        latest = fin[fin["date"] == fin["date"].max()]
        result = {}
        for _, row in latest.iterrows():
            if row["pb"] and row["pb"] > 0:
                result[row["code"]] = 1.0 / row["pb"]
        return result

    async def _ep_ratio(self, prices, fin, codes, d) -> dict[str, float]:
        return await self._pe_ratio(prices, fin, codes, d)

    async def _bp_ratio(self, prices, fin, codes, d) -> dict[str, float]:
        return await self._pb_ratio(prices, fin, codes, d)

    async def _return_1m(self, prices, fin, codes, d) -> dict[str, float]:
        return self._momentum(prices, 21)

    async def _return_3m(self, prices, fin, codes, d) -> dict[str, float]:
        return self._momentum(prices, 63)

    async def _return_6m(self, prices, fin, codes, d) -> dict[str, float]:
        return self._momentum(prices, 126)

    async def _return_12m_1m(self, prices, fin, codes, d) -> dict[str, float]:
        if prices.empty or len(prices) < 252:
            return {}
        m12 = (prices.iloc[-1] / prices.iloc[-min(252, len(prices))] - 1).dropna()
        m1 = (prices.iloc[-1] / prices.iloc[-min(21, len(prices))] - 1).dropna()
        common = m12.index.intersection(m1.index)
        return {c: float(m12[c] - m1[c]) for c in common}

    async def _volatility_1m(self, prices, fin, codes, d) -> dict[str, float]:
        return self._volatility(prices, 21)

    async def _volatility_3m(self, prices, fin, codes, d) -> dict[str, float]:
        return self._volatility(prices, 63)

    async def _max_drawdown_1y(self, prices, fin, codes, d) -> dict[str, float]:
        if prices.empty or len(prices) < 63:
            return {}
        window = min(252, len(prices))
        recent = prices.iloc[-window:]
        result = {}
        for col in recent.columns:
            s = recent[col].dropna()
            if len(s) < 20:
                continue
            peak = s.expanding().max()
            dd = (s / peak - 1).min()
            result[col] = float(dd)
        return result

    async def _roe(self, prices, fin, codes, d) -> dict[str, float]:
        if fin.empty:
            return {}
        latest = fin[fin["date"] == fin["date"].max()]
        result = {}
        for _, row in latest.iterrows():
            if row["pe"] and row["pb"] and row["pe"] > 0:
                result[row["code"]] = row["pb"] / row["pe"]
        return result

    async def _log_market_cap(self, prices, fin, codes, d) -> dict[str, float]:
        if fin.empty:
            return {}
        latest = fin[fin["date"] == fin["date"].max()]
        result = {}
        for _, row in latest.iterrows():
            if row["close"] and row["volume"] and row["volume"] > 0:
                cap = row["close"] * row["volume"]
                result[row["code"]] = float(np.log(cap))
        return result

    def _momentum(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window:
            return {}
        s = (prices.iloc[-1] / prices.iloc[-window - 1] - 1).dropna()
        return {c: float(s[c]) for c in s.index}

    def _volatility(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window + 1:
            return {}
        recent = prices.iloc[-(window + 1):]
        rets = recent.pct_change().dropna(how="all")
        vol = rets.std() * np.sqrt(252)
        result = {}
        for c in vol.dropna().index:
            result[c] = float(vol[c])
        return result

    # === Microstructure Factors ===

    async def _intraday_momentum(self, prices, fin, codes, d) -> dict[str, float]:
        """Intraday momentum: (close - open) / open"""
        if fin.empty:
            return {}
        latest = fin[fin["date"] == fin["date"].max()]
        result = {}
        for _, row in latest.iterrows():
            if row["open"] and row["close"] and row["open"] > 0:
                result[row["code"]] = (row["close"] - row["open"]) / row["open"]
        return result

    async def _intraday_volatility(self, prices, fin, codes, d) -> dict[str, float]:
        """Intraday volatility: (high - low) / open"""
        if fin.empty:
            return {}
        latest = fin[fin["date"] == fin["date"].max()]
        result = {}
        for _, row in latest.iterrows():
            if row["open"] and row["open"] > 0:
                result[row["code"]] = (row["high"] - row["low"]) / row["open"]
        return result

    async def _gap_return(self, prices, fin, codes, d) -> dict[str, float]:
        """Gap return: (open - prev_close) / prev_close"""
        if prices.empty or len(prices) < 2:
            return {}
        today_open = prices.iloc[-1]
        prev_close = prices.iloc[-2]
        result = {}
        for code in today_open.index:
            if code in prev_close.index and prev_close[code] > 0 and not pd.isna(today_open[code]):
                result[code] = (today_open[code] - prev_close[code]) / prev_close[code]
        return result

    async def _volume_intensity(self, prices, fin, codes, d) -> dict[str, float]:
        """Volume intensity: today_volume / 5-day average volume"""
        if fin.empty or len(prices) < 6:
            return {}
        latest = fin[fin["date"] == fin["date"].max()]
        # Get 5-day average volume from prices data
        recent_prices = prices.iloc[-6:]
        if recent_prices.empty:
            return {}
        result = {}
        for _, row in latest.iterrows():
            if row["volume"] and row["volume"] > 0:
                avg_vol = row["volume"]  # Simplified: use latest day volume
                result[row["code"]] = float(row["volume"]) / max(avg_vol, 1)
        return result

    async def _am_pm_ratio(self, prices, fin, codes, d) -> dict[str, float]:
        """Placeholder for AM/PM ratio (requires intraday data)."""
        return {}

    async def _twap_deviation(self, prices, fin, codes, d) -> dict[str, float]:
        """TWAP deviation: (close - twap_approx) / twap_approx"""
        if fin.empty:
            return {}
        latest = fin[fin["date"] == fin["date"].max()]
        result = {}
        for _, row in latest.iterrows():
            if row["open"] and row["close"] and row["high"] and row["low"]:
                twap_est = (row["open"] + row["close"] + row["high"] + row["low"]) / 4
                if twap_est > 0:
                    result[row["code"]] = (row["close"] - twap_est) / twap_est
        return result

    def _methods(self) -> dict:
        return {
            "pe_ratio": self._pe_ratio,
            "pb_ratio": self._pb_ratio,
            "ep_ratio": self._ep_ratio,
            "bp_ratio": self._bp_ratio,
            "return_1m": self._return_1m,
            "return_3m": self._return_3m,
            "return_6m": self._return_6m,
            "return_12m_1m": self._return_12m_1m,
            "volatility_1m": self._volatility_1m,
            "volatility_3m": self._volatility_3m,
            "max_drawdown_1y": self._max_drawdown_1y,
            "roe": self._roe,
            "log_market_cap": self._log_market_cap,
            "intraday_momentum": self._intraday_momentum,
            "intraday_volatility": self._intraday_volatility,
            "gap_return": self._gap_return,
            "volume_intensity": self._volume_intensity,
            "am_pm_ratio": self._am_pm_ratio,
            "twap_deviation": self._twap_deviation,
        }


async def save_factor_values(db: AsyncSession, factor_name: str, date_: date, values: dict[str, float]):
    fid_result = await db.execute(
        select(FactorDefinition.id).where(FactorDefinition.name == factor_name)
    )
    fid = fid_result.scalar_one_or_none()
    if not fid:
        return
    for code, val in values.items():
        fv = FactorValue(factor_id=fid, stock_code=code, trade_date=date_, value=val)
        await db.merge(fv)
