import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shop import Shop, ShopPlatformLink
from app.models.product import Product, CrossPlatformProduct
from app.models.price import PriceSnapshot
from app.models.coupon import Coupon, CouponType
from app.redis_client import cache_get, cache_set, cache_delete

logger = logging.getLogger(__name__)

CACHE_TTL = {
    "shop_search": 1800,
    "shop_detail": 3600,
    "product_list": 1800,
    "coupon_list": 900,
}


class CrawlService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_crawled_data(self, platform: str, data: dict) -> dict:
        saved_shops = 0
        saved_products = 0
        saved_prices = 0
        saved_coupons = 0

        shop_data = data.get("shop", {})
        if shop_data:
            shop = await self._save_shop(platform, shop_data)
            saved_shops += 1

            products = data.get("products", [])
            for p in products:
                product = await self._save_product(shop.id, p)
                saved_products += 1

                await self._save_price_snapshot(product.id, platform, p)
                saved_prices += 1

                await self._save_cross_platform(product.id, platform, p)

            coupons = data.get("coupons", [])
            for c in coupons:
                await self._save_coupon(platform, shop.id, c)
                saved_coupons += 1

            delivery = data.get("delivery", {})
            if delivery:
                await self._update_delivery_info(shop.id, platform, delivery)

            await self._invalidate_shop_cache(shop.id, shop.name)

        shops_list = data.get("shops", [])
        if shops_list and not shop_data:
            for s in shops_list:
                shop = await self._save_shop(platform, s)
                saved_shops += 1

        await self.db.commit()

        logger.info(
            "CrawlService saved: shops=%d, products=%d, prices=%d, coupons=%d",
            saved_shops, saved_products, saved_prices, saved_coupons,
        )

        return {
            "saved_shops": saved_shops,
            "saved_products": saved_products,
            "saved_prices": saved_prices,
            "saved_coupons": saved_coupons,
        }

    async def _save_shop(self, platform: str, data: dict) -> Shop:
        name = data.get("name", "")
        result = await self.db.execute(
            select(Shop).where(Shop.name == name).limit(1)
        )
        shop = result.scalar_one_or_none()

        if shop is None:
            shop = Shop(
                name=name,
                image_url=data.get("image_url", ""),
                rating=float(data.get("rating", 0)),
                category=data.get("category", ""),
                address=data.get("address", ""),
                latitude=float(data.get("latitude", 0)),
                longitude=float(data.get("longitude", 0)),
                is_chain=bool(data.get("is_chain", False)),
            )
            self.db.add(shop)
            await self.db.flush()

        platform_shop_id = data.get("platform_shop_id", data.get("id", ""))
        link_result = await self.db.execute(
            select(ShopPlatformLink).where(
                ShopPlatformLink.shop_id == shop.id,
                ShopPlatformLink.platform == platform,
            ).limit(1)
        )
        link = link_result.scalar_one_or_none()

        if link is None:
            link = ShopPlatformLink(
                shop_id=shop.id,
                platform=platform,
                platform_shop_id=str(platform_shop_id),
                platform_url=data.get("url", data.get("platform_url", "")),
                extra_data={
                    "delivery_fee": float(data.get("delivery_fee", 0)),
                    "min_delivery_time": int(data.get("min_delivery_time", 25)),
                    "max_delivery_time": int(data.get("max_delivery_time", 45)),
                    "min_order": float(data.get("min_order", 0)),
                    "rating": float(data.get("rating", shop.rating)),
                    "monthly_sales": int(data.get("monthly_sales", 0)),
                },
            )
            self.db.add(link)
        else:
            link.platform_shop_id = str(platform_shop_id)
            link.platform_url = data.get("url", data.get("platform_url", link.platform_url))
            link.extra_data = {
                "delivery_fee": float(data.get("delivery_fee", 0)),
                "min_delivery_time": int(data.get("min_delivery_time", 25)),
                "max_delivery_time": int(data.get("max_delivery_time", 45)),
                "min_order": float(data.get("min_order", 0)),
                "rating": float(data.get("rating", shop.rating)),
                "monthly_sales": int(data.get("monthly_sales", 0)),
            }

        await self.db.flush()
        return shop

    async def _save_product(self, shop_id: int, data: dict) -> Product:
        name = data.get("name", "")
        result = await self.db.execute(
            select(Product).where(
                Product.shop_id == shop_id,
                Product.name == name,
            ).limit(1)
        )
        product = result.scalar_one_or_none()

        if product is None:
            product = Product(
                shop_id=shop_id,
                name=name,
                image_url=data.get("image_url", ""),
                category=data.get("category", ""),
                description=data.get("description", ""),
                is_available=True,
            )
            self.db.add(product)
            await self.db.flush()

        return product

    async def _save_price_snapshot(self, product_id: int, platform: str, data: dict):
        base_price = float(data.get("price", 0))
        package_fee = float(data.get("package_fee", 0))
        delivery_fee = float(data.get("delivery_fee", 0))
        min_order = float(data.get("min_order_amount", 0))

        discount_info = data.get("discount_info", [])
        if isinstance(discount_info, list):
            discount_info = json.dumps(discount_info, ensure_ascii=False)
        elif not isinstance(discount_info, str):
            discount_info = "[]"

        final_price = base_price + package_fee + delivery_fee

        snapshot = PriceSnapshot(
            product_id=product_id,
            platform=platform,
            base_price=base_price,
            package_fee=package_fee,
            delivery_fee=delivery_fee,
            min_order_amount=min_order,
            discount_info=discount_info,
            final_price=final_price,
            source="crawler",
        )
        self.db.add(snapshot)

    async def _save_cross_platform(self, product_id: int, platform: str, data: dict):
        platform_product_id = str(data.get("platform_product_id", data.get("id", "")))
        platform_shop_id = str(data.get("platform_shop_id", ""))

        if not platform_product_id:
            return

        result = await self.db.execute(
            select(CrossPlatformProduct).where(
                CrossPlatformProduct.product_id == product_id,
                CrossPlatformProduct.platform == platform,
                CrossPlatformProduct.platform_product_id == platform_product_id,
            ).limit(1)
        )
        existing = result.scalar_one_or_none()

        if existing is None:
            cross = CrossPlatformProduct(
                product_id=product_id,
                platform=platform,
                platform_product_id=platform_product_id,
                platform_shop_id=platform_shop_id,
                match_confidence=1.0,
            )
            self.db.add(cross)

    async def _save_coupon(self, platform: str, shop_id: int, data: dict):
        title = data.get("title", data.get("name", ""))
        if not title:
            return

        value = float(data.get("value", data.get("discount", 0)))
        min_spend = float(data.get("min_spend", data.get("threshold", 0)))

        coupon_type_str = data.get("type", "direct")
        try:
            coupon_type = CouponType(coupon_type_str)
        except ValueError:
            coupon_type = CouponType.DIRECT

        now = datetime.now(timezone.utc)
        coupon = Coupon(
            title=title,
            type=coupon_type,
            value=value,
            min_spend=min_spend,
            platform=platform,
            platform_coupon_id=str(data.get("id", "")),
            description=data.get("description", ""),
            start_time=data.get("start_time", now) if isinstance(data.get("start_time"), datetime) else now,
            expire_time=data.get("expire_time", datetime(2026, 12, 31, tzinfo=timezone.utc)) if isinstance(data.get("expire_time"), datetime) else datetime(2026, 12, 31, tzinfo=timezone.utc),
            is_active=True,
            source="crawler",
        )
        self.db.add(coupon)

    async def _update_delivery_info(self, shop_id: int, platform: str, data: dict):
        result = await self.db.execute(
            select(ShopPlatformLink).where(
                ShopPlatformLink.shop_id == shop_id,
                ShopPlatformLink.platform == platform,
            ).limit(1)
        )
        link = result.scalar_one_or_none()
        if link:
            extra = link.extra_data or {}
            extra["delivery_fee"] = float(data.get("fee", extra.get("delivery_fee", 0)))
            extra["min_delivery_time"] = int(data.get("min_time", extra.get("min_delivery_time", 25)))
            extra["max_delivery_time"] = int(data.get("max_time", extra.get("max_delivery_time", 45)))
            link.extra_data = extra

    async def _invalidate_shop_cache(self, shop_id: int, shop_name: str):
        try:
            await cache_delete(f"shop:{shop_id}")
            await cache_delete(f"shop_search:{shop_name}")
        except Exception as e:
            logger.warning("Cache invalidation failed: %s", e)

    async def search_shops_cached(self, keyword: str, city: str = "北京", platform: str = None) -> list[dict]:
        cache_key = f"shop_search:{keyword}:{city}:{platform or 'all'}"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)

        query = select(Shop).where(Shop.name.ilike(f"%{keyword}%"))
        if platform:
            query = query.join(
                ShopPlatformLink,
                ShopPlatformLink.shop_id == Shop.id,
            ).where(ShopPlatformLink.platform == platform)
        query = query.order_by(Shop.rating.desc()).limit(20)

        result = await self.db.execute(query)
        shops = result.scalars().all()

        shop_list = []
        for s in shops:
            links_result = await self.db.execute(
                select(ShopPlatformLink).where(ShopPlatformLink.shop_id == s.id)
            )
            links = links_result.scalars().all()

            prices = {}
            delivery_fee = 0.0
            min_time = 25
            max_time = 45

            for link in links:
                extra = link.extra_data or {}
                delivery_fee = extra.get("delivery_fee", delivery_fee)
                min_time = extra.get("min_delivery_time", min_time)
                max_time = extra.get("max_delivery_time", max_time)

            shop_list.append({
                "id": s.id,
                "name": s.name,
                "rating": s.rating,
                "category": s.category,
                "address": s.address,
                "image_url": s.image_url,
                "delivery_fee": delivery_fee,
                "min_delivery_time": min_time,
                "max_delivery_time": max_time,
                "platforms": [link.platform for link in links],
            })

        await cache_set(cache_key, json.dumps(shop_list, ensure_ascii=False), ttl=CACHE_TTL["shop_search"])

        return shop_list

    async def get_shop_detail_cached(self, shop_id: int) -> dict | None:
        cache_key = f"shop:{shop_id}"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)

        result = await self.db.execute(
            select(Shop).where(Shop.id == shop_id)
        )
        shop = result.scalar_one_or_none()
        if not shop:
            return None

        products_result = await self.db.execute(
            select(Product).where(Product.shop_id == shop_id, Product.is_available == True)
        )
        products = products_result.scalars().all()

        product_list = []
        for p in products:
            price_result = await self.db.execute(
                select(PriceSnapshot)
                .where(PriceSnapshot.product_id == p.id)
                .order_by(PriceSnapshot.recorded_at.desc())
                .limit(4)
            )
            prices = price_result.scalars().all()

            price_map = {}
            for ps in prices:
                if ps.platform not in price_map:
                    price_map[ps.platform] = {
                        "base_price": ps.base_price,
                        "delivery_fee": ps.delivery_fee,
                        "final_price": ps.final_price,
                        "source": ps.source,
                        "recorded_at": ps.recorded_at.isoformat() if ps.recorded_at else None,
                    }

            product_list.append({
                "id": p.id,
                "name": p.name,
                "image_url": p.image_url,
                "category": p.category,
                "prices": price_map,
            })

        links_result = await self.db.execute(
            select(ShopPlatformLink).where(ShopPlatformLink.shop_id == shop_id)
        )
        links = links_result.scalars().all()

        detail = {
            "id": shop.id,
            "name": shop.name,
            "rating": shop.rating,
            "category": shop.category,
            "address": shop.address,
            "image_url": shop.image_url,
            "platforms": [
                {
                    "platform": link.platform,
                    "platform_shop_id": link.platform_shop_id,
                    "platform_url": link.platform_url,
                    "delivery_fee": (link.extra_data or {}).get("delivery_fee", 0),
                    "min_delivery_time": (link.extra_data or {}).get("min_delivery_time", 25),
                    "max_delivery_time": (link.extra_data or {}).get("max_delivery_time", 45),
                }
                for link in links
            ],
            "products": product_list,
        }

        await cache_set(cache_key, json.dumps(detail, ensure_ascii=False), ttl=CACHE_TTL["shop_detail"])

        return detail
