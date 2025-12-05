"""Analytics Service Configuration."""

import os
from pathlib import Path


def _int_from_env(name: str, default: int) -> int:
    """Parse integer from environment variable."""
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


class AnalyticsConfig:
    """Analytics service configuration from environment."""

    def __init__(self) -> None:
        # Database
        self.database_url = os.getenv("ANALYTICS_DATABASE_URL", "")
        self.db_pool_min = _int_from_env("ANALYTICS_DB_POOL_MIN", 1)
        self.db_pool_max = _int_from_env("ANALYTICS_DB_POOL_MAX", 5)
        self.db_statement_timeout_ms = _int_from_env("ANALYTICS_DB_STATEMENT_TIMEOUT_MS", 8000)

        # Query limits
        self.weekly_limit = _int_from_env("ANALYTICS_STATS_WEEKLY_LIMIT", 8)
        self.progress_limit = _int_from_env("ANALYTICS_STATS_PROGRESS_LIMIT", 10)
        self.aggregate_weekly_limit = _int_from_env("ANALYTICS_STATS_AGGREGATE_WEEKLY_LIMIT", 12)
        self.top_exercise_limit = _int_from_env("ANALYTICS_TOP_EXERCISE_LIMIT", 5)
        self.default_metrics_limit = _int_from_env("ANALYTICS_DEFAULT_METRICS_LIMIT", 100)

        # Cache
        self.cache_ttl_seconds = _int_from_env("ANALYTICS_CACHE_TTL_SECONDS", 300)
        self.cache_max_entries = _int_from_env("ANALYTICS_CACHE_MAX_ENTRIES", 1000)

        # Service
        self.port = _int_from_env("PORT", 3004)
        self.host = os.getenv("HOST", "0.0.0.0")
        self.log_level = os.getenv("LOG_LEVEL", "INFO")
        self.environment = os.getenv("ENVIRONMENT", "unknown")

    def validate(self) -> None:
        """Validate required configuration."""
        if not self.database_url:
            raise RuntimeError("ANALYTICS_DATABASE_URL is required")


# Global config instance
config = AnalyticsConfig()
