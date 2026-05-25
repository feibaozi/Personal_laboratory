import logging
import math
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from ..models.market import (
    Stock, DailyQuote, MinuteQuote, IndexDaily, SectorDaily,
    NorthBoundFlow, MarketBreadth, TradingCalendar, SyncLog
)
from ..utils.date_utils import CST
from .data_sources.akshare_source import AkShareSource
from .data_sources.baostock_source import BaoStockSource

logger = logging.getLogger(__name__)

BATCH_SIZE = 500  # Safe under SQLite 999 param limit (500 rows × ~10 cols = ~5,000 params)


async def _bulk_upsert(db: AsyncSession, model, rows: list[dict], unique_cols: list[str]):
    """Batched upsert to avoid SQLite parameter limit."""
    if not rows:
        return
    update_cols = [k for k in rows[0].keys() if k not in unique_cols]
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        base = sqlite_insert(model).values(batch)
        stmt = base.on_conflict_do_update(
            index_elements=unique_cols,
            set_={c: getattr(base.excluded, c) for c in update_cols},
        )
        await db.execute(stmt)

INDEX_MAP = {
    "000001": "上证指数", "399001": "深证成指", "399006": "创业板指",
    "000688": "科创50", "000300": "沪深300", "000905": "中证500",
}


class SyncManager:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.ak = AkShareSource()
        self.bs = BaoStockSource()

    async def sync_selected(self, data_types: list[str] | None, start_date: str | None = None, end_date: str | None = None):
        if start_date is None:
            start_date = (date.today() - timedelta(days=365 * 5)).isoformat()
        if end_date is None:
            end_date = date.today().isoformat()

        all_methods = {
            "stock_list": ("stock_list", self.sync_stock_list),
            "daily_quotes": ("daily_quotes", lambda: self.sync_daily_quotes(start_date, end_date)),
            "indices": ("indices", lambda: self.sync_index_daily(start_date, end_date)),
            "sectors": ("sectors", self.sync_sector_daily),
            "north_bound": ("north_bound", lambda: self.sync_north_bound(start_date, end_date)),
            "market_breadth": ("market_breadth", lambda: self.sync_market_breadth(start_date, end_date)),
        }

        selected = data_types if data_types else list(all_methods.keys())
        results = []
        for key in selected:
            if key not in all_methods:
                continue
            name, method = all_methods[key]
            try:
                count = await method()
                await self._log_sync(name, "success", count)
                results.append({"type": name, "status": "success", "count": count})
            except Exception as e:
                logger.exception(f"Sync {name} failed")
                await self._log_sync(name, "error", 0, str(e))
                results.append({"type": name, "status": "error", "error": str(e)})

        await self.db.commit()
        return results

    async def sync_stock_list(self) -> int:
        # Try AkShare first (more complete), fallback to BaoStock
        df = await self.ak.fetch_stock_list()
        if df is None or df.empty:
            logger.info("AkShare stock list empty, falling back to BaoStock")
            df = await self.bs.fetch_stock_list()

        if df is None or df.empty:
            return 0

        for _, row in df.iterrows():
            s = Stock(
                code=str(row["code"]).zfill(6),
                name=str(row.get("name", row.get("code_name", ""))),
                exchange=row.get("exchange"),
                list_date=row.get("list_date") if row.get("list_date") else None,
            )
            await self.db.merge(s)
        return len(df)

    async def sync_daily_quotes(self, start_date: str, end_date: str) -> int:
        sd = date.fromisoformat(start_date)
        ed = date.fromisoformat(end_date)
        result = await self.db.execute(select(Stock.code))
        all_codes = [r[0] for r in result.all()]

        total = 0
        for i, code in enumerate(all_codes):
            df = await self._fetch_with_fallback(code, sd, ed)
            if df is None or df.empty:
                continue
            for _, row in df.iterrows():
                dq = DailyQuote(
                    stock_code=code,
                    trade_date=row["date"] if isinstance(row["date"], date) else date.fromisoformat(str(row["date"])),
                    open=float(row["open"]) if not pd_isna(row["open"]) else None,
                    high=float(row["high"]) if not pd_isna(row["high"]) else None,
                    low=float(row["low"]) if not pd_isna(row["low"]) else None,
                    close=float(row["close"]) if not pd_isna(row["close"]) else None,
                    pre_close=float(row["pre_close"]) if "pre_close" in row and not pd_isna(row["pre_close"]) else None,
                    volume=int(row["volume"]) if not pd_isna(row["volume"]) else 0,
                    amount=float(row["amount"]) if not pd_isna(row["amount"]) else None,
                    turnover_rate=float(row["turnover_rate"]) if "turnover_rate" in row and not pd_isna(row["turnover_rate"]) else None,
                    change_pct=float(row["change_pct"]) if "change_pct" in row and not pd_isna(row["change_pct"]) else None,
                    pe_ratio=float(row["pe_ratio"]) if "pe_ratio" in row and not pd_isna(row["pe_ratio"]) else None,
                    pb_ratio=float(row["pb_ratio"]) if "pb_ratio" in row and not pd_isna(row["pb_ratio"]) else None,
                )
                await self.db.merge(dq)
            total += len(df)
            if (i + 1) % 50 == 0:
                await self.db.commit()
                logger.info(f"Synced {i+1}/{min(len(all_codes), 300)} stocks")
        await self.db.commit()
        return total

    async def _fetch_with_fallback(self, code: str, sd: date, ed: date):
        # Try BaoStock first (more reliable), fallback to AkShare
        df = await self.bs.fetch_daily_quotes(code, sd, ed)
        if df is not None and not df.empty:
            return df
        logger.info(f"BaoStock fallback to AkShare for {code}")
        return await self.ak.fetch_daily_quotes(code, sd, ed)

    async def sync_index_daily(self, start_date: str, end_date: str) -> int:
        sd = date.fromisoformat(start_date)
        ed = date.fromisoformat(end_date)
        total = 0
        for code, name in INDEX_MAP.items():
            df = await self.ak.fetch_index_daily(code, sd, ed)
            if df is None or df.empty:
                df = await self.bs.fetch_index_daily(code, sd, ed)
            if df is None or df.empty:
                continue
            rows = []
            for _, row in df.iterrows():
                rows.append({
                    "index_code": code, "index_name": name,
                    "trade_date": row["date"] if isinstance(row["date"], date) else date.fromisoformat(str(row["date"])),
                    "open": _safe_val(row["open"]), "high": _safe_val(row["high"]),
                    "low": _safe_val(row["low"]), "close": _safe_val(row["close"]),
                    "volume": int(row["volume"]) if not pd_isna(row.get("volume")) else 0,
                })
            await _bulk_upsert(self.db, IndexDaily, rows, ["index_code", "trade_date"])
            total += len(rows)
        await self.db.commit()
        return total

    async def sync_sector_daily(self) -> int:
        df = await self.ak.fetch_sector_data()
        if df is None or df.empty:
            return 0
        today = date.today()
        count = 0
        for _, row in df.iterrows():
            sd = SectorDaily(
                trade_date=today,
                sector_code=str(row.get("板块代码", "")),
                sector_name=str(row.get("板块名称", "")),
                change_pct=float(row.get("涨跌幅", 0)),
            )
            self.db.add(sd)
            count += 1
        return count

    async def sync_north_bound(self, start_date: str, end_date: str) -> int:
        sd = date.fromisoformat(start_date)
        ed = date.fromisoformat(end_date)
        df = await self.ak.fetch_north_bound(sd, ed)
        if df is None or df.empty:
            return 0
        count = 0
        for _, row in df.iterrows():
            try:
                d = date.fromisoformat(str(row["日期"]))
                nbf = NorthBoundFlow(trade_date=d, net_flow_total=float(row.get("当日成交净买入", 0)))
                await self.db.merge(nbf)
                count += 1
            except Exception:
                pass
        return count

    async def sync_minute_quotes(self, code: str, start_date: str, end_date: str, freq: str = "5") -> int:
        from datetime import date as dt
        sd = dt.fromisoformat(start_date)
        ed = dt.fromisoformat(end_date)
        df = await self.ak.fetch_minute_quotes(code, sd, ed, freq)
        if df is None or df.empty:
            return 0
        # Validate data quality
        bad_open = (df["open"].fillna(0) <= 0).sum()
        bad_close = (df["close"].fillna(0) <= 0).sum()
        if bad_open > len(df) * 0.3 or bad_close > len(df) * 0.3:
            logger.warning(f"Rejecting bad minute data for {code} freq={freq}: {bad_open}/{len(df)} bars with open<=0")
            return 0
        # Validate date coverage: real minute sources have limited history
        actual_days = df["trade_date"].nunique()
        # 1-min sources typically only have ~10-15 days real data
        min_accept = 5 if freq == "1" else 10
        if actual_days < min_accept:
            logger.warning(f"Insufficient coverage for {code} freq={freq}: got {actual_days} days, expected ~{expected_days}")
            return 0
        rows = []
        for _, row in df.iterrows():
            rows.append({
                "stock_code": code,
                "trade_time": row["trade_time"].to_pydatetime() if hasattr(row["trade_time"], "to_pydatetime") else row["trade_time"],
                "trade_date": row["trade_date"],
                "freq": freq,
                "open": _safe_val(row["open"]),
                "high": _safe_val(row["high"]),
                "low": _safe_val(row["low"]),
                "close": _safe_val(row["close"]),
                "volume": int(row["volume"]) if not pd_isna(row["volume"]) else 0,
                "amount": _safe_val(row["amount"]),
                "source": "real",
            })
        await _bulk_upsert(self.db, MinuteQuote, rows, ["stock_code", "trade_time", "freq"])
        await self.db.commit()
        return len(rows)

    async def generate_synthetic_minute(self, code: str, start_date: str, end_date: str, freq: str = "5") -> int:
        """Generate synthetic minute bars from daily data. Uses bulk upsert."""
        from datetime import date as dt, datetime, timedelta
        import numpy as np

        sd = dt.fromisoformat(start_date)
        ed = dt.fromisoformat(end_date)
        result = await self.db.execute(
            select(DailyQuote).where(DailyQuote.stock_code == code)
            .where(DailyQuote.trade_date >= sd).where(DailyQuote.trade_date <= ed)
            .order_by(DailyQuote.trade_date)
        )
        dqs = result.scalars().all()
        if not dqs:
            return 0

        freq_min = int(freq)
        rows = []
        for dq in dqs:
            n_bars = 240 // freq_min
            o = dq.open if dq.open and dq.open > 0 else 10.0
            h = dq.high if dq.high and dq.high > 0 else o * 1.05
            l = dq.low if dq.low and dq.low > 0 else o * 0.95
            c = dq.close if dq.close and dq.close > 0 else o
            vol = (dq.volume or 1000000) // max(n_bars, 1)
            base_time = datetime.combine(dq.trade_date, datetime.strptime("09:30", "%H:%M").time())
            prices = self._brownian_bridge(o, c, h, l, n_bars)
            market_close = datetime.strptime("15:00", "%H:%M").time()

            for i in range(n_bars):
                t = base_time + timedelta(minutes=freq_min * i)
                if t.time() > market_close:
                    break
                rows.append({
                    "stock_code": code,
                    "trade_time": t,
                    "trade_date": dq.trade_date,
                    "freq": freq,
                    "open": prices[i][0], "high": prices[i][1],
                    "low": prices[i][2], "close": prices[i][3],
                    "volume": vol, "amount": vol * prices[i][3] if prices[i][3] > 0 else 0,
                    "source": "synthetic",
                })

        if rows:
            await _bulk_upsert(self.db, MinuteQuote, rows, ["stock_code", "trade_time", "freq"])
        await self.db.commit()
        return len(rows)

    def _brownian_bridge(self, open_p, close_p, high_p, low_p, n):
        """Generate n OHLC bars with realistic intraday price movement."""
        import numpy as np
        np.random.seed(abs(hash((open_p, close_p))) % 2**31)
        ret = (close_p / open_p - 1) if open_p > 0 else 0
        drift = ret / n
        # Very small per-bar volatility: daily range / (3 * sqrt(bars)) scaled down
        daily_range_pct = (high_p - low_p) / open_p if open_p > 0 else 0.02
        bar_vol = daily_range_pct / (4 * np.sqrt(n))
        bars = []
        cur = open_p
        for i in range(n):
            bar_ret = np.random.normal(drift, max(bar_vol, 0.0001))
            bar_close = cur * (1 + bar_ret)
            bar_open = cur
            wick = abs(bar_close - bar_open) * np.random.uniform(0.1, 0.5)
            bar_high = max(bar_open, bar_close) + wick
            bar_low = min(bar_open, bar_close) - wick
            bars.append((bar_open, bar_high, bar_low, bar_close))
            cur = bar_close
        return bars

    async def sync_market_breadth(self, start_date: str, end_date: str) -> int:
        return 0

    async def _log_sync(self, data_type: str, status: str, count: int, error: str = ""):
        log = SyncLog(data_type=data_type, last_sync=datetime.now(CST),
                       status=status, record_count=count, error_message=error[:500] if error else None)
        self.db.add(log)


def _safe_val(v):
    """Clean NaN/Inf to None for DB insert."""
    if v is None:
        return None
    try:
        if math.isnan(v) or math.isinf(v):
            return None
    except (TypeError, ValueError):
        pass
    return float(v) if isinstance(v, (int, float)) else v


def pd_isna(val) -> bool:
    """Check if a value is NaN/None."""
    import pandas as pd
    import numpy as np
    if val is None:
        return True
    try:
        return pd.isna(val) or np.isnan(val)
    except (TypeError, ValueError):
        return False
