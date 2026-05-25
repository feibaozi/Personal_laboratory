from app.config import settings

_async_redis = None
_sync_redis = None


def _get_async_redis():
    global _async_redis
    if _async_redis is None:
        import redis.asyncio as aioredis
        _async_redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _async_redis


def _get_sync_redis():
    global _sync_redis
    if _sync_redis is None:
        from redis import Redis
        _sync_redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _sync_redis


async def get_redis():
    return _get_async_redis()


async def close_redis():
    global _async_redis
    if _async_redis is not None:
        await _async_redis.close()
        _async_redis = None


async def cache_get(key: str) -> str | None:
    r = _get_async_redis()
    return await r.get(key)


async def cache_set(key: str, value: str, ttl: int = 3600):
    r = _get_async_redis()
    await r.setex(key, ttl, value)


async def cache_delete(key: str):
    r = _get_async_redis()
    await r.delete(key)