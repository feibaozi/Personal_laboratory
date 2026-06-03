import uuid
import json
import asyncio
import logging
from datetime import date, datetime
from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, PlainTextResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.backtest import BacktestRun, BacktestDaily, BacktestSummary, BacktestTrade
from ..engine.vectorized_engine import VectorizedBacktester
from ..engine.event_driven_engine import EventDrivenBacktester
from ..engine.optimizer import Optimizer
from ..engine.progress_tracker import ProgressTracker

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

    config["run_id"] = run_id
    ProgressTracker.create(run_id)

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
                positions_json=d.get("positions_json", ""),
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

        # Save trades
        for t in result.get("trades", []):
            bt = BacktestTrade(
                run_id=run_id,
                trade_date=date.fromisoformat(t["trade_date"]) if isinstance(t["trade_date"], str) else t["trade_date"],
                stock_code=t["stock_code"],
                direction=t["direction"],
                shares=t["shares"],
                price=t["price"],
                amount=t["amount"],
                cost=t.get("cost", 0),
                slippage=t.get("slippage", 0),
            )
            db.add(bt)

        run.status = "done"
        run.completed_at = datetime.now()
        await db.commit()
        ProgressTracker.complete(run_id, "done")

        return {"run_id": run_id, "status": "done"}
    except asyncio.CancelledError:
        logger.info(f"Backtest {run_id} cancelled")
        run.status = "cancelled"
        run.error_message = "Cancelled by user"
        run.completed_at = datetime.now()
        await db.commit()
        ProgressTracker.complete(run_id, "cancelled")
        return {"run_id": run_id, "status": "cancelled"}
    except Exception as e:
        logger.exception("Backtest failed")
        run.status = "error"
        run.error_message = str(e)[:1000]
        run.completed_at = datetime.now()
        await db.commit()
        ProgressTracker.complete(run_id, "error")
        return {"run_id": run_id, "status": "error", "error": str(e)}


@router.get("/progress/{run_id}")
async def backtest_progress(run_id: str):
    """SSE endpoint for real-time backtest progress."""
    queue = ProgressTracker.get_queue(run_id)
    if not queue:
        # Return current state
        state = ProgressTracker.get_state(run_id)
        if state:
            return {"progress": state.progress, "status": state.status, "step": state.step, "message": state.message}
        return {"progress": 0, "status": "unknown", "step": "", "message": ""}

    async def event_stream():
        try:
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(data)}\n\n"
                    if data.get("status") in ("done", "error", "cancelled"):
                        break
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'status': 'running', 'message': 'heartbeat'})}\n\n"
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/runs/{run_id}/cancel")
async def cancel_backtest(run_id: str):
    ProgressTracker.cancel(run_id)
    return {"run_id": run_id, "status": "cancelling"}


