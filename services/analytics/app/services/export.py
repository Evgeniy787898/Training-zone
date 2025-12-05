"""Export Service for Analytics."""

import csv
import io
import json
from typing import Any, Dict, List, Tuple

from app.models import ExportResource
from app.utils.helpers import _format_week_label


def _format_csv_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _profile_stats_export_rows(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[str]]:
    rows: List[Dict[str, Any]] = []
    totals = {
        "totalSessions": payload.get("totalSessions", 0),
        "totalExercises": payload.get("totalExercises", 0),
        "averagePerformance": payload.get("averagePerformance", 0.0),
    }
    for metric, value in totals.items():
        rows.append({"section": "totals", "metric": metric, "value": value})

    for entry in payload.get("weeklyStats", []):
        rows.append(
            {
                "section": "weeklyStats",
                "weekStart": entry.get("weekStart"),
                "completedSessions": entry.get("completedSessions"),
                "totalSessions": entry.get("totalSessions"),
                "totalVolume": entry.get("totalVolume"),
            }
        )

    for entry in payload.get("progressOverTime", []):
        rows.append(
            {
                "section": "progressOverTime",
                "date": entry.get("date"),
                "totalEntries": entry.get("totalEntries"),
                "buckets": entry.get("buckets"),
            }
        )

    columns = [
        "section",
        "metric",
        "value",
        "weekStart",
        "completedSessions",
        "totalSessions",
        "totalVolume",
        "date",
        "totalEntries",
        "buckets",
    ]
    return rows, columns


def _aggregate_export_rows(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[str]]:
    rows: List[Dict[str, Any]] = []
    summary = payload.get("summary", {})
    for metric, value in summary.items():
        rows.append({"section": "summary", "metric": metric, "value": value})

    for entry in payload.get("weeklyTrends", []):
        rows.append(
            {
                "section": "weeklyTrends",
                "weekStart": entry.get("weekStart"),
                "totalSessions": entry.get("totalSessions"),
                "completedSessions": entry.get("completedSessions"),
                "uniqueProfiles": entry.get("uniqueProfiles"),
                "totalVolume": entry.get("totalVolume"),
            }
        )

    for entry in payload.get("topExercises", []):
        rows.append(
            {
                "section": "topExercises",
                "exerciseKey": entry.get("exerciseKey"),
                "usageCount": entry.get("usageCount"),
            }
        )

    columns = [
        "section",
        "metric",
        "value",
        "weekStart",
        "totalSessions",
        "completedSessions",
        "uniqueProfiles",
        "totalVolume",
        "exerciseKey",
        "usageCount",
    ]
    return rows, columns


def _trend_export_rows(
    payload: Dict[str, Any], *, include_profile: bool
) -> Tuple[List[Dict[str, Any]], List[str]]:
    rows: List[Dict[str, Any]] = []
    profile_id = payload.get("profileId") if include_profile else None
    for entry in payload.get("weeklySeries", []):
        row = {
            "section": "weeklySeries",
            "weekStart": entry.get("weekStart"),
            "totalSessions": entry.get("totalSessions"),
            "completedSessions": entry.get("completedSessions"),
            "totalVolume": entry.get("totalVolume"),
        }
        if profile_id:
            row["profileId"] = profile_id
        rows.append(row)

    for entry in payload.get("insights", []):
        rows.append(
            {
                "section": "insights",
                "insightMetric": entry.get("metric"),
                "direction": entry.get("direction"),
                "slope": entry.get("slope"),
                "currentValue": entry.get("currentValue"),
                "forecastValue": entry.get("forecastValue"),
                "confidence": entry.get("confidence"),
                "profileId": profile_id,
            }
        )

    columns = [
        "section",
        "profileId",
        "weekStart",
        "totalSessions",
        "completedSessions",
        "totalVolume",
        "insightMetric",
        "direction",
        "slope",
        "currentValue",
        "forecastValue",
        "confidence",
    ]
    return rows, columns


def serialize_export_csv(resource: ExportResource, payload: Dict[str, Any]) -> str:
    if resource == ExportResource.PROFILE_STATS:
        rows, columns = _profile_stats_export_rows(payload)
    elif resource == ExportResource.AGGREGATE:
        rows, columns = _aggregate_export_rows(payload)
    elif resource == ExportResource.PROFILE_TRENDS:
        rows, columns = _trend_export_rows(payload, include_profile=True)
    elif resource == ExportResource.PLATFORM_TRENDS:
        rows, columns = _trend_export_rows(payload, include_profile=False)
    else:
        rows, columns = [], []

    buffer = io.StringIO()
    if not columns:
        columns = ["section", "metric", "value"]
    writer = csv.DictWriter(buffer, fieldnames=columns)
    writer.writeheader()
    for row in rows:
        writer.writerow({column: _format_csv_value(row.get(column)) for column in columns})
    return buffer.getvalue()
