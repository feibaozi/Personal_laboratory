"""Tests for data_service module — _build_daily_row, _get_last_sync_date, _safe_val, pd_isna, constants."""
import math
from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pandas as pd
import numpy as np

from app.services.data_service import SyncManager, _safe_val, pd_isna, BATCH_SIZE, SYNC_CONCURRENCY


# ── _build_daily_row ──────────────────────────────────────────

class TestBuildDailyRow:
    def _make_manager(self):
        db = AsyncMock()
        return SyncManager(db)

    def _make_row(self, data: dict) -> pd.Series:
        """Create a pandas Series from dict, matching real data flow."""
        return pd.Series(data)

    def test_normal_row(self):
        mgr = self._make_manager()
        row = self._make_row({
            "date": "2026-06-01",
            "open": 10.5, "high": 11.0, "low": 10.0, "close": 10.8,
            "pre_close": 10.3, "volume": 5000000, "amount": 54000000.0,
            "turnover_rate": 2.5, "change_pct": 4.85,
            "pe_ratio": 15.2, "pb_ratio": 1.8,
        })

        result = mgr._build_daily_row("000001", row)
        assert result["stock_code"] == "000001"
        assert result["trade_date"] == date(2026, 6, 1)
        assert result["open"] == 10.5
        assert result["close"] == 10.8
        assert result["volume"] == 5000000
        assert result["turnover_rate"] == 2.5
        assert result["pe_ratio"] == 15.2

    def test_nan_values(self):
        mgr = self._make_manager()
        row = self._make_row({
            "date": date(2026, 6, 1),
            "open": float("nan"), "high": float("nan"),
            "low": float("nan"), "close": float("nan"),
            "pre_close": float("nan"), "volume": float("nan"),
            "amount": float("nan"), "turnover_rate": float("nan"),
            "change_pct": float("nan"), "pe_ratio": float("nan"),
            "pb_ratio": float("nan"),
        })

        result = mgr._build_daily_row("000001", row)
        assert result["open"] is None
        assert result["close"] is None
        assert result["volume"] == 0  # volume defaults to 0 for NaN
        assert result["turnover_rate"] is None
        assert result["pe_ratio"] is None

    def test_date_string_parsing(self):
        mgr = self._make_manager()
        row = self._make_row({
            "date": "2026-01-15",
            "open": 5.0, "high": 5.5, "low": 4.8, "close": 5.2,
            "pre_close": 5.0, "volume": 1000, "amount": 5200.0,
        })

        result = mgr._build_daily_row("600000", row)
        assert result["trade_date"] == date(2026, 1, 15)

    def test_date_object_passthrough(self):
        mgr = self._make_manager()
        d = date(2026, 3, 20)
        row = self._make_row({
            "date": d,
            "open": 5.0, "high": 5.5, "low": 4.8, "close": 5.2,
            "pre_close": 5.0, "volume": 1000, "amount": 5200.0,
        })

        result = mgr._build_daily_row("600000", row)
        assert result["trade_date"] == d

    def test_missing_optional_fields(self):
        mgr = self._make_manager()
        row = self._make_row({
            "date": "2026-06-01",
            "open": 10.0, "high": 11.0, "low": 9.0, "close": 10.5,
            "volume": 1000, "amount": 10500.0,
        })

        result = mgr._build_daily_row("000001", row)
        assert result["pre_close"] is None
        assert result["turnover_rate"] is None
        assert result["change_pct"] is None
        assert result["pe_ratio"] is None
        assert result["pb_ratio"] is None


# ── _get_last_sync_date ───────────────────────────────────────

class TestGetLastSyncDate:
    @pytest.mark.asyncio
    async def test_found(self):
        db = AsyncMock()
        last_dt = datetime(2026, 5, 30, 15, 31, 0)
        mock_result = MagicMock()
        mock_result.first.return_value = (last_dt,)
        db.execute = AsyncMock(return_value=mock_result)

        mgr = SyncManager(db)
        result = await mgr._get_last_sync_date("daily_quotes")
        assert result == date(2026, 5, 30)

    @pytest.mark.asyncio
    async def test_not_found(self):
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.first.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        mgr = SyncManager(db)
        result = await mgr._get_last_sync_date("daily_quotes")
        assert result is None

    @pytest.mark.asyncio
    async def test_only_success_status(self):
        db = AsyncMock()
        last_dt = datetime(2026, 5, 30, 15, 31, 0)
        mock_result = MagicMock()
        mock_result.first.return_value = (last_dt,)
        db.execute = AsyncMock(return_value=mock_result)

        mgr = SyncManager(db)
        await mgr._get_last_sync_date("daily_quotes")

        # Verify the query was executed
        assert db.execute.called


# ── _safe_val ─────────────────────────────────────────────────

class TestSafeVal:
    def test_normal_int(self):
        assert _safe_val(42) == 42.0

    def test_normal_float(self):
        assert _safe_val(3.14) == 3.14

    def test_none(self):
        assert _safe_val(None) is None

    def test_nan(self):
        assert _safe_val(float("nan")) is None

    def test_inf(self):
        assert _safe_val(float("inf")) is None
        assert _safe_val(float("-inf")) is None

    def test_string_passthrough(self):
        assert _safe_val("hello") == "hello"


# ── pd_isna ───────────────────────────────────────────────────

class TestPdIsna:
    def test_none(self):
        assert pd_isna(None) is True

    def test_nan(self):
        assert pd_isna(float("nan")) is True

    def test_normal_number(self):
        # pd_isna returns np.False_ for numbers, use == instead of is
        assert pd_isna(42) == False
        assert pd_isna(3.14) == False

    def test_string(self):
        assert pd_isna("hello") == False

    def test_zero(self):
        assert pd_isna(0) == False
        assert pd_isna(0.0) == False


# ── Constants ─────────────────────────────────────────────────

class TestConstants:
    def test_sync_concurrency(self):
        assert SYNC_CONCURRENCY == 10

    def test_batch_size(self):
        assert BATCH_SIZE == 500
