"""Unit tests for PaperTradeEngine and OrderManager."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import numpy as np
from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from app.engine.order_manager import OrderManager, OrderStatus
from app.models.backtest import PaperOrder


def _make_order(code="000001", direction="buy", shares=1000, trade_date=None):
    """Create a PaperOrder for testing."""
    return PaperOrder(
        run_id="test-run",
        trade_date=trade_date or date(2024, 1, 15),
        stock_code=code,
        direction=direction,
        signal_price=10.0,
        order_shares=shares,
        status=OrderStatus.PENDING.value,
        created_at=datetime.now(),
    )


def _make_dq(close=10.0, pre_close=9.5, volume=1000000):
    """Create a mock DailyQuote."""
    dq = MagicMock()
    dq.close = close
    dq.pre_close = pre_close
    dq.volume = volume
    return dq


def test_simulate_fill_normal():
    """Normal fill should use closing price and respect volume limit."""
    mgr = OrderManager.__new__(OrderManager)
    mgr.db = AsyncMock()

    order = _make_order(shares=500)
    dq = _make_dq(close=10.5, pre_close=10.0, volume=5000000)

    mgr.db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=dq)))

    import asyncio
    result = asyncio.get_event_loop().run_until_complete(mgr.simulate_fill(order))

    assert result.status == OrderStatus.FILLED.value
    assert result.fill_price == 10.5
    assert result.fill_shares == 500


def test_simulate_fill_limit_up_reject():
    """Buy order on limit-up stock should be rejected."""
    mgr = OrderManager.__new__(OrderManager)
    mgr.db = AsyncMock()

    order = _make_order(direction="buy", shares=1000)
    # close >= pre_close * 1.095 => limit up
    dq = _make_dq(close=10.95, pre_close=10.0, volume=5000000)

    mgr.db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=dq)))

    import asyncio
    result = asyncio.get_event_loop().run_until_complete(mgr.simulate_fill(order))

    assert result.status == OrderStatus.REJECTED.value
    assert "Limit up" in result.reject_reason


def test_simulate_fill_limit_down_reject():
    """Sell order on limit-down stock should be rejected."""
    mgr = OrderManager.__new__(OrderManager)
    mgr.db = AsyncMock()

    order = _make_order(direction="sell", shares=1000)
    # close <= pre_close * 0.905 => limit down
    dq = _make_dq(close=9.05, pre_close=10.0, volume=5000000)

    mgr.db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=dq)))

    import asyncio
    result = asyncio.get_event_loop().run_until_complete(mgr.simulate_fill(order))

    assert result.status == OrderStatus.REJECTED.value
    assert "Limit down" in result.reject_reason


def test_simulate_fill_no_market_data():
    """Order should be rejected when no market data available."""
    mgr = OrderManager.__new__(OrderManager)
    mgr.db = AsyncMock()

    order = _make_order()
    mgr.db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))

    import asyncio
    result = asyncio.get_event_loop().run_until_complete(mgr.simulate_fill(order))

    assert result.status == OrderStatus.REJECTED.value
    assert "No market data" in result.reject_reason


def test_simulate_fill_insufficient_liquidity():
    """Order should be cancelled when daily volume is zero (no trading)."""
    mgr = OrderManager.__new__(OrderManager)
    mgr.db = AsyncMock()

    order = _make_order(shares=10000)
    # volume = 0 means no trading at all
    dq = _make_dq(close=10.0, pre_close=10.0, volume=0)

    mgr.db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=dq)))

    import asyncio
    result = asyncio.get_event_loop().run_until_complete(mgr.simulate_fill(order))

    assert result.status == OrderStatus.CANCELLED.value
    assert "Insufficient liquidity" in result.reject_reason


def test_simulate_fill_volume_cap():
    """Fill shares should be capped at 1% of daily volume."""
    mgr = OrderManager.__new__(OrderManager)
    mgr.db = AsyncMock()

    # Request 100000 shares, but daily volume * 1% = 50000
    order = _make_order(shares=100000)
    dq = _make_dq(close=10.0, pre_close=10.0, volume=5000000)

    mgr.db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=dq)))

    import asyncio
    result = asyncio.get_event_loop().run_until_complete(mgr.simulate_fill(order))

    assert result.status == OrderStatus.FILLED.value
    # 5000000 * 0.01 = 50000, rounded to 100-share lots = 50000
    assert result.fill_shares == 50000


def test_order_status_enum():
    """OrderStatus enum should have all expected values."""
    assert OrderStatus.PENDING.value == "pending"
    assert OrderStatus.FILLED.value == "filled"
    assert OrderStatus.REJECTED.value == "rejected"
    assert OrderStatus.CANCELLED.value == "cancelled"


print("All PaperEngine tests passed!")
