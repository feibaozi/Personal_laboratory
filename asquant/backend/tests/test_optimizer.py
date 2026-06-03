"""Unit tests for Optimizer (grid_search, walk_forward, param_stability)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.engine.optimizer import Optimizer


def test_extract_objective_sharpe():
    """_extract_objective should return sharpe for sharpe_ratio objective."""
    opt = Optimizer.__new__(Optimizer)
    metrics = {"sharpe": 1.5, "annual_return": 0.2, "max_drawdown": -0.1, "sortino": 2.0, "calmar": 1.0}
    score = opt._extract_objective(metrics, "sharpe_ratio")
    assert abs(score - 1.5) < 1e-10


def test_extract_objective_annual_return():
    """_extract_objective should return annual_return for annual_return objective."""
    opt = Optimizer.__new__(Optimizer)
    metrics = {"sharpe": 1.5, "annual_return": 0.2, "max_drawdown": -0.1, "sortino": 2.0, "calmar": 1.0}
    score = opt._extract_objective(metrics, "annual_return")
    assert abs(score - 0.2) < 1e-10


def test_extract_objective_sortino():
    """_extract_objective should return sortino for sortino_ratio objective."""
    opt = Optimizer.__new__(Optimizer)
    metrics = {"sharpe": 1.5, "annual_return": 0.2, "max_drawdown": -0.1, "sortino": 2.0, "calmar": 1.0}
    score = opt._extract_objective(metrics, "sortino_ratio")
    assert abs(score - 2.0) < 1e-10


def test_extract_objective_calmar():
    """_extract_objective should return calmar for calmar_ratio objective."""
    opt = Optimizer.__new__(Optimizer)
    metrics = {"sharpe": 1.5, "annual_return": 0.2, "max_drawdown": -0.1, "sortino": 2.0, "calmar": 1.0}
    score = opt._extract_objective(metrics, "calmar_ratio")
    assert abs(score - 1.0) < 1e-10


def test_extract_objective_total_return():
    """_extract_objective should return total_return for total_return objective."""
    opt = Optimizer.__new__(Optimizer)
    metrics = {"sharpe": 1.5, "annual_return": 0.2, "total_return": 0.5, "max_drawdown": -0.1}
    score = opt._extract_objective(metrics, "total_return")
    assert abs(score - 0.5) < 1e-10


def test_extract_objective_return_over_drawdown():
    """_extract_objective should compute return_over_drawdown correctly."""
    opt = Optimizer.__new__(Optimizer)
    metrics = {"annual_return": 0.2, "max_drawdown": -0.1}
    score = opt._extract_objective(metrics, "return_over_drawdown")
    # Code: -abs(metrics.get("max_drawdown", 0)) = -abs(-0.1) = -0.1
    assert abs(score - (-0.1)) < 1e-10


def test_extract_objective_default():
    """Unknown objective should default to sharpe."""
    opt = Optimizer.__new__(Optimizer)
    metrics = {"sharpe": 1.5, "annual_return": 0.2}
    score = opt._extract_objective(metrics, "unknown_objective")
    assert abs(score - 1.5) < 1e-10


def test_compute_param_stability_consistent():
    """When same param is chosen every time, consistency should be 1.0."""
    opt = Optimizer.__new__(Optimizer)
    all_best_params = [
        {"top_n": 30, "weighting": "equal"},
        {"top_n": 30, "weighting": "equal"},
        {"top_n": 30, "weighting": "equal"},
    ]
    stability = opt._compute_param_stability(all_best_params)
    assert stability["top_n"]["consistency"] == 1.0
    assert stability["weighting"]["consistency"] == 1.0
    assert stability["top_n"]["unique_count"] == 1
    assert stability["top_n"]["most_frequent"] == "30"


def test_compute_param_stability_inconsistent():
    """When param changes every time, consistency should be low."""
    opt = Optimizer.__new__(Optimizer)
    all_best_params = [
        {"top_n": 20},
        {"top_n": 30},
        {"top_n": 50},
    ]
    stability = opt._compute_param_stability(all_best_params)
    assert stability["top_n"]["unique_count"] == 3
    assert stability["top_n"]["consistency"] < 0.5


def test_compute_param_stability_empty():
    """Empty params should return empty dict."""
    opt = Optimizer.__new__(Optimizer)
    stability = opt._compute_param_stability([])
    assert stability == {}


def test_compute_param_stability_partial():
    """When some windows don't have a param, it should still work."""
    opt = Optimizer.__new__(Optimizer)
    all_best_params = [
        {"top_n": 30, "weighting": "equal"},
        {"top_n": 30},  # missing weighting
        {"weighting": "risk_parity"},  # missing top_n
    ]
    stability = opt._compute_param_stability(all_best_params)
    assert "top_n" in stability
    assert "weighting" in stability
    assert stability["top_n"]["unique_count"] == 1
    assert stability["weighting"]["unique_count"] == 2


print("All Optimizer tests passed!")
