import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.market import (
    IndexDaily, SectorDaily, MarketBreadth, NorthBoundFlow,
    DailyQuote, MinuteQuote, Stock, WatchlistItem
)
from ..utils.date_utils import is_market_open

router = APIRouter(prefix="/api/v1/market", tags=["market"])


def _clean(v):
    if v is None:
        return None
    try:
        if math.isnan(v) or math.isinf(v):
            return None
    except (TypeError, ValueError):
        pass
    return v


@router.get("/status")
async def market_status():
    return {"market_open": is_market_open()}


@router.get("/indices/latest")
async def indices_latest(db: AsyncSession = Depends(get_db)):
    from datetime import date, timedelta
    sub = select(
        IndexDaily.index_code,
        func.max(IndexDaily.trade_date).label("max_date")
    ).group_by(IndexDaily.index_code).subquery()
    result = await db.execute(
        select(IndexDaily).join(sub, (IndexDaily.index_code == sub.c.index_code) & (IndexDaily.trade_date == sub.c.max_date))
    )
    rows = result.scalars().all()

    prev_result = await db.execute(
        select(IndexDaily).where(
            IndexDaily.trade_date.in_([r.trade_date - timedelta(days=1) for r in rows])
        )
    )
    prev_map = {(p.index_code, p.trade_date): p.close for p in prev_result.scalars().all()}

    indices = []
    for row in rows:
        prev_close = prev_map.get((row.index_code, row.trade_date - timedelta(days=1)))
        if prev_close and prev_close != 0:
            change_pct = (row.close - prev_close) / prev_close * 100
        else:
            change_pct = None
        indices.append({
            "code": row.index_code,
            "name": row.index_name,
            "close": row.close,
            "change_pct": change_pct,
            "volume": row.volume,
            "amount": row.amount,
            "trade_date": row.trade_date.isoformat() if row.trade_date else None,
        })
    return {"indices": indices}


@router.get("/indices/{code}/history")
async def index_history(code: str, start_date: str, end_date: str, db: AsyncSession = Depends(get_db)):
    from datetime import date
    result = await db.execute(
        select(IndexDaily)
        .where(IndexDaily.index_code == code)
        .where(IndexDaily.trade_date >= date.fromisoformat(start_date))
        .where(IndexDaily.trade_date <= date.fromisoformat(end_date))
        .order_by(IndexDaily.trade_date)
    )
    data = []
    for r in result.scalars().all():
        data.append({
            "date": r.trade_date.isoformat(),
            "open": r.open, "high": r.high, "low": r.low,
            "close": r.close, "volume": r.volume,
        })
    return {"code": code, "data": data}


@router.get("/stocks")
async def stocks_list(
    page: int = 1, page_size: int = 50,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Stock)
    if search:
        q = q.where((Stock.code.contains(search)) | (Stock.name.contains(search)))
    q = q.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(q)
    items = []
    for s in result.scalars().all():
        items.append({
            "code": s.code, "name": s.name, "exchange": s.exchange,
            "industry": s.industry, "area": s.area, "list_date": s.list_date.isoformat() if s.list_date else None,
            "is_st": s.is_st,
        })
    total_result = await db.execute(select(func.count(Stock.code)))
    total = total_result.scalar()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/stocks/{code}/profile")
async def stock_profile(code: str, db: AsyncSession = Depends(get_db)):
    from datetime import date, timedelta
    stock_result = await db.execute(select(Stock).where(Stock.code == code))
    stock = stock_result.scalar_one_or_none()
    if not stock:
        return {"error": "not found"}

    quote_result = await db.execute(
        select(DailyQuote).where(DailyQuote.stock_code == code)
        .order_by(DailyQuote.trade_date.desc()).limit(10)
    )
    quotes = quote_result.scalars().all()
    latest = quotes[0] if quotes else None
    prev = quotes[1] if len(quotes) > 1 else None

    # Find latest PE/PB from available data
    pe = next((q.pe_ratio for q in quotes if q.pe_ratio), None)
    pb = next((q.pb_ratio for q in quotes if q.pb_ratio), None)

    change_pct = None
    if latest and prev and prev.close:
        change_pct = (latest.close - prev.close) / prev.close * 100
    elif latest and latest.pre_close:
        change_pct = (latest.close - latest.pre_close) / latest.pre_close * 100 if latest.pre_close else None

    return {
        "code": stock.code,
        "name": stock.name,
        "industry": stock.industry,
        "exchange": stock.exchange,
        "area": stock.area,
        "list_date": stock.list_date.isoformat() if stock.list_date else None,
        "latest_price": latest.close if latest else None,
        "change_pct": round(change_pct, 2) if change_pct else None,
        "pe_ratio": pe,
        "pb_ratio": pb,
        "volume": latest.volume if latest else None,
        "amount": latest.amount if latest else None,
        "turnover_rate": latest.turnover_rate if latest else None,
        "trade_date": latest.trade_date.isoformat() if latest and latest.trade_date else None,
    }


