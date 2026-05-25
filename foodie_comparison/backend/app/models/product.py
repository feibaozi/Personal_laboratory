import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float, Boolean, JSON, ForeignKey
)
from sqlalchemy.orm import relationship

from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    image_url = Column(String(512), default="")
    category = Column(String(64), default="")
    description = Column(Text, default="")

    is_available = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                       onupdate=datetime.datetime.utcnow)

    shop = relationship("Shop", back_populates="products")
    prices = relationship(
        "PriceSnapshot", back_populates="product",
        cascade="all, delete-orphan",
    )
    cross_platforms = relationship(
        "CrossPlatformProduct", back_populates="product",
        cascade="all, delete-orphan",
    )


class CrossPlatformProduct(Base):
    __tablename__ = "cross_platform_products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    platform = Column(String(32), nullable=False, index=True)
    platform_product_id = Column(String(128), nullable=False)
    platform_shop_id = Column(String(128), nullable=False)
    match_confidence = Column(Float, default=1.0)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="cross_platforms")