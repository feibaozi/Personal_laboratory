import json
import logging
from datetime import datetime, timezone, timedelta
from collections import Counter
from typing import Optional

from sqlalchemy import select, and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserPreference
from app.models.shop import Shop, ShopPlatformLink
from app.models.product import Product
from app.models.price import PriceSnapshot
from app.models.order import OrderHistory
from app.models.recommend import UserBehavior, RecommendResult
from app.config import settings

logger = logging.getLogger(__name__)

RECOMMEND_WEIGHTS = {
    "price_sensitivity": 0.35,
    "cuisine_preference": 0.25,
    "recency": 0.20,
    "rating": 0.20,
}

BEHAVIOR_WEIGHTS = {
    "order": 10.0,
    "click": 1.0,
    "view": 0.5,
    "search": 2.0,
    "favorite": 5.0,
    "compare": 3.0,
}

PLATFORM_NAMES = {
    "meituan": "美团",
    "eleme": "饿了么",
    "jd_waimai": "京东外卖",
    "douyin_waimai": "抖音外卖",
}


class RecommendService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.decay_days = 30

    async def recommend_shops(
        self, user_id: int, limit: int = 10, platform: str = None,
    ) -> list[dict]:
        prefs = await self._get_user_preferences(user_id)
        if not prefs:
            return await self._cold_start_recommendations(limit, platform)

        order_history = await self._get_order_history(user_id)
        if len(order_history) < 3:
            return await self._cold_start_recommendations(limit, platform)

        content_shops = await self._content_based_recommend(
            prefs, order_history, limit * 3, platform,
        )

        price_optimized = await self._price_aware_ranking(
            content_shops, prefs,
        )

        result = price_optimized[:limit]

        await self._save_recommend_result(
            user_id, "shop", result,
        )

        return result

    async def recommend_products(
        self, user_id: int, limit: int = 10, platform: str = None,
    ) -> list[dict]:
        prefs = await self._get_user_preferences(user_id)
        if not prefs:
            return await self._cold_start_products(limit, platform)

        order_history = await self._get_order_history(user_id)
        if len(order_history) < 3:
            return await self._cold_start_products(limit, platform)

        recent_shops = self._extract_recent_shops(order_history)
        categories = self._extract_preferred_categories(order_history)

        products = await self._query_products_by_categories(
            categories, recent_shops, limit * 2, platform,
        )

        scored = self._score_products(products, prefs, order_history)
        scored.sort(key=lambda x: x.get("score", 0), reverse=True)

        result = scored[:limit]
        await self._save_recommend_result(user_id, "product", result)
        return result

    async def log_behavior(
        self,
        user_id: int,
        behavior_type: str,
        target_type: str,
        target_id: int,
        target_name: str = "",
        context: dict = None,
    ) -> bool:
        if not user_id:
            return False

        behavior = UserBehavior(
            user_id=user_id,
            behavior_type=behavior_type,
            target_type=target_type,
            target_id=target_id,
            target_name=target_name,
            context=context or {},
            weight=BEHAVIOR_WEIGHTS.get(behavior_type, 1.0),
        )
        self.db.add(behavior)
        await self.db.commit()
        return True

    async def get_user_behaviors(
        self, user_id: int, limit: int = 50,
    ) -> list[dict]:
        result = await self.db.execute(
            select(UserBehavior)
            .where(UserBehavior.user_id == user_id)
            .order_by(UserBehavior.behavior_time.desc())
            .limit(limit)
        )
        behaviors = result.scalars().all()
        return [
            {
                "id": b.id,
                "behavior_type": b.behavior_type,
                "target_type": b.target_type,
                "target_id": b.target_id,
                "target_name": b.target_name,
                "weight": b.weight,
                "context": b.context or {},
                "behavior_time": b.behavior_time.isoformat() if b.behavior_time else None,
            }
            for b in behaviors
        ]

    async def get_recommend_history(
        self, user_id: int, recommend_type: str = "shop", limit: int = 5,
    ) -> list[dict]:
        result = await self.db.execute(
            select(RecommendResult)
            .where(
                RecommendResult.user_id == user_id,
                RecommendResult.recommend_type == recommend_type,
            )
            .order_by(RecommendResult.generated_at.desc())
            .limit(limit)
        )
        records = result.scalars().all()
        return [
            {
                "id": r.id,
                "recommend_type": r.recommend_type,
                "items": r.items or [],
                "algorithm_version": r.algorithm_version,
                "generated_at": r.generated_at.isoformat() if r.generated_at else None,
            }
            for r in records
        ]

    async def _get_user_preferences(self, user_id: int) -> Optional[dict]:
        result = await self.db.execute(
            select(UserPreference).where(UserPreference.user_id == user_id)
        )
        pref = result.scalar_one_or_none()
        if not pref:
            return None

        return {
            "cuisine_weights": pref.cuisine_weights or {},
            "taste_weights": pref.taste_weights or {},
            "avg_order_amount": pref.avg_order_amount or 0,
            "price_sensitivity": pref.price_sensitivity or 0.5,
            "preferred_platforms": pref.preferred_platforms or [],
            "preferred_delivery_time": pref.preferred_delivery_time or 30,
        }

    async def _get_order_history(
        self, user_id: int, days: int = 30,
    ) -> list[dict]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        result = await self.db.execute(
            select(OrderHistory)
            .where(
                OrderHistory.user_id == user_id,
                OrderHistory.order_time >= since,
            )
            .order_by(OrderHistory.order_time.desc())
            .limit(100)
        )
        orders = result.scalars().all()

        return [
            {
                "shop_id": o.shop_id,
                "shop_name": o.shop_name,
                "platform": o.platform,
                "amount": o.actual_amount,
                "order_amount": o.order_amount,
                "savings": o.savings,
                "rating": o.user_rating,
                "order_time": o.order_time,
                "weight": self._decay_weight(o.order_time),
            }
            for o in orders
        ]

    def _decay_weight(self, event_time: datetime) -> float:
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)
        days_ago = (datetime.now(timezone.utc) - event_time).days
        if days_ago <= 0:
            return 1.0
        return max(0.1, 1.0 - (days_ago / self.decay_days))

    async def _content_based_recommend(
        self,
        prefs: dict,
        order_history: list[dict],
        limit: int,
        platform: str = None,
    ) -> list[dict]:
        favorite_shops = Counter()
        favorite_categories = Counter()
        platform_counter = Counter()

        for order in order_history:
            w = order.get("weight", 0.5)
            favorite_shops[order["shop_name"]] += w
            platform_counter[order["platform"]] += w

        shops = await self._query_similar_shops(
            list(favorite_shops.keys()), limit, platform,
        )

        price_sensitivity = prefs.get("price_sensitivity", 0.5)
        avg_amount = prefs.get("avg_order_amount", 30)

        scored_shops = []
        for shop in shops:
            relevance = shop.get("relevance_score", 0.5)
            rating_score = min(shop.get("rating", 4.0) / 5.0, 1.0)
            price_score = self._price_score(
                shop.get("avg_price", avg_amount), avg_amount, price_sensitivity,
            )
            popularity = shop.get("popularity_score", 0.5)

            composite = (
                RECOMMEND_WEIGHTS["cuisine_preference"] * relevance
                + RECOMMEND_WEIGHTS["rating"] * rating_score
                + RECOMMEND_WEIGHTS["price_sensitivity"] * price_score
                + RECOMMEND_WEIGHTS["recency"] * popularity
            )

            shop["score"] = round(composite, 4)
            shop["reason"] = self._generate_reason(shop, prefs)
            scored_shops.append(shop)

        scored_shops.sort(key=lambda x: x["score"], reverse=True)
        return scored_shops[:limit]

    async def _price_aware_ranking(
        self, shops: list[dict], prefs: dict,
    ) -> list[dict]:
        for shop in shops:
            prices = await self._get_shop_prices(shop.get("id", 0))
            if prices and len(prices) > 1:
                price_values = list(prices.values())
                shop["lowest_price"] = min(price_values)
                shop["highest_price"] = max(price_values)
                shop["lowest_platform"] = min(prices, key=prices.get)
                shop["prices"] = prices

                price_savings = shop["highest_price"] - shop["lowest_price"]
                if price_savings > 0:
                    shop["score"] += min(0.15, price_savings / 100)
                    shop["savings"] = round(price_savings, 2)

        shops.sort(key=lambda x: x.get("score", 0), reverse=True)
        return shops

    def _price_score(
        self, avg_price: float, user_avg: float, sensitivity: float,
    ) -> float:
        if avg_price <= 0:
            return 0.5
        ratio = user_avg / avg_price if avg_price > 0 else 1.0
        if ratio >= 1.0:
            return 0.8 + 0.2 * min(sensitivity, 1.0)
        else:
            return max(0.1, 1.0 - sensitivity * (1.0 - ratio))

    def _generate_reason(self, shop: dict, prefs: dict) -> str:
        reasons = []
        category = shop.get("category", "")
        if category:
            cuisine_weights = prefs.get("cuisine_weights", {})
            if category in cuisine_weights and cuisine_weights[category] > 0.5:
                reasons.append(f"符合您偏好的{category}口味")

        if shop.get("savings", 0) > 0:
            reasons.append(f"跨平台可省¥{shop['savings']:.1f}")

        rating = shop.get("rating", 0)
        if rating >= 4.5:
            reasons.append("高分好评店铺")

        if not reasons:
            reasons.append("根据您的历史偏好推荐")

        return "，".join(reasons)

    async def _cold_start_recommendations(
        self, limit: int, platform: str = None,
    ) -> list[dict]:
        query = select(Shop).where(Shop.rating >= 4.0)
        if platform:
            query = query.join(
                ShopPlatformLink,
                ShopPlatformLink.shop_id == Shop.id,
            ).where(ShopPlatformLink.platform == platform)

        query = query.order_by(Shop.rating.desc()).limit(limit)
        result = await self.db.execute(query)
        shops = result.scalars().all()

        return [
            {
                "id": s.id,
                "shop_name": s.name,
                "category": s.category or "",
                "rating": s.rating,
                "image_url": s.image_url,
                "score": round(s.rating / 5.0, 4),
                "reason": "热门高分推荐",
                "is_cold_start": True,
            }
            for s in shops
        ]

    async def _cold_start_products(
        self, limit: int, platform: str = None,
    ) -> list[dict]:
        query = select(Product).where(Product.is_available == True)
        query = query.order_by(Product.id.desc()).limit(limit)
        result = await self.db.execute(query)
        products = result.scalars().all()

        return [
            {
                "id": p.id,
                "product_name": p.name,
                "category": p.category or "",
                "image_url": p.image_url,
                "score": 0.5,
                "reason": "新用户热门推荐",
                "is_cold_start": True,
            }
            for p in products
        ]

    async def _query_similar_shops(
        self, shop_names: list[str], limit: int, platform: str = None,
    ) -> list[dict]:
        query = select(Shop)
        if platform:
            query = query.join(
                ShopPlatformLink,
                ShopPlatformLink.shop_id == Shop.id,
            ).where(ShopPlatformLink.platform == platform)

        query = query.order_by(Shop.rating.desc()).limit(limit)
        result = await self.db.execute(query)
        shops = result.scalars().all()

        shop_list = []
        for i, s in enumerate(shops):
            relevance = 0.8 - (i * 0.05) if i < 16 else 0.1
            is_related = any(
                name in s.name or s.name in name for name in shop_names
            )
            if is_related:
                relevance = min(relevance + 0.3, 1.0)

            shop_list.append({
                "id": s.id,
                "shop_name": s.name,
                "category": s.category or "",
                "relevance_score": round(relevance, 4),
                "rating": s.rating,
                "avg_price": 0,
                "popularity_score": 0.5 + (s.rating / 10.0),
                "image_url": s.image_url,
            })

        return shop_list

    async def _query_products_by_categories(
        self,
        categories: list[str],
        recent_shop_ids: list[int],
        limit: int,
        platform: str = None,
    ) -> list[dict]:
        query = select(Product).where(Product.is_available == True)
        query = query.order_by(Product.id.desc()).limit(limit)
        result = await self.db.execute(query)
        products = result.scalars().all()

        return [
            {
                "id": p.id,
                "product_name": p.name,
                "category": p.category or "",
                "shop_id": p.shop_id,
                "image_url": p.image_url,
                "avg_price": 0,
            }
            for p in products
        ]

    def _score_products(
        self, products: list[dict], prefs: dict, order_history: list[dict],
    ) -> list[dict]:
        price_sensitivity = prefs.get("price_sensitivity", 0.5)
        avg_amount = prefs.get("avg_order_amount", 30)

        for p in products:
            rating_score = 0.6
            price_score = self._price_score(
                p.get("avg_price", avg_amount), avg_amount, price_sensitivity,
            )
            category_match = 0.5

            p["score"] = round(
                0.35 * category_match
                + 0.25 * rating_score
                + 0.20 * price_score
                + 0.20 * 0.5,
                4,
            )
            p["reason"] = "根据您的偏好推荐"

        return products

    def _extract_recent_shops(self, order_history: list[dict]) -> list[int]:
        shop_ids = []
        seen = set()
        for o in order_history:
            sid = o.get("shop_id", 0)
            if sid and sid not in seen:
                shop_ids.append(sid)
                seen.add(sid)
        return shop_ids[:20]

    def _extract_preferred_categories(self, order_history: list[dict]) -> list[str]:
        return []

    async def _get_shop_prices(self, shop_id: int) -> dict:
        result = await self.db.execute(
            select(
                PriceSnapshot.platform,
                func.avg(PriceSnapshot.final_price),
            )
            .join(Product, Product.id == PriceSnapshot.product_id)
            .where(Product.shop_id == shop_id)
            .group_by(PriceSnapshot.platform)
        )
        rows = result.all()
        if not rows:
            return {}

        return {
            row[0]: round(row[1], 2) if row[1] else 0
            for row in rows
        }

    async def _save_recommend_result(
        self, user_id: int, recommend_type: str, items: list[dict],
    ):
        try:
            record = RecommendResult(
                user_id=user_id,
                recommend_type=recommend_type,
                items=items,
                algorithm_version="v1.0",
                generated_at=datetime.now(timezone.utc),
                expires_at=datetime.now(timezone.utc) + timedelta(hours=6),
            )
            self.db.add(record)
            await self.db.commit()
        except Exception as e:
            logger.warning("Failed to save recommend result: %s", e)
            await self.db.rollback()