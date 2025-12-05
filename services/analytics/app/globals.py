import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict

# Add services directory to path to allow importing python_shared
SERVICES_DIR = Path(__file__).resolve().parents[2]
if SERVICES_DIR.exists() and str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))

from python_shared.cache import AsyncTTLCache, CacheConfig
from python_shared.metrics import MetricsRecorder
from app.services.database import AnalyticsDatabase
from app.services.realtime import RealtimeMetricsBroadcaster
from app.utils.helpers import _int_from_env, _seconds_from_env

LOGGER = logging.getLogger("tzona.analytics")

metrics_recorder = MetricsRecorder(
    service="analytics",
    environment=os.getenv("ENVIRONMENT", "unknown"),
)

database = AnalyticsDatabase(
    dsn=os.getenv("ANALYTICS_DATABASE_URL", ""),
    min_size=_int_from_env("ANALYTICS_DB_POOL_MIN", 1),
    max_size=_int_from_env("ANALYTICS_DB_POOL_MAX", 5),
    statement_timeout_ms=_int_from_env("ANALYTICS_DB_STATEMENT_TIMEOUT_MS", 8000),
    weekly_limit=_int_from_env("ANALYTICS_STATS_WEEKLY_LIMIT", 8),
    progress_limit=_int_from_env("ANALYTICS_STATS_PROGRESS_LIMIT", 10),
    aggregate_weekly_limit=_int_from_env("ANALYTICS_AGGREGATE_WEEKLY_LIMIT", 12),
    top_exercise_limit=_int_from_env("ANALYTICS_TOP_EXERCISE_LIMIT", 5),
)

cache_config = CacheConfig(
    namespace="analytics",
    default_ttl_seconds=float(_seconds_from_env("ANALYTICS_CACHE_DEFAULT_TTL_SECONDS", 30)),
    max_entries=_int_from_env("ANALYTICS_CACHE_MAX_ENTRIES", 512),
)
analytics_cache = AsyncTTLCache(cache_config)

# Realtime config
REALTIME_UPDATE_INTERVAL_SECONDS = float(
    _seconds_from_env("ANALYTICS_REALTIME_UPDATE_INTERVAL_SECONDS", 15)
)
REALTIME_HEARTBEAT_SECONDS = float(
    _seconds_from_env("ANALYTICS_REALTIME_HEARTBEAT_SECONDS", 10)
)
REALTIME_IDLE_TIMEOUT_SECONDS = float(
    _seconds_from_env("ANALYTICS_REALTIME_IDLE_TIMEOUT_SECONDS", 60)
)
REALTIME_MAX_CLIENTS = max(1, _int_from_env("ANALYTICS_REALTIME_MAX_CLIENTS", 100))

# We need a loader for realtime broadcaster, but it depends on database.
# We can define it here or pass it later.
# RealtimeMetricsBroadcaster expects a loader in __init__.
# We can define a wrapper that calls database.

async def _load_realtime_snapshot() -> Dict[str, Any]:
    # We need to import Any, Dict
    from typing import Dict, Any
    aggregate = await database.fetch_aggregate_metrics()
    platform = await database.fetch_platform_trends()
    return {
        "aggregate": aggregate,
        "platformTrends": platform,
    }

realtime_broadcaster = RealtimeMetricsBroadcaster(
    loader=_load_realtime_snapshot,
    update_interval_seconds=REALTIME_UPDATE_INTERVAL_SECONDS,
    idle_timeout_seconds=REALTIME_IDLE_TIMEOUT_SECONDS,
    heartbeat_seconds=REALTIME_HEARTBEAT_SECONDS,
    max_clients=REALTIME_MAX_CLIENTS,
    logger=LOGGER,
)

# Cache TTLs
PROFILE_STATS_CACHE_TTL = float(
    _seconds_from_env("ANALYTICS_CACHE_PROFILE_TTL_SECONDS", 60)
)
AGGREGATE_CACHE_TTL = float(
    _seconds_from_env("ANALYTICS_CACHE_AGGREGATE_TTL_SECONDS", 120)
)
TREND_CACHE_TTL = float(_seconds_from_env("ANALYTICS_CACHE_TRENDS_TTL_SECONDS", 300))
GROUPED_CACHE_TTL = float(
    _seconds_from_env("ANALYTICS_CACHE_GROUPED_TTL_SECONDS", 120)
)
GROUPED_RESULTS_LIMIT = max(
    1, _int_from_env("ANALYTICS_GROUPED_RESULTS_LIMIT", 25)
)
VISUALIZATION_CACHE_TTL = float(
    _seconds_from_env("ANALYTICS_CACHE_VISUALIZATION_TTL_SECONDS", 90)
)
BATCH_PROFILE_LIMIT = max(1, _int_from_env("ANALYTICS_BATCH_PROFILE_LIMIT", 25))
