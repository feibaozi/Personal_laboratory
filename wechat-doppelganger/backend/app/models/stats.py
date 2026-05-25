import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Text

from app.database import Base


class DailyStats(Base):
    __tablename__ = "daily_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, unique=True, nullable=False, index=True)
    messages_received = Column(Integer, default=0)
    messages_auto_replied = Column(Integer, default=0)
    messages_draft_approved = Column(Integer, default=0)
    messages_draft_rejected = Column(Integer, default=0)
    conversations_touched = Column(Integer, default=0)
    total_chars_generated = Column(Integer, default=0)
    estimated_time_saved_minutes = Column(Float, default=0.0)
    top_contact = Column(String(256), default="")
    top_contact_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ReplyLog(Base):
    __tablename__ = "reply_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contact_name = Column(String(256), nullable=False, index=True)
    char_count = Column(Integer, default=0)
    mode = Column(String(16), default="auto")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
