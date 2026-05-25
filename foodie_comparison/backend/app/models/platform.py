import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, Float, JSON
)

from app.database import Base


class PlatformActivity(Base):
    __tablename__ = "platform_activities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String(32), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    description = Column(String(1024), default="")
    icon = Column(String(8), default="")
    activity_url = Column(String(512), default="")
    extra_data = Column(JSON, default=dict)

    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False, index=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class FlashSale(Base):
    __tablename__ = "flash_sales"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(256), nullable=False)
    description = Column(String(1024), default="")
    discount = Column(Float, default=0.0)

    platforms = Column(JSON, default=list)
    applicable_shops = Column(String, default="")

    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False, index=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)