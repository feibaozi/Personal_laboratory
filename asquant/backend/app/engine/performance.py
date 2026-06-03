"""Performance metrics: returns, risk, ratios, regression."""
import numpy as np
from scipy import stats


def annualized_return(daily_returns: np.ndarray) -> float:
    """Cumulative return from daily returns."""
    return float(np.prod(1 + daily_returns) - 1)


def annualized_return_pct(daily_returns: np.ndarray) -> float:
    """Annualized return from daily returns (CAGR)."""
    total = np.prod(1 + daily_returns) - 1
    years = len(daily_returns) / 252
    if years == 0:
        return 0.0
    return float((1 + total) ** (1 / years) - 1)


def annualized_volatility(daily_returns: np.ndarray) -> float:
    """Annualized standard deviation."""
    return float(np.std(daily_returns, ddof=1) * np.sqrt(252))


def max_drawdown(daily_values: np.ndarray) -> float:
    """Maximum drawdown as a negative number (e.g., -0.25 for 25% drawdown)."""
    peak = np.maximum.accumulate(daily_values)
    drawdowns = daily_values / peak - 1
    return float(np.min(drawdowns))


def max_drawdown_duration(daily_values: np.ndarray) -> int:
    """Maximum number of days from peak to recovery."""
    peak = np.maximum.accumulate(daily_values)
    drawdowns = daily_values / peak - 1
    in_dd = drawdowns < 0
    if not in_dd.any():
        return 0
    max_dur = 0
    cur = 0
    for x in in_dd:
        if x:
            cur += 1
            max_dur = max(max_dur, cur)
        else:
            cur = 0
    return max_dur


def sharpe_ratio(daily_returns: np.ndarray, rf_annual: float = 0.02) -> float:
    """Annualized Sharpe ratio."""
    excess = annualized_return_pct(daily_returns) - rf_annual
    vol = annualized_volatility(daily_returns)
    if vol == 0:
        return 0.0
    return float(excess / vol)


def calmar_ratio(daily_returns: np.ndarray, daily_values: np.ndarray) -> float:
    """Annualized return / |max drawdown|."""
    ann_ret = annualized_return_pct(daily_returns)
    mdd = abs(max_drawdown(daily_values))
    if mdd == 0:
        return 0.0
    return float(ann_ret / mdd)


def sortino_ratio(daily_returns: np.ndarray, rf_annual: float = 0.02, target: float = 0.0) -> float:
    """Annualized Sortino ratio using downside deviation."""
    excess = annualized_return_pct(daily_returns) - rf_annual
    downside = daily_returns[daily_returns < target]
    if len(downside) == 0:
        return 0.0
    downside_vol = np.std(downside, ddof=1) * np.sqrt(252)
    if downside_vol == 0:
        return 0.0
    return float(excess / downside_vol)


def var_cvar(daily_returns: np.ndarray, confidence: float = 0.95) -> tuple[float, float]:
    """Historical VaR and CVaR at given confidence level."""
    cutoff = np.percentile(daily_returns, 100 * (1 - confidence))
    tail = daily_returns[daily_returns <= cutoff]
    cvar = float(np.mean(tail)) if len(tail) > 0 else float(cutoff)
    return float(cutoff), cvar


def alpha_beta(portfolio_returns: np.ndarray, benchmark_returns: np.ndarray, rf_annual: float = 0.02) -> dict:
    """CAPM regression: portfolio excess = alpha + beta * benchmark excess + e."""
    rf_daily = rf_annual / 252
    pr_excess = portfolio_returns - rf_daily
    bm_excess = benchmark_returns - rf_daily

    min_len = min(len(pr_excess), len(bm_excess))
    pr_excess = pr_excess[-min_len:]
    bm_excess = bm_excess[-min_len:]

    if min_len < 20:
        return {"alpha": 0, "beta": 1, "r_squared": 0, "tracking_error": 0, "information_ratio": 0}

    slope, intercept, r_value, _, _ = stats.linregress(bm_excess, pr_excess)

    alpha_annual = float(intercept * 252)
    tracking_error = float(np.std(pr_excess - bm_excess, ddof=1) * np.sqrt(252))
    info_ratio = float(alpha_annual / tracking_error) if tracking_error > 0 else 0.0

    return {
        "alpha": alpha_annual,
        "beta": float(slope),
        "r_squared": float(r_value ** 2),
        "tracking_error": tracking_error,
        "information_ratio": info_ratio,
    }


