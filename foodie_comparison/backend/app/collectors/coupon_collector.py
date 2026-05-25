import logging
from typing import Optional
from datetime import datetime, timedelta

from .base_collector import BaseCollector, CollectionResult

logger = logging.getLogger(__name__)


class CouponCollector:
    def __init__(self):
        self._collectors = {}

    def _get_collector(self, platform: str) -> Optional[BaseCollector]:
        if platform not in self._collectors:
            if platform == "meituan":
                from .meituan_collector import MeituanCollector
                self._collectors[platform] = MeituanCollector()
            elif platform == "eleme":
                from .eleme_collector import ElemeCollector
                self._collectors[platform] = ElemeCollector()
            elif platform == "jd_waimai":
                from .jd_collector import JDCollector
                self._collectors[platform] = JDCollector()
            elif platform == "douyin_waimai":
                from .douyin_collector import DouyinCollector
                self._collectors[platform] = DouyinCollector()
            else:
                return None
        return self._collectors[platform]

    async def collect_coupons_for_platform(self, platform: str) -> CollectionResult:
        collector = self._get_collector(platform)
        if collector is None:
            return CollectionResult(
                success=False,
                error=f"Unknown platform: {platform}",
            )

        try:
            result = await collector.collect_coupons()
            return result
        except Exception as e:
            logger.error("Coupon collection failed for %s: %s", platform, e)
            return CollectionResult(
                success=False,
                error=str(e),
                data={
                    "platform": platform,
                    "message": f"优惠券采集失败: {e}",
                },
            )

    async def collect_all_platforms(self) -> dict:
        platforms = ["meituan", "eleme", "jd_waimai", "douyin_waimai"]
        results = {}
        for platform in platforms:
            results[platform] = await self.collect_coupons_for_platform(platform)
        return results

    async def search_coupons(
        self, platform: str = None, keyword: str = None, limit: int = 20,
    ) -> list:
        platforms = [platform] if platform else ["meituan", "eleme", "jd_waimai", "douyin_waimai"]

        all_coupons = []
        for p in platforms:
            result = await self.collect_coupons_for_platform(p)
            if result.success and result.data.get("coupons"):
                for coupon in result.data["coupons"]:
                    coupon["platform"] = p
                    all_coupons.append(coupon)

        if keyword:
            all_coupons = [
                c for c in all_coupons
                if keyword.lower() in c.get("description", "").lower()
                or keyword.lower() in c.get("type", "").lower()
            ]

        return all_coupons[:limit]

    async def close(self):
        for collector in self._collectors.values():
            await collector.close()
        self._collectors.clear()