@router.get("/runs")
async def backtest_runs(page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    # P7.3.5: Use COUNT instead of loading all rows
    from sqlalchemy import func
    count_result = await db.execute(select(func.count()).select_from(BacktestRun))
    total = count_result.scalar() or 0
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
        return {"sector_attribution": [], "factor_attribution": [], "daily_attribution": []}

    # Group rows by rebalance days (those with positions_json)
    from ..models.market import Stock, DailyQuote
    from ..engine.brinson import brinson_attribution, simple_factor_attribution

    # Get all stock sectors
    stock_result = await db.execute(select(Stock.code, Stock.industry))
    all_sectors = {r[0]: (r[1] or "Unknown") for r in stock_result.all()}

    rebalance_days = []
    for d in daily_rows:
        if d.positions_json:
            try:
                pos_data = json.loads(d.positions_json)
                weights = pos_data.get("weights", {})
                if weights:
                    rebalance_days.append((d, weights, pos_data.get("sector_weights", {})))
            except (json.JSONDecodeError, TypeError):
                continue

    if len(rebalance_days) < 2:
        # Fallback to simple factor attribution
        returns = [d.daily_return for d in daily_rows]
        bm_returns = [d.benchmark_return for d in daily_rows]
        factor_attr = simple_factor_attribution(returns, bm_returns)
        return {
            "sector_attribution": [],
            "factor_attribution": factor_attr.get("factors", []),
            "daily_attribution": [],
            "alpha_annual": factor_attr.get("alpha_annual", 0),
            "beta": factor_attr.get("beta", 1),
            "r_squared": factor_attr.get("r_squared", 0),
            "idiosyncratic_vol": factor_attr.get("idiosyncratic_vol", 0),
        }

    # Per-rebalance-day Brinson attribution
    daily_attribution = []
    total_allocation = 0.0
    total_selection = 0.0
    total_interaction = 0.0
    all_sector_details: dict[str, dict] = {}
    period_count = 0

    for i in range(len(rebalance_days) - 1):
        day_i, weights_i, _ = rebalance_days[i]
        day_j, _, _ = rebalance_days[i + 1]

        start_date = day_i.trade_date
        end_date = day_j.trade_date

        if not weights_i:
            continue

        stock_codes = list(weights_i.keys())
        if not stock_codes:
            continue

        # Fetch stock prices for this period
        quote_result = await db.execute(
            select(DailyQuote.stock_code, DailyQuote.close, DailyQuote.pre_close)
            .where(
                DailyQuote.stock_code.in_(stock_codes),
                DailyQuote.trade_date >= start_date,
                DailyQuote.trade_date <= end_date,
            )
            .order_by(DailyQuote.trade_date)
        )
        quotes = quote_result.all()

        # Compute stock-level returns over the period
        stock_returns: dict[str, float] = {}
        stock_first_price: dict[str, float] = {}
        stock_last_price: dict[str, float] = {}
        for q in quotes:
            code = q[0]
            if code not in stock_first_price:
                stock_first_price[code] = q[1]
            stock_last_price[code] = q[1]

        for code in stock_codes:
            if code in stock_first_price and code in stock_last_price:
                first_px = stock_first_price[code]
                last_px = stock_last_price[code]
                if first_px and last_px and first_px > 0:
                    stock_returns[code] = (last_px - first_px) / first_px

        if not stock_returns:
            continue

        # Build benchmark: sector-level equal weight, sector return = average of all stocks in sector
        # This makes Brinson decomposition meaningful:
        # - Allocation effect: overweighting outperforming sectors
        # - Selection effect: picking better stocks within a sector
        sector_codes: dict[str, list[str]] = {}
        for code in stock_codes:
            sec = all_sectors.get(code, "Unknown")
            sector_codes.setdefault(sec, []).append(code)

        benchmark_weights: dict[str, float] = {}
        benchmark_returns: dict[str, float] = {}

        # Equal weight across sectors, then equal within sector
        n_sectors = len(sector_codes)
        if n_sectors == 0:
            continue
        for sec, codes in sector_codes.items():
            sec_weight = 1.0 / n_sectors
            per_stock_weight = sec_weight / len(codes)
            # Sector return = equal-weighted average of all stocks in sector
            sec_returns = [stock_returns.get(c, 0) for c in codes]
            avg_sec_return = sum(sec_returns) / len(sec_returns) if sec_returns else 0
            for code in codes:
                benchmark_weights[code] = per_stock_weight
                benchmark_returns[code] = avg_sec_return

        # Run Brinson for this period
        result = brinson_attribution(
            weights_i,
            stock_returns,
            benchmark_weights,
            benchmark_returns,
            all_sectors,
        )

        total_allocation += result["allocation_effect"]
        total_selection += result["selection_effect"]
        total_interaction += result["interaction_effect"]

        daily_attribution.append({
            "date": start_date.isoformat() if hasattr(start_date, "isoformat") else str(start_date),
            "allocation": result["allocation_effect"],
            "selection": result["selection_effect"],
            "interaction": result["interaction_effect"],
            "excess": result["excess_return"],
        })

        # Aggregate sector details
        for sd in result.get("sector_details", []):
            sec = sd["sector"]
            if sec not in all_sector_details:
                all_sector_details[sec] = {
                    "sector": sec,
                    "allocation_effect": 0,
                    "selection_effect": 0,
                    "interaction_effect": 0,
                    "total_effect": 0,
                    "portfolio_weight": 0,
                    "benchmark_weight": 0,
                    "portfolio_return": 0,
                    "benchmark_return": 0,
                }
            all_sector_details[sec]["allocation_effect"] += sd["allocation_effect"]
            all_sector_details[sec]["selection_effect"] += sd["selection_effect"]
            all_sector_details[sec]["interaction_effect"] += sd["interaction_effect"]
            all_sector_details[sec]["total_effect"] += sd["total_effect"]
            all_sector_details[sec]["portfolio_weight"] += sd["portfolio_weight"]
            all_sector_details[sec]["benchmark_weight"] += sd["benchmark_weight"]
            all_sector_details[sec]["portfolio_return"] += sd["portfolio_return"]
            all_sector_details[sec]["benchmark_return"] += sd["benchmark_return"]
        period_count += 1

    # Average sector details
    sector_attr = []
    if period_count > 0:
        for sec, sd in all_sector_details.items():
            sector_attr.append({
                "sector": sec,
                "portfolio_weight": round(sd["portfolio_weight"] / period_count, 4),
                "benchmark_weight": round(sd["benchmark_weight"] / period_count, 4),
                "portfolio_return": round(sd["portfolio_return"] / period_count, 4),
                "benchmark_return": round(sd["benchmark_return"] / period_count, 4),
                "allocation_effect": round(sd["allocation_effect"], 6),
                "selection_effect": round(sd["selection_effect"], 6),
                "interaction_effect": round(sd["interaction_effect"], 6),
                "total_effect": round(sd["total_effect"], 6),
            })

    # Simple factor attribution for overall
    returns = [d.daily_return for d in daily_rows]
    bm_returns = [d.benchmark_return for d in daily_rows]
    factor_attr = simple_factor_attribution(returns, bm_returns)

    return {
        "sector_attribution": sector_attr,
        "factor_attribution": factor_attr.get("factors", []),
        "daily_attribution": daily_attribution,
        "summary": {
            "total_allocation": round(total_allocation, 6),
            "total_selection": round(total_selection, 6),
            "total_interaction": round(total_interaction, 6),
            "total_excess": round(total_allocation + total_selection + total_interaction, 6),
        },
        "alpha_annual": factor_attr.get("alpha_annual", 0),
        "beta": factor_attr.get("beta", 1),
        "r_squared": factor_attr.get("r_squared", 0),
        "idiosyncratic_vol": factor_attr.get("idiosyncratic_vol", 0),
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


@router.get("/runs/{run_id}/trades")
async def backtest_trades(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BacktestTrade).where(BacktestTrade.run_id == run_id).order_by(BacktestTrade.trade_date)
    )
    trades = []
    for t in result.scalars().all():
        trades.append({
            "trade_date": t.trade_date.isoformat() if t.trade_date else "",
            "stock_code": t.stock_code,
            "direction": t.direction,
            "shares": t.shares,
            "price": t.price,
            "amount": t.amount,
            "cost": t.cost,
            "slippage": t.slippage,
        })
    return {"trades": trades}


@router.get("/runs/{run_id}/positions")
async def backtest_positions(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BacktestDaily).where(BacktestDaily.run_id == run_id).order_by(BacktestDaily.trade_date)
    )
    positions = []
    for d in result.scalars().all():
        pos_data = {}
        if d.positions_json:
            try:
                pos_data = json.loads(d.positions_json)
            except (json.JSONDecodeError, TypeError):
                pass
        positions.append({
            "trade_date": d.trade_date.isoformat() if d.trade_date else "",
            "positions": pos_data.get("positions", {}),
            "weights": pos_data.get("weights", {}),
            "sector_weights": pos_data.get("sector_weights", {}),
            "cumulative_pnl": pos_data.get("cumulative_pnl", {}),
        })
    return {"positions": positions}


