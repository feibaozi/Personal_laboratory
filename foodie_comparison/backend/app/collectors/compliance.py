import time
import logging
import asyncio
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

COMPLIANCE_POLICY = {
    "purpose": "个人学习研究用途，非商业目的",
    "scope": "仅采集公开可访问的页面信息",
    "restrictions": [
        "不采集用户个人数据",
        "不绕过登录墙或付费墙",
        "不采集非公开API接口",
        "遵守robots.txt规则",
        "遵守Crawl-Delay指令",
        "请求频率不超过2次/秒",
        "每日每域名请求上限500次",
    ],
    "user_agent_suffix": "FoodieComparisonBot/1.0 (+https://github.com/foodie-comparison; educational-purpose)",
}

DOMAIN_DAILY_LIMITS = {
    "meituan.com": 500,
    "ele.me": 500,
    "jd.com": 300,
    "douyin.com": 200,
}

CRAWL_DELAY_DEFAULT = 3.0


class ComplianceGuard:
    def __init__(self):
        self._robots_cache: dict[str, dict] = {}
        self._domain_requests: dict[str, list[float]] = {}
        self._audit_log: list[dict] = []
        self._initialized = False

    async def initialize(self):
        if self._initialized:
            return
        logger.info("ComplianceGuard initialized with policy: %s", COMPLIANCE_POLICY["purpose"])
        self._initialized = True

    def _get_domain(self, url: str) -> str:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        parts = host.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return host

    async def check_robots_txt(self, url: str) -> dict:
        domain = self._get_domain(url)
        if domain in self._robots_cache:
            return self._robots_cache[domain]

        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.hostname}/robots.txt"

        result = {
            "allowed": True,
            "crawl_delay": CRAWL_DELAY_DEFAULT,
            "disallowed_paths": [],
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(
                    robots_url,
                    headers={"User-Agent": COMPLIANCE_POLICY["user_agent_suffix"]},
                )
                if response.status_code == 200:
                    result = self._parse_robots_txt(response.text, domain)
                else:
                    logger.info("No robots.txt found for %s, assuming allowed", domain)
        except Exception as e:
            logger.warning("Failed to fetch robots.txt for %s: %s", domain, e)

        self._robots_cache[domain] = result
        return result

    def _parse_robots_txt(self, content: str, domain: str) -> dict:
        result = {
            "allowed": True,
            "crawl_delay": CRAWL_DELAY_DEFAULT,
            "disallowed_paths": [],
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

        our_agent = "FoodieComparisonBot"
        applies_to_us = False

        for line in content.splitlines():
            line = line.strip().lower()
            if line.startswith("user-agent:"):
                agent = line.split(":", 1)[1].strip()
                applies_to_us = agent in ("*", our_agent.lower())
            elif applies_to_us:
                if line.startswith("disallow:"):
                    path = line.split(":", 1)[1].strip()
                    if path:
                        result["disallowed_paths"].append(path)
                        if path == "/":
                            result["allowed"] = False
                            logger.warning("robots.txt for %s disallows all crawling", domain)
                elif line.startswith("crawl-delay:"):
                    try:
                        delay = float(line.split(":", 1)[1].strip())
                        result["crawl_delay"] = max(delay, CRAWL_DELAY_DEFAULT)
                        logger.info("robots.txt Crawl-Delay for %s: %.1fs", domain, delay)
                    except ValueError:
                        pass

        return result

    def is_path_allowed(self, url: str, robots_info: dict) -> bool:
        if not robots_info.get("allowed", True):
            return False

        parsed = urlparse(url)
        path = parsed.path

        for disallowed in robots_info.get("disallowed_paths", []):
            if path.startswith(disallowed):
                return False

        return True

    async def check_rate_limit(self, url: str) -> bool:
        domain = self._get_domain(url)
        now = time.time()

        if domain not in self._domain_requests:
            self._domain_requests[domain] = []

        self._domain_requests[domain] = [
            t for t in self._domain_requests[domain] if now - t < 86400
        ]

        daily_limit = DOMAIN_DAILY_LIMITS.get(domain, 500)
        if len(self._domain_requests[domain]) >= daily_limit:
            logger.warning(
                "Daily limit reached for %s: %d/%d",
                domain, len(self._domain_requests[domain]), daily_limit,
            )
            return False

        recent = [t for t in self._domain_requests[domain] if now - t < 1.0]
        if len(recent) >= settings.collector_rate_limit:
            logger.warning("Rate limit hit for %s", domain)
            return False

        return True

    def record_request(self, url: str):
        domain = self._get_domain(url)
        now = time.time()
        if domain not in self._domain_requests:
            self._domain_requests[domain] = []
        self._domain_requests[domain].append(now)

    async def acquire_crawl_permission(self, url: str) -> tuple[bool, str]:
        await self.initialize()

        robots_info = await self.check_robots_txt(url)

        if not robots_info.get("allowed", True):
            return False, f"robots.txt 禁止爬取此域名"

        if not self.is_path_allowed(url, robots_info):
            return False, f"robots.txt 禁止爬取此路径"

        if not await self.check_rate_limit(url):
            return False, f"已达到频率限制，请稍后再试"

        crawl_delay = robots_info.get("crawl_delay", CRAWL_DELAY_DEFAULT)
        await asyncio.sleep(crawl_delay)

        self.record_request(url)
        self._log_audit("crawl_allowed", url)

        return True, "允许爬取"

    def _log_audit(self, action: str, url: str, extra: dict = None):
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "url": url,
            "domain": self._get_domain(url),
        }
        if extra:
            entry.update(extra)
        self._audit_log.append(entry)
        if len(self._audit_log) > 10000:
            self._audit_log = self._audit_log[-5000:]
        logger.debug("Audit: %s %s", action, url)

    def log_crawl_result(self, url: str, success: bool, items_count: int = 0, error: str = None):
        self._log_audit(
            "crawl_result", url,
            {"success": success, "items_count": items_count, "error": error},
        )

    def get_daily_stats(self) -> dict:
        now = time.time()
        stats = {}
        for domain, timestamps in self._domain_requests.items():
            today = [t for t in timestamps if now - t < 86400]
            daily_limit = DOMAIN_DAILY_LIMITS.get(domain, 500)
            stats[domain] = {
                "requests_today": len(today),
                "daily_limit": daily_limit,
                "remaining": max(0, daily_limit - len(today)),
                "usage_percent": round(len(today) / daily_limit * 100, 1) if daily_limit > 0 else 0,
            }
        return stats

    def get_audit_log(self, limit: int = 100) -> list[dict]:
        return self._audit_log[-limit:]

    def get_compliance_report(self) -> dict:
        return {
            "policy": COMPLIANCE_POLICY,
            "daily_stats": self.get_daily_stats(),
            "robots_cache_status": {
                domain: {
                    "allowed": info.get("allowed", True),
                    "crawl_delay": info.get("crawl_delay", CRAWL_DELAY_DEFAULT),
                    "checked_at": info.get("checked_at"),
                }
                for domain, info in self._robots_cache.items()
            },
            "total_audit_entries": len(self._audit_log),
        }


compliance_guard = ComplianceGuard()
