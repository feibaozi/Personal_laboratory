"""Tests for backtest engine components."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import numpy as np
import pandas as pd
from app.engine.portfolio_constructor import equal_weight, risk_parity_weights, mean_variance_weights


def test_equal_weight():
    w = equal_weight(10)
    assert len(w) == 10
    assert abs(sum(w) - 1.0) < 1e-10
    assert all(abs(x - 0.1) < 1e-10 for x in w)


def test_risk_parity():
    np.random.seed(42)
    rets = pd.DataFrame({
        "A": np.random.normal(0.001, 0.01, 100),
        "B": np.random.normal(0.001, 0.02, 100),
        "C": np.random.normal(0.001, 0.03, 100),
    })
    w = risk_parity_weights(rets)
    assert len(w) == 3
    assert abs(sum(w) - 1.0) < 1e-10
    assert w[0] > w[1] > w[2], "Lower vol stocks should get higher weight"


def test_mean_variance():
    np.random.seed(42)
    rets = pd.DataFrame({
        "A": np.random.normal(0.002, 0.01, 200),
        "B": np.random.normal(0.001, 0.02, 200),
    })
    w = mean_variance_weights(rets)
    assert len(w) == 2
    assert abs(sum(w) - 1.0) < 1e-10
    assert all(w >= -1e-6)  # non-negative (within tolerance)


def test_equal_weight_single():
    w = equal_weight(1)
    assert len(w) == 1
    assert abs(w[0] - 1.0) < 1e-10


if __name__ == "__main__":
    test_equal_weight(); print("  [PASS] equal weight")
    test_risk_parity(); print("  [PASS] risk parity")
    test_mean_variance(); print("  [PASS] mean variance")
    test_equal_weight_single(); print("  [PASS] single stock")
    print("All backtest engine tests passed!")
