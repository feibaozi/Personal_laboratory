import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float, Boolean, JSON, ForeignKey
)
from sqlalchemy.orm import relationship

from app.database import Base


class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(256), nullable=False, index=True)
    image_url = Column(String(512), default="")
    rating = Column(Float, default=0.0)
    category = Column(String(64), default="")
    address = Column(String(512), default="")
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    is_chain = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    platform_links = relationship(
        "ShopPlatformLink", back_populates="shop",
        cascade="all, delete-orphan",
    )
    products = relationship(
        "Product", back_populates="shop",
        cascade="all, delete-orphan",
    )


class ShopPlatformLink(Base):
    __tablename__ = "shop_platform_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    platform = Column(String(32), nullable=False, index=True)
    platform_shop_id = Column(String(128), nullable=False)
    platform_url = Column(String(512), default="")
    extra_data = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    shop = relationship("Shop", back_populates="platform_links")