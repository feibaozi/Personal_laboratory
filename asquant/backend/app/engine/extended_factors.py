import numpy as np
import pandas as pd
from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.market import FinancialReport, NorthBoundDaily, MarginDetail
from .factor_factory import Factor


def _get_close(prices: pd.DataFrame, code: str) -> float | None:
    if prices.empty or code not in prices.columns:
        return None
    col = prices[code].dropna()
    if col.empty:
        return None
    return float(col.iloc[-1])


def _get_market_cap(code: str, close_px: float, stock_info: dict, fin: pd.DataFrame) -> float:
    si = stock_info.get(code, {})
    shares = si.get("total_shares")
    if shares and shares > 0:
        return shares * close_px
    if fin is not None and not fin.empty:
        fin_row = fin[fin["code"] == code]
        if not fin_row.empty:
            ts = fin_row.iloc[0].get("total_shares_val")
            if ts and ts > 0:
                return ts * close_px
    return 0


# ================== Cash Flow / Valuation Factors ==================

async def _compute_fcf_yield(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    fin = ctx.get("financials", pd.DataFrame())
    si = ctx.get("stock_info", {})
    if fin.empty:
        return {}
    result = {}
    for code in codes:
        close_px = _get_close(prices, code)
        if close_px is None or close_px <= 0:
            continue
        mcap = _get_market_cap(code, close_px, si, fin)
        if mcap <= 0:
            continue
        fin_row = fin[fin["code"] == code] if not fin.empty else pd.DataFrame()
        if fin_row.empty:
            continue
        fcf = fin_row.iloc[0].get("free_cash_flow")
        if fcf and fcf > 0:
            result[code] = fcf / mcap
    return result


async def _compute_pcf_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    fin = ctx.get("financials", pd.DataFrame())
    si = ctx.get("stock_info", {})
    if fin.empty:
        return {}
    result = {}
    for code in codes:
        close_px = _get_close(prices, code)
        if close_px is None or close_px <= 0:
            continue
        mcap = _get_market_cap(code, close_px, si, fin)
        if mcap <= 0:
            continue
        fin_row = fin[fin["code"] == code] if not fin.empty else pd.DataFrame()
        if fin_row.empty:
            continue
        ocf = fin_row.iloc[0].get("operating_cash_flow")
        if ocf and ocf > 0:
            result[code] = mcap / ocf
    return result


async def _compute_ocf_to_debt(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        ocf = row.get("operating_cash_flow")
        debt = row.get("total_liabilities")
        if ocf and debt and debt > 0:
            result[code] = ocf / debt
    return result


async def _compute_cash_conversion(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        ocf = row.get("operating_cash_flow")
        np_val = row.get("net_profit_parent")
        if ocf and np_val and abs(np_val) > 0:
            result[code] = ocf / np_val
    return result


async def _compute_reinvestment_rate(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        ocf = row.get("operating_cash_flow")
        np_val = row.get("net_profit_parent")
        dps = row.get("dividend_per_share")
        si = ctx.get("stock_info", {})
        si_code = si.get(code, {})
        shares = si_code.get("total_shares") or row.get("total_shares_val")
        if ocf and np_val and shares and abs(np_val) > 0:
            total_dps = (dps or 0) * shares
            result[code] = (ocf - total_dps) / np_val
    return result


async def _compute_current_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        ca = row.get("current_assets")
        cl = row.get("current_liabilities")
        if ca and cl and cl > 0:
            result[code] = ca / cl
    return result


async def _compute_quick_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        ca = row.get("current_assets")
        cl = row.get("current_liabilities")
        if ca and cl and cl > 0:
            inventory = (row.get("operating_cost") or 0) * 0.3
            quick = ca - inventory
            if quick > 0:
                result[code] = quick / cl
    return result


async def _compute_accrual(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    if fin.empty:
        return {}
    result = {}
    for _, row in fin.iterrows():
        code = row["code"]
        np_val = row.get("net_profit_parent")
        ocf = row.get("operating_cash_flow")
        assets = row.get("total_assets")
        if np_val is not None and ocf is not None and assets and assets > 0:
            result[code] = (np_val - ocf) / assets
    return result


async def _compute_asset_growth(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    db = ctx["db"]
    if fin.empty:
        return {}
    result = {}
    for code in codes:
        fin_row = fin[fin["code"] == code]
        if fin_row.empty:
            continue
        row = fin_row.iloc[0]
        assets = row.get("total_assets")
        if not assets or assets <= 0:
            continue
        prev_date = row["report_date"] - timedelta(days=365)
        prev_result = await db.execute(
            select(FinancialReport.total_assets)
            .where(FinancialReport.stock_code == code)
            .where(FinancialReport.report_date <= prev_date)
            .where(FinancialReport.total_assets.isnot(None))
            .order_by(FinancialReport.report_date.desc())
            .limit(1)
        )
        prev = prev_result.scalar_one_or_none()
        if prev and prev > 0:
            result[code] = (assets - float(prev)) / float(prev)
    return result


async def _compute_equity_growth(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    fin = ctx.get("financials", pd.DataFrame())
    db = ctx["db"]
    if fin.empty:
        return {}
    result = {}
    for code in codes:
        fin_row = fin[fin["code"] == code]
        if fin_row.empty:
            continue
        row = fin_row.iloc[0]
        equity = row.get("total_equity")
        if not equity or equity <= 0:
            continue
        prev_date = row["report_date"] - timedelta(days=365)
        prev_result = await db.execute(
            select(FinancialReport.total_equity)
            .where(FinancialReport.stock_code == code)
            .where(FinancialReport.report_date <= prev_date)
            .where(FinancialReport.total_equity.isnot(None))
            .order_by(FinancialReport.report_date.desc())
            .limit(1)
        )
        prev = prev_result.scalar_one_or_none()
        if prev and prev > 0:
            result[code] = (equity - float(prev)) / float(prev)
    return result


# ================== Short-term Reversal Factors ==================

async def _compute_return_5d(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 6:
            continue
        val = float(s.iloc[-1]) / float(s.iloc[-6]) - 1
        if not np.isnan(val) and not np.isinf(val):
            result[col] = val
    return result


async def _compute_return_reversal_1w(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 6:
            continue
        val = float(s.iloc[-1]) / float(s.iloc[-6]) - 1
        if not np.isnan(val) and not np.isinf(val):
            result[col] = -val
    return result


async def _compute_return_reversal_2w(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 11:
            continue
        val = float(s.iloc[-1]) / float(s.iloc[-11]) - 1
        if not np.isnan(val) and not np.isinf(val):
            result[col] = -val
    return result


async def _compute_close_position_20d(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 20:
            continue
        recent = s.iloc[-20:]
        low = float(recent.min())
        high = float(recent.max())
        close = float(recent.iloc[-1])
        if high > low:
            result[col] = (close - low) / (high - low)
    return result


async def _compute_amplitude_5d(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 5:
            continue
        recent = s.iloc[-5:]
        high = float(recent.max())
        low = float(recent.min())
        close = float(recent.iloc[-1])
        if close > 0:
            result[col] = (high - low) / close
    return result


async def _compute_volume_weighted_return(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("quote_df", pd.DataFrame())
    if qdf.empty:
        return {}
    latest = qdf.sort_values("date").groupby("code").last().reset_index()
    result = {}
    total_amount = 0.0
    weighted_sum = 0.0
    for _, row in latest.iterrows():
        amt = row.get("volume", 0) * row.get("close", 0)
        ret = (row.get("close", 0) - row.get("pre_close", 0)) / row.get("pre_close", 1) if row.get("pre_close") else 0
        total_amount += amt
        weighted_sum += amt * ret
    if total_amount > 0:
        avg_ret = weighted_sum / total_amount
        for _, row in latest.iterrows():
            code = row["code"]
            ret = (row.get("close", 0) - row.get("pre_close", 0)) / row.get("pre_close", 1) if row.get("pre_close") else 0
            result[code] = ret - avg_ret
    return result


# ================== Trend / Breakout Factors ==================

async def _compute_macd_signal(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 35:
            continue
        close = s.astype(float)
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        dif = ema12 - ema26
        dea = dif.ewm(span=9, adjust=False).mean()
        macd = (dif - dea) * 2
        val = float(macd.iloc[-1])
        avg_close = float(close.iloc[-20:].mean()) if len(close) >= 20 else float(close.iloc[-1])
        if avg_close > 0:
            result[col] = val / avg_close
    return result


async def _compute_bollinger_position(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 20:
            continue
        recent = s.iloc[-20:].astype(float)
        ma = recent.mean()
        std = recent.std()
        if std > 0:
            close = float(recent.iloc[-1])
            upper = ma + 2 * std
            lower = ma - 2 * std
            result[col] = (close - lower) / (upper - lower)
    return result


async def _compute_adx_trend_strength(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("quote_df", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for code in qdf["code"].unique():
        code_df = qdf[qdf["code"] == code].sort_values("date").tail(30)
        if len(code_df) < 15:
            continue
        highs = code_df["high"].astype(float).values
        lows = code_df["low"].astype(float).values
        closes = code_df["close"].astype(float).values
        tr_list = []
        for i in range(1, len(highs)):
            tr = max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
            tr_list.append(tr)
        if not tr_list:
            continue
        atr = sum(tr_list) / len(tr_list)
        if atr <= 0:
            continue
        plus_dm = sum(max(highs[i] - highs[i - 1], 0) for i in range(1, len(highs)) if highs[i] - highs[i - 1] > lows[i - 1] - lows[i])
        minus_dm = sum(max(lows[i - 1] - lows[i], 0) for i in range(1, len(highs)) if lows[i - 1] - lows[i] > highs[i] - highs[i - 1])
        plus_di = (plus_dm / (atr * len(tr_list))) * 100 if atr * len(tr_list) > 0 else 0
        minus_di = (minus_dm / (atr * len(tr_list))) * 100 if atr * len(tr_list) > 0 else 0
        di_sum = plus_di + minus_di
        adx = abs(plus_di - minus_di) / di_sum * 100 if di_sum > 0 else 0
        result[code] = adx / 100
    return result


async def _compute_price_channel_breakout(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 21:
            continue
        recent = s.iloc[-21:]
        high_20 = float(recent.iloc[:-1].max())
        low_20 = float(recent.iloc[:-1].min())
        close = float(recent.iloc[-1])
        if high_20 > low_20:
            result[col] = (close - (high_20 + low_20) / 2) / ((high_20 - low_20) / 2)
    return result


async def _compute_momentum_reversal_3m(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 127:
            continue
        m6 = float(s.iloc[-1]) / float(s.iloc[-127]) - 1
        m3 = float(s.iloc[-1]) / float(s.iloc[-64]) - 1
        val = -(m6 - m3)
        if not np.isnan(val) and not np.isinf(val):
            result[col] = val
    return result


async def _compute_resistance_strength(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 20:
            continue
        recent = s.iloc[-20:].astype(float)
        high = float(recent.max())
        close = float(recent.iloc[-1])
        if high > 0:
            result[col] = (high - close) / high
    return result


async def _compute_support_strength(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 20:
            continue
        recent = s.iloc[-20:].astype(float)
        low = float(recent.min())
        close = float(recent.iloc[-1])
        if low > 0:
            result[col] = (close - low) / low
    return result


async def _compute_volume_price_trend(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("quote_df", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for code in qdf["code"].unique():
        code_df = qdf[qdf["code"] == code].sort_values("date").tail(20)
        if len(code_df) < 5:
            continue
        rets = code_df["close"].astype(float).pct_change().dropna().values
        vols = code_df["volume"].astype(float).iloc[1:].values
        min_len = min(len(rets), len(vols))
        if min_len < 3:
            continue
        rets = rets[:min_len]
        vols = vols[:min_len]
        if np.std(vols) > 0 and np.std(rets) > 0:
            corr = float(np.corrcoef(rets, vols)[0, 1])
            if not np.isnan(corr):
                result[code] = corr
    return result


# ================== Risk / Tail Factors ==================

async def _compute_tail_risk_1m(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 22:
            continue
        rets = s.iloc[-22:].astype(float).pct_change().dropna()
        if len(rets) < 5:
            continue
        var_5 = float(np.percentile(rets, 5))
        result[col] = var_5
    return result


async def _compute_downside_volatility(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 22:
            continue
        rets = s.iloc[-22:].astype(float).pct_change().dropna()
        neg = rets[rets < 0]
        if len(neg) < 3:
            continue
        dvol = float(neg.std() * np.sqrt(252))
        if not np.isnan(dvol):
            result[col] = dvol
    return result


async def _compute_cvar_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 63:
            continue
        rets = s.iloc[-63:].astype(float).pct_change().dropna()
        if len(rets) < 10:
            continue
        var_5 = float(np.percentile(rets, 5))
        cvar = float(rets[rets <= var_5].mean()) if len(rets[rets <= var_5]) > 0 else var_5
        vol = float(rets.std() * np.sqrt(252))
        if vol > 0:
            result[col] = abs(cvar) / vol
    return result


async def _compute_skewness_3m(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 63:
            continue
        rets = s.iloc[-63:].astype(float).pct_change().dropna()
        if len(rets) < 10:
            continue
        from scipy import stats as sp_stats
        sk = float(sp_stats.skew(rets))
        if not np.isnan(sk):
            result[col] = sk
    return result


async def _compute_kurtosis_3m(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 63:
            continue
        rets = s.iloc[-63:].astype(float).pct_change().dropna()
        if len(rets) < 10:
            continue
        from scipy import stats as sp_stats
        kt = float(sp_stats.kurtosis(rets))
        if not np.isnan(kt):
            result[col] = kt
    return result


async def _compute_beta_60d(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    prices = ctx.get("prices", pd.DataFrame())
    if prices.empty:
        return {}
    result = {}
    from ..models.market import IndexDaily
    db = ctx["db"]
    bm_result = await db.execute(
        select(IndexDaily.close)
        .where(IndexDaily.index_code == "000300")
        .where(IndexDaily.trade_date <= d)
        .order_by(IndexDaily.trade_date.desc())
        .limit(61)
    )
    bm_rows = bm_result.all()
    if len(bm_rows) < 30:
        return {}
    bm_prices = [float(r[0]) for r in reversed(bm_rows)]
    bm_rets = np.diff(bm_prices) / bm_prices[:-1]
    for col in prices.columns:
        s = prices[col].dropna()
        if len(s) < 61:
            continue
        stock_rets = s.iloc[-61:].astype(float).pct_change().dropna().values
        min_len = min(len(stock_rets), len(bm_rets))
        if min_len < 20:
            continue
        stock_rets = stock_rets[-min_len:]
        bm_rets_slice = bm_rets[-min_len:]
        cov_mat = np.cov(stock_rets, bm_rets_slice)
        var_bm = cov_mat[1, 1]
        if var_bm > 0:
            beta = float(cov_mat[0, 1] / var_bm)
            if not np.isnan(beta):
                result[col] = beta
    return result


# ================== Sentiment / Flow Factors =================#

async def _compute_north_bound_flow(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    db = ctx["db"]
    si = ctx.get("stock_info", {})
    prices = ctx.get("prices", pd.DataFrame())
    nb_result = await db.execute(
        select(NorthBoundDaily)
        .where(NorthBoundDaily.trade_date <= d)
        .order_by(NorthBoundDaily.trade_date.desc())
        .limit(5)
    )
    nb_rows = nb_result.scalars().all()
    if not nb_rows:
        return {}
    avg_flow = sum(r.net_flow_total or 0 for r in nb_rows) / len(nb_rows)
    result = {}
    for code in codes:
        close_px = _get_close(prices, code)
        if close_px is None or close_px <= 0:
            continue
        mcap = _get_market_cap(code, close_px, si, pd.DataFrame())
        if mcap > 0:
            result[code] = avg_flow / mcap
    return result


async def _compute_margin_balance_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    db = ctx["db"]
    si = ctx.get("stock_info", {})
    prices = ctx.get("prices", pd.DataFrame())
    result = {}
    for code in codes:
        close_px = _get_close(prices, code)
        if close_px is None or close_px <= 0:
            continue
        mcap = _get_market_cap(code, close_px, si, pd.DataFrame())
        if mcap <= 0:
            continue
        mg_result = await db.execute(
            select(MarginDetail.margin_balance)
            .where(MarginDetail.stock_code == code)
            .where(MarginDetail.trade_date <= d)
            .order_by(MarginDetail.trade_date.desc())
            .limit(1)
        )
        mb = mg_result.scalar_one_or_none()
        if mb and mb > 0:
            result[code] = float(mb) / mcap
    return result


async def _compute_margin_balance_change(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    db = ctx["db"]
    result = {}
    for code in codes:
        mg_result = await db.execute(
            select(MarginDetail.margin_balance)
            .where(MarginDetail.stock_code == code)
            .where(MarginDetail.trade_date <= d)
            .order_by(MarginDetail.trade_date.desc())
            .limit(5)
        )
        rows = mg_result.all()
        if len(rows) >= 2:
            current = float(rows[0][0]) if rows[0][0] else 0
            prev = float(rows[-1][0]) if rows[-1][0] else 0
            if prev > 0:
                result[code] = (current - prev) / prev
    return result


async def _compute_short_selling_ratio(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    db = ctx["db"]
    si = ctx.get("stock_info", {})
    prices = ctx.get("prices", pd.DataFrame())
    result = {}
    for code in codes:
        close_px = _get_close(prices, code)
        if close_px is None or close_px <= 0:
            continue
        mcap = _get_market_cap(code, close_px, si, pd.DataFrame())
        if mcap <= 0:
            continue
        mg_result = await db.execute(
            select(MarginDetail.short_balance)
            .where(MarginDetail.stock_code == code)
            .where(MarginDetail.trade_date <= d)
            .order_by(MarginDetail.trade_date.desc())
            .limit(1)
        )
        sb = mg_result.scalar_one_or_none()
        if sb and sb > 0:
            result[code] = float(sb) / mcap
    return result


async def _compute_turnover_rate_short(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("quote_df", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for code in qdf["code"].unique():
        code_df = qdf[qdf["code"] == code].sort_values("date")
        if len(code_df) < 5:
            continue
        recent_5 = code_df.tail(5)
        vol_5 = recent_5["volume"].astype(float).sum()
        if vol_5 <= 0:
            continue
        older = code_df.iloc[:-5].tail(15) if len(code_df) > 5 else code_df.head(min(len(code_df), 15))
        if len(older) < 3:
            continue
        vol_20 = older["volume"].astype(float).sum() / len(older) * 5
        if vol_20 > 0:
            result[code] = vol_5 / vol_20
    return result


async def _compute_price_volume_divergence(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("quote_df", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for code in qdf["code"].unique():
        code_df = qdf[qdf["code"] == code].sort_values("date").tail(20)
        if len(code_df) < 5:
            continue
        rets = code_df["close"].astype(float).pct_change().dropna().values
        vols = code_df["volume"].astype(float).iloc[1:].values
        min_len = min(len(rets), len(vols))
        if min_len < 3:
            continue
        rets = rets[:min_len]
        vols = vols[:min_len]
        if np.std(vols) > 0 and np.std(rets) > 0:
            corr = float(np.corrcoef(rets, vols)[0, 1])
            if not np.isnan(corr):
                result[code] = -corr
    return result


async def _compute_limit_up_count_5d(ctx: dict, codes: list[str], d: date) -> dict[str, float]:
    qdf = ctx.get("quote_df", pd.DataFrame())
    if qdf.empty:
        return {}
    result = {}
    for code in qdf["code"].unique():
        code_df = qdf[qdf["code"] == code].sort_values("date").tail(5)
        count = 0
        for _, row in code_df.iterrows():
            close = row.get("close", 0)
            pre_close = row.get("pre_close", 0)
            if pre_close and pre_close > 0 and close:
                pct = (close - pre_close) / pre_close
                if pct >= 0.095:
                    count += 1
        if count > 0:
            result[code] = float(count)
    return result


# ================== Registry Builder ==================

def register_extended_factors(registry) -> None:
    registry.register(Factor(
        name="fcf_yield", category="value",
        description="自由现金流收益率：FCF/总市值",
        compute_fn=_compute_fcf_yield,
        required_data=["prices", "financials", "stock_info"],
    ))
    registry.register(Factor(
        name="pcf_ratio", category="value",
        description="市现率：总市值/经营现金流",
        compute_fn=_compute_pcf_ratio,
        required_data=["prices", "financials", "stock_info"],
    ))
    registry.register(Factor(
        name="ocf_to_debt", category="quality",
        description="经营现金流/总负债",
        compute_fn=_compute_ocf_to_debt,
        required_data=["financials"],
    ))
    registry.register(Factor(
        name="cash_conversion", category="quality",
        description="盈利现金含量：OCF/净利润",
        compute_fn=_compute_cash_conversion,
        required_data=["financials"],
    ))
    registry.register(Factor(
        name="reinvestment_rate", category="quality",
        description="再投资率：(OCF-股息)/净利润",
        compute_fn=_compute_reinvestment_rate,
        required_data=["financials", "stock_info"],
    ))
    registry.register(Factor(
        name="current_ratio", category="quality",
        description="流动比率：流动资产/流动负债",
        compute_fn=_compute_current_ratio,
        required_data=["financials"],
    ))
    registry.register(Factor(
        name="quick_ratio", category="quality",
        description="速动比率：(流动资产-存货)/流动负债",
        compute_fn=_compute_quick_ratio,
        required_data=["financials"],
    ))
    registry.register(Factor(
        name="accrual", category="quality",
        description="应计项目：(净利润-OCF)/总资产",
        compute_fn=_compute_accrual,
        required_data=["financials"],
    ))
    registry.register(Factor(
        name="asset_growth", category="quality",
        description="总资产增长率",
        compute_fn=_compute_asset_growth,
        required_data=["financials"],
    ))
    registry.register(Factor(
        name="equity_growth", category="quality",
        description="净资产增长率",
        compute_fn=_compute_equity_growth,
        required_data=["financials"],
    ))

    registry.register(Factor(
        name="return_5d", category="momentum",
        description="近5日收益",
        compute_fn=_compute_return_5d,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="return_reversal_1w", category="short_term",
        description="1周反转因子",
        compute_fn=_compute_return_reversal_1w,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="return_reversal_2w", category="short_term",
        description="2周反转因子",
        compute_fn=_compute_return_reversal_2w,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="close_position_20d", category="short_term",
        description="收盘价在近20日位置",
        compute_fn=_compute_close_position_20d,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="amplitude_5d", category="short_term",
        description="5日振幅",
        compute_fn=_compute_amplitude_5d,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="volume_weighted_return", category="short_term",
        description="成交量加权收益偏离",
        compute_fn=_compute_volume_weighted_return,
        required_data=["quote"],
    ))

    registry.register(Factor(
        name="macd_signal", category="trend",
        description="MACD信号（标准化）",
        compute_fn=_compute_macd_signal,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="bollinger_position", category="trend",
        description="布林带位置：(收盘-下轨)/(上轨-下轨)",
        compute_fn=_compute_bollinger_position,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="adx_trend_strength", category="trend",
        description="ADX趋势强度",
        compute_fn=_compute_adx_trend_strength,
        required_data=["quote"],
    ))
    registry.register(Factor(
        name="price_channel_breakout", category="trend",
        description="20日价格通道突破信号",
        compute_fn=_compute_price_channel_breakout,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="momentum_reversal_3m", category="trend",
        description="3月动量反转",
        compute_fn=_compute_momentum_reversal_3m,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="resistance_strength", category="trend",
        description="阻力位强度",
        compute_fn=_compute_resistance_strength,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="support_strength", category="trend",
        description="支撑位强度",
        compute_fn=_compute_support_strength,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="volume_price_trend", category="trend",
        description="量价趋势一致性",
        compute_fn=_compute_volume_price_trend,
        required_data=["quote"],
    ))

    registry.register(Factor(
        name="tail_risk_1m", category="risk",
        description="月度尾部风险(VaR5%)",
        compute_fn=_compute_tail_risk_1m,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="downside_volatility", category="risk",
        description="下行波动率",
        compute_fn=_compute_downside_volatility,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="cvar_ratio", category="risk",
        description="CVaR/波动率",
        compute_fn=_compute_cvar_ratio,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="skewness_3m", category="risk",
        description="3月收益偏度",
        compute_fn=_compute_skewness_3m,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="kurtosis_3m", category="risk",
        description="3月收益峰度",
        compute_fn=_compute_kurtosis_3m,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="beta_60d", category="risk",
        description="60日市场Beta",
        compute_fn=_compute_beta_60d,
        required_data=["prices"],
    ))

    registry.register(Factor(
        name="north_bound_flow", category="sentiment",
        description="北向资金净流入率",
        compute_fn=_compute_north_bound_flow,
        required_data=["prices", "stock_info"],
    ))
    registry.register(Factor(
        name="margin_balance_ratio", category="sentiment",
        description="融资余额/总市值",
        compute_fn=_compute_margin_balance_ratio,
        required_data=["prices", "stock_info"],
    ))
    registry.register(Factor(
        name="margin_balance_change", category="sentiment",
        description="融资余额变化率",
        compute_fn=_compute_margin_balance_change,
        required_data=["prices"],
    ))
    registry.register(Factor(
        name="short_selling_ratio", category="sentiment",
        description="融券余额/总市值",
        compute_fn=_compute_short_selling_ratio,
        required_data=["prices", "stock_info"],
    ))
    registry.register(Factor(
        name="turnover_rate_short", category="sentiment",
        description="短期换手率变化",
        compute_fn=_compute_turnover_rate_short,
        required_data=["quote"],
    ))
    registry.register(Factor(
        name="price_volume_divergence", category="sentiment",
        description="量价背离度",
        compute_fn=_compute_price_volume_divergence,
        required_data=["quote"],
    ))
    registry.register(Factor(
        name="limit_up_count_5d", category="sentiment",
        description="5日涨停次数",
        compute_fn=_compute_limit_up_count_5d,
        required_data=["quote"],
    ))
