"""Tests for factor computer."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import numpy as np
import pandas as pd
from datetime import date
from unittest.mock import MagicMock
from app.engine.factor_computer import FactorComputer


def make_prices(num_stocks=10, num_days=200):
    dates = pd.date_range("2025-01-01", periods=num_days, freq="B")
    np.random.seed(42)
    data = {}
    codes = [f"{i:06d}" for i in range(1, num_stocks + 1)]
    for code in codes:
        base = np.random.uniform(5, 50)
        noise = np.random.normal(0, 0.01, len(dates))
        data[code] = base * np.cumprod(1 + noise)
    return pd.DataFrame(data, index=dates)


def make_fin_df(prices, d):
    latest = prices.iloc[-1]
    rows = []
    for code in latest.index:
        rows.append({
            "code": code, "date": d,
            "pe": np.random.uniform(5, 30),
            "pb": np.random.uniform(0.5, 5),
            "volume": np.random.uniform(1e6, 1e10),
            "close": float(latest[code]),
        })
    return pd.DataFrame(rows)


def make_mock_computer(prices):
    comp = FactorComputer.__new__(FactorComputer)
    comp.db = MagicMock()
    comp._cache = {}

    async def _prices(codes, d):
        return prices

    async def _fin(d):
        return make_fin_df(prices, d)

    comp._load_prices = _prices
    comp._load_fin = _fin
    return comp


async def test_momentum():
    comp = make_mock_computer(make_prices())
    codes = [f"{i:06d}" for i in range(1, 4)]
    vals = await comp.compute_one("return_1m", codes, date(2025, 8, 1))
    assert len(vals) >= 3, f"Expected >=3, got {len(vals)}"
    for v in vals.values():
        assert -0.5 < v < 0.5, f"Momentum out of range: {v}"


async def test_volatility():
    comp = make_mock_computer(make_prices())
    codes = [f"{i:06d}" for i in range(1, 4)]
    vals = await comp.compute_one("volatility_1m", codes, date(2025, 8, 1))
    assert len(vals) >= 3
    for v in vals.values():
        assert 0 < v < 1.0, f"Vol out of range: {v}"


async def test_pe_ratio():
    comp = make_mock_computer(make_prices())
    vals = await comp.compute_one("pe_ratio", [f"{i:06d}" for i in range(1, 4)], date(2025, 8, 1))
    assert len(vals) >= 3
    for v in vals.values():
        assert v > 0


async def test_max_drawdown_factor():
    comp = make_mock_computer(make_prices(10, 300))
    vals = await comp.compute_one("max_drawdown_1y", [f"{i:06d}" for i in range(1, 4)], date(2025, 10, 1))
    assert len(vals) >= 3
    for v in vals.values():
        assert v <= 0, f"Max DD should be negative: {v}"


async def test_log_market_cap():
    comp = make_mock_computer(make_prices())
    vals = await comp.compute_one("log_market_cap", [f"{i:06d}" for i in range(1, 4)], date(2025, 8, 1))
    assert len(vals) >= 3
    for v in vals.values():
        assert 10 < v < 30


if __name__ == "__main__":
    import asyncio
    async def run():
        await test_momentum(); print("  [PASS] momentum")
        await test_volatility(); print("  [PASS] volatility")
        await test_pe_ratio(); print("  [PASS] pe_ratio")
        await test_log_market_cap(); print("  [PASS] log_market_cap")
        await test_max_drawdown_factor(); print("  [PASS] max_drawdown")
    asyncio.run(run())
    print("All factor computer tests passed!")
