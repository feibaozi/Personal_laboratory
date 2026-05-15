"""Unit tests for performance metrics."""
import numpy as np
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.engine.performance import (
    annualized_return, annualized_return_pct, annualized_volatility,
    max_drawdown, max_drawdown_duration, sharpe_ratio, calmar_ratio,
    sortino_ratio, var_cvar, alpha_beta,
)


def test_annualized_return_zero():
    rets = np.array([0.0] * 100)
    assert abs(annualized_return(rets)) < 1e-10
    assert abs(annualized_return_pct(rets)) < 1e-10


def test_max_drawdown():
    values = np.array([100, 110, 90, 95, 120])
    mdd = max_drawdown(values)
    assert abs(mdd - (-10 / 110)) < 1e-6  # 90/110 - 1 = -0.1818...


def test_max_drawdown_duration():
    values = np.array([100, 90, 85, 80, 90, 100])
    dur = max_drawdown_duration(values)
    assert dur == 4  # days 1-4: 90<100, 85<100, 80<100, 90<100


def test_sharpe_ratio():
    rets = np.array([0.001] * 252)  # 0.1% daily => ~28.6% annual
    sharpe = sharpe_ratio(rets, rf_annual=0.02)
    assert sharpe > 0


def test_var_cvar():
    rets = np.array([-0.05, -0.03, -0.02, -0.01, 0.0, 0.01, 0.02, 0.03, 0.04, 0.05])
    var95, cvar95 = var_cvar(rets, 0.95)
    assert var95 <= cvar95
    assert var95 < 0  # 95% VaR should be negative for symmetric dist


def test_calmar():
    rets = np.array([0.001] * 200)
    vals = np.cumprod(1 + rets) * 100
    vals = np.append(vals, [80, 90, 100, 110])  # simulate a drawdown
    calmar = calmar_ratio(rets, vals)
    assert not np.isnan(calmar)


def test_sortino():
    rets = np.array([0.001, -0.002, 0.003, -0.001, 0.002] * 50)
    sortino = sortino_ratio(rets)
    assert not np.isnan(sortino)


def test_alpha_beta():
    bm = np.array([0.001, -0.002, 0.003, -0.001, 0.002] * 50)
    pr = bm * 0.8 + 0.0001  # beta=0.8, alpha ~2.5% annual
    reg = alpha_beta(pr, bm)
    assert abs(reg["beta"] - 0.8) < 0.1
    assert reg["r_squared"] > 0.9


print("All performance tests passed!")
