from datetime import date, datetime
from sqlalchemy import Column, Integer, Float, String, Date, DateTime, Text, JSON, ForeignKey, UniqueConstraint
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


class BacktestTrade(Base):
    __tablename__ = "backtest_trades"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), index=True)
    trade_date = Column(Date, index=True)
    stock_code = Column(String(6))
    direction = Column(String(4))
    shares = Column(Integer)
    price = Column(Float)
    amount = Column(Float)
    cost = Column(Float)
    slippage = Column(Float)


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


class PaperTradeRun(Base):
    __tablename__ = "paper_trade_runs"
    id = Column(String(36), primary_key=True)
    name = Column(String(100))
    config_json = Column(JSON)
    status = Column(String(20), default="active")
    started_at = Column(DateTime)
    initial_capital = Column(Float)
    current_cash = Column(Float)
    current_value = Column(Float)
    total_return = Column(Float)


class PaperOrder(Base):
    __tablename__ = "paper_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("paper_trade_runs.id"), index=True)
    trade_date = Column(Date, index=True)
    stock_code = Column(String(6))
    direction = Column(String(4))
    signal_price = Column(Float)
    order_shares = Column(Integer)
    fill_price = Column(Float)
    fill_shares = Column(Integer)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime)
    filled_at = Column(DateTime, nullable=True)
    reject_reason = Column(Text, nullable=True)


class PaperPosition(Base):
    __tablename__ = "paper_positions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("paper_trade_runs.id"), index=True)
    stock_code = Column(String(6))
    shares = Column(Integer)
    avg_cost = Column(Float)
    market_value = Column(Float)
    weight = Column(Float)
    unrealized_pnl = Column(Float)
    updated_at = Column(DateTime)
    __table_args__ = (UniqueConstraint("run_id", "stock_code"),)


class PaperDailyValue(Base):
    __tablename__ = "paper_daily_values"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("paper_trade_runs.id"), index=True)
    trade_date = Column(Date, index=True)
    total_value = Column(Float)
    cash = Column(Float)
    daily_return = Column(Float)
