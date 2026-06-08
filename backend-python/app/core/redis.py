"""
Redis client with in-memory fallback — exact port of Backend/src/config/redis.ts.
When REDIS_URL is not set or REDIS_ENABLED is false, all operations use a
plain dict in memory (suitable for single-process dev/test only).
"""
import asyncio
import time
from collections import defaultdict
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

# ---------------------------------------------------------------------------
# In-memory fallback store (mirrors the Map-based fallback in otpStore.ts)
# ---------------------------------------------------------------------------

_mem_store: dict[str, tuple[Any, float]] = {}  # key → (value, expires_at)
_mem_lock = asyncio.Lock()


class InMemoryRedis:
    """Minimal Redis-compatible API using a plain dict. Single-process only."""

    async def get(self, key: str) -> str | None:
        async with _mem_lock:
            entry = _mem_store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if expires_at and time.monotonic() > expires_at:
                del _mem_store[key]
                return None
            return value

    async def set(self, key: str, value: Any, ex: int | None = None) -> None:
        async with _mem_lock:
            expires_at = time.monotonic() + ex if ex else 0.0
            _mem_store[key] = (str(value), expires_at)

    async def setex(self, key: str, seconds: int, value: Any) -> None:
        await self.set(key, value, ex=seconds)

    async def delete(self, *keys: str) -> int:
        async with _mem_lock:
            deleted = 0
            for k in keys:
                if k in _mem_store:
                    del _mem_store[k]
                    deleted += 1
            return deleted

    async def exists(self, *keys: str) -> int:
        async with _mem_lock:
            return sum(1 for k in keys if k in _mem_store)

    async def ttl(self, key: str) -> int:
        async with _mem_lock:
            entry = _mem_store.get(key)
            if entry is None:
                return -2
            _, expires_at = entry
            if not expires_at:
                return -1
            remaining = expires_at - time.monotonic()
            return max(0, int(remaining))

    async def ping(self) -> bool:
        return True

    async def close(self) -> None:
        pass


# ---------------------------------------------------------------------------
# Module-level client (set during app startup)
# ---------------------------------------------------------------------------

_redis_client: aioredis.Redis | InMemoryRedis | None = None
_using_real_redis = False


async def init_redis() -> None:
    global _redis_client, _using_real_redis

    redis_enabled = settings.REDIS_ENABLED
    redis_url = settings.REDIS_URL

    if redis_enabled is False or not redis_url:
        _redis_client = InMemoryRedis()
        _using_real_redis = False
        return

    try:
        client = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
        await client.ping()
        _redis_client = client
        _using_real_redis = True
    except Exception:
        _redis_client = InMemoryRedis()
        _using_real_redis = False


async def close_redis() -> None:
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None


def get_redis() -> aioredis.Redis | InMemoryRedis:
    if _redis_client is None:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return _redis_client


async def check_redis_health() -> dict:
    try:
        client = get_redis()
        await client.ping()
        return {"status": "ok", "driver": "redis" if _using_real_redis else "memory"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}
