"""Alembic 迁移生成工具（无需 alembic CLI 权限）"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import create_engine
from app.database import Base
from app.models.user import User, UserPreference
from app.models.shop import Shop, ShopPlatformLink
from app.models.product import Product, CrossPlatformProduct
from app.models.price import PriceSnapshot, DeliveryFeeSnapshot
from app.models.coupon import Coupon, UserCoupon
from app.models.order import OrderHistory
from app.models.platform import PlatformActivity, FlashSale
from app.models.recommend import UserBehavior, RecommendResult


def create_tables(engine_url: str = "sqlite:///foodie_dev.db"):
    engine = create_engine(engine_url, echo=True)
    Base.metadata.create_all(engine)
    print("\nAll tables created successfully!")

    for table_name in sorted(Base.metadata.tables.keys()):
        table = Base.metadata.tables[table_name]
        columns = ", ".join(c.name for c in table.columns)
        print(f"  {table_name}: ({columns})")

    engine.dispose()


if __name__ == "__main__":
    create_tables()