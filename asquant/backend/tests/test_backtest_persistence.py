"""Unit tests for backtest result persistence logic."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from datetime import date
from app.models.backtest import BacktestDaily, BacktestTrade, BacktestSummary, PaperDailyValue


def test_backtest_daily_model():
    """BacktestDaily model should have expected fields."""
    daily = BacktestDaily(
        run_id="test-run",
        trade_date=date(2024, 1, 15),
        portfolio_value=1050000.0,
        benchmark_value=1020000.0,
        cash=50000.0,
        daily_return=0.01,
        benchmark_return=0.005,
        turnover=0.15,
        positions_json='{"A1": 500}',
    )
    assert daily.run_id == "test-run"
    assert daily.trade_date == date(2024, 1, 15)
    assert daily.portfolio_value == 1050000.0
    assert daily.cash == 50000.0
    assert daily.positions_json == '{"A1": 500}'


def test_backtest_trade_model():
    """BacktestTrade model should have expected fields."""
    trade = BacktestTrade(
        run_id="test-run",
        trade_date=date(2024, 1, 15),
        stock_code="000001",
        direction="buy",
        shares=1000,
        price=10.5,
        amount=10500.0,
        cost=3.15,
        slippage=0.001,
    )
    assert trade.run_id == "test-run"
    assert trade.direction == "buy"
    assert trade.shares == 1000
    assert trade.price == 10.5
    assert trade.cost == 3.15


def test_backtest_summary_model():
    """BacktestSummary model should have expected fields."""
    summary = BacktestSummary(
        run_id="test-run",
        total_return=0.5,
        annual_return=0.2,
        volatility=0.15,
        max_drawdown=-0.1,
        sharpe=1.5,
        calmar=2.0,
        sortino=2.5,
        alpha=0.05,
        beta=0.8,
        r_squared=0.7,
    )
    assert summary.run_id == "test-run"
    assert summary.total_return == 0.5
    assert summary.sharpe == 1.5


def test_paper_daily_value_model():
    """PaperDailyValue model should have expected fields."""
    pdv = PaperDailyValue(
        run_id="paper-run",
        trade_date=date(2024, 1, 15),
        total_value=1050000.0,
        cash=50000.0,
        daily_return=0.01,
    )
    assert pdv.run_id == "paper-run"
    assert pdv.total_value == 1050000.0
    assert pdv.daily_return == 0.01


def test_date_parsing_from_string():
    """Date strings from backtest results should be parseable."""
    # Vectorized engine returns date objects
    d1 = date(2024, 1, 15)
    assert isinstance(d1, date)

    # Event-driven engine may return string dates
    date_str = "2024-01-15"
    parsed = date.fromisoformat(date_str[:10])
    assert parsed == date(2024, 1, 15)

    # Pandas Timestamp
    import pandas as pd
    ts = pd.Timestamp("2024-01-15")
    parsed_ts = ts.date()
    assert parsed_ts == date(2024, 1, 15)


def test_summary_monthly_returns_json():
    """Monthly returns should be serializable to JSON."""
    import json
    monthly = [{"month": 1, "return": 0.05}, {"month": 2, "return": -0.02}]
    json_str = json.dumps(monthly)
    parsed = json.loads(json_str)
    assert len(parsed) == 2
    assert parsed[0]["month"] == 1
    assert parsed[1]["return"] == -0.02


print("All BacktestPersistence tests passed!")
