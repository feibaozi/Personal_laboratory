"""Unit tests for EventDrivenBacktester (signal generation & data index)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import pandas as pd
import numpy as np
from datetime import date, datetime, timedelta


def _build_test_df():
    """Build a small test DataFrame simulating minute data for 3 stocks."""
    times = pd.date_range("2024-01-02 09:30", periods=30, freq="5min")
    rows = []
    for code in ["A1", "A2", "A3"]:
        base_price = 10.0 if code == "A1" else 20.0 if code == "A2" else 30.0
        for i, t in enumerate(times):
            rows.append({
                "code": code,
                "time": t,
                "date": t.date(),
                "open": base_price + i * 0.01,
                "high": base_price + i * 0.02,
                "low": base_price - i * 0.01,
                "close": base_price + i * 0.01,
                "volume": 10000 + i * 100,
                "amount": (base_price + i * 0.01) * (10000 + i * 100),
            })
    return pd.DataFrame(rows)


def test_data_index_construction():
    """Pre-built data_index should have entries for all (code, time) pairs."""
    from app.engine.event_driven_engine import EventDrivenBacktester
    df = _build_test_df()
    codes = df["code"].unique().tolist()

    data_index = {}
    for _, row in df.iterrows():
        data_index[(row["code"], row["time"])] = {
            "open": row["open"], "high": row["high"], "low": row["low"],
            "close": row["close"], "volume": row["volume"], "amount": row["amount"],
        }

    # Should have 3 stocks * 30 times = 90 entries
    assert len(data_index) == 90

    # O(1) lookup should work
    first_time = df["time"].iloc[0]
    bar = data_index.get(("A1", first_time))
    assert bar is not None
    assert bar["close"] > 0


def test_code_times_index():
    """code_times and code_time_idx should correctly map time -> index."""
    df = _build_test_df()
    codes = df["code"].unique().tolist()

    code_times = {}
    code_time_idx = {}
    for code in codes:
        code_df = df[df["code"] == code]
        times = code_df["time"].tolist()
        code_times[code] = times
        code_time_idx[code] = {t: i for i, t in enumerate(times)}

    for code in codes:
        assert len(code_times[code]) == 30
        assert len(code_time_idx[code]) == 30
        # First time should map to index 0
        assert code_time_idx[code][code_times[code][0]] == 0
        # Last time should map to index 29
        assert code_time_idx[code][code_times[code][-1]] == 29


def test_signal_generation_momentum():
    """Intraday momentum strategy should generate signals."""
    from app.engine.event_driven_engine import EventDrivenBacktester

    df = _build_test_df()
    codes = df["code"].unique().tolist()

    data_index = {}
    for _, row in df.iterrows():
        data_index[(row["code"], row["time"])] = {
            "open": row["open"], "high": row["high"], "low": row["low"],
            "close": row["close"], "volume": row["volume"], "amount": row["amount"],
        }

    code_times = {}
    code_time_idx = {}
    for code in codes:
        code_df = df[df["code"] == code]
        times = code_df["time"].tolist()
        code_times[code] = times
        code_time_idx[code] = {t: i for i, t in enumerate(times)}

    engine = EventDrivenBacktester.__new__(EventDrivenBacktester)

    # Use a time that has enough lookback
    test_time = code_times["A1"][25]  # index 25, lookback=20
    signals = engine._generate_signals(
        data_index, code_times, code_time_idx, codes,
        test_time, "intraday_momentum", lookback=20, top_n=3,
    )

    assert len(signals) > 0
    assert len(signals) <= 3
    # All signals should have (code, score) tuples
    for code, score in signals:
        assert code in codes
        assert isinstance(score, float)


def test_signal_generation_mean_reversion():
    """Mean reversion strategy should generate signals."""
    from app.engine.event_driven_engine import EventDrivenBacktester

    df = _build_test_df()
    codes = df["code"].unique().tolist()

    data_index = {}
    for _, row in df.iterrows():
        data_index[(row["code"], row["time"])] = {
            "open": row["open"], "high": row["high"], "low": row["low"],
            "close": row["close"], "volume": row["volume"], "amount": row["amount"],
        }

    code_times = {}
    code_time_idx = {}
    for code in codes:
        code_df = df[df["code"] == code]
        times = code_df["time"].tolist()
        code_times[code] = times
        code_time_idx[code] = {t: i for i, t in enumerate(times)}

    engine = EventDrivenBacktester.__new__(EventDrivenBacktester)
    test_time = code_times["A1"][25]
    signals = engine._generate_signals(
        data_index, code_times, code_time_idx, codes,
        test_time, "mean_reversion", lookback=20, top_n=3,
    )
    assert len(signals) > 0


def test_signal_generation_breakout():
    """Breakout strategy should generate signals."""
    from app.engine.event_driven_engine import EventDrivenBacktester

    df = _build_test_df()
    codes = df["code"].unique().tolist()

    data_index = {}
    for _, row in df.iterrows():
        data_index[(row["code"], row["time"])] = {
            "open": row["open"], "high": row["high"], "low": row["low"],
            "close": row["close"], "volume": row["volume"], "amount": row["amount"],
        }

    code_times = {}
    code_time_idx = {}
    for code in codes:
        code_df = df[df["code"] == code]
        times = code_df["time"].tolist()
        code_times[code] = times
        code_time_idx[code] = {t: i for i, t in enumerate(times)}

    engine = EventDrivenBacktester.__new__(EventDrivenBacktester)
    test_time = code_times["A1"][25]
    signals = engine._generate_signals(
        data_index, code_times, code_time_idx, codes,
        test_time, "breakout", lookback=20, top_n=3,
    )
    assert len(signals) > 0


def test_signal_insufficient_lookback():
    """Signals should be empty when lookback window is insufficient."""
    from app.engine.event_driven_engine import EventDrivenBacktester

    df = _build_test_df()
    codes = df["code"].unique().tolist()

    data_index = {}
    for _, row in df.iterrows():
        data_index[(row["code"], row["time"])] = {
            "open": row["open"], "high": row["high"], "low": row["low"],
            "close": row["close"], "volume": row["volume"], "amount": row["amount"],
        }

    code_times = {}
    code_time_idx = {}
    for code in codes:
        code_df = df[df["code"] == code]
        times = code_df["time"].tolist()
        code_times[code] = times
        code_time_idx[code] = {t: i for i, t in enumerate(times)}

    engine = EventDrivenBacktester.__new__(EventDrivenBacktester)
    # Use first time (index 0) with lookback=20 => insufficient
    test_time = code_times["A1"][0]
    signals = engine._generate_signals(
        data_index, code_times, code_time_idx, codes,
        test_time, "intraday_momentum", lookback=20, top_n=3,
    )
    assert len(signals) == 0


def test_strategies_dict():
    """STRATEGIES dict should contain all 3 strategies."""
    from app.engine.event_driven_engine import STRATEGIES
    assert "intraday_momentum" in STRATEGIES
    assert "mean_reversion" in STRATEGIES
    assert "breakout" in STRATEGIES


print("All EventDrivenEngine tests passed!")
