import logging
from typing import Optional

from app.collectors.compliance import compliance_guard
from app.collectors.meituan_collector import MeituanCollector
from app.collectors.eleme_collector import ElemeCollector
from app.collectors.base_collector import CollectionResult

logger = logging.getLogger(__name__)

PLATFORM_COLLECTORS = {
    "meituan": MeituanCollector,
}

PLATFORM_ROBOTS_STATUS = {
    "meituan": {"allowed": True, "note": "robots.txt 允许部分路径"},
    "eleme": {"allowed": False, "note": "robots.txt 禁止所有爬取，仅支持缓存/手动录入"},
    "jd_waimai": {"allowed": None, "note": "待检查"},
    "douyin": {"allowed": None, "note": "待检查"},
}

PLATFORM_NAMES = {
    "meituan": "美团",
    "eleme": "饿了么",
    "jd_waimai": "京东外卖",
    "douyin": "抖音外卖",
}


class CrawlerManager:
    def __init__(self):
        self._collectors: dict[str, object] = {}
        self._initialized = False

    def _ensure_collector(self, platform: str):
        if platform in self._collectors:
            return
        cls = PLATFORM_COLLECTORS.get(platform)
        if cls:
            self._collectors[platform] = cls()

    async def search_shops(
        self, keyword: str, city: str = "北京",
        platforms: list[str] = None,
        latitude: float = None, longitude: float = None,
    ) -> dict:
        if platforms is None:
            platforms = list(PLATFORM_COLLECTORS.keys())

        location = {
            "keyword": keyword,
            "city": city,
            "latitude": latitude,
            "longitude": longitude,
        }

        results = {}
        for platform in platforms:
            robots_status = PLATFORM_ROBOTS_STATUS.get(platform, {})
            if robots_status.get("allowed") is False:
                results[platform] = {
                    "success": False,
                    "message": f"该平台 robots.txt 禁止爬取: {robots_status.get('note', '')}",
                    "shops": [],
                    "compliance_blocked": True,
                }
                continue

            try:
                self._ensure_collector(platform)
                collector = self._collectors.get(platform)
                if collector is None:
                    results[platform] = {
                        "success": False,
                        "message": f"不支持的平台: {platform}",
                        "shops": [],
                    }
                    continue

                result = await collector.collect_shops(location)
                results[platform] = result.to_dict()

                compliance_guard.log_crawl_result(
                    url=collector.base_url,
                    success=result.success,
                    items_count=len(result.data.get("shops", [])),
                )
            except Exception as e:
                logger.error("CrawlManager search_shops %s failed: %s", platform, e)
                results[platform] = {
                    "success": False,
                    "message": str(e),
                    "shops": [],
                }
                compliance_guard.log_crawl_result(
                    url="", success=False, error=str(e),
                )

        all_shops = []
        for platform, data in results.items():
            if data.get("success"):
                for shop in data.get("data", {}).get("shops", []):
                    shop["platform"] = platform
                    shop["platform_name"] = PLATFORM_NAMES.get(platform, platform)
                    all_shops.append(shop)

        return {
            "keyword": keyword,
            "city": city,
            "total_shops": len(all_shops),
            "shops": all_shops,
            "platform_results": results,
        }

    async def get_shop_menu(
        self, platform: str, shop_url: str = None, shop_id: str = None,
    ) -> dict:
        self._ensure_collector(platform)
        collector = self._collectors.get(platform)
        if collector is None:
            return {"success": False, "message": f"不支持的平台: {platform}"}

        allowed, reason = await compliance_guard.acquire_crawl_permission(shop_url or collector.base_url)
        if not allowed:
            return {"success": False, "message": f"合规检查未通过: {reason}"}

        try:
            if shop_url and hasattr(collector, "collect_shop_menu"):
                result = await collector.collect_shop_menu(shop_url)
            elif shop_id:
                result = await collector.collect_products(shop_id)
            else:
                return {"success": False, "message": "需要提供 shop_url 或 shop_id"}

            compliance_guard.log_crawl_result(
                url=shop_url or shop_id,
                success=result.success,
                items_count=len(result.data.get("products", [])),
            )

            result_dict = result.to_dict()
            result_dict["platform_name"] = PLATFORM_NAMES.get(platform, platform)
            return result_dict

        except Exception as e:
            logger.error("CrawlerManager get_shop_menu failed: %s", e)
            compliance_guard.log_crawl_result(
                url=shop_url or shop_id, success=False, error=str(e),
            )
            return {"success": False, "message": str(e)}

    async def collect_from_url(self, url: str) -> dict:
        platform = self._detect_platform(url)
        if not platform:
            return {"success": False, "message": "无法识别平台，请手动选择平台"}

        allowed, reason = await compliance_guard.acquire_crawl_permission(url)
        if not allowed:
            return {"success": False, "message": f"合规检查未通过: {reason}"}

        self._ensure_collector(platform)
        collector = self._collectors.get(platform)
        if collector is None:
            return {"success": False, "message": f"不支持的平台: {platform}"}

        try:
            result = await collector.collect_shop_menu(url)
            compliance_guard.log_crawl_result(
                url=url,
                success=result.success,
                items_count=len(result.data.get("products", [])),
            )

            result_dict = result.to_dict()
            result_dict["platform"] = platform
            result_dict["platform_name"] = PLATFORM_NAMES.get(platform, platform)
            return result_dict

        except Exception as e:
            logger.error("CrawlerManager collect_from_url failed: %s", e)
            compliance_guard.log_crawl_result(url=url, success=False, error=str(e))
            return {"success": False, "message": str(e)}

    def _detect_platform(self, url: str) -> Optional[str]:
        url_lower = url.lower()
        if "meituan" in url_lower:
            return "meituan"
        elif "ele.me" in url_lower or "eleme" in url_lower:
            return "eleme"
        elif "jd.com" in url_lower or "jddj" in url_lower:
            return "jd_waimai"
        elif "douyin" in url_lower:
            return "douyin"
        return None

    def get_compliance_report(self) -> dict:
        return compliance_guard.get_compliance_report()

    def get_daily_stats(self) -> dict:
        return compliance_guard.get_daily_stats()

    async def close(self):
        for collector in self._collectors.values():
            try:
                await collector.close()
            except Exception as e:
                logger.warning("Error closing collector: %s", e)
        self._collectors.clear()


crawler_manager = CrawlerManager()
