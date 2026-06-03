import uuid
import logging
from datetime import date, datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from ..database import get_db
from ..models.backtest import PaperTradeRun, PaperOrder, PaperPosition, PaperDailyValue
from ..models.market import DailyQuote, Stock
from ..engine.paper_engine import PaperTradeEngine
from ..engine.signal_engine import SignalEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/paper", tags=["paper"])


@router.post("/runs")
async def create_paper_run(config: dict, db: AsyncSession = Depends(get_db)):
    run_id = str(uuid.uuid4())[:8]
    run = PaperTradeRun(
        id=run_id,
        name=config.get("name", "Paper Trading"),
        config_json=config,
        status="active",
        started_at=datetime.now(),
        initial_capital=config.get("initial_capital", 1_000_000),
        current_cash=config.get("initial_capital", 1_000_000),
        current_value=config.get("initial_capital", 1_000_000),
        total_return=0,
    )
    db.add(run)
    await db.commit()
    return {"run_id": run_id, "status": "active"}


@router.get("/runs")
async def list_paper_runs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PaperTradeRun).order_by(PaperTradeRun.started_at.desc())
    )
    runs = result.scalars().all()
    return {
        "runs": [{
            "id": r.id, "name": r.name, "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "initial_capital": r.initial_capital, "current_value": r.current_value,
            "total_return": r.total_return,
        } for r in runs]
    }


@router.post("/runs/{run_id}/generate-signal")
async def generate_signal(run_id: str, target_date: str | None = None, db: AsyncSession = Depends(get_db)):
    run_result = await db.execute(select(PaperTradeRun).where(PaperTradeRun.id == run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        return {"error": "Run not found"}

    engine = SignalEngine(db)
    td = date.fromisoformat(target_date) if target_date else None
    if not td:
        dq_result = await db.execute(
            select(DailyQuote.trade_date).order_by(DailyQuote.trade_date.desc()).limit(1)
        )
        td = dq_result.scalar_one_or_none() or date.today()

    result = await engine.generate(run.config_json or {}, td)

    # Add stock names to signals
    if "signals" in result and result["signals"]:
        codes = [s.get("stock_code", "") for s in result["signals"] if s.get("stock_code")]
        name_map = {}
        if codes:
            stock_result = await db.execute(
                select(Stock.code, Stock.name).where(Stock.code.in_(codes))
            )
            name_map = {r[0]: r[1] for r in stock_result.all()}
        for s in result["signals"]:
            s["stock_name"] = name_map.get(s.get("stock_code", ""), "")

    return result


@router.post("/runs/{run_id}/execute")
async def execute_rebalance(run_id: str, target_date: str | None = None, db: AsyncSession = Depends(get_db)):
    engine = PaperTradeEngine(db)
    td = date.fromisoformat(target_date) if target_date else None
    result = await engine.run_once(run_id, td)
    return result


@router.get("/runs/{run_id}/positions")
async def get_positions(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PaperPosition).where(PaperPosition.run_id == run_id)
    )
    positions = result.scalars().all()
    run_result = await db.execute(select(PaperTradeRun).where(PaperTradeRun.id == run_id))
    run = run_result.scalar_one_or_none()

    total_value = run.current_value if run else sum((p.market_value or 0) for p in positions)

    # Fetch stock names
    codes = [p.stock_code for p in positions]
    name_map = {}
    if codes:
        stock_result = await db.execute(
            select(Stock.code, Stock.name).where(Stock.code.in_(codes))
        )
        name_map = {r[0]: r[1] for r in stock_result.all()}

    return {
        "positions": [{
            "stock_code": p.stock_code,
            "stock_name": name_map.get(p.stock_code, ""),
            "shares": p.shares,
            "avg_cost": round(p.avg_cost, 2) if p.avg_cost else 0,
            "market_value": round(p.market_value, 2) if p.market_value else 0,
            "weight": round(p.market_value / total_value, 4) if total_value > 0 and p.market_value else 0,
            "unrealized_pnl": round(p.unrealized_pnl, 2) if p.unrealized_pnl else 0,
        } for p in positions],
        "total_value": round(total_value, 2),
        "cash": round(run.current_cash, 2) if run else 0,
    }


@router.get("/runs/{run_id}/orders")
async def get_orders(run_id: str, page: int = 1, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PaperOrder)
        .where(PaperOrder.run_id == run_id)
        .order_by(PaperOrder.trade_date.desc(), PaperOrder.created_at.desc())
        .limit(100)
        .offset((page - 1) * 100)
    )
    orders = result.scalars().all()

    # Fetch stock names
    codes = list(set(o.stock_code for o in orders if o.stock_code))
    name_map = {}
    if codes:
        stock_result = await db.execute(
            select(Stock.code, Stock.name).where(Stock.code.in_(codes))
        )
        name_map = {r[0]: r[1] for r in stock_result.all()}

    return {
        "orders": [{
            "id": o.id,
            "trade_date": o.trade_date.isoformat() if o.trade_date else None,
            "stock_code": o.stock_code,
            "stock_name": name_map.get(o.stock_code, ""),
            "direction": o.direction,
            "signal_price": o.signal_price,
            "order_shares": o.order_shares,
            "fill_price": o.fill_price,
            "fill_shares": o.fill_shares,
            "status": o.status,
            "reject_reason": o.reject_reason,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        } for o in orders]
    }


@router.get("/runs/{run_id}/equity")
async def get_equity_curve(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PaperDailyValue)
        .where(PaperDailyValue.run_id == run_id)
        .order_by(PaperDailyValue.trade_date)
    )
    values = result.scalars().all()
    return {
        "equity": [{
            "date": v.trade_date.isoformat(),
            "total_value": v.total_value,
            "cash": v.cash,
            "daily_return": v.daily_return,
        } for v in values]
    }


@router.put("/runs/{run_id}")
async def update_paper_run(run_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PaperTradeRun).where(PaperTradeRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        return {"error": "Run not found"}
    if "status" in body:
        run.status = body["status"]
    await db.commit()
    return {"run_id": run_id, "status": run.status}


@router.get("/runs/{run_id}")
async def get_paper_run(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PaperTradeRun).where(PaperTradeRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        return {"error": "Run not found"}
    return {
        "id": run.id, "name": run.name, "status": run.status,
        "config": run.config_json,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "initial_capital": run.initial_capital,
        "current_cash": run.current_cash,
        "current_value": run.current_value,
        "total_return": run.total_return,
    }


@router.delete("/runs/{run_id}")
async def delete_paper_run(run_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(PaperOrder).where(PaperOrder.run_id == run_id))
    await db.execute(delete(PaperPosition).where(PaperPosition.run_id == run_id))
    await db.execute(delete(PaperDailyValue).where(PaperDailyValue.run_id == run_id))
    await db.execute(delete(PaperTradeRun).where(PaperTradeRun.id == run_id))
    await db.commit()
    return {"ok": True}
