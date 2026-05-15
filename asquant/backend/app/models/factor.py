from datetime import date, datetime
from sqlalchemy import Column, Integer, Float, String, Date, DateTime, Boolean, UniqueConstraint, JSON, Text
from ..database import Base


class FactorDefinition(Base):
    __tablename__ = "factor_definitions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True)
    category = Column(String(30))
    description = Column(String(200))
    formula_spec = Column(JSON)
    default_params = Column(JSON)
    is_builtin = Column(Boolean, default=True)


class FactorValue(Base):
    __tablename__ = "factor_values"
    id = Column(Integer, primary_key=True, autoincrement=True)
    factor_id = Column(Integer, index=True)
    stock_code = Column(String(6), index=True)
    trade_date = Column(Date, index=True)
    value = Column(Float)
    __table_args__ = (UniqueConstraint("factor_id", "stock_code", "trade_date"),)


class FactorBacktestResult(Base):
    __tablename__ = "factor_backtest_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    factor_id = Column(Integer)
    start_date = Column(Date)
    end_date = Column(Date)
    universe_spec = Column(JSON)
    ic_mean = Column(Float)
    ic_std = Column(Float)
    icir = Column(Float)
    ic_win_rate = Column(Float)
    ic_t_stat = Column(Float)
    ic_series = Column(Text)
    quantile_returns = Column(Text)
    turnover = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
