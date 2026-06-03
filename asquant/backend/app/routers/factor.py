from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date

from ..database import get_db
from ..models.factor import FactorDefinition, FactorValue
from ..models.market import Stock, DailyQuote
from ..engine.factor_computer import FactorComputer, save_factor_values
from ..engine.factor_backtester import FactorBacktester
from ..services.factor_analysis_service import FactorAnalyzer

router = APIRouter(prefix="/api/v1/factor", tags=["factor"])


async def _codes_with_data(db: AsyncSession) -> list[str]:
    r = await db.execute(select(DailyQuote.stock_code).distinct())
    return [row[0] for row in r.all()]


async def _latest_trade_date(db: AsyncSession, before: date | None = None) -> date | None:
    q = select(DailyQuote.trade_date).distinct()
    if before:
        q = q.where(DailyQuote.trade_date <= before)
    q = q.order_by(DailyQuote.trade_date.desc()).limit(1)
    r = await db.execute(q)
    row = r.first()
    return row[0] if row else None


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


@router.get("/latest-date")
async def latest_trade_date(db: AsyncSession = Depends(get_db)):
    d = await _latest_trade_date(db)
    return {"date": d.isoformat() if d else None}


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
    target_date_str = body["date"]
    universe = body.get("universe")
    top_n = body.get("top_n", 50)

    codes_result = await db.execute(select(Stock.code))
    all_codes = [r[0] for r in codes_result.all()]
    codes_with_data = set(await _codes_with_data(db))

    target_date = date.fromisoformat(target_date_str)
    actual_date = await _latest_trade_date(db, target_date)
    if actual_date is None:
        return {"results": [], "total": 0}

    computer = FactorComputer(db)

    stock_scores: dict[str, float] = {}

    for condition in conditions:
        factor_name = condition["factor_name"]
        direction = condition.get("direction", "positive")

        vals = await computer.compute_one(factor_name, list(codes_with_data)[:500], actual_date)

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

    target_date = date.fromisoformat(date_str) if date_str else date.today()
    actual_date = await _latest_trade_date(db, target_date)
    if actual_date is None:
        return {"correlation_matrix": [], "factor_names": factor_names}

    computer = FactorComputer(db)
    factor_data: dict[str, dict[str, float]] = {}

    for fname in factor_names:
        vals = await computer.compute_one(fname, all_codes, actual_date)
        if vals:
            factor_data[fname] = vals

    import numpy as np
    common_codes = None
    for vals in factor_data.values():
        if common_codes is None:
            common_codes = set(vals.keys())
        else:
            common_codes &= set(vals.keys())

    if not common_codes or len(common_codes) < 2:
        return {"correlation_matrix": [], "factor_names": list(factor_data.keys())}

    names = list(factor_data.keys())
    n = len(names)
    corr_matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                corr_matrix[i][j] = 1.0
                continue
            a = np.array([factor_data[names[i]].get(c, np.nan) for c in common_codes])
            b = np.array([factor_data[names[j]].get(c, np.nan) for c in common_codes])
            mask = ~np.isnan(a) & ~np.isnan(b)
            if mask.sum() >= 2:
                corr_matrix[i][j] = round(float(np.corrcoef(a[mask], b[mask])[0, 1]), 4)
            else:
                corr_matrix[i][j] = 0.0

    return {"correlation_matrix": corr_matrix, "factor_names": names}


