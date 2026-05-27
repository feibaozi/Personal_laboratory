from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, func
from sqlalchemy.orm import relationship
from database.connection import Base


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(10), unique=True, nullable=False)
    name = Column(String(50), nullable=False)
    market = Column(String(10))
    industry = Column(String(50))
    watch_status = Column(String(20), default="observing")
    notes = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Financial(Base):
    __tablename__ = "financials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, nullable=False)
    report_date = Column(String(10), nullable=False)
    report_type = Column(String(20))
    revenue = Column(Float)
    net_profit = Column(Float)
    total_assets = Column(Float)
    total_liabilities = Column(Float)
    operating_cf = Column(Float)
    gross_margin = Column(Float)
    roe = Column(Float)
    debt_ratio = Column(Float)
    receivables = Column(Float)
    raw_json = Column(Text)


class SentimentEvent(Base):
    __tablename__ = "sentiment_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer)
    source = Column(String(50))
    source_url = Column(Text)
    title = Column(String(500), nullable=False)
    content = Column(Text)
    sentiment = Column(String(10))
    sentiment_score = Column(Float)
    impact_score = Column(Float)
    event_cluster_id = Column(String(64))
    published_at = Column(DateTime)
    fetched_at = Column(DateTime, server_default=func.now())


class EventCluster(Base):
    __tablename__ = "event_clusters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cluster_id = Column(String(64), unique=True)
    title = Column(String(200))
    stock_ids = Column(Text)
    event_type = Column(String(50))
    severity = Column(String(10))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    summary = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer)
    report_type = Column(String(50))
    title = Column(String(200))
    content_markdown = Column(Text)
    data_snapshot = Column(Text)
    model_used = Column(String(50))
    tokens_used = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer)
    alert_type = Column(String(50))
    severity = Column(String(10))
    title = Column(String(200))
    description = Column(Text)
    related_data = Column(Text)
    is_read = Column(Boolean, default=False)
    dismissed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