@router.get("/runs/{run_id}/turnover")
async def backtest_turnover(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BacktestDaily).where(BacktestDaily.run_id == run_id).order_by(BacktestDaily.trade_date)
    )
    daily = result.scalars().all()
    if not daily:
        return {"avg_turnover": 0, "max_turnover": 0, "turnover_series": []}

    turnovers = [d.turnover for d in daily if d.turnover and d.turnover > 0]
    avg_turnover = sum(turnovers) / len(turnovers) if turnovers else 0
    max_turnover = max(turnovers) if turnovers else 0
    trade_count = len(turnovers)

    return {
        "avg_turnover": round(avg_turnover, 6),
        "max_turnover": round(max_turnover, 6),
        "trade_count": trade_count,
        "turnover_series": [
            {"date": d.trade_date.isoformat() if d.trade_date else "", "turnover": d.turnover}
            for d in daily if d.turnover and d.turnover > 0
        ],
    }


@router.get("/runs/{run_id}/report")
async def backtest_report(run_id: str, format: str = "html", db: AsyncSession = Depends(get_db)):
    from ..services.report_service import generate_html_report, generate_csv_export

    if format == "csv":
        csv_content = await generate_csv_export(run_id, db)
        return PlainTextResponse(
            content=csv_content,
            headers={"Content-Disposition": f'attachment; filename="backtest_{run_id}.csv"'},
        )
    else:
        html_content = await generate_html_report(run_id, db)
        return HTMLResponse(content=html_content)


@router.get("/runs/{run_id}/barra")
async def backtest_barra(run_id: str, db: AsyncSession = Depends(get_db)):
    daily_result = await db.execute(
        select(BacktestDaily).where(BacktestDaily.run_id == run_id).order_by(BacktestDaily.trade_date)
    )
    daily_rows = daily_result.scalars().all()
    if not daily_rows:
        return {"factor_contributions": [], "r_squared": 0, "error": "no data"}

    returns = [d.daily_return for d in daily_rows]
    dates = [d.trade_date for d in daily_rows if d.trade_date]

    from ..engine.barra_attribution import barra_factor_attribution

    result = await barra_factor_attribution(
        db, returns, dates, universe_size=500,
    )

    return {
        "factor_contributions": result.factor_contributions,
        "specific_return": result.specific_return,
        "r_squared": result.r_squared,
        "total_explained": result.total_explained,
        "total_return": result.total_return,
        "factor_names": result.factor_names,
    }


