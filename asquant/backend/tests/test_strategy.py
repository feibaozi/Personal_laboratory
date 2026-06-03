"""Tests for strategy model and API."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.strategy import Strategy, PRESET_STRATEGIES, seed_strategies


class TestStrategyModel:
    def test_get_config_empty(self):
        s = Strategy(name="test")
        s.config_json = None
        assert s.get_config() == {}

    def test_get_config_with_data(self):
        s = Strategy(name="test")
        s.config_json = json.dumps({"top_n": 30, "weighting": "equal"})
        config = s.get_config()
        assert config["top_n"] == 30
        assert config["weighting"] == "equal"

    def test_set_config(self):
        s = Strategy(name="test")
        s.set_config({"factor_names": ["pe_ratio"], "top_n": 20})
        assert s.config_json is not None
        parsed = json.loads(s.config_json)
        assert parsed["factor_names"] == ["pe_ratio"]
        assert parsed["top_n"] == 20

    def test_set_config_chinese(self):
        s = Strategy(name="test")
        s.set_config({"name": "低估值高成长"})
        parsed = json.loads(s.config_json)
        assert parsed["name"] == "低估值高成长"

    def test_roundtrip(self):
        s = Strategy(name="test")
        original = {"factor_names": ["pe_ratio", "revenue_growth_yoy"], "top_n": 30, "weighting": "risk_parity"}
        s.set_config(original)
        result = s.get_config()
        assert result == original


class TestPresetStrategies:
    def test_preset_count(self):
        assert len(PRESET_STRATEGIES) == 4

    def test_preset_names(self):
        names = [p["name"] for p in PRESET_STRATEGIES]
        assert "低估值高成长" in names
        assert "动量反转" in names
        assert "高质量低波动" in names
        assert "小盘成长" in names

    def test_preset_have_config(self):
        for preset in PRESET_STRATEGIES:
            assert "config" in preset
            assert "factor_names" in preset["config"]
            assert "top_n" in preset["config"]
            assert "weighting" in preset["config"]
            assert preset["category"] == "preset"

    def test_preset_factor_weights_match(self):
        for preset in PRESET_STRATEGIES:
            config = preset["config"]
            assert len(config["factor_names"]) == len(config["factor_weights"])


class TestSeedStrategies:
    @pytest.mark.asyncio
    async def test_seed_creates_presets(self):
        db = AsyncMock()
        # No existing presets
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        await seed_strategies(db)
        assert db.add.call_count == 4
        assert db.commit.called

    @pytest.mark.asyncio
    async def test_seed_skips_if_existing(self):
        db = AsyncMock()
        # Already have presets
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [MagicMock()]
        db.execute = AsyncMock(return_value=mock_result)

        await seed_strategies(db)
        assert db.add.call_count == 0
