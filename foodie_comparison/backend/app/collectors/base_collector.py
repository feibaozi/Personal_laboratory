import time
import random
import asyncio
import logging
from typing import Optional
from datetime import datetime, timezone
from enum import Enum

import httpx
from bs4 import BeautifulSoup

from app.config import settings

logger = logging.getLogger(__name__)


class CollectionStrategy(str, Enum):
    API = "api"
    CRAWLER = "crawler"
    CACHE = "cache"
    OCR = "ocr"
    MANUAL = "manual"


class CollectionResult:
    def __init__(
        self,
        success: bool,
        data: dict = None,
        error: str = None,
        source: str = "api",
    ):
        self.success = success
        self.data = data or {}
        self.error = error
        self.source = source

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "source": self.source,
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }


class BaseCollector:
    platform: str = ""
    base_url: str = ""
    strategy_order: list[str] = ["api", "crawler", "cache"]

    def __init__(self):
        self._request_count = 0
        self._window_start = time.time()
        self._browser = None
        self._context = None
        self._playwright = None
        self._api_client = None

    async def _rate_limit(self):
        now = time.time()
        elapsed = now - self._window_start

        if elapsed >= 1.0:
            self._request_count = 0
            self._window_start = now
            return

        if self._request_count >= settings.collector_rate_limit:
            delay = 1.0 - elapsed + random.uniform(0.1, 0.5)
            await asyncio.sleep(delay)
            self._request_count = 0
            self._window_start = time.time()

    async def _init_browser(self):
        if self._browser is not None:
            return
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.warning("Playwright not installed, browser-based collection disabled")
            return

        self._playwright = await async_playwright().__aenter__()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        self._context = await self._browser.new_context(
            user_agent=settings.collector_user_agent,
            viewport={"width": 1920, "height": 1080},
        )
        await self._context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """)

    async def _request_with_retry(
        self, url: str, headers: dict = None, cookies: dict = None
    ) -> str:
        last_exception = None
        default_headers = {
            "User-Agent": settings.collector_user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
        if headers:
            default_headers.update(headers)

        for attempt in range(settings.collector_max_retries):
            try:
                await self._rate_limit()
                async with httpx.AsyncClient(
                    timeout=30.0, follow_redirects=True,
                    cookies=cookies,
                ) as client:
                    response = await client.get(url, headers=default_headers)
                    response.raise_for_status()
                    self._request_count += 1
                    return response.text
            except httpx.HTTPStatusError as e:
                last_exception = e
                logger.warning(
                    "%s HTTP %d on attempt %d: %s",
                    self.platform, e.response.status_code, attempt + 1, url,
                )
                if e.response.status_code in (403, 429):
                    await asyncio.sleep(5 * (2 ** attempt))
                else:
                    await asyncio.sleep(2 ** attempt)
            except Exception as e:
                last_exception = e
                logger.warning(
                    "%s attempt %d failed: %s",
                    self.platform, attempt + 1, str(e),
                )
                await asyncio.sleep(2 ** attempt)

        raise last_exception

    async def _page_request(
        self, url: str, wait_selector: str = None, wait_ms: int = 2000
    ) -> str:
        await self._init_browser()
        if self._browser is None:
            return await self._request_with_retry(url)

        page = await self._context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            if wait_selector:
                await page.wait_for_selector(wait_selector, timeout=10000)
            await page.wait_for_timeout(wait_ms)
            content = await page.content()
            return content
        finally:
            await page.close()

    async def _parse_page(self, html: str) -> BeautifulSoup:
        return BeautifulSoup(html, "lxml")

    async def close(self):
        if self._browser:
            await self._browser.close()
            self._browser = None
            self._context = None
        if self._playwright:
            await self._playwright.__aexit__(None, None, None)
            self._playwright = None

    async def collect_with_fallback(
        self, method: str, **kwargs
    ) -> CollectionResult:
        for strategy in self.strategy_order:
            try:
                handler = getattr(self, f"_collect_{method}_{strategy}", None)
                if handler is None:
                    continue
                result = await handler(**kwargs)
                if result and result.success:
                    result.source = strategy
                    logger.info(
                        "%s %s via %s succeeded",
                        self.platform, method, strategy,
                    )
                    return result
            except Exception as e:
                logger.warning(
                    "%s %s via %s failed: %s",
                    self.platform, method, strategy, e,
                )
                continue

        return CollectionResult(
            success=False,
            data={
                "platform": self.platform,
                "manual_entry_required": True,
                "message": "所有采集方式均失败，请手动提交链接或使用截图OCR",
                "support_methods": ["link_submit", "screenshot_ocr"],
            },
            error="all_strategies_failed",
        )

    async def collect_shops(self, location: dict) -> CollectionResult:
        return await self.collect_with_fallback("shops", location=location)

    async def collect_products(self, shop_id: str) -> CollectionResult:
        return await self.collect_with_fallback("products", shop_id=shop_id)

    async def collect_price(self, product_id: str) -> CollectionResult:
        return await self.collect_with_fallback("price", product_id=product_id)

    async def collect_coupons(self) -> CollectionResult:
        return await self.collect_with_fallback("coupons")

    async def health_check(self) -> bool:
        try:
            await self._request_with_retry(self.base_url)
            return True
        except Exception:
            return False
