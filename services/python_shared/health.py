"""Health-check helpers shared across TZONA microservices."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, Literal

HealthStatus = Literal["ok", "degraded", "error"]


@dataclass
class HealthCheckResult:
    """Represents the outcome of a single health check."""

    status: HealthStatus
    details: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def ok(cls, **details: Any) -> "HealthCheckResult":
        return cls(status="ok", details=details)

    @classmethod
    def degraded(cls, **details: Any) -> "HealthCheckResult":
        return cls(status="degraded", details=details)

    @classmethod
    def error(cls, **details: Any) -> "HealthCheckResult":
        return cls(status="error", details=details)


HealthCheck = Callable[[], Awaitable[HealthCheckResult] | HealthCheckResult]


class HealthReporter:
    """Collects health information for a microservice."""

    def __init__(self, *, service: str, version: str) -> None:
        self.service = service
        self.version = version
        self._start_time = time.time()
        self._checks: Dict[str, HealthCheck] = {}

    def register(self, name: str, check: HealthCheck) -> None:
        self._checks[name] = check

    async def snapshot(self) -> Dict[str, Any]:
        overall: HealthStatus = "ok"
        checks: Dict[str, Dict[str, Any]] = {}
        for name, check in self._checks.items():
            try:
                result = check()
                if asyncio.iscoroutine(result):
                    result = await result
            except Exception as exc:  # pragma: no cover - defensive logging happens at call site
                result = HealthCheckResult.error(error=str(exc))
            checks[name] = {"status": result.status, "details": result.details}
            if result.status == "error":
                overall = "error"
            elif result.status == "degraded" and overall == "ok":
                overall = "degraded"
        return {
            "service": self.service,
            "version": self.version,
            "status": overall,
            "uptimeSeconds": round(time.time() - self._start_time, 2),
            "checks": checks,
        }


__all__ = ["HealthReporter", "HealthCheckResult", "HealthStatus"]
