import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class OrderHistory(Base):
    __tablename__ = "order_histories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    shop_id = Column(Integer, nullable=False, default=0)
    shop_name = Column(String(256), default="")
    platform = Column(String(32), nullable=False)

    order_amount = Column(Float, default=0.0)
    actual_amount = Column(Float, default=0.0)
    savings = Column(Float, default=0.0)

    items = Column(Text, default="[]")
    coupons_used = Column(Text, default="[]")

    user_rating = Column(Integer, default=0)
    feedback = Column(Text, default="")

    order_time = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="order_histories")