import asyncio, random
from datetime import date, datetime
from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sqldelete, func

from ..database import get_db
from ..services.data_service import SyncManager
from ..models.market import SyncLog, TradingCalendar, Stock, DailyQuote, MinuteQuote as MQ, IndexDaily, NorthBoundFlow, MarketBreadth, StockInfo, FinancialReport
from ..engine.progress_tracker import ProgressTracker

router = APIRouter(prefix="/api/v1/data", tags=["data"])


@router.post("/sync")
async def trigger_sync(
    data_types: str = "",
    start_date: str | None = None,
    end_date: str | None = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Trigger data sync as a background task with progress tracking."""
    selected = [t.strip() for t in data_types.split(",") if t.strip()] if data_types else None

    # Run sync in background
    async def _run_sync():
        from ..database import async_session_factory
        async with async_session_factory() as sync_db:
            mgr = SyncManager(sync_db)
            await mgr.sync_selected(selected, start_date=start_date, end_date=end_date)

    background_tasks.add_task(_run_sync)
    return {"job_id": "sync", "status": "started"}


@router.get("/sync/progress")
async def sync_progress_stream():
    """SSE endpoint for real-time sync progress."""
    async def event_stream():
        import json
        last_progress = -1
        while True:
            state = ProgressTracker.get_state("sync")
            if state and state.get("progress", 0) != last_progress:
                last_progress = state.get("progress", 0)
                yield f"data: {json.dumps(state)}\n\n"
            if state and state.get("message") == "done":
                break
            await asyncio.sleep(0.5)
    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/sync/status")
async def sync_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyncLog).order_by(SyncLog.last_sync.desc()))
    logs = result.scalars().all()
    data_types_map = {}
    for log in logs:
        if log.data_type not in data_types_map:
            data_types_map[log.data_type] = {
                "type": log.data_type, "last_sync": log.last_sync.isoformat() if log.last_sync else None,
                "status": log.status, "record_count": log.record_count,
            }
    return {"data_types": list(data_types_map.values())}


@router.post("/sync/stock/{code}/minute")
async def sync_minute_stock(
    code: str, freq: str = "5",
    start_date: str = "2026-04-01", end_date: str = "2026-05-15",
    force: bool = False,
    db: AsyncSession = Depends(get_db),
):
    mgr = SyncManager(db)
    sd = date.fromisoformat(start_date)
    ed = date.fromisoformat(end_date)

    # Ensure stock exists
    stock_result = await db.execute(select(Stock).where(Stock.code == code))
    if not stock_result.scalar_one_or_none():
        df = await mgr.ak.fetch_stock_list()
        if df is not None and not df.empty:
            match = df[df["code"] == code]
            if not match.empty:
                db.add(Stock(code=code, name=str(match.iloc[0]["name"])))
                await db.commit()

    # Ensure daily data covers the requested range (for synthetic generation)
    daily_min = await db.execute(
        select(func.min(DailyQuote.trade_date)).where(DailyQuote.stock_code == code)
    )
    daily_max = await db.execute(
        select(func.max(DailyQuote.trade_date)).where(DailyQuote.stock_code == code)
    )
    dmin = daily_min.scalar()
    dmax = daily_max.scalar()
    need_daily = (dmin is None or dmax is None or sd < dmin or ed > dmax or force)

    if need_daily:
        df = await mgr._fetch_with_fallback(code, sd, ed)
        if df is not None and not df.empty:
            rows = []
            for _, row in df.iterrows():
                rows.append({
                    "stock_code": code,
                    "trade_date": row["date"] if isinstance(row["date"], date) else date.fromisoformat(str(row["date"])),
                    "open": _sf(row, "open"), "high": _sf(row, "high"), "low": _sf(row, "low"), "close": _sf(row, "close"),
                    "pre_close": _sf(row, "pre_close"), "volume": int(row["volume"]) if not _pdn(row.get("volume")) else 0,
                    "amount": _sf(row, "amount"), "turnover_rate": _sf(row, "turnover_rate"),
                    "change_pct": _sf(row, "change_pct"), "pe_ratio": _sf(row, "pe_ratio"), "pb_ratio": _sf(row, "pb_ratio"),
                })
            from ..services.data_service import _bulk_upsert
            await _bulk_upsert(db, DailyQuote, rows, ["stock_code", "trade_date"])
            await db.commit()

    all_freqs = ["1", "5", "15", "30", "60"] if freq == "all" else [freq]
    results = []
    cached = set()

    # Check cache and delete old data for non-cached frequencies
    for f in all_freqs:
        if not force:
            ex = await db.execute(
                select(MQ.trade_date).where(MQ.stock_code == code, MQ.freq == f,
                    MQ.trade_date >= sd, MQ.trade_date <= ed).limit(1)
            )
            if ex.scalar_one_or_none():
                cnt = await db.execute(select(MQ).where(MQ.stock_code == code, MQ.freq == f,
                    MQ.trade_date >= sd, MQ.trade_date <= ed))
                results.append({"freq": f, "rows": len(cnt.scalars().all()), "source": "cached"})
                cached.add(f)
                continue
        await db.execute(sqldelete(MQ).where(MQ.stock_code == code, MQ.freq == f,
            MQ.trade_date >= sd, MQ.trade_date <= ed))
    await db.commit()

    # Strategy: generate synthetic for full range first, then overlay real data on top.
    pending = [f for f in all_freqs if f not in cached]

    # Step 1: Generate synthetic for all pending frequencies
    for f in pending:
        sc = await mgr.generate_synthetic_minute(code, start_date, end_date, f)
        results.append({"freq": f, "rows": sc, "source": "synthetic"})

    # Step 2: Overlay real data for 1/5 min
    real_pending = [f for f in pending if f in ("1", "5")]
    async def safe_sync(fv):
        await asyncio.sleep(random.uniform(0, 1))
        return await mgr.sync_minute_quotes(code, start_date, end_date, fv)

    for f in real_pending:
        try:
            real_count = await safe_sync(f)
            if isinstance(real_count, Exception):
                real_count = 0
        except Exception:
            real_count = 0
        if real_count > 0:
            for r in results:
                if r["freq"] == f:
                    r["source"] = "mixed"
                    r["real_rows"] = real_count
                    break

    return {"status": "done", "code": code, "results": results, "total_rows": sum(r["rows"] for r in results)}


@router.post("/sync/stock/{code}")
async def sync_single_stock(
    code: str, start_date: str = "2024-01-01", end_date: str = "2026-05-14",
    db: AsyncSession = Depends(get_db),
):
    mgr = SyncManager(db)
    sd = date.fromisoformat(start_date)
    ed = date.fromisoformat(end_date)
    stock_result = await db.execute(select(Stock).where(Stock.code == code))
    if not stock_result.scalar_one_or_none():
        df = await mgr.ak.fetch_stock_list()
        if df is not None and not df.empty:
            match = df[df["code"] == code]
            if not match.empty:
                db.add(Stock(code=code, name=str(match.iloc[0]["name"]), exchange=match.iloc[0].get("exchange")))
                await db.commit()
    df = await mgr._fetch_with_fallback(code, sd, ed)
    if df is None or df.empty:
        return {"status": "error", "detail": "No data available for this stock"}
    count = 0
    for _, row in df.iterrows():
        dq = DailyQuote(
            stock_code=code,
            trade_date=row["date"] if isinstance(row["date"], date) else date.fromisoformat(str(row["date"])),
            open=_sf(row, "open"), high=_sf(row, "high"), low=_sf(row, "low"), close=_sf(row, "close"),
            pre_close=_sf(row, "pre_close"), volume=int(row["volume"]) if not _pdn(row.get("volume")) else 0,
            amount=_sf(row, "amount"), turnover_rate=_sf(row, "turnover_rate"),
            change_pct=_sf(row, "change_pct"), pe_ratio=_sf(row, "pe_ratio"), pb_ratio=_sf(row, "pb_ratio"),
        )
        await db.merge(dq)
        count += 1
    await db.commit()
    return {"status": "done", "code": code, "rows_synced": count}


@router.get("/coverage")
async def data_coverage(db: AsyncSession = Depends(get_db)):
    """Return date range and count for each data type."""
    coverage = []

    # Daily quotes
    dq_result = await db.execute(
        select(func.min(DailyQuote.trade_date), func.max(DailyQuote.trade_date),
               func.count(DailyQuote.trade_date.distinct()), func.count(DailyQuote.stock_code.distinct()))
    )
    dq = dq_result.one()
    coverage.append({
        "type": "daily_quotes", "label": "日线行情",
        "min_date": dq[0].isoformat() if dq[0] else None,
        "max_date": dq[1].isoformat() if dq[1] else None,
        "trading_days": dq[2] or 0, "stock_count": dq[3] or 0,
    })

    # Index daily
    idx_result = await db.execute(
        select(func.min(IndexDaily.trade_date), func.max(IndexDaily.trade_date),
               func.count(IndexDaily.trade_date.distinct()), func.count(IndexDaily.index_code.distinct()))
    )
    idx = idx_result.one()
    coverage.append({
        "type": "indices", "label": "指数行情",
        "min_date": idx[0].isoformat() if idx[0] else None,
        "max_date": idx[1].isoformat() if idx[1] else None,
        "trading_days": idx[2] or 0, "stock_count": idx[3] or 0,
    })

    # North bound
    nb_result = await db.execute(
        select(func.min(NorthBoundFlow.trade_date), func.max(NorthBoundFlow.trade_date), func.count())
    )
    nb = nb_result.one()
    coverage.append({
        "type": "north_bound", "label": "北向资金",
        "min_date": nb[0].isoformat() if nb[0] else None,
        "max_date": nb[1].isoformat() if nb[1] else None,
        "trading_days": nb[2] or 0, "stock_count": 0,
    })

    # Market breadth
    mb_result = await db.execute(
        select(func.min(MarketBreadth.trade_date), func.max(MarketBreadth.trade_date), func.count())
    )
    mb = mb_result.one()
    coverage.append({
        "type": "market_breadth", "label": "市场广度",
        "min_date": mb[0].isoformat() if mb[0] else None,
        "max_date": mb[1].isoformat() if mb[1] else None,
        "trading_days": mb[2] or 0, "stock_count": 0,
    })

    # Stock info
    si_result = await db.execute(select(func.count(StockInfo.stock_code)))
    si_count = si_result.scalar() or 0
    coverage.append({
        "type": "stock_info", "label": "股票信息",
        "min_date": None, "max_date": None, "trading_days": 0, "stock_count": si_count,
    })

    # Financial reports
    fr_result = await db.execute(
        select(func.min(FinancialReport.report_date), func.max(FinancialReport.report_date),
               func.count(), func.count(FinancialReport.stock_code.distinct()))
    )
    fr = fr_result.one()
    coverage.append({
        "type": "financial_reports", "label": "财务报表",
        "min_date": fr[0].isoformat() if fr[0] else None,
        "max_date": fr[1].isoformat() if fr[1] else None,
        "trading_days": fr[2] or 0, "stock_count": fr[3] or 0,
    })

    # Stock list
    sl_result = await db.execute(select(func.count(Stock.code)))
    sl_count = sl_result.scalar() or 0
    coverage.append({
        "type": "stock_list", "label": "股票列表",
        "min_date": None, "max_date": None, "trading_days": 0, "stock_count": sl_count,
    })

    return {"coverage": coverage}


@router.get("/trading-calendar")
async def trading_calendar(year: int | None = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TradingCalendar.trade_date).where(TradingCalendar.is_trading_day == True).order_by(TradingCalendar.trade_date)
    )
    dates = [r[0].isoformat() for r in result.fetchall()]
    return {"trading_days": dates}


def _sf(row, key):
    import math
    v = row.get(key)
    if v is None: return None
    try:
        if not _pdn(v):
            fv = float(v)
            if not math.isnan(fv) and not math.isinf(fv): return fv
    except (ValueError, TypeError): pass
    return None


def _pdn(val):
    if val is None: return True
    try:
        import pandas as pd; import numpy as np
        return pd.isna(val) or np.isnan(val)
    except (TypeError, ValueError): return False
