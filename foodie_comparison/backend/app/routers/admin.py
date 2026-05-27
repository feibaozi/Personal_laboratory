import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.shop import Shop, ShopPlatformLink
from app.models.product import Product, CrossPlatformProduct
from app.models.price import PriceSnapshot
from app.models.coupon import Coupon
from app.models.platform import PlatformActivity, FlashSale
from app.models.user import User
from app.models.recommend import RecommendResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    shops_count = (await db.execute(select(func.count(Shop.id)))).scalar() or 0
    products_count = (await db.execute(select(func.count(Product.id)))).scalar() or 0
    cross_products_count = (await db.execute(select(func.count(CrossPlatformProduct.id)))).scalar() or 0
    coupons_count = (await db.execute(
        select(func.count(Coupon.id)).where(Coupon.is_active == True)
    )).scalar() or 0
    activities_count = (await db.execute(
        select(func.count(PlatformActivity.id)).where(PlatformActivity.is_active == True)
    )).scalar() or 0
    flash_sales_count = (await db.execute(
        select(func.count(FlashSale.id)).where(FlashSale.is_active == True)
    )).scalar() or 0
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0

    snapshots_today = (await db.execute(
        select(func.count(PriceSnapshot.id)).where(PriceSnapshot.created_at >= day_ago)
    )).scalar() or 0
    snapshots_week = (await db.execute(
        select(func.count(PriceSnapshot.id)).where(PriceSnapshot.created_at >= week_ago)
    )).scalar() or 0

    platform_links = (await db.execute(
        select(ShopPlatformLink.platform, func.count(ShopPlatformLink.id))
        .group_by(ShopPlatformLink.platform)
    )).all()
    platform_coverage = {p: c for p, c in platform_links}

    recent_snapshots = (await db.execute(
        select(PriceSnapshot.platform, func.count(PriceSnapshot.id))
        .where(PriceSnapshot.created_at >= day_ago)
        .group_by(PriceSnapshot.platform)
    )).all()
    daily_collection = {p: c for p, c in recent_snapshots}

    recommend_count = (await db.execute(
        select(func.count(RecommendResult.id))
    )).scalar() or 0

    return {
        "overview": {
            "shops": shops_count,
            "products": products_count,
            "cross_platform_products": cross_products_count,
            "active_coupons": coupons_count,
            "active_activities": activities_count,
            "active_flash_sales": flash_sales_count,
            "users": users_count,
            "recommend_results": recommend_count,
        },
        "collection": {
            "price_snapshots_today": snapshots_today,
            "price_snapshots_week": snapshots_week,
            "platform_coverage": platform_coverage,
            "daily_collection_by_platform": daily_collection,
        },
        "timestamp": now.isoformat(),
    }


@router.get("/collector-status")
async def get_collector_status(db: AsyncSession = Depends(get_db)):
    from app.collectors.meituan_collector import MeituanCollector
    from app.collectors.eleme_collector import ElemeCollector
    from app.collectors.jd_collector import JDCollector
    from app.collectors.douyin_collector import DouyinCollector

    collectors = [
        ("meituan", MeituanCollector),
        ("eleme", ElemeCollector),
        ("jd", JDCollector),
        ("douyin", DouyinCollector),
    ]

    statuses = []
    for platform, collector_cls in collectors:
        day_ago = datetime.utcnow() - timedelta(days=1)
        snapshot_count = (await db.execute(
            select(func.count(PriceSnapshot.id))
            .where(
                PriceSnapshot.platform == platform,
                PriceSnapshot.created_at >= day_ago,
            )
        )).scalar() or 0

        latest_snapshot = (await db.execute(
            select(PriceSnapshot.created_at)
            .where(PriceSnapshot.platform == platform)
            .order_by(PriceSnapshot.created_at.desc())
            .limit(1)
        )).scalar()

        shop_links = (await db.execute(
            select(func.count(ShopPlatformLink.id))
            .where(ShopPlatformLink.platform == platform)
        )).scalar() or 0

        active_coupons = (await db.execute(
            select(func.count(Coupon.id))
            .where(
                Coupon.platform == platform,
                Coupon.is_active == True,
                Coupon.expire_time > datetime.utcnow(),
            )
        )).scalar() or 0

        collector = collector_cls()
        api_configured = bool(getattr(collector, "_api_client", None))

        statuses.append({
            "platform": platform,
            "is_healthy": snapshot_count > 0,
            "snapshots_24h": snapshot_count,
            "latest_snapshot": latest_snapshot.isoformat() if latest_snapshot else None,
            "shop_links": shop_links,
            "active_coupons": active_coupons,
            "api_configured": api_configured,
            "strategy_order": collector.strategy_order,
        })

    return {
        "collectors": statuses,
        "timestamp": datetime.utcnow().isoformat(),
    }
