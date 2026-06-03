import numpy as np
import pandas as pd
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.market import DailyQuote

WINDOWS = [5, 10, 20, 30, 60]


class TechnicalFactorComputer:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._price_cache: dict[str, pd.DataFrame] = {}
        self._quote_cache: dict[str, pd.DataFrame] = {}

    async def compute(self, factor_name: str, stock_codes: list[str],
                      target_date: date, params: dict) -> dict[str, float]:
        prices, quote_df = await self._load_data(stock_codes, target_date)
        if prices.empty:
            return {}

        window = params.get("window", 0)

        prefix = factor_name.split("_")[0]

        if prefix == "k":
            return self._k_line(factor_name, quote_df)
        elif prefix == "roc":
            return self._roc(prices, window)
        elif prefix == "ma":
            return self._ma(prices, window)
        elif prefix == "std":
            return self._std(prices, window)
        elif prefix == "max":
            return self._max(prices, window)
        elif prefix == "min":
            return self._min(prices, window)
        elif prefix == "corr":
            return self._corr(prices, quote_df, window)
        elif prefix == "cord":
            return self._cord(prices, quote_df, window)
        elif prefix == "sump":
            return self._sump(prices, window)
        elif prefix == "sumn":
            return self._sumn(prices, window)
        elif prefix == "sumd":
            return self._sumd(prices, window)
        elif prefix == "rsv":
            return self._rsv(prices, window)
        elif prefix == "cntp":
            return self._cntp(prices, window)
        elif prefix == "cntd":
            return self._cntd(prices, window)
        elif prefix == "vma":
            return self._vma(quote_df, window)
        elif prefix == "vstd":
            return self._vstd(quote_df, window)
        elif prefix == "wvma":
            return self._wvma(prices, quote_df, window)
        elif prefix == "beta":
            return self._beta(prices, window)
        elif prefix == "rsqr":
            return self._rsqr(prices, window)
        elif prefix == "resi":
            return self._resi(prices, window)
        elif prefix == "imax":
            return self._imax(prices, window)
        elif prefix == "imin":
            return self._imin(prices, window)
        elif prefix == "imxd":
            return self._imxd(prices, window)
        else:
            return {}

    async def _load_data(self, stock_codes: list[str], target_date: date
                         ) -> tuple[pd.DataFrame, pd.DataFrame]:
        cache_key = f"tech_{target_date}"
        if cache_key in self._price_cache:
            return self._price_cache[cache_key], self._quote_cache.get(cache_key, pd.DataFrame())

        lookback = target_date - timedelta(days=400)
        result = await self.db.execute(
            select(DailyQuote.stock_code, DailyQuote.trade_date, DailyQuote.close,
                   DailyQuote.open, DailyQuote.high, DailyQuote.low,
                   DailyQuote.volume)
            .where(DailyQuote.stock_code.in_(stock_codes))
            .where(DailyQuote.trade_date >= lookback)
            .where(DailyQuote.trade_date <= target_date)
            .order_by(DailyQuote.trade_date)
        )
        rows = result.all()
        if not rows:
            return pd.DataFrame(), pd.DataFrame()

        cols = ["code", "date", "close", "open", "high", "low", "volume"]
        df = pd.DataFrame(rows, columns=cols)

        prices = df.pivot(index="date", columns="code", values="close")
        prices.sort_index(inplace=True)

        latest_per_code = df.sort_values("date").groupby("code").last().reset_index()
        quote_df = latest_per_code

        self._price_cache[cache_key] = prices
        self._quote_cache[cache_key] = quote_df
        return prices, quote_df

    def _k_line(self, factor_name: str, quote_df: pd.DataFrame) -> dict[str, float]:
        if quote_df.empty:
            return {}
        result = {}
        for _, row in quote_df.iterrows():
            code = row["code"]
            o = row.get("open")
            c = row.get("close")
            h = row.get("high")
            l = row.get("low")
            if not all(v is not None and not np.isnan(v) for v in [o, c, h, l]) or o <= 0:
                continue

            if factor_name == "k_mid":
                val = (c - o) / o
            elif factor_name == "k_len":
                val = (h - l) / o
            elif factor_name == "k_mid2":
                denom = (h - l) + 1e-12
                val = (c - o) / denom
            elif factor_name == "k_up":
                upper = max(o, c)
                val = (h - upper) / o
            elif factor_name == "k_up2":
                upper = max(o, c)
                denom = (h - l) + 1e-12
                val = (h - upper) / denom
            elif factor_name == "k_low":
                lower = min(o, c)
                val = (lower - l) / o
            elif factor_name == "k_low2":
                lower = min(o, c)
                denom = (h - l) + 1e-12
                val = (lower - l) / denom
            elif factor_name == "k_sft":
                val = (2 * c - h - l) / o
            elif factor_name == "k_sft2":
                denom = (h - l) + 1e-12
                val = (2 * c - h - l) / denom
            else:
                continue

            if not np.isnan(val) and not np.isinf(val):
                result[code] = float(val)
        return result

    def _roc(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window + 1:
            return {}
        result = {}
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window + 1:
                continue
            val = float(s.iloc[-1]) / float(s.iloc[-(window + 1)]) - 1
            if not np.isnan(val) and not np.isinf(val):
                result[col] = val
        return result

    def _ma(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window:
            return {}
        result = {}
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window:
                continue
            ma_val = float(s.iloc[-window:].mean())
            close_val = float(s.iloc[-1])
            if close_val > 0:
                val = ma_val / close_val
                if not np.isnan(val) and not np.isinf(val):
                    result[col] = val
        return result

    def _std(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window:
            return {}
        result = {}
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window:
                continue
            std_val = float(s.iloc[-window:].std(ddof=0))
            close_val = float(s.iloc[-1])
            if close_val > 0:
                val = std_val / close_val
                if not np.isnan(val) and not np.isinf(val):
                    result[col] = val
        return result

    def _max(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        return self._price_extreme(prices, window, "max")

    def _min(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        return self._price_extreme(prices, window, "min")

    def _price_extreme(self, prices: pd.DataFrame, window: int, extreme: str
                       ) -> dict[str, float]:
        if prices.empty or len(prices) < window:
            return {}
        result = {}
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window:
                continue
            if extreme == "max":
                ext_val = float(s.iloc[-window:].max())
            else:
                ext_val = float(s.iloc[-window:].min())
            close_val = float(s.iloc[-1])
            if close_val > 0:
                val = ext_val / close_val
                if not np.isnan(val) and not np.isinf(val):
                    result[col] = val
        return result

    def _corr(self, prices: pd.DataFrame, quote_df: pd.DataFrame, window: int
              ) -> dict[str, float]:
        if prices.empty or quote_df.empty or len(prices) < window:
            return {}
        result = {}
        for code in quote_df["code"]:
            if code not in prices.columns:
                continue
            s = prices[code].dropna()
            if len(s) < window:
                continue
            close_arr = s.iloc[-window:].values
            last_close = close_arr[-1]
            if last_close <= 0:
                continue
            vol_data = quote_df[quote_df["code"] == code]
            if vol_data.empty:
                continue
            last_vol = vol_data.iloc[0].get("volume", 0)
            if last_vol is None or last_vol <= 0:
                continue
            log_vol = np.log(float(last_vol) + 1)
            if len(close_arr) < 3:
                continue
            corr_val = float(np.corrcoef(close_arr, np.full_like(close_arr, log_vol))[0, 1])
            if not np.isnan(corr_val) and not np.isinf(corr_val):
                result[code] = corr_val
        return result

    def _cord(self, prices: pd.DataFrame, quote_df: pd.DataFrame, window: int
              ) -> dict[str, float]:
        if prices.empty or quote_df.empty or len(prices) < window + 1:
            return {}
        result = {}
        for code in quote_df["code"]:
            if code not in prices.columns:
                continue
            s = prices[code].dropna()
            if len(s) < window + 1:
                continue
            close_arr = s.iloc[-(window + 1):].values
            rets = close_arr[1:] / close_arr[:-1] - 1
            vol_data = quote_df[quote_df["code"] == code]
            if vol_data.empty:
                continue
            last_vol = vol_data.iloc[0].get("volume", 0)
            if last_vol is None or last_vol <= 0:
                continue
            ref_vol = vol_data.iloc[0].get("volume", 1)
            log_vol_ret = np.log(ref_vol / (last_vol + 1) + 1) if last_vol > 0 else 0
            if len(rets) < 3:
                continue
            corr_val = float(np.corrcoef(rets, np.full_like(rets, log_vol_ret))[0, 1])
            if not np.isnan(corr_val) and not np.isinf(corr_val):
                result[code] = corr_val
        return result

    def _sump(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        return self._rsi_component(prices, window, "up")

    def _sumn(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        return self._rsi_component(prices, window, "down")

    def _sumd(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window + 1:
            return {}
        up = self._rsi_component(prices, window, "up")
        down = self._rsi_component(prices, window, "down")
        result = {}
        for code in set(up.keys()) & set(down.keys()):
            result[code] = up[code] - down[code]
        return result

    def _rsi_component(self, prices: pd.DataFrame, window: int, direction: str
                       ) -> dict[str, float]:
        if prices.empty or len(prices) < window + 1:
            return {}
        result = {}
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window + 1:
                continue
            changes = s.iloc[-(window + 1):].diff().iloc[1:].values
            abs_total = float(np.abs(changes).sum()) + 1e-12
            if direction == "up":
                val = float(np.sum(changes[changes > 0])) / abs_total
            else:
                val = float(np.sum(np.abs(changes[changes < 0]))) / abs_total
            result[col] = val
        return result

    def _rsv(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window:
            return {}
        result = {}
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window:
                continue
            window_data = s.iloc[-window:]
            c = float(window_data.iloc[-1])
            h = float(window_data.max())
            l = float(window_data.min())
            denom = h - l + 1e-12
            val = (c - l) / denom
            if not np.isnan(val) and not np.isinf(val):
                result[col] = val
        return result

    def _cntp(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        return self._count_direction(prices, window, "up")

    def _cntd(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window + 1:
            return {}
        up = self._count_direction(prices, window, "up")
        down = self._count_direction(prices, window, "down")
        result = {}
        for code in set(up.keys()) & set(down.keys()):
            result[code] = up[code] - down[code]
        return result

    def _count_direction(self, prices: pd.DataFrame, window: int, direction: str
                         ) -> dict[str, float]:
        if prices.empty or len(prices) < window + 1:
            return {}
        result = {}
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window + 1:
                continue
            changes = s.iloc[-(window + 1):].diff().iloc[1:]
            if direction == "up":
                val = float((changes > 0).sum() / window)
            else:
                val = float((changes < 0).sum() / window)
            result[col] = val
        return result

    def _vma(self, quote_df: pd.DataFrame, window: int) -> dict[str, float]:
        if quote_df.empty:
            return {}
        result = {}
        for _, row in quote_df.iterrows():
            code = row["code"]
            vol = row.get("volume")
            if vol is None or vol <= 0:
                continue
            val = float(vol) / (float(vol) + 1e-12)
            result[code] = val
        return result

    def _vstd(self, quote_df: pd.DataFrame, window: int) -> dict[str, float]:
        return {}

    def _wvma(self, prices: pd.DataFrame, quote_df: pd.DataFrame, window: int
              ) -> dict[str, float]:
        return {}

    def _beta(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window + 1:
            return {}
        result = {}
        x = np.arange(window)
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window:
                continue
            y = s.iloc[-window:].values
            if len(y) < 2:
                continue
            slope = float(np.polyfit(x, y, 1)[0])
            close_val = float(s.iloc[-1])
            if close_val > 0:
                val = slope / close_val
                if not np.isnan(val) and not np.isinf(val):
                    result[col] = val
        return result

    def _rsqr(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window + 1:
            return {}
        result = {}
        x = np.arange(window)
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window:
                continue
            y = s.iloc[-window:].values
            if len(y) < 3:
                continue
            corr_mat = np.corrcoef(x, y)
            r = corr_mat[0, 1] if len(corr_mat) > 1 else 0
            val = float(r ** 2)
            if not np.isnan(val) and not np.isinf(val):
                result[col] = val
        return result

    def _resi(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window + 1:
            return {}
        result = {}
        x = np.arange(window)
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window:
                continue
            y = s.iloc[-window:].values
            if len(y) < 2:
                continue
            coeffs = np.polyfit(x, y, 1)
            pred = np.polyval(coeffs, x)
            resi_val = float(y[-1] - pred[-1])
            close_val = float(s.iloc[-1])
            if close_val > 0:
                val = resi_val / close_val
                if not np.isnan(val) and not np.isinf(val):
                    result[col] = val
        return result

    def _imax(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        return self._aroon_component(prices, window, "max")

    def _imin(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        return self._aroon_component(prices, window, "min")

    def _imxd(self, prices: pd.DataFrame, window: int) -> dict[str, float]:
        if prices.empty or len(prices) < window:
            return {}
        imax = self._aroon_component(prices, window, "max")
        imin = self._aroon_component(prices, window, "min")
        result = {}
        for code in set(imax.keys()) & set(imin.keys()):
            result[code] = imax[code] - imin[code]
        return result

    def _aroon_component(self, prices: pd.DataFrame, window: int, extreme: str
                         ) -> dict[str, float]:
        if prices.empty or len(prices) < window:
            return {}
        result = {}
        for col in prices.columns:
            s = prices[col].dropna()
            if len(s) < window:
                continue
            window_data = s.iloc[-window:].values
            if extreme == "max":
                idx = int(np.argmax(window_data))
            else:
                idx = int(np.argmin(window_data))
            val = (window - 1 - idx) / window
            result[col] = val
        return result