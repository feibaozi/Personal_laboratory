"""Barra-style multi-factor attribution analysis.

Decomposes portfolio returns into contributions from common style factors:
size, value, momentum, quality, volatility, liquidity.

P7.2.3: Optimized to use bulk queries instead of per-factor per-day queries.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.market import DailyQuote, FinancialReport, Stock


# ── Bulk data loader ─────────────────────────────────────────────────────────

async def _load_barra_data(
    db: AsyncSession,
    stock_codes: list[str],
    start_date: date,
    end_date: date,
) -> dict:
    """Load all data needed for Barra attribution in minimal DB queries.

    Returns dict with:
        quotes_df: DataFrame of daily quotes (code, date, close, pb_ratio, turnover_rate, change_pct)
        financials_df: DataFrame of financial reports (code, report_date, total_assets, roe_val)
    """
    # Query 1: All daily quotes for the full period
    lookback = start_date - timedelta(days=400)  # For momentum/volatility
    quote_result = await db.execute(
        select(
            DailyQuote.stock_code,
            DailyQuote.trade_date,
            DailyQuote.close,
            DailyQuote.pb_ratio,
            DailyQuote.turnover_rate,
            DailyQuote.change_pct,
        ).where(
            DailyQuote.stock_code.in_(stock_codes),
            DailyQuote.trade_date >= lookback,
            DailyQuote.trade_date <= end_date,
        )
    )
    quote_rows = quote_result.all()
    quotes_df = pd.DataFrame(
        quote_rows,
        columns=["code", "date", "close", "pb_ratio", "turnover_rate", "change_pct"],
    ) if quote_rows else pd.DataFrame()

    # Query 2: All financial reports up to end_date
    fin_result = await db.execute(
        select(
            FinancialReport.stock_code,
            FinancialReport.report_date,
            FinancialReport.total_assets,
            FinancialReport.roe_val,
        ).where(
            FinancialReport.stock_code.in_(stock_codes),
            FinancialReport.report_date <= end_date,
        )
        .order_by(FinancialReport.stock_code, FinancialReport.report_date.desc())
    )
    fin_rows = fin_result.all()
    financials_df = pd.DataFrame(
        fin_rows,
        columns=["code", "report_date", "total_assets", "roe_val"],
    ) if fin_rows else pd.DataFrame()

    return {"quotes_df": quotes_df, "financials_df": financials_df}


# ── Factor exposure calculation (from pre-loaded data) ───────────────────────

def compute_factor_exposures_from_data(
    stock_codes: list[str],
    target_date: date,
    quotes_df: pd.DataFrame,
    financials_df: pd.DataFrame,
) -> dict[str, dict[str, float]]:
    """Compute Barra-style factor exposures from pre-loaded DataFrames.

    No DB queries — all computation is in-memory.
    """
    if not stock_codes:
        return {}

    exposures: dict[str, dict[str, float]] = {code: {} for code in stock_codes}

    # Filter quotes for target_date
    qdf = quotes_df[quotes_df["date"] == target_date] if not quotes_df.empty else pd.DataFrame()

    # 1. Size: ln(total_assets) from latest financial report per stock
    if not financials_df.empty:
        fin_before = financials_df[financials_df["report_date"] <= target_date]
        # Keep latest per stock (already sorted desc by report_date)
        latest_fin = fin_before.drop_duplicates(subset=["code"], keep="first")
        size_raw: dict[str, float] = {}
        for _, row in latest_fin.iterrows():
            code = row["code"]
            ta = row["total_assets"]
            if ta and ta > 0 and code in exposures:
                size_raw[code] = np.log(ta)

        if size_raw:
            vals = np.array(list(size_raw.values()))
            mean, std = vals.mean(), vals.std(ddof=1) if len(vals) > 1 else 1
            std = std if std > 0 else 1
            for code in stock_codes:
                if code in size_raw:
                    exposures[code]["size"] = float((size_raw[code] - mean) / std)
                else:
                    exposures[code]["size"] = 0.0

    # 2. Value: 1/PB from daily quotes
    if not qdf.empty:
        pb_map = {}
        for _, row in qdf.iterrows():
            code = row["code"]
            pb = row["pb_ratio"]
            if pb and pb > 0 and code in exposures:
                pb_map[code] = 1.0 / pb

        if pb_map:
            vals = np.array(list(pb_map.values()))
            mean, std = vals.mean(), vals.std(ddof=1) if len(vals) > 1 else 1
            std = std if std > 0 else 1
            for code in stock_codes:
                if code in pb_map:
                    exposures[code]["value"] = float((pb_map[code] - mean) / std)
                else:
                    exposures[code]["value"] = 0.0

    # 3. Momentum: 12-month cumulative return
    mom_start = target_date - timedelta(days=365)
    if not quotes_df.empty:
        mom_q = quotes_df[
            (quotes_df["date"] >= mom_start) &
            (quotes_df["date"] <= target_date)
        ]
        mom_raw: dict[str, float] = {}
        for code in stock_codes:
            code_q = mom_q[mom_q["code"] == code].sort_values("date")
            if len(code_q) >= 2:
                first_px = code_q.iloc[0]["close"]
                last_px = code_q.iloc[-1]["close"]
                if first_px and last_px and first_px > 0:
                    mom_raw[code] = (last_px - first_px) / first_px

        if mom_raw:
            vals = np.array(list(mom_raw.values()))
            mean, std = vals.mean(), vals.std(ddof=1) if len(vals) > 1 else 1
            std = std if std > 0 else 1
            for code in stock_codes:
                if code in mom_raw:
                    exposures[code]["momentum"] = float((mom_raw[code] - mean) / std)
                else:
                    exposures[code]["momentum"] = 0.0

    # 4. Quality: ROE from financial reports (latest per stock)
    if not financials_df.empty:
        fin_before = financials_df[financials_df["report_date"] <= target_date]
        latest_fin = fin_before.drop_duplicates(subset=["code"], keep="first")
        roe_data: dict[str, float] = {}
        for _, row in latest_fin.iterrows():
            code = row["code"]
            roe = row["roe_val"]
            if roe is not None and code in exposures:
                roe_data[code] = roe

        if roe_data:
            vals = np.array(list(roe_data.values()))
            mean, std = vals.mean(), vals.std(ddof=1) if len(vals) > 1 else 1
            std = std if std > 0 else 1
            for code in stock_codes:
                if code in roe_data:
                    exposures[code]["quality"] = float((roe_data[code] - mean) / std)
                else:
                    exposures[code]["quality"] = 0.0

    # 5. Volatility: 60-day return standard deviation
    vol_start = target_date - timedelta(days=90)
    if not quotes_df.empty:
        vol_q = quotes_df[
            (quotes_df["date"] >= vol_start) &
            (quotes_df["date"] <= target_date)
        ]
        vol_raw: dict[str, float] = {}
        for code in stock_codes:
            code_q = vol_q[vol_q["code"] == code].sort_values("date")
            prices = code_q["close"].dropna().values
            if len(prices) >= 20:
                returns = np.diff(np.log(prices.astype(float)))
                vol_raw[code] = float(returns.std(ddof=1) * np.sqrt(252))

        if vol_raw:
            vals = np.array(list(vol_raw.values()))
            mean, std = vals.mean(), vals.std(ddof=1) if len(vals) > 1 else 1
            std = std if std > 0 else 1
            for code in stock_codes:
                if code in vol_raw:
                    exposures[code]["volatility"] = float((vol_raw[code] - mean) / std)
                else:
                    exposures[code]["volatility"] = 0.0

    # 6. Liquidity: 1/turnover_rate averaged over recent days
    if not quotes_df.empty:
        liq_q = quotes_df[
            (quotes_df["date"] >= vol_start) &
            (quotes_df["date"] <= target_date)
        ]
        liq_raw: dict[str, float] = {}
        for code in stock_codes:
            code_q = liq_q[liq_q["code"] == code]
            tr = code_q["turnover_rate"].dropna()
            tr = tr[tr > 0]
            if len(tr) > 0:
                liq_raw[code] = float(np.mean(1.0 / tr.values))

        if liq_raw:
            vals = np.array(list(liq_raw.values()))
            mean, std = vals.mean(), vals.std(ddof=1) if len(vals) > 1 else 1
            std = std if std > 0 else 1
            for code in stock_codes:
                if code in liq_raw:
                    exposures[code]["liquidity"] = float((liq_raw[code] - mean) / std)
                else:
                    exposures[code]["liquidity"] = 0.0

    return exposures


# ── Factor return calculation (from pre-loaded data) ─────────────────────────

def compute_factor_returns_from_data(
    factor_name: str,
    stock_codes: list[str],
    trading_dates: list[date],
    quotes_df: pd.DataFrame,
    financials_df: pd.DataFrame,
) -> np.ndarray:
    """Compute daily factor returns from pre-loaded data. No DB queries."""
    if len(trading_dates) < 2:
        return np.array([])

    factor_returns = []

    for i, dt in enumerate(trading_dates[:-1]):
        next_dt = trading_dates[i + 1]

        # Get exposures for current date
        exposures = compute_factor_exposures_from_data(
            stock_codes, dt, quotes_df, financials_df,
        )

        # Get next-day returns from pre-loaded data
        next_day_q = quotes_df[quotes_df["date"] == next_dt] if not quotes_df.empty else pd.DataFrame()
        next_returns: dict[str, float] = {}
        for _, row in next_day_q.iterrows():
            code = row["code"]
            chg = row["change_pct"]
            if code in exposures and chg is not None:
                next_returns[code] = float(chg)

        # Rank stocks by factor exposure
        ranked = [
            (code, exposures.get(code, {}).get(factor_name, 0))
            for code in stock_codes
            if code in next_returns
        ]
        if len(ranked) < 30:
            continue

        ranked.sort(key=lambda x: x[1])
        n = len(ranked)
        top_n = max(int(n * 0.3), 5)
        bottom_n = max(int(n * 0.3), 5)

        top_codes = {c for c, _ in ranked[-top_n:]}
        bottom_codes = {c for c, _ in ranked[:bottom_n]}

        top_ret = np.mean([next_returns.get(c, 0) for c in top_codes])
        bottom_ret = np.mean([next_returns.get(c, 0) for c in bottom_codes])

        factor_returns.append(top_ret - bottom_ret)

    return np.array(factor_returns)


# ── Barra multi-factor attribution ───────────────────────────────────────────

@dataclass
class BarraAttributionResult:
    factor_contributions: list[dict] = field(default_factory=list)
    specific_return: float = 0.0
    r_squared: float = 0.0
    total_explained: float = 0.0
    total_return: float = 0.0
    factor_names: list[str] = field(default_factory=list)


async def barra_factor_attribution(
    db: AsyncSession,
    portfolio_daily_returns: list[float],
    portfolio_dates: list[date],
    factor_names: Optional[list[str]] = None,
    universe_size: int = 500,
) -> BarraAttributionResult:
    """Multi-factor regression-based attribution.

    P7.2.3: Uses bulk data loading (2 DB queries total) instead of
    per-factor per-day queries (previously 1500+ queries).
    """
    if factor_names is None:
        factor_names = ["size", "value", "momentum", "quality", "volatility", "liquidity"]

    if len(portfolio_daily_returns) < 20 or len(portfolio_dates) < 20:
        return BarraAttributionResult()

    portfolio_returns = np.array(portfolio_daily_returns)

    # Get universe stocks
    universe_result = await db.execute(
        select(DailyQuote.stock_code)
        .where(DailyQuote.trade_date == portfolio_dates[0])
        .limit(universe_size)
    )
    universe_codes = [r[0] for r in universe_result.all()]
    if not universe_codes:
        return BarraAttributionResult()

    start_date = portfolio_dates[0]
    end_date = portfolio_dates[-1]

    # P7.2.3: Bulk load all data in 2 queries
    data = await _load_barra_data(db, universe_codes, start_date, end_date)
    quotes_df = data["quotes_df"]
    financials_df = data["financials_df"]

    # Get trading dates from pre-loaded data
    if quotes_df.empty:
        return BarraAttributionResult()
    trading_dates = sorted(quotes_df[
        (quotes_df["date"] >= start_date) & (quotes_df["date"] <= end_date)
    ]["date"].unique().tolist())

    # Compute factor returns for each factor (in-memory, no DB queries)
    factor_return_matrix: dict[str, np.ndarray] = {}
    for fn in factor_names:
        fr = compute_factor_returns_from_data(
            fn, universe_codes, trading_dates, quotes_df, financials_df,
        )
        if len(fr) > 0:
            factor_return_matrix[fn] = fr

    if not factor_return_matrix:
        return BarraAttributionResult()

    # Align lengths
    min_len = min(
        len(portfolio_returns),
        *(len(v) for v in factor_return_matrix.values()),
    )
    if min_len < 10:
        return BarraAttributionResult()

    aligned_portfolio = portfolio_returns[:min_len]

    # Build design matrix X (factor returns)
    avail_factors = [f for f in factor_names if f in factor_return_matrix]
    X_cols = [factor_return_matrix[fn][:min_len] for fn in avail_factors]
    X = np.column_stack(X_cols)

    # Add intercept
    X = np.column_stack([np.ones(min_len), X])

    # OLS regression
    try:
        beta, residuals, rank, singular = np.linalg.lstsq(X, aligned_portfolio, rcond=None)
    except np.linalg.LinAlgError:
        return BarraAttributionResult()

    # Calculate R²
    y_pred = X @ beta
    ss_res = np.sum((aligned_portfolio - y_pred) ** 2)
    ss_tot = np.sum((aligned_portfolio - aligned_portfolio.mean()) ** 2)
    r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0

    # Factor contributions: beta * mean(factor_return) * 252 (annualized)
    total_return = float(np.mean(aligned_portfolio) * 252)
    intercept = float(beta[0])
    factor_contributions = []

    for i, fn in enumerate(avail_factors):
        factor_beta = float(beta[i + 1])
        factor_rets = factor_return_matrix[fn][:min_len]
        mean_factor_return = float(np.mean(factor_rets))
        contribution = factor_beta * mean_factor_return * 252
        factor_std = float(np.std(factor_rets, ddof=1))
        t_stat = float(factor_beta / (factor_std / np.sqrt(min_len))) if factor_std > 0 else 0

        factor_contributions.append({
            "factor": fn,
            "beta": round(factor_beta, 4),
            "mean_daily_return": round(mean_factor_return, 6),
            "annual_contribution": round(contribution, 6),
            "t_stat": round(t_stat, 4),
        })

    total_explained = sum(c["annual_contribution"] for c in factor_contributions)
    specific_return = total_return - total_explained - intercept * 252

    factor_contributions.append({
        "factor": "specific",
        "beta": 1.0,
        "mean_daily_return": 0,
        "annual_contribution": round(specific_return, 6),
        "t_stat": 0,
    })

    return BarraAttributionResult(
        factor_contributions=factor_contributions,
        specific_return=round(specific_return, 6),
        r_squared=round(float(r_squared), 4),
        total_explained=round(total_explained, 6),
        total_return=round(total_return, 6),
        factor_names=avail_factors,
    )
