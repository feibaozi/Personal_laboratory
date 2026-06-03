"""Unit tests for Brinson attribution."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.engine.brinson import brinson_attribution, simple_factor_attribution
import numpy as np


def test_brinson_basic():
    """Basic Brinson: equal weights, same returns => zero excess."""
    sectors = {"A1": "Fin", "A2": "Fin", "B1": "Tech", "B2": "Tech"}
    pw = {"A1": 0.25, "A2": 0.25, "B1": 0.25, "B2": 0.25}
    pr = {"A1": 0.01, "A2": 0.01, "B1": 0.02, "B2": 0.02}
    bw = {"A1": 0.25, "A2": 0.25, "B1": 0.25, "B2": 0.25}
    br = {"A1": 0.01, "A2": 0.01, "B1": 0.02, "B2": 0.02}

    result = brinson_attribution(pw, pr, bw, br, sectors)
    assert abs(result["excess_return"]) < 1e-10
    assert abs(result["attribution_check"] - (result["allocation_effect"] + result["selection_effect"] + result["interaction_effect"])) < 1e-10


def test_brinson_allocation_effect():
    """Overweight high-return sector => positive allocation effect."""
    sectors = {"A1": "Fin", "A2": "Fin", "B1": "Tech", "B2": "Tech"}
    # Portfolio: overweight Fin (0.7) vs benchmark Fin (0.5)
    pw = {"A1": 0.35, "A2": 0.35, "B1": 0.15, "B2": 0.15}
    pr = {"A1": 0.02, "A2": 0.02, "B1": 0.01, "B2": 0.01}
    bw = {"A1": 0.25, "A2": 0.25, "B1": 0.25, "B2": 0.25}
    br = {"A1": 0.02, "A2": 0.02, "B1": 0.01, "B2": 0.01}

    result = brinson_attribution(pw, pr, bw, br, sectors)
    # Total return should be positive since we overweight high-return sector
    assert result["excess_return"] > 0
    assert result["allocation_effect"] > 0
    # attribution_check should match sum
    total = result["allocation_effect"] + result["selection_effect"] + result["interaction_effect"]
    assert abs(result["attribution_check"] - total) < 1e-10


def test_brinson_selection_effect():
    """Select better stock within sector => positive selection effect."""
    sectors = {"A1": "Fin", "A2": "Fin"}
    # Same sector weights, but pick A1 which has higher return
    pw = {"A1": 0.8, "A2": 0.2}
    pr = {"A1": 0.05, "A2": 0.01}
    bw = {"A1": 0.5, "A2": 0.5}
    br = {"A1": 0.03, "A2": 0.03}  # benchmark returns equal since sector avg = 0.03

    result = brinson_attribution(pw, pr, bw, br, sectors)
    assert result["selection_effect"] > 0
    assert result["excess_return"] > 0


def test_brinson_sector_details():
    """Verify sector_details has all expected fields."""
    sectors = {"A": "Fin", "B": "Tech"}
    pw = {"A": 0.6, "B": 0.4}
    pr = {"A": 0.02, "B": 0.01}
    bw = {"A": 0.5, "B": 0.5}
    br = {"A": 0.015, "B": 0.015}

    result = brinson_attribution(pw, pr, bw, br, sectors)
    assert len(result["sector_details"]) == 2
    for sd in result["sector_details"]:
        assert "sector" in sd
        assert "allocation_effect" in sd
        assert "selection_effect" in sd
        assert "interaction_effect" in sd
        assert "total_effect" in sd
        # total_effect should equal sum of three components
        total = sd["allocation_effect"] + sd["selection_effect"] + sd["interaction_effect"]
        assert abs(sd["total_effect"] - total) < 1e-10


def test_simple_factor_attribution_basic():
    """Market factor attribution with correlated returns."""
    np.random.seed(42)
    bm = np.random.randn(252) * 0.01
    pr = bm * 1.2 + np.random.randn(252) * 0.005  # beta ~1.2

    result = simple_factor_attribution(list(pr), list(bm))
    assert len(result["factors"]) >= 2
    assert 1.0 < result["beta"] < 1.4
    assert result["r_squared"] > 0.7


def test_simple_factor_attribution_insufficient_data():
    """Less than 20 data points => r_squared=0."""
    pr = [0.01, -0.005, 0.002] * 3
    bm = [0.008, -0.003, 0.001] * 3
    result = simple_factor_attribution(pr, bm)
    assert result["r_squared"] == 0


print("All Brinson tests passed!")