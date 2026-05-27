import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.coupon import Coupon, UserCoupon
from app.models.platform import PlatformActivity, FlashSale
from app.models.shop import Shop, ShopPlatformLink
from app.models.price import PriceSnapshot
from app.schemas.home import (
    CouponHomeResponse, CouponHomeItem,
    PlatformActivityResponse, PlatformActivityItem,
    FlashSaleResponse, FlashSaleItem,
    ShopHomeResponse, ShopHomeItem,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["home"])


@router.get("/coupons/home", response_model=CouponHomeResponse)
async def coupons_home(
    platform: str = Query(default=None, description="筛选平台"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Coupon).where(
        Coupon.is_active == True,
        Coupon.expire_time > datetime.utcnow(),
    )
    if platform and platform != "all":
        query = query.where(Coupon.platform == platform)
    query = query.order_by(Coupon.value.desc()).limit(20)

    result = await db.execute(query)
    coupons = result.scalars().all()

    items = []
    for c in coupons:
        items.append(CouponHomeItem(
            id=c.id,
            title=c.title,
            type=c.type.value if hasattr(c.type, "value") else str(c.type),
            value=c.value,
            min_spend=c.min_spend,
            platform=c.platform,
            description=c.description,
            expire_time=c.expire_time.isoformat() if c.expire_time else None,
            is_claimed=False,
            remaining_quota=c.remaining_quota,
        ))

    return CouponHomeResponse(coupons=items, total=len(items))


@router.get("/platform/activities", response_model=PlatformActivityResponse)
async def platform_activities(
    platform: str = Query(default=None, description="筛选平台"),
    db: AsyncSession = Depends(get_db),
):
    query = select(PlatformActivity).where(
        PlatformActivity.is_active == True,
        PlatformActivity.end_time > datetime.utcnow(),
    )
    if platform and platform != "all":
        query = query.where(PlatformActivity.platform == platform)
    query = query.order_by(PlatformActivity.start_time.desc()).limit(20)

    result = await db.execute(query)
    activities = result.scalars().all()

    items = [
        PlatformActivityItem(
            id=a.id,
            platform=a.platform,
            title=a.title,
            description=a.description,
            icon=a.icon,
            activity_url=a.activity_url,
            start_time=a.start_time.isoformat() if a.start_time else None,
            end_time=a.end_time.isoformat() if a.end_time else None,
        )
        for a in activities
    ]

    return PlatformActivityResponse(activities=items, total=len(items))


@router.get("/platform/flash-sale", response_model=FlashSaleResponse)
async def flash_sales(
    platform: str = Query(default=None, description="筛选平台"),
    db: AsyncSession = Depends(get_db),
):
    query = select(FlashSale).where(
        FlashSale.is_active == True,
        FlashSale.end_time > datetime.utcnow(),
    )
    if platform and platform != "all":
        query = query.where(FlashSale.platforms.contains([platform]))
    query = query.order_by(FlashSale.start_time).limit(10)

    result = await db.execute(query)
    sales = result.scalars().all()

    items = [
        FlashSaleItem(
            id=s.id,
            title=s.title,
            description=s.description,
            discount=s.discount,
            platforms=s.platforms if isinstance(s.platforms, list) else [],
            start_time=s.start_time.isoformat() if s.start_time else None,
            end_time=s.end_time.isoformat() if s.end_time else None,
        )
        for s in sales
    ]

    return FlashSaleResponse(sales=items, total=len(items))


@router.get("/recommend/shops", response_model=ShopHomeResponse)
async def recommend_shops_home(
    platform: str = Query(default=None, description="筛选平台"),
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    query = select(Shop)
    if platform and platform != "all":
        query = query.join(
            ShopPlatformLink,
            ShopPlatformLink.shop_id == Shop.id,
        ).where(ShopPlatformLink.platform == platform)
    query = query.order_by(Shop.rating.desc()).limit(limit)

    result = await db.execute(query)
    shops = result.scalars().all()

    items = []
    for s in shops:
        prices = {}
        delivery_fee = 0.0
        min_time = 25
        max_time = 45

        link_query = select(ShopPlatformLink).where(
            ShopPlatformLink.shop_id == s.id,
        )
        link_result = await db.execute(link_query)
        links = link_result.scalars().all()

        for link in links:
            extra = link.extra_data or {}
            delivery_fee = extra.get("delivery_fee", delivery_fee)
            min_time = extra.get("min_delivery_time", min_time)
            max_time = extra.get("max_delivery_time", max_time)

            price_query = select(
                func.avg(PriceSnapshot.final_price),
            ).where(
                PriceSnapshot.product_id.in_(
                    select(PriceSnapshot.product_id).where(
                        PriceSnapshot.platform == link.platform,
                    ).limit(1)
                ),
                PriceSnapshot.platform == link.platform,
            )
            price_result = await db.execute(price_query)
            avg_price = price_result.scalar()
            if avg_price:
                prices[link.platform] = round(avg_price, 2)

        savings = 0.0
        if len(prices) >= 2:
            price_values = list(prices.values())
            savings = round(max(price_values) - min(price_values), 2)

        items.append(ShopHomeItem(
            id=s.id,
            shop_name=s.name,
            category=s.category or "",
            rating=s.rating,
            image_url=s.image_url or "",
            delivery_fee=delivery_fee,
            min_delivery_time=min_time,
            max_delivery_time=max_time,
            prices=prices,
            savings=savings,
            reason="热门高分推荐",
        ))

    return ShopHomeResponse(shops=items, total=len(items))
