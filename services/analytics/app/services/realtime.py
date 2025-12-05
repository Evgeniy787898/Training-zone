"""Realtime Metrics Broadcaster."""

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from app.utils.helpers import _json_default


class RealtimeCapacityError(RuntimeError):
    """Raised when realtime capacity is exceeded."""


class _RealtimeClient:
    __slots__ = ("queue", "last_activity")

    def __init__(self) -> None:
        self.queue: "asyncio.Queue[str]" = asyncio.Queue()
        self.last_activity = time.monotonic()

    def touch(self) -> None:
        self.last_activity = time.monotonic()

    def is_stale(self, idle_timeout: float) -> bool:
        return (time.monotonic() - self.last_activity) > idle_timeout


class RealtimeMetricsBroadcaster:
    """Streams aggregate analytics snapshots to SSE clients."""

    def __init__(
        self,
        *,
        loader: Callable[[], Awaitable[Dict[str, Any]]],
        update_interval_seconds: float,
        idle_timeout_seconds: float,
        heartbeat_seconds: float,
        max_clients: int,
        logger: logging.Logger,
    ) -> None:
        self._loader = loader
        self._update_interval = max(1.0, update_interval_seconds)
        self._idle_timeout = max(1.0, idle_timeout_seconds)
        self._heartbeat = max(1.0, heartbeat_seconds)
        self._max_clients = max(1, max_clients)
        self._logger = logger
        self._clients: Dict[int, _RealtimeClient] = {}
        self._client_seq = 0
        self._task: Optional[asyncio.Task[None]] = None
        self._latest_payload: Optional[str] = None
        self._lock = asyncio.Lock()

    def start(self) -> None:
        if not self._task:
            self._task = asyncio.create_task(self._run(), name="analytics.realtime")
            self._logger.info("Realtime analytics broadcaster started")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
            self._logger.info("Realtime analytics broadcaster stopped")

    async def _run(self) -> None:
        try:
            while True:
                try:
                    if self._clients:
                        payload = await self._load_payload()
                        await self._broadcast(payload)
                        self._latest_payload = payload
                    await asyncio.sleep(self._update_interval)
                except asyncio.CancelledError:
                    raise
                except Exception:  # pragma: no cover - defensive logging
                    self._logger.exception("Realtime broadcast loop failed")
                    await asyncio.sleep(self._update_interval)
        except asyncio.CancelledError:
            pass

    async def _load_payload(self) -> str:
        snapshot = await self._loader()
        envelope = {
            "event": "analytics.metrics",
            "generatedAt": datetime.utcnow().isoformat() + "Z",
            "payload": snapshot,
        }
        return json.dumps(envelope, default=_json_default)

    async def _broadcast(self, payload: str) -> None:
        stale: List[int] = []
        for client_id, client in self._clients.items():
            if client.is_stale(self._idle_timeout):
                stale.append(client_id)
                continue
            await client.queue.put(payload)
        for client_id in stale:
            self._clients.pop(client_id, None)

    async def _add_client(self) -> Tuple[int, _RealtimeClient]:
        async with self._lock:
            if len(self._clients) >= self._max_clients:
                raise RealtimeCapacityError("Realtime capacity reached")
            self._client_seq += 1
            client = _RealtimeClient()
            self._clients[self._client_seq] = client
            return self._client_seq, client

    async def _remove_client(self, client_id: int) -> None:
        async with self._lock:
            self._clients.pop(client_id, None)

    async def iter_events(self, request: Any) -> Any:
        # Note: request type is Any to avoid importing FastAPI Request here if possible,
        # but we need is_disconnected().
        client_id, client = await self._add_client()
        try:
            yield "retry: 5000\n\n"
            if self._latest_payload is not None:
                await client.queue.put(self._latest_payload)
            else:
                payload = await self._load_payload()
                self._latest_payload = payload
                await client.queue.put(payload)

            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(
                        client.queue.get(), timeout=self._heartbeat
                    )
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                client.touch()
                yield f"data: {message}\n\n"
        finally:
            await self._remove_client(client_id)
