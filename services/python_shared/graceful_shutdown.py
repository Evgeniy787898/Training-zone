"""Shared graceful-shutdown helpers for TZONA microservices."""

from __future__ import annotations

import asyncio
import inspect
import logging
from contextlib import asynccontextmanager
from typing import Awaitable, Callable, Optional

ShutdownCallback = Callable[[], Awaitable[None] | None]


class GracefulShutdownManager:
    """Coordinates FastAPI lifespan cleanup with reusable callbacks."""

    def __init__(self, *, service: str, logger: Optional[logging.Logger] = None) -> None:
        self.service = service
        self.logger = logger or logging.getLogger(f"tzona.{service}")
        self._callbacks: list[ShutdownCallback] = []
        self._event = asyncio.Event()
        self._closing = False

    def register(self, callback: ShutdownCallback) -> None:
        """Register a callback executed when the app shuts down."""

        self._callbacks.append(callback)

    def callback(self, func: ShutdownCallback) -> ShutdownCallback:
        """Decorator variant of :meth:`register`."""

        self.register(func)
        return func

    @property
    def shutting_down(self) -> bool:
        return self._event.is_set()

    async def wait_for_shutdown(self) -> None:
        await self._event.wait()

    async def _run_callbacks(self) -> None:
        if self._closing:
            return
        self._closing = True
        self._event.set()
        for callback in reversed(self._callbacks):
            try:
                result = callback()
                if inspect.isawaitable(result):
                    await result
            except Exception:  # pragma: no cover - defensive logging
                callback_name = getattr(callback, "__name__", repr(callback))
                self.logger.exception("Shutdown callback %s failed", callback_name)

    def lifespan(self):  # type: ignore[override]
        """Return an asynccontextmanager for FastAPI's lifespan hook."""

        @asynccontextmanager
        async def _lifespan(_app):
            self.logger.info("Service %s startup complete", self.service)
            try:
                yield
            finally:
                await self._run_callbacks()
                self.logger.info("Service %s shutdown complete", self.service)

        return _lifespan
