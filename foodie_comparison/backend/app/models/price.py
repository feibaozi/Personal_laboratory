import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Index, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"
    __table_args__ = (
        Index("ix_price_product_platform_time",
              "product_id", "platform", "recorded_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    platform = Column(String(32), nullable=False, index=True)

    base_price = Column(Float, nullable=False)
    package_fee = Column(Float, default=0.0)
    delivery_fee = Column(Float, default=0.0)
    min_order_amount = Column(Float, default=0.0)

    discount_info = Column(String, default="[]")

    final_price = Column(Float, nullable=False)

    source = Column(String(32), default="api")

    recorded_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    product = relationship("Product", back_populates="prices")


class DeliveryFeeSnapshot(Base):
    __tablename__ = "delivery_fee_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String(32), nullable=False, index=True)
    shop_id = Column(Integer, nullable=False, index=True)

    user_lat = Column(Float, default=0.0)
    user_lng = Column(Float, default=0.0)

    delivery_fee = Column(Float, nullable=False)
    estimated_time_min = Column(Integer, default=30)
    estimated_time_max = Column(Integer, default=45)
    distance_km = Column(Float, default=0.0)

    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)