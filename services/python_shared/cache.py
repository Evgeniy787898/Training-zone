"""Reusable async TTL cache for TZONA microservices."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Optional


@dataclass(frozen=True)
class CacheConfig:
    """Configuration for the in-memory TTL cache."""

    namespace: str = "cache"
    default_ttl_seconds: float = 60.0
    max_entries: int = 512


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


class AsyncTTLCache:
    """Small async-friendly TTL cache with stampede protection."""

    def __init__(self, config: Optional[CacheConfig] = None) -> None:
        self._config = config or CacheConfig()
        self._entries: Dict[str, _CacheEntry] = {}
        self._lock = asyncio.Lock()
        self._key_locks: Dict[str, asyncio.Lock] = {}

    async def get(self, key: str) -> Optional[Any]:
        """Return a cached value if it's still valid."""

        async with self._lock:
            entry = self._entries.get(key)
            if not entry:
                return None
            if entry.expires_at <= time.monotonic():
                self._entries.pop(key, None)
                return None
            return entry.value

    async def set(self, key: str, value: Any, *, ttl_seconds: Optional[float] = None) -> Any:
        ttl = ttl_seconds if ttl_seconds is not None else self._config.default_ttl_seconds
        expires_at = time.monotonic() + max(0.1, ttl)
        async with self._lock:
            self._entries[key] = _CacheEntry(value=value, expires_at=expires_at)
            self._prune_locked()
        return value

    async def remember(
        self,
        key: str,
        loader: Callable[[], Awaitable[Any]],
        *,
        ttl_seconds: Optional[float] = None,
    ) -> Any:
        cached = await self.get(key)
        if cached is not None:
            return cached

        lock = await self._lock_for_key(key)
        async with lock:
            cached = await self.get(key)
            if cached is not None:
                return cached
            value = await loader()
            await self.set(key, value, ttl_seconds=ttl_seconds)
            return value

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._entries.pop(key, None)

    async def clear(self) -> None:
        async with self._lock:
            self._entries.clear()

    async def _lock_for_key(self, key: str) -> asyncio.Lock:
        async with self._lock:
            lock = self._key_locks.get(key)
            if lock is None:
                lock = asyncio.Lock()
                self._key_locks[key] = lock
            return lock

    def _prune_locked(self) -> None:
        if len(self._entries) <= self._config.max_entries:
            return
        now = time.monotonic()
        expired = [key for key, entry in self._entries.items() if entry.expires_at <= now]
        for key in expired:
            self._entries.pop(key, None)
        while len(self._entries) > self._config.max_entries:
            oldest_key = min(self._entries.items(), key=lambda item: item[1].expires_at)[0]
            self._entries.pop(oldest_key, None)

