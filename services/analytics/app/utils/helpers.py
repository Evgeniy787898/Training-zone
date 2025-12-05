"""Helper functions for Analytics Service."""

import json
import os
import sys
from datetime import date, datetime, timedelta, time
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID

# Add services directory to path to allow importing python_shared
SERVICES_DIR = Path(__file__).resolve().parents[3]
if SERVICES_DIR.exists() and str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))

# Now we can import from python_shared
from python_shared.config import parse_int
from app.models import AnalyticsFilters, VISUALIZATION_COLOR_PALETTE, GROUPING_CONFIG


def _int_from_env(key: str, fallback: int) -> int:
    """Parse integer from environment with fallback.
    
    DEPRECATED: Use python_shared.config.parse_int instead.
    Kept for backward compatibility.
    """
    return parse_int(os.getenv(key), fallback)


def _seconds_from_env(key: str, fallback: int) -> int:
    """Parse seconds from environment with fallback.
    
    DEPRECATED: Use python_shared.config.parse_int instead.
    Kept for backward compatibility.
    """
    value = parse_int(os.getenv(key), fallback)
    return max(1, value)


def _json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    raise TypeError(f"Unsupported type for serialization: {type(value)!r}")


def _format_week_label(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _cycle_colors(count: int) -> List[str]:
    if count <= 0:
        return []
    palette = VISUALIZATION_COLOR_PALETTE or ["#2563eb"]
    return [palette[i % len(palette)] for i in range(count)]


def _completion_percentage(total: int, completed: int) -> float:
    if total <= 0:
        return 0.0
    return round(min(100.0, max(0.0, (completed / total) * 100.0)), 1)


def _linear_trend_insight(
    metric: str, values: List[float], *, clamp_min: float = 0.0
) -> Optional[Dict[str, object]]:
    if not values:
        return None
    if len(values) < 2 or all(v == values[0] for v in values):
        return {
            "metric": metric,
            "direction": "flat",
            "slope": 0.0,
            "currentValue": float(values[-1]),
            "forecastValue": float(max(clamp_min, values[-1])),
            "confidence": 0.0,
        }

    indexes = list(range(len(values)))
    mean_x = sum(indexes) / len(indexes)
    mean_y = sum(values) / len(values)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(indexes, values))
    denominator = sum((x - mean_x) ** 2 for x in indexes) or 1.0
    slope = numerator / denominator
    intercept = mean_y - slope * mean_x
    next_index = len(values)
    forecast = slope * next_index + intercept

    sse = sum((y - (slope * x + intercept)) ** 2 for x, y in zip(indexes, values))
    sst = sum((y - mean_y) ** 2 for y in values) or 1.0
    r_squared = max(0.0, min(1.0, 1 - (sse / sst)))

    baseline = abs(mean_y) if mean_y != 0 else 1.0
    tolerance = max(0.01, baseline * 0.05)
    if slope > tolerance:
        direction = "up"
    elif slope < -tolerance:
        direction = "down"
    else:
        direction = "flat"

    return {
        "metric": metric,
        "direction": direction,
        "slope": float(slope),
        "currentValue": float(values[-1]),
        "forecastValue": float(max(clamp_min, forecast)),
        "confidence": float(r_squared),
    }


def _build_trend_insights(points: List[Dict[str, object]]) -> List[Dict[str, object]]:
    if not points:
        return []
    sessions = [float(point["totalSessions"]) for point in points]
    completed = [float(point["completedSessions"]) for point in points]
    volume = [float(point["totalVolume"]) for point in points]
    completion_rate: List[float] = []
    for total, done in zip(sessions, completed):
        if total <= 0:
            completion_rate.append(0.0)
        else:
            completion_rate.append(done / total)

    insights = [
        _linear_trend_insight("totalSessions", sessions),
        _linear_trend_insight("completedSessions", completed),
        _linear_trend_insight("totalVolume", volume),
        _linear_trend_insight("completionRate", completion_rate, clamp_min=0.0),
    ]
    return [insight for insight in insights if insight is not None]


def _build_filter_clause(
    filters: AnalyticsFilters, *, alias: str = "ts", planned_column: str = "planned_at"
) -> Tuple[str, List[Any]]:
    conditions: List[str] = ["1=1"]
    params: List[Any] = []

    def bind(value: Any) -> str:
        params.append(value)
        return f"${len(params)}"

    def column(name: str) -> str:
        if "." in name:
            return name
        return f"{alias}.{name}"

    if filters.profileId:
        conditions.append(f"{column('profile_id')} = {bind(filters.profileId)}")
    if filters.programId:
        conditions.append(f"{column('program_id')} = {bind(filters.programId)}")
    if filters.disciplineId:
        conditions.append(f"{column('discipline_id')} = {bind(filters.disciplineId)}")
    if filters.status:
        conditions.append(f"{column('status')} = {bind(filters.status.value)}")
    planned_ref = column(planned_column)
    if filters.dateFrom:
        start_dt = datetime.combine(filters.dateFrom, datetime.min.time())
        conditions.append(f"{planned_ref} >= {bind(start_dt)}")
    if filters.dateTo:
        end_dt = datetime.combine(filters.dateTo + timedelta(days=1), datetime.min.time())
        conditions.append(f"{planned_ref} < {bind(end_dt)}")

    return " AND ".join(conditions), params


def _stringify_group_key(value: Any) -> str:
    if value is None:
        return "unassigned"
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _build_grouped_cache_key(
    group_by: Any, filters: AnalyticsFilters
) -> str:
    parts = [f"groupBy={group_by.value}"]
    for field in ("profileId", "programId", "disciplineId", "status", "dateFrom", "dateTo"):
        value = getattr(filters, field)
        if value is None:
            parts.append(f"{field}=null")
            continue
        if isinstance(value, Enum):
            serialized = value.value
        elif isinstance(value, (datetime, date)):
            serialized = value.isoformat()
        else:
            serialized = str(value)
        parts.append(f"{field}={serialized}")
    return "grouped:" + "|".join(parts)


def _build_visualization_cache_key(
    visualization_type: Any, filters: AnalyticsFilters
) -> str:
    parts = [f"type={visualization_type.value}"]
    for field in ("profileId", "programId", "disciplineId", "status", "dateFrom", "dateTo"):
        value = getattr(filters, field)
        if value is None:
            parts.append(f"{field}=null")
            continue
        if isinstance(value, Enum):
            serialized = value.value
        elif isinstance(value, (datetime, date)):
            serialized = value.isoformat()
        else:
            serialized = str(value)
        parts.append(f"{field}={serialized}")
    return "visualization:" + "|".join(parts)


def _serialize_weekly_point(row: Any) -> Dict[str, object]:
    return {
        "weekStart": row["week_start"],
        "completedSessions": int(row["completed_sessions"] or 0),
        "totalSessions": int(row["total_sessions"] or 0),
        "totalVolume": int(row["total_volume"] or 0),
    }


def _empty_profile_stats() -> Dict[str, object]:
    return {
        "totalSessions": 0,
        "totalExercises": 0,
        "averagePerformance": 0.0,
        "weeklyStats": [],
        "progressOverTime": [],
    }


def _default_totals_row(profile_id: UUID) -> Dict[str, object]:
    return {
        "profile_id": profile_id,
        "total_sessions": 0,
        "total_exercises": 0,
        "average_performance": 0.0,
    }
