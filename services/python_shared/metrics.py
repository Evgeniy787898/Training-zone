"""Lightweight metrics utilities shared by TZONA Python services."""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from threading import RLock
from typing import Any, Dict, Optional


@dataclass
class RequestStats:
    """Aggregated stats for a single HTTP method/path pair."""

    count: int = 0
    total_duration_ms: float = 0.0
    success: int = 0
    client_error: int = 0
    server_error: int = 0
    last_error: Optional[str] = None
    max_duration_ms: float = 0.0

    def register(self, status_code: int, duration_ms: float, error: Optional[str]) -> None:
        self.count += 1
        self.total_duration_ms += duration_ms
        if status_code < 400:
            self.success += 1
        elif status_code < 500:
            self.client_error += 1
        else:
            self.server_error += 1
        if error:
            self.last_error = error
        if duration_ms > self.max_duration_ms:
            self.max_duration_ms = duration_ms

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["avg_duration_ms"] = self.total_duration_ms / self.count if self.count else 0.0
        return payload


@dataclass
class OperationStats:
    """Aggregated stats for background or business operations."""

    count: int = 0
    success: int = 0
    failure: int = 0
    total_duration_ms: float = 0.0
    last_error: Optional[str] = None
    last_metadata: Dict[str, Any] = field(default_factory=dict)

    def register(
        self,
        *,
        duration_ms: float,
        success: bool,
        error: Optional[str],
        metadata: Optional[Dict[str, Any]],
    ) -> None:
        self.count += 1
        if success:
            self.success += 1
        else:
            self.failure += 1
        self.total_duration_ms += duration_ms
        if error:
            self.last_error = error
        if metadata:
            self.last_metadata = dict(metadata)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["avg_duration_ms"] = self.total_duration_ms / self.count if self.count else 0.0
        return payload


class MetricsRecorder:
    """Thread-safe metrics accumulator for FastAPI services."""

    def __init__(self, service: str, *, environment: Optional[str] = None) -> None:
        self.service = service
        self.environment = environment or "unknown"
        self.started_at = time.time()
        self._lock = RLock()
        self._http_totals = RequestStats()
        self._http_endpoints: Dict[str, RequestStats] = {}
        self._counters: Dict[str, float] = {}
        self._operations: Dict[str, OperationStats] = {}

    def observe_http_request(
        self,
        *,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        error_message: Optional[str] = None,
    ) -> None:
        key = f"{method.upper()} {path}"
        with self._lock:
            self._http_totals.register(status_code, duration_ms, error_message)
            bucket = self._http_endpoints.setdefault(key, RequestStats())
            bucket.register(status_code, duration_ms, error_message)

    def increment_counter(self, name: str, value: float = 1.0) -> None:
        with self._lock:
            self._counters[name] = self._counters.get(name, 0.0) + value

    def observe_operation(
        self,
        name: str,
        *,
        duration_ms: float,
        success: bool,
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        with self._lock:
            bucket = self._operations.setdefault(name, OperationStats())
            bucket.register(duration_ms=duration_ms, success=success, error=error, metadata=metadata)

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "service": self.service,
                "environment": self.environment,
                "uptime_seconds": round(time.time() - self.started_at, 3),
                "totals": self._http_totals.to_dict(),
                "endpoints": {key: stats.to_dict() for key, stats in self._http_endpoints.items()},
                "counters": dict(self._counters),
                "operations": {key: stats.to_dict() for key, stats in self._operations.items()},
            }


class MetricsMiddleware:
    """FastAPI middleware that records request timings and statuses."""

    def __init__(self, app, recorder: MetricsRecorder):
        self.app = app
        self.recorder = recorder

    async def __call__(self, scope, receive, send):  # type: ignore[override]
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        path = scope.get("path", "/")
        start = time.perf_counter()
        status_holder = {"value": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["value"] = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:  # pragma: no cover - FastAPI handles logging
            duration_ms = (time.perf_counter() - start) * 1000
            self.recorder.observe_http_request(
                method=method,
                path=path,
                status_code=500,
                duration_ms=duration_ms,
                error_message=str(exc),
            )
            raise
        else:
            duration_ms = (time.perf_counter() - start) * 1000
            self.recorder.observe_http_request(
                method=method,
                path=path,
                status_code=status_holder["value"],
                duration_ms=duration_ms,
            )

