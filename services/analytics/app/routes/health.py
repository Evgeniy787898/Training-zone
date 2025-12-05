"""Health routes for Analytics Service."""

import os
from fastapi import APIRouter
from python_shared.health import HealthReporter, HealthCheckResult

from app.services.database import AnalyticsDatabase

router = APIRouter()

# Note: We need to inject these dependencies or use a global singleton
# For now, we'll assume they are available via the app state or global context
# In a pure DI approach, we would inject them.
# To keep it simple and compatible with the existing structure, we will use
# the global instances from the main app module, but since we are refactoring,
# we should try to pass them.
# However, HealthReporter is designed to be a singleton.

health_reporter = HealthReporter(service="analytics", version="1.0.0")

def register_health_checks(database: AnalyticsDatabase):
    REQUIRED_ENV_VARS = ("ANALYTICS_DATABASE_URL",)

    def _database_config_health() -> HealthCheckResult:
        missing = [env for env in REQUIRED_ENV_VARS if not os.getenv(env)]
        if missing:
            return HealthCheckResult.degraded(missingEnv=missing)
        database_url = os.getenv("ANALYTICS_DATABASE_URL", "").strip()
        return HealthCheckResult.ok(driver=database_url.split(":", 1)[0])

    def _schedule_health() -> HealthCheckResult:
        refresh_at = os.getenv("ANALYTICS_REFRESH_AT", "00:00").strip()
        return HealthCheckResult.ok(refreshAt=refresh_at)

    def _database_connection_health() -> HealthCheckResult:
        return (
            HealthCheckResult.ok(poolReady=True)
            if database.is_connected()
            else HealthCheckResult.degraded(poolReady=False)
        )

    health_reporter.register("databaseConfig", _database_config_health)
    health_reporter.register("scheduler", _schedule_health)
    health_reporter.register("databaseConnection", _database_connection_health)


@router.get("/api/health")
async def health():
    return await health_reporter.snapshot()
