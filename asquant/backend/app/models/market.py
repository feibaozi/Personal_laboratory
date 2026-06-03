from datetime import date, datetime
from sqlalchemy import Column, Integer, BigInteger, Float, String, Date, DateTime, Boolean, UniqueConstraint, ForeignKey, func
from ..database import Base


class Stock(Base):
    __tablename__ = "stocks"
    code = Column(String(6), primary_key=True)
    name = Column(String(20), nullable=False)
    exchange = Column(String(2))
    industry = Column(String(50))
    industry_code = Column(String(10))
    area = Column(String(20))
    list_date = Column(Date, index=True)
    out_date = Column(Date, index=True)
    is_st = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())


class DailyQuote(Base):
    __tablename__ = "daily_quotes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_code = Column(String(6), ForeignKey("stocks.code"), index=True)
    trade_date = Column(Date, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    pre_close = Column(Float)
    volume = Column(BigInteger)
    amount = Column(Float)
    turnover_rate = Column(Float)
    pe_ratio = Column(Float)
    pb_ratio = Column(Float)
    change_pct = Column(Float)
    __table_args__ = (UniqueConstraint("stock_code", "trade_date"),)


class IndexDaily(Base):
    __tablename__ = "index_daily"
    id = Column(Integer, primary_key=True, autoincrement=True)
    index_code = Column(String(10))
    index_name = Column(String(30))
    trade_date = Column(Date)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(BigInteger)
    amount = Column(Float)
    change_pct = Column(Float)
    __table_args__ = (UniqueConstraint("index_code", "trade_date"),)


class SectorDaily(Base):
    __tablename__ = "sector_daily"
    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_date = Column(Date)
    sector_code = Column(String(10))
    sector_name = Column(String(50))
    change_pct = Column(Float)
    leading_stock_code = Column(String(6))
    leading_stock_name = Column(String(20))
    __table_args__ = (UniqueConstraint("trade_date", "sector_code"),)


class NorthBoundFlow(Base):
    __tablename__ = "north_bound_flow"
    trade_date = Column(Date, primary_key=True)
    net_flow_sh = Column(Float)
    net_flow_sz = Column(Float)
    net_flow_total = Column(Float)


class MarketBreadth(Base):
    __tablename__ = "market_breadth"
    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_date = Column(Date, unique=True)
    up_count = Column(Integer)
    down_count = Column(Integer)
    flat_count = Column(Integer)
    limit_up = Column(Integer)
    limit_down = Column(Integer)


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_code = Column(String(6), ForeignKey("stocks.code"))
    added_at = Column(DateTime, default=func.now())
    notes = Column(String(200))
    alert_price_upper = Column(Float)
    alert_price_lower = Column(Float)


class TradingCalendar(Base):
    __tablename__ = "trading_calendar"
    trade_date = Column(Date, primary_key=True)
    is_trading_day = Column(Boolean, default=True)


class MinuteQuote(Base):
    __tablename__ = "minute_quotes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_code = Column(String(6), index=True)
    trade_time = Column(DateTime, index=True)
    trade_date = Column(Date, index=True)
    freq = Column(String(5), default="5")
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(BigInteger)
    amount = Column(Float)
    source = Column(String(10), default="synthetic")  # "real" or "synthetic"
    __table_args__ = (UniqueConstraint("stock_code", "trade_time", "freq"),)


class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_code = Column(String(6))
    shares = Column(Integer, default=0)
    avg_cost = Column(Float)
    open_date = Column(Date, nullable=True)      # 开仓日期
    close_date = Column(Date, nullable=True)     # 平仓日期 (NULL=持仓中)
    close_price = Column(Float, nullable=True)   # 平仓价格
    added_at = Column(DateTime, default=func.now())
    notes = Column(String(200))


class SyncLog(Base):
    __tablename__ = "sync_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    data_type = Column(String(30))
    last_sync = Column(DateTime)
    status = Column(String(20))
    record_count = Column(Integer)
    error_message = Column(String(500))


class StockInfo(Base):
    __tablename__ = "stock_info"
    stock_code = Column(String(6), primary_key=True)
    total_shares = Column(BigInteger)
    float_shares = Column(BigInteger)
    industry_sw = Column(String(50))
    industry_sw_code = Column(String(10))
    updated_at = Column(DateTime, default=func.now())


class FinancialReport(Base):
    __tablename__ = "financial_reports"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_code = Column(String(6), ForeignKey("stocks.code"), index=True)
    report_date = Column(Date, index=True)
    public_date = Column(Date, nullable=True, index=True)
    report_type = Column(String(20))

    revenue = Column(Float)
    operating_cost = Column(Float)
    selling_expense = Column(Float)
    admin_expense = Column(Float)
    rd_expense = Column(Float)
    operating_profit = Column(Float)
    net_profit = Column(Float)
    net_profit_parent = Column(Float)

    total_assets = Column(Float)
    total_liabilities = Column(Float)
    total_equity = Column(Float)
    current_assets = Column(Float)
    current_liabilities = Column(Float)

    operating_cash_flow = Column(Float)
    investing_cash_flow = Column(Float)
    financing_cash_flow = Column(Float)
    free_cash_flow = Column(Float)

    roe_val = Column(Float)
    net_margin_val = Column(Float)
    gross_margin_val = Column(Float)
    total_shares_val = Column(Float)
    float_shares_val = Column(Float)

    yoy_revenue_growth = Column(Float)
    yoy_profit_growth = Column(Float)
    yoy_parent_profit_growth = Column(Float)

    dividend_per_share = Column(Float)

    __table_args__ = (UniqueConstraint("stock_code", "report_date", "report_type"),)


class MarginDetail(Base):
    __tablename__ = "margin_details"
    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_date = Column(Date, index=True)
    stock_code = Column(String(6), ForeignKey("stocks.code"), index=True)
    margin_buy = Column(Float)
    margin_sell = Column(Float)
    margin_balance = Column(Float)
    short_sell_volume = Column(Float)
    short_buy_volume = Column(Float)
    short_balance = Column(Float)
    total_balance = Column(Float)
    __table_args__ = (UniqueConstraint("trade_date", "stock_code"),)


class NorthBoundDaily(Base):
    __tablename__ = "north_bound_daily"
    trade_date = Column(Date, primary_key=True)
    net_flow_sh = Column(Float)
    net_flow_sz = Column(Float)
    net_flow_total = Column(Float)
    balance_sh = Column(Float)
    balance_sz = Column(Float)
    balance_total = Column(Float)


class SectorFlow(Base):
    __tablename__ = "sector_flow"
    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_date = Column(Date, index=True)
    sector_code = Column(String(10), index=True)
    sector_name = Column(String(50))
    net_flow = Column(Float)
    buy_amount = Column(Float)
    sell_amount = Column(Float)
    __table_args__ = (UniqueConstraint("trade_date", "sector_code"),)
