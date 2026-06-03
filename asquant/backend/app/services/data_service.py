import logging
import math
import asyncio
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from ..models.market import (
    Stock, DailyQuote, MinuteQuote, IndexDaily, SectorDaily,
    NorthBoundFlow, MarketBreadth, TradingCalendar, SyncLog, StockInfo, FinancialReport
)
from ..utils.date_utils import CST
from .data_sources.akshare_source import AkShareSource
from .data_sources.baostock_source import BaoStockSource
from ..engine.progress_tracker import ProgressTracker

logger = logging.getLogger(__name__)

BATCH_SIZE = 500
SYNC_CONCURRENCY = 10  # max concurrent stock syncs


async def _bulk_upsert(db: AsyncSession, model, rows: list[dict], unique_cols: list[str]):
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
            "stock_info": ("stock_info", self.sync_stock_info),
            "financial_reports": ("financial_reports", self.sync_financial_reports),
        }

        selected = data_types if data_types else list(all_methods.keys())
        results = []
        total_types = len(selected)
        for t_idx, key in enumerate(selected):
            if key not in all_methods:
                continue
            name, method = all_methods[key]
            ProgressTracker.update("sync", step=f"同步 {name}", progress=(t_idx / total_types) * 0.95)
            try:
                count = await method()
                await self._log_sync(name, "success", count)
                results.append({"type": name, "status": "success", "count": count})
            except Exception as e:
                logger.exception(f"Sync {name} failed")
                await self._log_sync(name, "error", 0, str(e))
                results.append({"type": name, "status": "error", "error": str(e)})

        await self.db.commit()
        ProgressTracker.update("sync", step="同步完成", progress=1.0, message="done")
        return results

    async def sync_stock_list(self) -> int:
        df = await self.bs.fetch_stock_list()
        if df is None or df.empty:
            logger.info("BaoStock stock list empty, falling back to AkShare")
            df = await self.ak.fetch_stock_list()

        if df is None or df.empty:
            return 0

        rows = []
        for _, row in df.iterrows():
            ld = row.get("list_date")
            od = row.get("out_date")
            try:
                if pd_isna(ld):
                    ld = None
            except (TypeError, ValueError):
                pass
            try:
                if pd_isna(od):
                    od = None
            except (TypeError, ValueError):
                pass
            rows.append({
                "code": str(row["code"]).zfill(6),
                "name": str(row.get("name", row.get("code_name", ""))),
                "exchange": row.get("exchange"),
                "list_date": ld,
                "out_date": od,
            })
        await _bulk_upsert(self.db, Stock, rows, ["code"])
        return len(rows)

    async def sync_daily_quotes(self, start_date: str, end_date: str, limit: int = 0) -> int:
        # Incremental sync: if start_date is default, try to use last sync date
        if start_date == (date.today() - timedelta(days=365 * 5)).isoformat():
            last_sync = await self._get_last_sync_date("daily_quotes")
            if last_sync:
                start_date = (last_sync - timedelta(days=3)).isoformat()
                logger.info(f"Incremental sync from {start_date}")

        sd = date.fromisoformat(start_date)
        ed = date.fromisoformat(end_date)
        q = select(Stock.code)
        if limit > 0:
            q = q.limit(limit)
        result = await self.db.execute(q)
        all_codes = [r[0] for r in result.all()]

        sem = asyncio.Semaphore(SYNC_CONCURRENCY)
        processed = [0]  # use list for mutable counter in closure
        lock = asyncio.Lock()

        async def _sync_one(code: str) -> int:
            async with sem:
                df = await self._fetch_with_fallback(code, sd, ed)
                if df is None or df.empty:
                    return 0
                rows = [self._build_daily_row(code, row) for _, row in df.iterrows()]
                if rows:
                    await _bulk_upsert(self.db, DailyQuote, rows, ["stock_code", "trade_date"])
                async with lock:
                    processed[0] += 1
                    if processed[0] % 50 == 0:
                        await self.db.commit()
                        pct = processed[0] / len(all_codes)
                        ProgressTracker.update("sync", step=f"同步日行情 {processed[0]}/{len(all_codes)}",
                                               progress=0.1 + pct * 0.6,
                                               current_step=processed[0], total_steps=len(all_codes),
                                               message=f"已同步 {processed[0]} 只股票")
                        logger.info(f"Synced {processed[0]}/{len(all_codes)} stocks")
                return len(df)

        tasks = [_sync_one(code) for code in all_codes]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total = sum(r for r in results if isinstance(r, int))
        errors = sum(1 for r in results if isinstance(r, Exception))
        if errors:
            logger.warning(f"Sync completed with {errors} errors")

        await self.db.commit()
        return total

    def _build_daily_row(self, code: str, row) -> dict:
        return {
            "stock_code": code,
            "trade_date": row["date"] if isinstance(row["date"], date) else date.fromisoformat(str(row["date"])),
            "open": float(row["open"]) if not pd_isna(row["open"]) else None,
            "high": float(row["high"]) if not pd_isna(row["high"]) else None,
            "low": float(row["low"]) if not pd_isna(row["low"]) else None,
            "close": float(row["close"]) if not pd_isna(row["close"]) else None,
            "pre_close": float(row["pre_close"]) if "pre_close" in row and not pd_isna(row["pre_close"]) else None,
            "volume": int(row["volume"]) if not pd_isna(row["volume"]) else 0,
            "amount": float(row["amount"]) if not pd_isna(row["amount"]) else None,
            "turnover_rate": float(row["turnover_rate"]) if "turnover_rate" in row and not pd_isna(row["turnover_rate"]) else None,
            "change_pct": float(row["change_pct"]) if "change_pct" in row and not pd_isna(row["change_pct"]) else None,
            "pe_ratio": float(row["pe_ratio"]) if "pe_ratio" in row and not pd_isna(row["pe_ratio"]) else None,
            "pb_ratio": float(row["pb_ratio"]) if "pb_ratio" in row and not pd_isna(row["pb_ratio"]) else None,
        }

    async def _fetch_with_fallback(self, code: str, sd: date, ed: date):
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
        bad_open = (df["open"].fillna(0) <= 0).sum()
        bad_close = (df["close"].fillna(0) <= 0).sum()
        if bad_open > len(df) * 0.3 or bad_close > len(df) * 0.3:
            logger.warning(f"Rejecting bad minute data for {code} freq={freq}: {bad_open}/{len(df)} bars with open<=0")
            return 0
        actual_days = df["trade_date"].nunique()
        min_accept = 5 if freq == "1" else 10
        if actual_days < min_accept:
            logger.warning(f"Insufficient coverage for {code} freq={freq}: got {actual_days} days")
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
        import numpy as np
        np.random.seed(abs(hash((open_p, close_p))) % 2**31)
        ret = (close_p / open_p - 1) if open_p > 0 else 0
        drift = ret / n
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

    async def sync_stock_info(self) -> int:
        """Sync stock basic info using BaoStock profit data (fast, batch-friendly)."""
        result = await self.db.execute(select(Stock.code))
        all_codes = [r[0] for r in result.all()]

        sem = asyncio.Semaphore(SYNC_CONCURRENCY)
        processed = [0]
        lock = asyncio.Lock()
        rows = []

        async def _sync_one_info(code: str):
            async with sem:
                try:
                    df = await self.bs.fetch_income_statement(code)
                    if df is not None and not df.empty:
                        latest = df.iloc[0]
                        rows.append({
                            "stock_code": code,
                            "total_shares": _safe_val(latest.get("total_shares")),
                            "float_shares": _safe_val(latest.get("float_shares")),
                            "updated_at": datetime.now(CST),
                        })
                except Exception as e:
                    logger.warning(f"Stock info {code}: {e}")
                async with lock:
                    processed[0] += 1
                    if processed[0] % 50 == 0:
                        logger.info(f"Synced stock_info {processed[0]}/{len(all_codes)}")

        tasks = [_sync_one_info(code) for code in all_codes]
        await asyncio.gather(*tasks, return_exceptions=True)

        if rows:
            await _bulk_upsert(self.db, StockInfo, rows, ["stock_code"])
        return len(rows)

    async def sync_financial_reports(self) -> int:
        result = await self.db.execute(select(Stock.code))
        all_codes = [r[0] for r in result.all()]

        total_reports = 0
        sem = asyncio.Semaphore(5)  # lower concurrency for financial reports (heavier)
        lock = asyncio.Lock()
        processed = [0]

        async def _sync_one_fin(code: str) -> int:
            nonlocal total_reports
            async with sem:
                try:
                    reports_dict = {}

                    income_df = await self.bs.fetch_income_statement(code)
                    balance_df = await self.bs.fetch_balance_sheet(code)
                    cash_df = await self.bs.fetch_cash_flow(code)
                    growth_df = await self.bs.fetch_growth_data(code)

                    if income_df is not None and not income_df.empty:
                        for _, row in income_df.iterrows():
                            key = (code, row["report_date"], row.get("report_type", "quarterly"))
                            if key not in reports_dict:
                                reports_dict[key] = {}
                            reports_dict[key]["public_date"] = row.get("public_date")
                            reports_dict[key]["revenue"] = _safe_val(row.get("revenue"))
                            reports_dict[key]["net_profit_parent"] = _safe_val(row.get("net_profit_parent"))
                            reports_dict[key]["roe_val"] = _safe_val(row.get("roe"))
                            reports_dict[key]["net_margin_val"] = _safe_val(row.get("net_margin"))
                            reports_dict[key]["gross_margin_val"] = _safe_val(row.get("gross_margin"))
                            reports_dict[key]["total_shares_val"] = _safe_val(row.get("total_shares"))
                            reports_dict[key]["float_shares_val"] = _safe_val(row.get("float_shares"))

                            rev = _safe_val(row.get("revenue"))
                            gm = _safe_val(row.get("gross_margin"))
                            if rev and gm and not pd_isna(gm):
                                gm_ratio = float(gm) / 100 if abs(float(gm)) > 1 else float(gm)
                                reports_dict[key]["operating_cost"] = rev * (1 - gm_ratio)

                    if balance_df is not None and not balance_df.empty:
                        for _, row in balance_df.iterrows():
                            key = (code, row["report_date"], row.get("report_type", "quarterly"))
                            if key not in reports_dict:
                                reports_dict[key] = {}
                            if not reports_dict[key].get("public_date"):
                                reports_dict[key]["public_date"] = row.get("public_date")
                            reports_dict[key]["liability_to_asset"] = _safe_val(row.get("liability_to_asset"))
                            reports_dict[key]["asset_to_equity"] = _safe_val(row.get("asset_to_equity"))
                            reports_dict[key]["current_ratio"] = _safe_val(row.get("current_ratio"))

                            d = reports_dict[key]
                            roe = d.get("roe_val")
                            np_val = d.get("net_profit_parent")
                            ate = _safe_val(row.get("asset_to_equity"))

                            if np_val and roe and float(roe) > 0:
                                equity = float(np_val) / float(roe)
                                if equity > 0:
                                    reports_dict[key]["total_equity"] = equity
                                    if ate and float(ate) > 0:
                                        reports_dict[key]["total_assets"] = equity * float(ate)
                                        reports_dict[key]["total_liabilities"] = equity * float(ate) - equity

                    if cash_df is not None and not cash_df.empty:
                        for _, row in cash_df.iterrows():
                            key = (code, row["report_date"], row.get("report_type", "quarterly"))
                            if key not in reports_dict:
                                reports_dict[key] = {}
                            if not reports_dict[key].get("public_date"):
                                reports_dict[key]["public_date"] = row.get("public_date")
                            rev = reports_dict[key].get("revenue")
                            cfo_ratio = _safe_val(row.get("operating_cash_to_revenue"))
                            if rev and cfo_ratio is not None and not pd_isna(cfo_ratio):
                                reports_dict[key]["operating_cash_flow"] = float(rev) * float(cfo_ratio)

                    if growth_df is not None and not growth_df.empty:
                        for _, row in growth_df.iterrows():
                            key = (code, row["report_date"], row.get("report_type", "quarterly"))
                            if key not in reports_dict:
                                reports_dict[key] = {}
                            if not reports_dict[key].get("public_date"):
                                reports_dict[key]["public_date"] = row.get("public_date")
                            reports_dict[key]["yoy_profit_growth"] = _safe_val(row.get("yoy_net_profit_growth"))
                            reports_dict[key]["yoy_parent_profit_growth"] = _safe_val(row.get("yoy_parent_net_profit_growth"))
                            reports_dict[key]["yoy_revenue_growth"] = _safe_val(row.get("yoy_asset_growth"))

                    FIN_FIELDS = [
                        "public_date",
                        "revenue", "operating_cost", "operating_profit", "net_profit", "net_profit_parent",
                        "total_assets", "total_liabilities", "total_equity", "current_assets", "current_liabilities",
                        "operating_cash_flow", "investing_cash_flow", "financing_cash_flow",
                        "roe_val", "net_margin_val", "gross_margin_val", "total_shares_val", "float_shares_val",
                        "yoy_revenue_growth", "yoy_profit_growth", "yoy_parent_profit_growth",
                    ]

                    report_count = 0
                    if reports_dict:
                        report_rows = []
                        for (code, report_date, report_type), data in reports_dict.items():
                            row_dict = {
                                "stock_code": code,
                                "report_date": report_date,
                                "report_type": report_type,
                            }
                            for f in FIN_FIELDS:
                                v = data.get(f)
                                try:
                                    if v is not None and pd_isna(v):
                                        v = None
                                except (TypeError, ValueError):
                                    pass
                                row_dict[f] = v
                            report_rows.append(row_dict)

                        await _bulk_upsert(self.db, FinancialReport, report_rows, ["stock_code", "report_date", "report_type"])
                        report_count = len(report_rows)

                    async with lock:
                        processed[0] += 1
                        total_reports += report_count
                        if processed[0] % 20 == 0:
                            await self.db.commit()
                            logger.info(f"Synced financial reports {processed[0]}/{len(all_codes)}, total: {total_reports}")

                    return report_count

                except Exception as e:
                    logger.warning(f"Failed to sync financial reports for {code}: {e}")
                    return 0

        tasks = [_sync_one_fin(code) for code in all_codes]
        await asyncio.gather(*tasks, return_exceptions=True)

        await self.db.commit()
        return total_reports

    async def _log_sync(self, data_type: str, status: str, count: int, error: str = ""):
        log = SyncLog(data_type=data_type, last_sync=datetime.now(CST),
                       status=status, record_count=count, error_message=error[:500] if error else None)
        self.db.add(log)

    async def _get_last_sync_date(self, data_type: str) -> date | None:
        """Get the last successful sync date for incremental sync."""
        result = await self.db.execute(
            select(SyncLog.last_sync)
            .where(SyncLog.data_type == data_type, SyncLog.status == "success")
            .order_by(SyncLog.last_sync.desc())
            .limit(1)
        )
        row = result.first()
        if row and row[0]:
            return row[0].date() if hasattr(row[0], "date") else row[0]
        return None


def _safe_val(v):
    if v is None:
        return None
    try:
        if math.isnan(v) or math.isinf(v):
            return None
    except (TypeError, ValueError):
        pass
    return float(v) if isinstance(v, (int, float)) else v


def pd_isna(val) -> bool:
    import pandas as pd
    import numpy as np
    if val is None:
        return True
    try:
        return pd.isna(val) or np.isnan(val)
    except (TypeError, ValueError):
        return False