def compute_all_metrics(
    daily_returns: np.ndarray,
    daily_values: np.ndarray,
    benchmark_returns: np.ndarray | None = None,
    rf_annual: float = 0.02,
    dates: list | None = None,
) -> dict:
    """Compute all performance metrics."""
    ret_arr = np.array(daily_returns)
    val_arr = np.array(daily_values)

    var95, cvar95 = var_cvar(ret_arr, 0.95)
    reg = {}
    if benchmark_returns is not None:
        reg = alpha_beta(ret_arr, np.array(benchmark_returns), rf_annual)

    monthly = _monthly_returns(ret_arr, dates)

    beta = reg.get("beta", 0)

    return {
        "total_return": annualized_return(ret_arr),
        "annual_return": annualized_return_pct(ret_arr),
        "volatility": annualized_volatility(ret_arr),
        "max_drawdown": max_drawdown(val_arr),
        "max_drawdown_duration": max_drawdown_duration(val_arr),
        "sharpe": sharpe_ratio(ret_arr, rf_annual),
        "calmar": calmar_ratio(ret_arr, val_arr),
        "sortino": sortino_ratio(ret_arr, rf_annual),
        "var_95": var95,
        "cvar_95": cvar95,
        "treynor": treynor_ratio(ret_arr, beta, rf_annual),
        "win_rate": win_rate(ret_arr),
        "profit_factor": profit_factor(ret_arr),
        "avg_win_loss": avg_win_loss(ret_arr),
        "skewness": skewness(ret_arr),
        "kurtosis": kurtosis(ret_arr),
        **reg,
        "monthly_returns": monthly,
    }


def treynor_ratio(daily_returns: np.ndarray, beta: float, rf_annual: float = 0.02) -> float:
    """Treynor Ratio: excess return per unit of systematic risk."""
    excess = annualized_return_pct(daily_returns) - rf_annual
    if beta == 0:
        return 0.0
    return float(excess / beta)


def win_rate(daily_returns: np.ndarray) -> float:
    """Fraction of days with positive return."""
    if len(daily_returns) == 0:
        return 0.0
    return float(np.mean(daily_returns > 0))


def profit_factor(daily_returns: np.ndarray) -> float:
    """Sum of gains / abs(sum of losses)."""
    gains = daily_returns[daily_returns > 0].sum()
    losses = abs(daily_returns[daily_returns < 0].sum())
    if losses == 0:
        return 999.0 if gains > 0 else 0.0
    return float(gains / losses)


def avg_win_loss(daily_returns: np.ndarray) -> float:
    """Average gain / average loss."""
    gains = daily_returns[daily_returns > 0]
    losses = daily_returns[daily_returns < 0]
    avg_gain = gains.mean() if len(gains) > 0 else 0
    avg_loss = abs(losses.mean()) if len(losses) > 0 else 0
    if avg_loss == 0:
        return 999.0 if avg_gain > 0 else 0.0
    return float(avg_gain / avg_loss)


def skewness(daily_returns: np.ndarray) -> float:
    """Return skewness (positive = right-tail, negative = left-tail)."""
    if len(daily_returns) < 3:
        return 0.0
    return float(stats.skew(daily_returns))


def kurtosis(daily_returns: np.ndarray) -> float:
    """Excess kurtosis (positive = fat tails)."""
    if len(daily_returns) < 4:
        return 0.0
    return float(stats.kurtosis(daily_returns))


def _monthly_returns(daily_returns: np.ndarray, dates: list | None = None) -> list[dict]:
    """Aggregate daily returns to calendar months."""
    if len(daily_returns) < 21:
        return []

    # If dates are provided, group by calendar month
    if dates is not None and len(dates) == len(daily_returns):
        from collections import OrderedDict
        month_groups: OrderedDict[str, list[float]] = OrderedDict()
        for dt, ret in zip(dates, daily_returns):
            if hasattr(dt, 'strftime'):
                key = dt.strftime("%Y-%m")
            else:
                d_str = str(dt)
                key = d_str[:7]  # "YYYY-MM"
            if key not in month_groups:
                month_groups[key] = []
            month_groups[key].append(float(ret))
        months = []
        for key, rets in month_groups.items():
            if rets:
                month_ret = float(np.prod(1 + np.array(rets)) - 1)
                months.append({"month": key, "return": month_ret})
        return months

    # Fallback: fixed 21-day chunks
    months = []
    idx = 0
    days_per_month = 21
    while idx + days_per_month <= len(daily_returns):
        chunk = daily_returns[idx:idx + days_per_month]
        ret = float(np.prod(1 + chunk) - 1)
        months.append({"month": idx // days_per_month + 1, "return": ret})
        idx += days_per_month
    return months
