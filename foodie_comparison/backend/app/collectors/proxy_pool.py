import asyncio
import random
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class ProxyPool:
    def __init__(self):
        self._redis = None
        self._initialized = False

    async def _ensure_init(self):
        if self._initialized:
            return
        try:
            import redis.asyncio as aioredis
            self._redis = await aioredis.from_url(
                settings.redis_url, decode_responses=True,
            )
            self._initialized = True
        except Exception as e:
            logger.warning("Redis not available for proxy pool: %s", e)

    async def is_enabled(self) -> bool:
        return settings.collector_proxy_enabled and self._initialized

    async def get_proxy(self) -> Optional[str]:
        if not settings.collector_proxy_enabled:
            return None
        await self._ensure_init()
        if self._redis is None:
            return None

        try:
            proxies = await self._redis.smembers("proxy_pool:available")
            if not proxies:
                return None
            return random.choice(list(proxies))
        except Exception as e:
            logger.warning("Failed to get proxy: %s", e)
            return None

    async def mark_bad(self, proxy: str):
        if not await self.is_enabled():
            return
        try:
            await self._redis.srem("proxy_pool:available", proxy)
            await self._redis.sadd("proxy_pool:bad", proxy)
            logger.info("Marked proxy as bad: %s", proxy)
        except Exception as e:
            logger.warning("Failed to mark bad proxy: %s", e)

    async def mark_good(self, proxy: str):
        if not await self.is_enabled():
            return
        try:
            await self._redis.sadd("proxy_pool:available", proxy)
            logger.debug("Marked proxy as good: %s", proxy)
        except Exception as e:
            logger.warning("Failed to mark good proxy: %s", e)

    async def add_proxy(self, proxy: str):
        if not await self.is_enabled():
            return
        try:
            await self._redis.sadd("proxy_pool:available", proxy)
            logger.debug("Added proxy: %s", proxy)
        except Exception as e:
            logger.warning("Failed to add proxy: %s", e)

    async def get_count(self) -> int:
        if not await self.is_enabled():
            return 0
        try:
            return await self._redis.scard("proxy_pool:available")
        except Exception:
            return 0

    async def close(self):
        if self._redis:
            await self._redis.close()
            self._initialized = False