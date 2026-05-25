import datetime
import enum
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean, Text, Enum as SAEnum, ForeignKey
)
from sqlalchemy.orm import relationship

from app.database import Base


class CouponType(str, enum.Enum):
    DIRECT = "direct"
    FULL_REDUCTION = "full_reduction"
    DELIVERY_FREE = "delivery_free"
    NEW_USER = "new_user"
    PLATFORM = "platform"


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(256), nullable=False)
    type = Column(SAEnum(CouponType), default=CouponType.DIRECT)
    value = Column(Float, nullable=False)
    min_spend = Column(Float, default=0.0)
    platform = Column(String(32), nullable=False, index=True)
    platform_coupon_id = Column(String(128), default="")
    description = Column(Text, default="")

    applicable_shops = Column(String, default="")
    applicable_categories = Column(String, default="")

    start_time = Column(DateTime, nullable=False)
    expire_time = Column(DateTime, nullable=False, index=True)

    total_quota = Column(Integer, default=0)
    remaining_quota = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    claim_url = Column(String(512), default="")
    claim_method = Column(String(32), default="redirect")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    user_coupons = relationship(
        "UserCoupon", back_populates="coupon",
        cascade="all, delete-orphan",
    )


class UserCoupon(Base):
    __tablename__ = "user_coupons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id"), nullable=False, index=True)

    claim_status = Column(String(32), default="pending")
    claim_time = Column(DateTime, nullable=True)
    used = Column(Boolean, default=False)
    use_time = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="user_coupons")
    coupon = relationship("Coupon", back_populates="user_coupons")