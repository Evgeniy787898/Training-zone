"""Shared rate-limiting helpers for TZONA microservices."""

from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass, field
from typing import Iterable, Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette import status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"


@dataclass(frozen=True)
class RateLimitConfig:
    """Declarative configuration for the rate limiter."""

    limit: int = 60
    window_seconds: float = 60.0
    block_seconds: float = 30.0
    skip_paths: tuple[str, ...] = ("/api/health",)
    safe_methods: tuple[str, ...] = ()
    header_prefix: str = "X-RateLimit"

    @classmethod
    def from_env(cls, prefix: str, *, default_limit: int = 60, default_window: float = 60.0,
                 default_block: float = 30.0, default_skip_paths: Optional[Iterable[str]] = None) -> "RateLimitConfig":
        prefix = prefix.strip().upper()

        def _int(name: str, fallback: int) -> int:
            raw = os.getenv(f"{prefix}_RATE_LIMIT_{name}")
            if not raw:
                return fallback
            try:
                return int(raw)
            except ValueError:
                return fallback

        def _float(name: str, fallback: float) -> float:
            raw = os.getenv(f"{prefix}_RATE_LIMIT_{name}")
            if not raw:
                return fallback
            try:
                return float(raw)
            except ValueError:
                return fallback

        def _list(name: str, fallback: Iterable[str]) -> tuple[str, ...]:
            raw = os.getenv(f"{prefix}_RATE_LIMIT_{name}")
            if not raw:
                return tuple(fallback)
            values = [segment.strip() for segment in raw.split(",") if segment.strip()]
            return tuple(values) if values else tuple(fallback)

        skip = default_skip_paths or ("/api/health",)
        safe_methods = tuple(method.upper() for method in _list("SAFE_METHODS", ()))

        return cls(
            limit=max(1, _int("REQUESTS", default_limit)),
            window_seconds=max(1.0, _float("WINDOW_SECONDS", default_window)),
            block_seconds=max(1.0, _float("BLOCK_SECONDS", default_block)),
            skip_paths=_list("SKIP_PATHS", skip),
            safe_methods=safe_methods,
        )


@dataclass
class _RateLimitState:
    window_start: float = field(default_factory=lambda: time.monotonic())
    count: int = 0
    blocked_until: float = 0.0


@dataclass(frozen=True)
class RateLimitResult:
    limit: int
    remaining: int
    reset_in: float


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: float) -> None:
        super().__init__("Too many requests")
        self.retry_after = retry_after


class RateLimiter:
    """Simple in-memory limiter for microservices."""

    def __init__(self, config: RateLimitConfig):
        self._config = config
        self._states: dict[str, _RateLimitState] = {}
        self._lock = asyncio.Lock()

    async def hit(self, key: str) -> RateLimitResult:
        now = time.monotonic()
        async with self._lock:
            state = self._states.setdefault(key, _RateLimitState())
            if state.blocked_until > now:
                raise RateLimitExceeded(state.blocked_until - now)

            elapsed = now - state.window_start
            if elapsed >= self._config.window_seconds:
                state.window_start = now
                state.count = 0

            state.count += 1
            if state.count > self._config.limit:
                state.blocked_until = now + self._config.block_seconds
                raise RateLimitExceeded(self._config.block_seconds)

            remaining = max(0, self._config.limit - state.count)
            reset_in = max(0.0, self._config.window_seconds - (now - state.window_start))
            return RateLimitResult(limit=self._config.limit, remaining=remaining, reset_in=reset_in)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Starlette middleware that enforces the microservice rate limit."""

    def __init__(self, app, *, limiter: RateLimiter, config: RateLimitConfig):
        super().__init__(app)
        self._limiter = limiter
        self._config = config

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        if self._should_skip(request):
            return await call_next(request)

        key = self._key_for_request(request)
        if not key:
            return await call_next(request)

        try:
            result = await self._limiter.hit(key)
        except RateLimitExceeded as exc:
            return self._reject(request, exc)

        response = await call_next(request)
        self._apply_headers(response, result)
        return response

    def _should_skip(self, request: Request) -> bool:
        if request.method.upper() in self._config.safe_methods:
            return True
        return request.url.path in self._config.skip_paths

    def _key_for_request(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
        if request.client:
            return request.client.host
        return ""

    def _reject(self, request: Request, exc: RateLimitExceeded) -> JSONResponse:
        payload = {
            "detail": "Too Many Requests",
            "retryAfter": exc.retry_after,
            "requestId": request.headers.get(REQUEST_ID_HEADER),
        }
        response = JSONResponse(status_code=status.HTTP_429_TOO_MANY_REQUESTS, content=payload)
        response.headers["Retry-After"] = str(int(exc.retry_after))
        return response

    def _apply_headers(self, response: Response, result: RateLimitResult) -> None:
        response.headers[f"{self._config.header_prefix}-Limit"] = str(result.limit)
        response.headers[f"{self._config.header_prefix}-Remaining"] = str(result.remaining)
        response.headers[f"{self._config.header_prefix}-Reset"] = str(int(result.reset_in))