@router.get("/stocks/{code}/minute/coverage")
async def minute_coverage(code: str, db: AsyncSession = Depends(get_db)):
    from datetime import date
    result = await db.execute(
        select(MinuteQuote.freq, MinuteQuote.source,
               func.min(MinuteQuote.trade_date), func.max(MinuteQuote.trade_date),
               func.count(), func.count(MinuteQuote.trade_date.distinct()))
        .where(MinuteQuote.stock_code == code)
        .group_by(MinuteQuote.freq, MinuteQuote.source).order_by(MinuteQuote.freq)
    )
    freqs_map: dict[str, dict] = {}
    for row in result.all():
        f = row[0]; src = row[1] or "synthetic"
        if f not in freqs_map:
            freqs_map[f] = {"freq": f, "total_bars": 0, "trading_days": 0, "real_days": 0, "min_date": None, "max_date": None}
        m = freqs_map[f]
        m["total_bars"] += row[4]
        m["trading_days"] += row[5]
        if src == "real":
            m["real_days"] += row[5]
            m["min_date"] = row[2].isoformat() if row[2] and (m["min_date"] is None or row[2].isoformat() < m["min_date"]) else m["min_date"]
            m["max_date"] = row[3].isoformat() if row[3] and (m["max_date"] is None or row[3].isoformat() > m["max_date"]) else m["max_date"]
    freqs = sorted(freqs_map.values(), key=lambda x: x["freq"])
    # Also check daily data range
    daily_r = await db.execute(
        select(func.min(DailyQuote.trade_date), func.max(DailyQuote.trade_date), func.count(DailyQuote.trade_date.distinct()))
        .where(DailyQuote.stock_code == code)
    )
    daily = daily_r.one()
    return {
        "code": code,
        "daily": {
            "min_date": daily[0].isoformat() if daily[0] else None,
            "max_date": daily[1].isoformat() if daily[1] else None,
            "trading_days": daily[2],
        },
        "minute": freqs,
    }


@router.get("/stocks/{code}/quotes")
async def stock_quotes(code: str, start_date: str, end_date: str, freq: str = "d", source: str = "all",
                       db: AsyncSession = Depends(get_db)):
    from datetime import date as dt, timedelta, datetime
    sd = dt.fromisoformat(start_date)
    ed = dt.fromisoformat(end_date)

    # Minute frequency: query minute_quotes table
    if freq in ("1", "5", "15", "30", "60"):
        q = select(MinuteQuote).where(
            MinuteQuote.stock_code == code,
            MinuteQuote.freq == freq,
            MinuteQuote.trade_date >= sd,
            MinuteQuote.trade_date <= ed,
        )
        if source == "real":
            q = q.where(MinuteQuote.source == "real")
        q = q.order_by(MinuteQuote.trade_time)
        result = await db.execute(q)
        rows = result.scalars().all()
        minute_data = []
        for r in rows:
            minute_data.append({
                "date": r.trade_time.isoformat() if r.trade_time else "",
                "open": r.open, "high": r.high, "low": r.low, "close": r.close,
                "volume": r.volume, "amount": r.amount,
            })
        return {"code": code, "data": minute_data, "freq": freq}

    # Load daily data
    lookback = sd - timedelta(days=60)
    result = await db.execute(
        select(DailyQuote)
        .where(DailyQuote.stock_code == code)
        .where(DailyQuote.trade_date >= lookback)
        .where(DailyQuote.trade_date <= ed)
        .order_by(DailyQuote.trade_date)
    )
    rows = result.scalars().all()

    if not rows:
        return {"code": code, "data": [], "freq": freq}

    import pandas as pd
    data_list = []
    for r in rows:
        data_list.append({
            "date": r.trade_date,
            "open": r.open, "high": r.high, "low": r.low, "close": r.close,
            "pre_close": r.pre_close, "volume": r.volume, "amount": r.amount,
            "change_pct": r.change_pct, "turnover_rate": r.turnover_rate,
            "pe_ratio": r.pe_ratio, "pb_ratio": r.pb_ratio,
        })
    df = pd.DataFrame(data_list)
    df.index = df["date"]
    df = df.sort_index()

    if freq == "w":
        from ..engine.data_loader import resample_ohlc
        ohlc = resample_ohlc(df.set_index("date")[["open", "high", "low", "close", "volume", "amount"]], "W")
        if ohlc.empty:
            return {"code": code, "data": [], "freq": freq}
        agg_data = []
        for idx, row in ohlc.iterrows():
            agg_data.append({
                "date": idx.isoformat() if hasattr(idx, "isoformat") else str(idx),
                "open": _clean(row["open"]), "high": _clean(row["high"]),
                "low": _clean(row["low"]), "close": _clean(row["close"]),
                "volume": _clean(row.get("volume")),
                "pre_close": _clean(row.get("pre_close")),
                "change_pct": _clean(row.get("change_pct")),
            })
        return {"code": code, "data": agg_data, "freq": freq}
    elif freq == "m":
        from ..engine.data_loader import resample_ohlc
        ohlc = resample_ohlc(df.set_index("date")[["open", "high", "low", "close", "volume", "amount"]], "M")
        if ohlc.empty:
            return {"code": code, "data": [], "freq": freq}
        agg_data = []
        for idx, row in ohlc.iterrows():
            agg_data.append({
                "date": idx.isoformat() if hasattr(idx, "isoformat") else str(idx),
                "open": _clean(row["open"]), "high": _clean(row["high"]),
                "low": _clean(row["low"]), "close": _clean(row["close"]),
                "volume": _clean(row.get("volume")),
                "pre_close": _clean(row.get("pre_close")),
                "change_pct": _clean(row.get("change_pct")),
            })
        return {"code": code, "data": agg_data, "freq": freq}

    # Daily mode
    result_data = []
    for r in rows:
        if r.trade_date < sd:
            continue
        result_data.append({
            "date": r.trade_date.isoformat() if r.trade_date else "",
            "open": r.open, "high": r.high, "low": r.low, "close": r.close,
            "pre_close": r.pre_close, "volume": r.volume, "amount": r.amount,
            "change_pct": r.change_pct, "turnover_rate": r.turnover_rate,
            "pe_ratio": r.pe_ratio, "pb_ratio": r.pb_ratio,
        })
    return {"code": code, "data": result_data, "freq": freq}

