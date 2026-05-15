from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date

from ..database import get_db
from ..models.factor import FactorDefinition, FactorValue
from ..models.market import Stock, DailyQuote
from ..engine.factor_computer import FactorComputer, save_factor_values
from ..engine.factor_backtester import FactorBacktester

router = APIRouter(prefix="/api/v1/factor", tags=["factor"])


async def _codes_with_data(db: AsyncSession) -> list[str]:
    r = await db.execute(select(DailyQuote.stock_code).distinct())
    return [row[0] for row in r.all()]


@router.get("/library")
async def factor_library(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FactorDefinition).order_by(FactorDefinition.category, FactorDefinition.id))
    factors = []
    for f in result.scalars().all():
        factors.append({
            "id": f.id, "name": f.name, "category": f.category,
            "description": f.description, "default_params": f.default_params,
            "is_builtin": f.is_builtin,
        })
    return {"factors": factors}


@router.post("/compute")
async def compute_factor(
    factor_name: str,
    start_date: str,
    end_date: str,
    universe: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    all_codes = await _codes_with_data(db)
    if not all_codes:
        all_codes = [r[0] for r in (await db.execute(select(Stock.code).limit(500))).all()]
    if universe:
        all_codes = all_codes[:int(universe)] if universe.isdigit() else all_codes

    computer = FactorComputer(db)
    sd = date.fromisoformat(start_date)
    ed = date.fromisoformat(end_date)

    date_result = await db.execute(
        select(DailyQuote.trade_date).distinct()
        .where(DailyQuote.trade_date >= sd)
        .where(DailyQuote.trade_date <= ed)
        .order_by(DailyQuote.trade_date)
    )
    dates = [r[0] for r in date_result.all()]
    if not dates:
        return {"job_id": None, "status": "error", "error": "no trading data in range"}

    total = 0
    for d in dates[::21]:
        vals = await computer.compute_one(factor_name, all_codes, d)
        await save_factor_values(db, factor_name, d, vals)
        total += 1

    await db.commit()
    return {"job_id": None, "status": "done", "dates_computed": total, "stocks_per_date": len(all_codes)}


@router.get("/values")
async def factor_values(
    factor_id: int,
    date: str,
    stock_codes: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(FactorValue).where(
        FactorValue.factor_id == factor_id,
        FactorValue.trade_date == date.fromisoformat(date),
    )
    if stock_codes:
        codes = stock_codes.split(",")
        q = q.where(FactorValue.stock_code.in_(codes))
    result = await db.execute(q)
    values = [{"stock_code": v.stock_code, "date": v.trade_date.isoformat() if v.trade_date else "", "value": v.value}
              for v in result.scalars().all()]
    return {"values": values}


@router.post("/backtest/ic")
async def factor_backtest_ic(
    factor_name: str,
    start_date: str,
    end_date: str,
    universe: str | None = None,
    period: str = "monthly",
    n_quantiles: int = 5,
    db: AsyncSession = Depends(get_db),
):
    all_codes = await _codes_with_data(db)
    if not all_codes:
        all_codes = [r[0] for r in (await db.execute(select(Stock.code).limit(500))).all()]

    backtester = FactorBacktester(db)
    result = await backtester.run_ic_analysis(
        factor_name=factor_name,
        stock_codes=all_codes,
        start_date=date.fromisoformat(start_date),
        end_date=date.fromisoformat(end_date),
        period=period,
        n_quantiles=n_quantiles,
    )
    return result


@router.post("/screen")
async def factor_screen(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    conditions = body.get("conditions", [])
    target_date = date.fromisoformat(body["date"])
    universe = body.get("universe")
    top_n = body.get("top_n", 50)

    codes_result = await db.execute(select(Stock.code))
    all_codes = [r[0] for r in codes_result.all()]
    codes_with_data = set(await _codes_with_data(db))

    computer = FactorComputer(db)

    stock_scores: dict[str, float] = {}

    for condition in conditions:
        factor_name = condition["factor_name"]
        direction = condition.get("direction", "positive")

        vals = await computer.compute_one(factor_name, list(codes_with_data)[:500], target_date)

        if not vals:
            continue

        vals_list = [v for v in vals.values() if not (v is None)]
        if not vals_list:
            continue
        mean_v = sum(vals_list) / len(vals_list)
        std_v = (sum((v - mean_v) ** 2 for v in vals_list) / len(vals_list)) ** 0.5 or 1

        for code, val in vals.items():
            if val is None:
                continue
            z = (val - mean_v) / std_v
            score = z if direction == "positive" else -z
            stock_scores[code] = stock_scores.get(code, 0) + score

    ranked = sorted(stock_scores.items(), key=lambda x: x[1], reverse=True)

    result_codes = ranked[:top_n]
    name_result = await db.execute(select(Stock.code, Stock.name).where(Stock.code.in_([c for c, _ in result_codes])))
    name_map = {r[0]: r[1] for r in name_result.all()}

    results = []
    for code, score in result_codes:
        item = {"code": code, "name": name_map.get(code, ""), "composite_score": round(score, 4)}
        results.append(item)

    return {"results": results, "total": len(results)}


@router.post("/correlation")
async def factor_correlation(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    factor_names = body.get("factor_names", [])
    date_str = body.get("date_str", "")
    all_codes = await _codes_with_data(db)
    if not all_codes:
        all_codes = [r[0] for r in (await db.execute(select(Stock.code).limit(500))).all()]

    computer = FactorComputer(db)
    d = date.fromisoformat(date_str)
    factor_data: dict[str, dict[str, float]] = {}

    for fname in factor_names:
        vals = await computer.compute_one(fname, all_codes, d)
        factor_data[fname] = vals

    import numpy as np
    common_codes = None
    for vals in factor_data.values():
        if common_codes is None:
            common_codes = set(vals.keys())
        else:
            common_codes &= set(vals.keys())

    if not common_codes or len(common_codes) < 3:
        return {"correlation_matrix": [], "factor_names": factor_names}

    n = len(factor_names)
    corr_matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                corr_matrix[i][j] = 1.0
                continue
            a = np.array([factor_data[factor_names[i]].get(c, np.nan) for c in common_codes])
            b = np.array([factor_data[factor_names[j]].get(c, np.nan) for c in common_codes])
            mask = ~np.isnan(a) & ~np.isnan(b)
            if mask.sum() >= 3:
                corr_matrix[i][j] = float(np.corrcoef(a[mask], b[mask])[0, 1]) if mask.sum() > 2 else 0
            else:
                corr_matrix[i][j] = 0

    return {"correlation_matrix": corr_matrix, "factor_names": factor_names}
