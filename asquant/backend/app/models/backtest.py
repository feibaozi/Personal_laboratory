from datetime import date, datetime
from sqlalchemy import Column, Integer, Float, String, Date, DateTime, Text, JSON
from ..database import Base


class BacktestRun(Base):
    __tablename__ = "backtest_runs"
    id = Column(String(36), primary_key=True)
    name = Column(String(100))
    config_json = Column(JSON)
    status = Column(String(20), default="pending")
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)


class BacktestDaily(Base):
    __tablename__ = "backtest_daily"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), index=True)
    trade_date = Column(Date)
    portfolio_value = Column(Float)
    benchmark_value = Column(Float)
    cash = Column(Float, default=0)
    daily_return = Column(Float)
    benchmark_return = Column(Float)
    turnover = Column(Float)
    positions_json = Column(Text)


class BacktestSummary(Base):
    __tablename__ = "backtest_summary"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), unique=True)
    total_return = Column(Float)
    annual_return = Column(Float)
    volatility = Column(Float)
    max_drawdown = Column(Float)
    max_drawdown_duration = Column(Integer)
    sharpe = Column(Float)
    calmar = Column(Float)
    sortino = Column(Float)
    alpha = Column(Float)
    beta = Column(Float)
    r_squared = Column(Float)
    information_ratio = Column(Float)
    var_95 = Column(Float)
    cvar_95 = Column(Float)
    treynor = Column(Float)
    win_rate = Column(Float)
    profit_factor = Column(Float)
    avg_win_loss = Column(Float)
    skewness = Column(Float)
    kurtosis = Column(Float)
    monthly_returns_json = Column(Text)
