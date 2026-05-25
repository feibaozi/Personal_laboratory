import json
import logging
from typing import Optional
from datetime import datetime, timezone

from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product, CrossPlatformProduct
from app.models.price import PriceSnapshot
from app.models.coupon import Coupon
from app.models.shop import Shop, ShopPlatformLink

logger = logging.getLogger(__name__)

PLATFORM_NAMES = {
    "meituan": "美团",
    "eleme": "饿了么",
    "jd_waimai": "京东外卖",
    "douyin_waimai": "抖音外卖",
}


class CompareService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def compare_product(
        self,
        product_name: str,
        platforms: list[str] = None,
        user_coupons: list[dict] = None,
    ) -> list[dict]:
        platforms = platforms or list(PLATFORM_NAMES.keys())

        product = await self._find_product_by_name(product_name)
        if not product:
            return []

        price_snapshots = await self._get_latest_prices(product.id, platforms)
        if not price_snapshots:
            return []

        results = []
        for snapshot in price_snapshots:
            discount_info = self._parse_discount_info(snapshot.discount_info)
            original_total = (
                snapshot.base_price
                + (snapshot.package_fee or 0)
                + (snapshot.delivery_fee or 0)
            )
            final_price = self._calculate_final_price(
                original_total=original_total,
                discount_info=discount_info,
                platform=snapshot.platform,
                user_coupons=user_coupons or [],
            )
            savings = original_total - final_price

            shop_name = await self._get_shop_name_for_product(product.id)

            results.append({
                "platform": snapshot.platform,
                "platform_name": PLATFORM_NAMES.get(snapshot.platform, snapshot.platform),
                "product_name": product.name,
                "shop_name": shop_name,
                "base_price": snapshot.base_price,
                "package_fee": snapshot.package_fee or 0,
                "delivery_fee": snapshot.delivery_fee or 0,
                "min_order_amount": snapshot.min_order_amount or 0,
                "discounts": discount_info,
                "original_total": round(original_total, 2),
                "final_price": round(final_price, 2),
                "savings": round(savings, 2),
                "source": snapshot.source,
                "recorded_at": snapshot.recorded_at.isoformat() if snapshot.recorded_at else None,
                "is_best_price": False,
            })

        results.sort(key=lambda x: x["final_price"])

        if results:
            results[0]["is_best_price"] = True

        return results

    async def compare_shop(
        self,
        shop_name: str,
        platforms: list[str] = None,
    ) -> list[dict]:
        platforms = platforms or list(PLATFORM_NAMES.keys())

        shop = await self._find_shop_by_name(shop_name)
        if not shop:
            return []

        links = await self._get_shop_platform_links(shop.id, platforms)
        if not links:
            return []

        results = []
        for link in links:
            delivery_fee = (link.extra_data or {}).get("delivery_fee", 0)
            min_order = (link.extra_data or {}).get("min_order", 0)
            rating = (link.extra_data or {}).get("rating", shop.rating)

            results.append({
                "platform": link.platform,
                "platform_name": PLATFORM_NAMES.get(link.platform, link.platform),
                "shop_name": shop.name,
                "platform_shop_id": link.platform_shop_id,
                "platform_url": link.platform_url,
                "delivery_fee": delivery_fee,
                "min_order": min_order,
                "rating": rating,
            })

        results.sort(key=lambda x: x["delivery_fee"])
        return results

    async def get_saving_rank(
        self, platform: str = None, limit: int = 10
    ) -> list[dict]:
        products = await self._get_products_with_multi_platform_prices(platform)

        rank_items = []
        for product in products[:limit * 3]:
            snapshots = await self._get_latest_prices(product.id)
            if len(snapshots) < 2:
                continue

            prices = {}
            for s in snapshots:
                total = s.base_price + (s.delivery_fee or 0)
                prices[s.platform] = round(total, 2)

            if len(prices) < 2:
                continue

            lowest_platform = min(prices, key=prices.get)
            highest_platform = max(prices, key=prices.get)
            savings = round(prices[highest_platform] - prices[lowest_platform], 2)

            if savings <= 0:
                continue

            shop_name = await self._get_shop_name_for_product(product.id)

            rank_items.append({
                "product_name": product.name,
                "shop_name": shop_name,
                "prices": prices,
                "lowest_price": prices[lowest_platform],
                "lowest_platform": lowest_platform,
                "lowest_platform_name": PLATFORM_NAMES.get(lowest_platform, lowest_platform),
                "highest_price": prices[highest_platform],
                "savings": savings,
            })

        rank_items.sort(key=lambda x: x["savings"], reverse=True)
        rank_items = rank_items[:limit]

        for i, item in enumerate(rank_items):
            item["rank"] = i + 1

        return rank_items

    def _calculate_final_price(
        self,
        original_total: float,
        discount_info: list[dict],
        platform: str,
        user_coupons: list[dict],
    ) -> float:
        discount = self._calculate_optimal_discount(original_total, discount_info)
        coupon_savings = self._calculate_coupon_savings(
            original_total, platform, user_coupons,
        )
        final = original_total - discount - coupon_savings
        return max(round(final, 2), 0)

    def _calculate_optimal_discount(
        self, total: float, discount_info: list[dict],
    ) -> float:
        if not discount_info:
            return 0.0

        max_discount = 0.0
        for rule in discount_info:
            threshold = rule.get("threshold", float("inf"))
            discount_value = rule.get("discount", 0)
            if total >= threshold and discount_value > max_discount:
                max_discount = discount_value

        return max_discount

    def _calculate_coupon_savings(
        self, total: float, platform: str, coupons: list[dict],
    ) -> float:
        savings = 0.0
        for coupon in coupons:
            if coupon.get("platform") != platform:
                continue
            min_spend = coupon.get("min_spend", 0)
            if total < min_spend:
                continue
            savings += coupon.get("value", 0)
        return min(savings, total)

    def _parse_discount_info(self, raw: str) -> list[dict]:
        if not raw:
            return []
        try:
            info = json.loads(raw)
            if isinstance(info, list):
                return info
            return []
        except (json.JSONDecodeError, TypeError):
            return []

    async def _find_product_by_name(self, name: str) -> Optional[Product]:
        result = await self.db.execute(
            select(Product)
            .where(Product.name.ilike(f"%{name}%"))
            .where(Product.is_available == True)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _find_shop_by_name(self, name: str) -> Optional[Shop]:
        result = await self.db.execute(
            select(Shop).where(Shop.name.ilike(f"%{name}%")).limit(1)
        )
        return result.scalar_one_or_none()

    async def _get_latest_prices(
        self, product_id: int, platforms: list[str] = None,
    ) -> list[PriceSnapshot]:
        conditions = [PriceSnapshot.product_id == product_id]
        if platforms:
            conditions.append(PriceSnapshot.platform.in_(platforms))

        result = await self.db.execute(
            select(PriceSnapshot)
            .where(and_(*conditions))
            .order_by(
                PriceSnapshot.platform,
                desc(PriceSnapshot.recorded_at),
            )
        )
        all_snapshots = result.scalars().all()

        seen_platforms = set()
        latest = []
        for s in all_snapshots:
            if s.platform not in seen_platforms:
                seen_platforms.add(s.platform)
                latest.append(s)

        return latest

    async def _get_shop_platform_links(
        self, shop_id: int, platforms: list[str],
    ) -> list[ShopPlatformLink]:
        result = await self.db.execute(
            select(ShopPlatformLink)
            .where(
                ShopPlatformLink.shop_id == shop_id,
                ShopPlatformLink.platform.in_(platforms),
            )
        )
        return result.scalars().all()

    async def _get_shop_name_for_product(self, product_id: int) -> str:
        result = await self.db.execute(
            select(Shop.name)
            .join(Product, Product.shop_id == Shop.id)
            .where(Product.id == product_id)
        )
        row = result.first()
        return row[0] if row else ""

    async def _get_products_with_multi_platform_prices(
        self, platform: str = None,
    ) -> list[Product]:
        result = await self.db.execute(
            select(Product)
            .where(Product.is_available == True)
            .limit(200)
        )
        return result.scalars().all()

    @staticmethod
    def get_platform_name(platform: str) -> str:
        return PLATFORM_NAMES.get(platform, platform)