@router.get("/sectors/heatmap")
async def sector_heatmap(date: str | None = None, db: AsyncSession = Depends(get_db)):
    from datetime import date as d
    target_date = d.fromisoformat(date) if date else None
    if target_date is None:
        sub = select(func.max(SectorDaily.trade_date)).scalar_subquery()
        q = select(SectorDaily).where(SectorDaily.trade_date == sub)
    else:
        q = select(SectorDaily).where(SectorDaily.trade_date == target_date)
    result = await db.execute(q)
    sectors = []
    for r in result.scalars().all():
        sectors.append({
            "code": r.sector_code, "name": r.sector_name,
            "change_pct": r.change_pct,
            "leading_stock_code": r.leading_stock_code,
            "leading_stock_name": r.leading_stock_name,
        })
    return {"sectors": sectors}


@router.get("/breadth")
async def market_breadth(start_date: str, end_date: str, db: AsyncSession = Depends(get_db)):
    from datetime import date
    result = await db.execute(
        select(MarketBreadth)
        .where(MarketBreadth.trade_date >= date.fromisoformat(start_date))
        .where(MarketBreadth.trade_date <= date.fromisoformat(end_date))
        .order_by(MarketBreadth.trade_date)
    )
    data = []
    for r in result.scalars().all():
        data.append({
            "date": r.trade_date.isoformat(),
            "up_count": r.up_count, "down_count": r.down_count,
            "flat_count": r.flat_count, "limit_up": r.limit_up, "limit_down": r.limit_down,
        })
    return {"data": data}


@router.get("/north-bound")
async def north_bound(start_date: str, end_date: str, db: AsyncSession = Depends(get_db)):
    from datetime import date
    result = await db.execute(
        select(NorthBoundFlow)
        .where(NorthBoundFlow.trade_date >= date.fromisoformat(start_date))
        .where(NorthBoundFlow.trade_date <= date.fromisoformat(end_date))
        .order_by(NorthBoundFlow.trade_date)
    )
    data = []
    for r in result.scalars().all():
        data.append({
            "date": r.trade_date.isoformat(),
            "net_flow_total": r.net_flow_total,
        })
    return {"data": data}


@router.get("/watchlist")
async def watchlist(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WatchlistItem).order_by(WatchlistItem.added_at.desc()))
    items = []
    for w in result.scalars().all():
        items.append({
            "id": w.id, "stock_code": w.stock_code,
            "notes": w.notes,
            "alert_price_upper": w.alert_price_upper,
            "alert_price_lower": w.alert_price_lower,
            "added_at": w.added_at.isoformat() if w.added_at else None,
        })
    return {"items": items}


@router.post("/watchlist")
async def add_watchlist(
    stock_code: str = Query(...),
    notes: str | None = None,
    alert_price_upper: float | None = None,
    alert_price_lower: float | None = None,
    db: AsyncSession = Depends(get_db),
):
    item = WatchlistItem(
        stock_code=stock_code,
        notes=notes,
        alert_price_upper=alert_price_upper,
        alert_price_lower=alert_price_lower,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"id": item.id, "stock_code": item.stock_code}


@router.delete("/watchlist/{item_id}")
async def delete_watchlist(item_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WatchlistItem).where(WatchlistItem.id == item_id))
    item = result.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()
    return {"ok": True}
