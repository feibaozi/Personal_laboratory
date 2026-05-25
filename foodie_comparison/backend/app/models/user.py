import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, Float, JSON, ForeignKey
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    email = Column(String(128), unique=True, nullable=True)
    hashed_password = Column(String(256), nullable=False)
    nickname = Column(String(128), default="")
    avatar_url = Column(String(512), default="")

    default_address = Column(String(512), default="")

    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    preferences = relationship(
        "UserPreference", back_populates="user",
        uselist=False, cascade="all, delete-orphan",
    )
    order_histories = relationship(
        "OrderHistory", back_populates="user",
        cascade="all, delete-orphan",
    )
    user_coupons = relationship(
        "UserCoupon", back_populates="user",
        cascade="all, delete-orphan",
    )


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    cuisine_weights = Column(JSON, default=dict)
    taste_weights = Column(JSON, default=dict)

    avg_order_amount = Column(Float, default=0.0)
    price_sensitivity = Column(Float, default=0.5)
    preferred_platforms = Column(JSON, default=list)
    preferred_delivery_time = Column(Integer, default=30)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="preferences")