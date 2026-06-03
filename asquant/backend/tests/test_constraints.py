import pytest
import numpy as np
from app.engine.constraints import (
    is_limit_up, is_limit_down, is_suspended,
    compute_buy_cost, compute_sell_cost, dynamic_slippage,
    apply_position_constraints, round_shares,
    get_limit_constraints,
    LIMIT_UP_RATE, COMMISSION_RATE, STAMP_TAX_RATE, MIN_SHARES,
)


class TestLimitConstraints:

    def test_main_board_limit_up_10pct(self):
        assert is_limit_up("600001", 11.0, 10.0) is True
        assert is_limit_up("600001", 10.99, 10.0) is True
        assert is_limit_up("600001", 10.98, 10.0) is False
        assert is_limit_up("600001", 10.0, 10.0) is False
        assert is_limit_up("600001", 9.0, 10.0) is False

    def test_gem_limit_up_20pct(self):
        assert is_limit_up("300001", 12.0, 10.0) is True
        assert is_limit_up("688001", 12.0, 10.0) is True
        assert is_limit_up("300001", 11.99, 10.0) is True
        assert is_limit_up("300001", 11.98, 10.0) is False

    def test_limit_down_10pct(self):
        assert is_limit_down("600001", 9.0, 10.0) is True
        assert is_limit_down("600001", 9.01, 10.0) is True
        assert is_limit_down("600001", 9.02, 10.0) is False
        assert is_limit_down("600001", 10.0, 10.0) is False

    def test_gem_limit_down_20pct(self):
        assert is_limit_down("300001", 8.0, 10.0) is True
        assert is_limit_down("300001", 8.01, 10.0) is True
        assert is_limit_down("300001", 8.02, 10.0) is False

    def test_nse_30pct(self):
        assert is_limit_up("400001", 13.0, 10.0) is True
        assert is_limit_up("800001", 13.0, 10.0) is True

    def test_pre_close_zero(self):
        assert is_limit_up("600001", 10.0, 0.0) is False
        assert is_limit_down("600001", 9.0, 0.0) is False

    def test_suspended(self):
        assert is_suspended(None) is True
        assert is_suspended(0) is True
        assert is_suspended(1000) is False


class TestTransactionCosts:

    def test_buy_cost_normal(self):
        cost = compute_buy_cost(100000)
        expected_commission = max(100000 * COMMISSION_RATE, 5.0)
        expected_transfer = 100000 * 0.00001
        assert abs(cost - (expected_commission + expected_transfer)) < 0.01

    def test_buy_cost_min_commission(self):
        cost = compute_buy_cost(100)
        assert cost >= 5.0

    def test_sell_cost_includes_stamp(self):
        cost = compute_sell_cost(100000)
        expected_stamp = 100000 * STAMP_TAX_RATE
        buy_cost = compute_buy_cost(100000)
        assert cost - buy_cost > expected_stamp * 0.9

    def test_cost_proportionality(self):
        c1 = compute_buy_cost(100000)
        c2 = compute_buy_cost(200000)
        assert c2 > c1


class TestSlippage:

    def test_base_slippage(self):
        s = dynamic_slippage(5000, 1_000_000)
        assert s == 0.001

    def test_low_impact(self):
        s = dynamic_slippage(9000, 1_000_000)
        assert s == 0.001

    def test_medium_impact(self):
        s = dynamic_slippage(30000, 1_000_000)
        assert s == 0.002

    def test_high_impact(self):
        s = dynamic_slippage(60000, 1_000_000)
        assert s == 0.005

    def test_very_high_impact(self):
        s = dynamic_slippage(120000, 1_000_000)
        assert s == 0.01

    def test_zero_daily_amount(self):
        s = dynamic_slippage(10000, 0)
        assert s == 0.001


class TestPositionConstraints:

    def test_normal_weights(self):
        w = np.array([0.3, 0.3, 0.4])
        result = apply_position_constraints(w, 0.5)
        assert abs(result.sum() - 1.0) < 1e-10
        assert all(result >= 0)

    def test_clip_above_max(self):
        w = np.array([0.6, 0.4])
        result = apply_position_constraints(w, 0.2)
        assert abs(result.sum() - 1.0) < 1e-10
        assert all(r >= 0 for r in result)

    def test_zero_sum(self):
        w = np.zeros(5)
        result = apply_position_constraints(w, 0.3)
        assert all(r == 0.2 for r in result)

    def test_negative_clipped(self):
        w = np.array([-0.1, 0.5, 0.6])
        result = apply_position_constraints(w, 0.5)
        assert all(r >= 0 for r in result)

    def test_single_stock(self):
        w = np.array([1.0])
        result = apply_position_constraints(w, 0.15)
        assert abs(result.sum() - 1.0) < 1e-10


class TestRoundShares:

    def test_exact_lots(self):
        assert round_shares(300) == 300
        assert round_shares(100) == 100
        assert round_shares(500) == 500

    def test_round_down(self):
        assert round_shares(150) == 100
        assert round_shares(199) == 100

    def test_round_floor(self):
        assert round_shares(99) == 0
        assert round_shares(50) == 0

    def test_zero(self):
        assert round_shares(0) == 0
        assert round_shares(-10) == 0