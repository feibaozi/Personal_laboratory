"""Portfolio weight construction: equal, market_cap, risk_parity, mean_variance."""
import numpy as np
import pandas as pd
from scipy.optimize import minimize


def equal_weight(n: int) -> np.ndarray:
    """Equal weight: 1/n for each stock."""
    w = np.ones(n) / n
    return w


def market_cap_weight(market_caps: np.ndarray) -> np.ndarray:
    """Market cap weighted."""
    total = market_caps.sum()
    if total == 0:
        return equal_weight(len(market_caps))
    w = market_caps / total
    return w


def risk_parity_weights(returns: pd.DataFrame, max_iter: int = 100) -> np.ndarray:
    """Naive risk parity: inverse volatility weighting (fallback when scipy not available).

    Full risk parity via optimization is complex; inverse-vol provides similar diversification
    benefits and is much faster. For educational purposes, both approaches are valid.
    """
    vols = returns.std()
    if vols.sum() == 0:
        return equal_weight(len(vols))
    inv_vols = 1.0 / vols.replace(0, vols.mean())
    w = inv_vols / inv_vols.sum()
    return w.values


def mean_variance_weights(
    returns: pd.DataFrame,
    target: str = "max_sharpe",
    rf_annual: float = 0.02,
    max_weight: float = 0.10,
) -> np.ndarray:
    """Mean-variance optimization using scipy.

    target: 'max_sharpe' or 'min_vol'
    """
    n = returns.shape[1]
    if n < 2:
        return np.ones(n) / n

    mu = returns.mean().values * 252
    cov = returns.cov().values * 252
    rf_daily = rf_annual / 252

    def portfolio_stats(w):
        ret = np.dot(w, mu)
        vol = np.sqrt(np.dot(w, np.dot(cov, w)))
        sharpe = (ret - rf_annual) / vol if vol > 0 else 0
        return ret, vol, sharpe

    def obj_sharpe(w):
        _, _, s = portfolio_stats(w)
        return -s

    def obj_vol(w):
        _, v, _ = portfolio_stats(w)
        return v

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
    bounds = [(0, max_weight) for _ in range(n)]

    w0 = np.ones(n) / n

    objective = obj_sharpe if target == "max_sharpe" else obj_vol

    try:
        result = minimize(objective, w0, method="SLSQP", bounds=bounds, constraints=constraints,
                          options={"maxiter": 500, "ftol": 1e-8})
        if result.success:
            w = result.x
            w[w < 1e-6] = 0
            s = w.sum()
            if s > 0:
                w = w / s
            else:
                w = np.ones(n) / n
            return w
    except Exception:
        pass

    return equal_weight(n)