@router.delete("/runs/{run_id}")
async def delete_backtest(run_id: str, db: AsyncSession = Depends(get_db)):
    # Delete in correct order: trades, daily, summary, then run
    for model in [BacktestTrade, BacktestDaily, BacktestSummary]:
        result = await db.execute(select(model).where(model.run_id == run_id))
        for item in result.scalars().all():
            await db.delete(item)
    # Delete the run itself
    run_result = await db.execute(select(BacktestRun).where(BacktestRun.id == run_id))
    run = run_result.scalar_one_or_none()
    if run:
        await db.delete(run)
    await db.commit()
    return {"ok": True}


@router.get("/compare")
async def compare_backtests(run_ids: str = "", db: AsyncSession = Depends(get_db)):
    """Compare multiple backtest runs. Pass comma-separated run_ids."""
    ids = [rid.strip() for rid in run_ids.split(",") if rid.strip()]
    if not ids:
        return {"runs": [], "daily": []}

    # P7.3.4: Batch queries instead of per-run queries
    # Query 1: All run metadata in one query
    run_result = await db.execute(
        select(BacktestRun).where(BacktestRun.id.in_(ids))
    )
    runs_map = {r.id: r for r in run_result.scalars().all()}

    # Query 2: All summaries in one query
    summary_result = await db.execute(
        select(BacktestSummary).where(BacktestSummary.run_id.in_(ids))
    )
    summary_map = {s.run_id: s for s in summary_result.scalars().all()}

    # Query 3: All daily data in one query
    daily_result = await db.execute(
        select(BacktestDaily)
        .where(BacktestDaily.run_id.in_(ids))
        .order_by(BacktestDaily.run_id, BacktestDaily.trade_date)
    )
    daily_by_run: dict[str, list] = {rid: [] for rid in ids}
    for d in daily_result.scalars().all():
        if d.run_id in daily_by_run:
            daily_by_run[d.run_id].append({
                "date": d.trade_date.isoformat() if d.trade_date else "",
                "portfolio_value": d.portfolio_value,
                "benchmark_value": d.benchmark_value,
                "daily_return": d.daily_return,
            })

    # Build response
    runs_data = {}
    for rid in ids:
        r = runs_map.get(rid)
        if not r:
            continue
        s = summary_map.get(rid)
        runs_data[rid] = {
            "id": r.id,
            "name": r.name,
            "config": r.config_json,
            "status": r.status,
            "summary": {
                "total_return": s.total_return if s else 0,
                "annual_return": s.annual_return if s else 0,
                "sharpe": s.sharpe if s else 0,
                "max_drawdown": s.max_drawdown if s else 0,
                "volatility": s.volatility if s else 0,
                "calmar": s.calmar if s else 0,
                "alpha": s.alpha if s else 0,
                "beta": s.beta if s else 1,
                "win_rate": s.win_rate if s else 0,
                "profit_factor": s.profit_factor if s else 0,
            } if s else None,
        }

    return {
        "runs": [runs_data.get(rid) for rid in ids if rid in runs_data],
        "daily": daily_by_run,
    }


@router.post("/optimize")
async def optimize_backtest(config: dict, db: AsyncSession = Depends(get_db)):
    param_grid = config.pop("param_grid", {})
    objective = config.get("objective", "sharpe_ratio")
    max_trials = config.get("max_trials", 30)
    max_concurrency = config.get("max_concurrency", 4)

    opt = Optimizer(db)
    result = await opt.grid_search(config, param_grid, objective, max_trials, max_concurrency)
    return result


@router.post("/walk-forward")
async def walk_forward(config: dict, db: AsyncSession = Depends(get_db)):
    train_window = config.get("train_window", 252)
    test_window = config.get("test_window", 63)
    objective = config.get("objective", "sharpe_ratio")
    param_grid = config.get("param_grid")
    anchored = config.get("anchored", False)
    max_trials = config.get("max_trials_per_window", 20)

    base_config = {
        k: v for k, v in config.items()
        if k not in ("train_window", "test_window", "objective", "param_grid",
                      "anchored", "max_trials_per_window", "max_trials")
    }

    opt = Optimizer(db)
    result = await opt.walk_forward_analysis(
        base_config, train_window, test_window, objective,
        param_grid, anchored, max_trials,
    )
    return result