@router.post("/ic-analysis")
async def ic_analysis(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    factor_name = body.get("factor_name", "return_1m")
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    period = body.get("period", "monthly")
    ic_type = body.get("ic_type", "rank")

    all_codes = await _codes_with_data(db)
    if not all_codes:
        all_codes = [r[0] for r in (await db.execute(select(Stock.code).limit(500))).all()]

    sd = date.fromisoformat(start_date)
    ed = date.fromisoformat(end_date)
    actual_ed = await _latest_trade_date(db, ed)
    if actual_ed:
        ed = actual_ed

    analyzer = FactorAnalyzer(db)
    result = await analyzer.compute_ic_analysis(
        factor_name=factor_name,
        stock_codes=all_codes,
        start_date=sd,
        end_date=ed,
        period=period,
        ic_type=ic_type,
    )
    return result


@router.post("/decile-analysis")
async def decile_analysis(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    factor_name = body.get("factor_name", "return_1m")
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    period = body.get("period", "monthly")
    n_groups = body.get("n_groups", 10)

    all_codes = await _codes_with_data(db)
    if not all_codes:
        all_codes = [r[0] for r in (await db.execute(select(Stock.code).limit(500))).all()]

    sd = date.fromisoformat(start_date)
    ed = date.fromisoformat(end_date)
    actual_ed = await _latest_trade_date(db, ed)
    if actual_ed:
        ed = actual_ed

    analyzer = FactorAnalyzer(db)
    result = await analyzer.compute_decile_backtest(
        factor_name=factor_name,
        stock_codes=all_codes,
        start_date=sd,
        end_date=ed,
        period=period,
        n_groups=n_groups,
    )
    return result


@router.post("/stats")
async def factor_stats(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    factor_name = body.get("factor_name", "return_1m")
    target_date_str = body.get("date")

    all_codes = await _codes_with_data(db)
    if not all_codes:
        all_codes = [r[0] for r in (await db.execute(select(Stock.code).limit(500))).all()]

    target_date = date.fromisoformat(target_date_str) if target_date_str else date.today()
    actual_date = await _latest_trade_date(db, target_date)
    if actual_date is None:
        return {"coverage": 0, "n_stocks": 0}

    analyzer = FactorAnalyzer(db)
    result = await analyzer.compute_factor_stats(
        factor_name=factor_name,
        stock_codes=all_codes,
        target_date=actual_date,
    )
    return result


@router.post("/correlation-matrix")
async def correlation_matrix(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    factor_names = body.get("factor_names", [])
    target_date_str = body.get("date")

    all_codes = await _codes_with_data(db)
    if not all_codes:
        all_codes = [r[0] for r in (await db.execute(select(Stock.code).limit(500))).all()]

    target_date = date.fromisoformat(target_date_str) if target_date_str else date.today()
    actual_date = await _latest_trade_date(db, target_date)
    if actual_date is None:
        return {"factor_names": factor_names, "matrix": []}

    analyzer = FactorAnalyzer(db)
    result = await analyzer.compute_correlation_matrix(
        factor_names=factor_names,
        stock_codes=all_codes,
        target_date=actual_date,
    )
    result["actual_date"] = actual_date.isoformat()
    return result


@router.post("/batch-ic")
async def batch_ic_analysis(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    period = body.get("period", "monthly")
    ic_type = body.get("ic_type", "rank")
    categories = body.get("categories")

    all_codes = await _codes_with_data(db)
    if not all_codes:
        all_codes = [r[0] for r in (await db.execute(select(Stock.code).limit(500))).all()]

    sd = date.fromisoformat(start_date)
    ed = date.fromisoformat(end_date)
    actual_ed = await _latest_trade_date(db, ed)
    if actual_ed:
        ed = actual_ed

    analyzer = FactorAnalyzer(db)
    results = await analyzer.batch_ic_analysis(
        stock_codes=all_codes,
        start_date=sd,
        end_date=ed,
        period=period,
        ic_type=ic_type,
        categories=categories,
    )
    return {"results": results, "total": len(results)}


@router.post("/batch-decile")
async def batch_decile_analysis(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    period = body.get("period", "monthly")
    categories = body.get("categories")

    all_codes = await _codes_with_data(db)
    if not all_codes:
        all_codes = [r[0] for r in (await db.execute(select(Stock.code).limit(500))).all()]

    sd = date.fromisoformat(start_date)
    ed = date.fromisoformat(end_date)
    actual_ed = await _latest_trade_date(db, ed)
    if actual_ed:
        ed = actual_ed

    analyzer = FactorAnalyzer(db)
    results = await analyzer.batch_decile_backtest(
        stock_codes=all_codes,
        start_date=sd,
        end_date=ed,
        period=period,
        categories=categories,
    )
    return {"results": results, "total": len(results)}


@router.post("/redundant-factors")
async def find_redundant_factors(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    target_date_str = body.get("date")
    threshold = body.get("threshold", 0.8)
    categories = body.get("categories")

    all_codes = await _codes_with_data(db)
    if not all_codes:
        all_codes = [r[0] for r in (await db.execute(select(Stock.code).limit(500))).all()]

    target_date = date.fromisoformat(target_date_str) if target_date_str else date.today()
    actual_date = await _latest_trade_date(db, target_date)
    if actual_date is None:
        return {"redundant": []}

    analyzer = FactorAnalyzer(db)
    results = await analyzer.find_redundant_factors(
        stock_codes=all_codes,
        target_date=actual_date,
        threshold=threshold,
        categories=categories,
    )
    return {"redundant": results, "total": len(results)}


@router.get("/categories")
async def factor_categories():
    from ..engine.factor_computer import _get_builtin_registry
    registry = _get_builtin_registry()
    cats = registry.categories()
    result = []
    for c in cats:
        factors = registry.by_category(c)
        result.append({
            "category": c,
            "count": len(factors),
            "factors": [{"name": n, "description": f.description} for n, f in factors.items()],
        })
    return {"categories": result}
