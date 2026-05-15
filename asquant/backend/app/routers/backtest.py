import uuid
import json
import logging
from datetime import date, datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.backtest import BacktestRun, BacktestDaily, BacktestSummary
from ..engine.vectorized_engine import VectorizedBacktester
from ..engine.event_driven_engine import EventDrivenBacktester

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/backtest", tags=["backtest"])


@router.post("/run")
async def run_backtest(config: dict, db: AsyncSession = Depends(get_db)):
    run_id = str(uuid.uuid4())[:8]

    run = BacktestRun(
        id=run_id,
        name=config.get("name", "Untitled"),
        config_json=config,
        status="running",
        started_at=datetime.now(),
    )
    db.add(run)
    await db.commit()

    try:
        if config.get("mode") == "intraday":
            engine = EventDrivenBacktester(db)
        else:
            engine = VectorizedBacktester(db)
        result = await engine.run(config)

        # Save daily data
        for d in result["daily"]:
            bd = BacktestDaily(
                run_id=run_id,
                trade_date=date.fromisoformat(str(d["trade_date"])) if isinstance(d["trade_date"], str) else d["trade_date"],
                portfolio_value=d["portfolio_value"],
                benchmark_value=d["benchmark_value"],
                cash=d.get("cash", 0),
                daily_return=d["daily_return"],
                benchmark_return=d.get("benchmark_return", 0),
                turnover=d.get("turnover", 0),
                positions_json="",
            )
            db.add(bd)

        # Save summary
        s = result["summary"]
        summary = BacktestSummary(
            run_id=run_id,
            total_return=s.get("total_return", 0),
            annual_return=s.get("annual_return", 0),
            volatility=s.get("volatility", 0),
            max_drawdown=s.get("max_drawdown", 0),
            max_drawdown_duration=s.get("max_drawdown_duration", 0),
            sharpe=s.get("sharpe", 0),
            calmar=s.get("calmar", 0),
            sortino=s.get("sortino", 0),
            alpha=s.get("alpha", 0),
            beta=s.get("beta", 1),
            r_squared=s.get("r_squared", 0),
            information_ratio=s.get("information_ratio", 0),
            var_95=s.get("var_95", 0),
            cvar_95=s.get("cvar_95", 0),
            treynor=s.get("treynor", 0),
            win_rate=s.get("win_rate", 0),
            profit_factor=s.get("profit_factor", 0),
            avg_win_loss=s.get("avg_win_loss", 0),
            skewness=s.get("skewness", 0),
            kurtosis=s.get("kurtosis", 0),
            monthly_returns_json=json.dumps(s.get("monthly_returns", [])),
        )
        db.add(summary)

        run.status = "done"
        run.completed_at = datetime.now()
        await db.commit()

        return {"run_id": run_id, "status": "done"}
    except Exception as e:
        logger.exception("Backtest failed")
        run.status = "error"
        run.error_message = str(e)[:1000]
        run.completed_at = datetime.now()
        await db.commit()
        return {"run_id": run_id, "status": "error", "error": str(e)}


@router.get("/runs")
async def backtest_runs(page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    count_result = await db.execute(select(BacktestRun))
    total = len(count_result.all())
    result = await db.execute(
        select(BacktestRun).order_by(BacktestRun.started_at.desc()).limit(page_size).offset((page - 1) * page_size)
    )
    runs = []
    for r in result.scalars().all():
        config = r.config_json or {}
        runs.append({
            "id": r.id, "name": r.name,
            "start_date": config.get("start_date"),
            "end_date": config.get("end_date"),
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
        })
    return {"runs": runs, "total": total}


@router.get("/runs/{run_id}")
async def backtest_run_detail(run_id: str, db: AsyncSession = Depends(get_db)):
    run_result = await db.execute(select(BacktestRun).where(BacktestRun.id == run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        return {"error": "not found"}

    summary_result = await db.execute(select(BacktestSummary).where(BacktestSummary.run_id == run_id))
    s = summary_result.scalar_one_or_none()

    return {
        "id": run.id, "name": run.name, "config": run.config_json, "status": run.status,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "error_message": run.error_message,
        "summary": {
            "total_return": s.total_return, "annual_return": s.annual_return,
            "volatility": s.volatility, "max_drawdown": s.max_drawdown,
            "max_drawdown_duration": s.max_drawdown_duration,
            "sharpe": s.sharpe, "calmar": s.calmar, "sortino": s.sortino,
            "alpha": s.alpha, "beta": s.beta, "r_squared": s.r_squared,
            "information_ratio": s.information_ratio,
            "var_95": s.var_95, "cvar_95": s.cvar_95,
            "treynor": s.treynor, "win_rate": s.win_rate,
            "profit_factor": s.profit_factor, "avg_win_loss": s.avg_win_loss,
            "skewness": s.skewness, "kurtosis": s.kurtosis,
            "monthly_returns": json.loads(s.monthly_returns_json) if s.monthly_returns_json else [],
        } if s else None,
    }


@router.get("/runs/{run_id}/attribution")
async def backtest_attribution(run_id: str, db: AsyncSession = Depends(get_db)):
    daily_result = await db.execute(
        select(BacktestDaily).where(BacktestDaily.run_id == run_id).order_by(BacktestDaily.trade_date)
    )
    daily_rows = daily_result.scalars().all()
    if not daily_rows:
        return {"sector_attribution": [], "factor_attribution": []}
    returns = [d.daily_return for d in daily_rows]
    bm_returns = [d.benchmark_return for d in daily_rows]
    return {
        "sector_attribution": [],
        "factor_attribution": [],
        "annual_return": (sum(returns) / len(returns) * 252) if returns else 0,
        "annual_benchmark": (sum(bm_returns) / len(bm_returns) * 252) if bm_returns else 0,
    }


@router.get("/runs/{run_id}/daily")
async def backtest_daily(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BacktestDaily).where(BacktestDaily.run_id == run_id).order_by(BacktestDaily.trade_date)
    )
    daily = []
    for d in result.scalars().all():
        daily.append({
            "date": d.trade_date.isoformat() if d.trade_date else "",
            "portfolio_value": d.portfolio_value,
            "benchmark_value": d.benchmark_value,
            "cash": d.cash,
            "daily_return": d.daily_return,
            "benchmark_return": d.benchmark_return,
            "turnover": d.turnover,
        })
    return {"daily": daily}


@router.delete("/runs/{run_id}")
async def delete_backtest(run_id: str, db: AsyncSession = Depends(get_db)):
    for model in [BacktestDaily, BacktestSummary, BacktestRun]:
        result = await db.execute(select(model).where(
            model.run_id if hasattr(model, "run_id") else model.id == run_id
        ))
        items = result.scalars().all()
        for item in items:
            await db.delete(item)
    await db.commit()
    return {"ok": True}
