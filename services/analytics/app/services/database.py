"""Analytics Database Service."""

from datetime import datetime, date
from typing import Any, Dict, List, Optional, Sequence, Tuple, NamedTuple
from uuid import UUID

import asyncpg
from asyncpg.pool import Pool

from app.models import (
    AnalyticsFilters,
    AnalyticsGroupBy,
    GroupedMetricEntry,
    GROUPING_CONFIG,
)
from app.utils.helpers import (
    _build_filter_clause,
    _stringify_group_key,
    _serialize_weekly_point,
    _build_trend_insights,
    _empty_profile_stats,
    _default_totals_row,
)




class AnalyticsDatabase:
    """Manages the analytics Postgres pool and queries."""

    def __init__(
        self,
        *,
        dsn: str,
        min_size: int = 1,
        max_size: int = 5,
        statement_timeout_ms: int = 8000,
        weekly_limit: int = 8,
        progress_limit: int = 10,
        aggregate_weekly_limit: int = 12,
        top_exercise_limit: int = 5,
    ) -> None:
        self._dsn = dsn
        self._min_size = min_size
        self._max_size = max(min_size, max_size)
        self._statement_timeout_ms = statement_timeout_ms
        self._weekly_limit = max(1, weekly_limit)
        self._progress_limit = max(1, progress_limit)
        self._aggregate_weekly_limit = max(1, aggregate_weekly_limit)
        self._top_exercise_limit = max(1, top_exercise_limit)
        self._pool: Optional[Pool] = None

    async def connect(self) -> None:
        if self._pool or not self._dsn:
            if not self._dsn:
                raise RuntimeError("ANALYTICS_DATABASE_URL is not configured")
            return
        self._pool = await asyncpg.create_pool(
            dsn=self._dsn,
            min_size=self._min_size,
            max_size=self._max_size,
            command_timeout=self._statement_timeout_ms / 1000,
            statement_cache_size=0,
        )

    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None

    def is_connected(self) -> bool:
        return self._pool is not None

    async def refresh_views(self) -> None:
        """Refresh all materialized views concurrently."""
        if not self._pool:
            raise RuntimeError("Database pool is not initialized")

        async with self._pool.acquire() as conn:
            await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY session_volume_mv")
            await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY profile_rpe_distribution_mv")
            await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY profile_summary_mv")

    async def fetch_profile_stats(self, profile_id: UUID) -> Dict[str, object]:
        """Return the stats for a single profile (reuses the batch loader)."""

        batch = await self.fetch_profile_stats_batch([profile_id])
        return batch.get(profile_id, _empty_profile_stats())

    async def fetch_profile_stats_batch(
        self, profile_ids: Sequence[UUID]
    ) -> Dict[UUID, Dict[str, object]]:
        """Return stats for multiple profiles using batched queries."""

        if not profile_ids:
            return {}
        if not self._pool:
            raise RuntimeError("Database pool is not initialized")

        unique_ids: List[UUID] = []
        seen = set()
        for profile_id in profile_ids:
            if profile_id not in seen:
                seen.add(profile_id)
                unique_ids.append(profile_id)

        async with self._pool.acquire() as conn:
            totals_map = await self._fetch_totals_batch(conn, unique_ids)
            weekly_map = await self._fetch_weekly_stats_batch(conn, unique_ids)
            progress_map = await self._fetch_progress_batch(conn, unique_ids)

        results: Dict[UUID, Dict[str, object]] = {}
        for profile_id in unique_ids:
            totals = totals_map.get(profile_id, _default_totals_row(profile_id))
            results[profile_id] = {
                "totalSessions": totals["total_sessions"],
                "totalExercises": totals["total_exercises"],
                "averagePerformance": totals["average_performance"],
                "weeklyStats": weekly_map.get(profile_id, []),
                "progressOverTime": progress_map.get(profile_id, []),
            }

        return results

    async def fetch_aggregate_metrics(self) -> Dict[str, object]:
        if not self._pool:
            raise RuntimeError("Database pool is not initialized")

        async with self._pool.acquire() as conn:
            summary = await self._fetch_global_summary(conn)
            weekly = await self._fetch_platform_weekly_trends(conn)
            top_exercises = await self._fetch_top_exercises(conn)

        return {
            "summary": summary,
            "weeklyTrends": weekly,
            "topExercises": top_exercises,
        }

    async def fetch_profile_trends(self, profile_id: UUID) -> Dict[str, object]:
        if not self._pool:
            raise RuntimeError("Database pool is not initialized")

        async with self._pool.acquire() as conn:
            rows = await self._fetch_weekly_series(conn, profile_id, ascending=True)

        points = [_serialize_weekly_point(row) for row in rows]
        insights = _build_trend_insights(points)
        return {
            "profileId": profile_id,
            "generatedAt": datetime.utcnow(),
            "windowWeeks": len(points),
            "weeklySeries": points,
            "insights": insights,
        }

    async def fetch_platform_trends(self) -> Dict[str, object]:
        if not self._pool:
            raise RuntimeError("Database pool is not initialized")

        async with self._pool.acquire() as conn:
            rows = await self._fetch_platform_weekly_trends(conn, order="ASC")

        points = [_serialize_weekly_point(row) for row in rows]
        insights = _build_trend_insights(points)
        return {
            "scope": "platform",
            "generatedAt": datetime.utcnow(),
            "windowWeeks": len(points),
            "weeklySeries": points,
            "insights": insights,
        }

    async def fetch_grouped_metrics(
        self,
        *,
        filters: "AnalyticsFilters",
        group_by: "AnalyticsGroupBy",
        limit: int,
    ) -> List[Dict[str, object]]:
        if not self._pool:
            raise RuntimeError("Database pool is not initialized")
        config = GROUPING_CONFIG[group_by]
        source_alias = "facts"
        where_clause, params = _build_filter_clause(
            filters, alias=source_alias, planned_column="planned_at"
        )
        params_with_limit = [*params, limit]
        key_expr = config.key_expr_template.format(source=source_alias)
        label_expr = config.label_expr_template.format(source=source_alias)
        join_clause = config.join_clause_template.format(source=source_alias)

        async with self._pool.acquire() as conn:
            query = f"""
                SELECT
                    {key_expr} AS group_key,
                    {label_expr} AS group_label,
                    COUNT(*)::bigint AS total_sessions,
                    COUNT(*) FILTER (WHERE {source_alias}.status = 'done')::bigint AS completed_sessions,
                    COUNT(DISTINCT {source_alias}.profile_id)::bigint AS unique_profiles,
                    COALESCE(SUM({source_alias}.total_volume), 0)::bigint AS total_volume
                FROM session_volume_mv {source_alias}
                {join_clause}
                WHERE {where_clause}
                GROUP BY group_key, group_label
                ORDER BY {config.order_expr}
                LIMIT ${len(params_with_limit)}
            """
            rows = await conn.fetch(query, *params_with_limit)

        entries: List[Dict[str, object]] = []
        for row in rows:
            label_value = row["group_label"]
            if label_value is None:
                label_value = config.null_label
            entries.append(
                {
                    "key": _stringify_group_key(row["group_key"]),
                    "label": str(label_value).strip() or config.null_label,
                    "totalSessions": int(row["total_sessions"] or 0),
                    "completedSessions": int(row["completed_sessions"] or 0),
                    "uniqueProfiles": int(row["unique_profiles"] or 0),
                    "totalVolume": int(row["total_volume"] or 0),
                }
            )
        return entries

    async def _fetch_totals_batch(
        self, conn: asyncpg.Connection, profile_ids: Sequence[UUID]
    ) -> Dict[UUID, Dict[str, object]]:
        query = """
            WITH requested AS (
                SELECT DISTINCT unnest($1::uuid[]) AS profile_id
            ),
            session_totals AS (
                SELECT profile_id, COUNT(*)::bigint AS total_sessions
                FROM session_volume_mv
                WHERE profile_id = ANY($1)
                GROUP BY profile_id
            ),
            exercise_totals AS (
                SELECT profile_id, COUNT(*)::bigint AS total_exercises
                FROM training_session_exercises
                WHERE profile_id = ANY($1)
                GROUP BY profile_id
            ),
            avg_volume AS (
                SELECT profile_id, COALESCE(AVG(total_volume), 0)::double precision AS average_performance
                FROM session_volume_mv
                WHERE profile_id = ANY($1)
                GROUP BY profile_id
            )
            SELECT
                requested.profile_id,
                COALESCE(session_totals.total_sessions, 0)::bigint AS total_sessions,
                COALESCE(exercise_totals.total_exercises, 0)::bigint AS total_exercises,
                COALESCE(avg_volume.average_performance, 0)::double precision AS average_performance
            FROM requested
            LEFT JOIN session_totals USING (profile_id)
            LEFT JOIN exercise_totals USING (profile_id)
            LEFT JOIN avg_volume USING (profile_id)
        """
        rows = await conn.fetch(query, profile_ids)
        return {row["profile_id"]: dict(row) for row in rows}

    async def _fetch_weekly_stats_batch(
        self, conn: asyncpg.Connection, profile_ids: Sequence[UUID]
    ) -> Dict[UUID, List[Dict[str, object]]]:
        query = """
            WITH ranked AS (
                SELECT
                    profile_id,
                    DATE_TRUNC('week', session_date)::date AS week_start,
                    COUNT(*) FILTER (WHERE status = 'done')::bigint AS completed_sessions,
                    COUNT(*)::bigint AS total_sessions,
                    COALESCE(SUM(total_volume), 0)::bigint AS total_volume,
                    ROW_NUMBER() OVER (
                        PARTITION BY profile_id
                        ORDER BY DATE_TRUNC('week', session_date) DESC
                    ) AS row_number
                FROM session_volume_mv
                WHERE profile_id = ANY($1)
                GROUP BY profile_id, week_start
            )
            SELECT *
            FROM ranked
            WHERE row_number <= $2
            ORDER BY profile_id, week_start DESC
        """
        rows = await conn.fetch(query, profile_ids, self._weekly_limit)
        grouped: Dict[UUID, List[Dict[str, object]]] = {}
        for row in rows:
            grouped.setdefault(row["profile_id"], []).append(_serialize_weekly_point(row))
        return grouped

    async def _fetch_progress_batch(
        self, conn: asyncpg.Connection, profile_ids: Sequence[UUID]
    ) -> Dict[UUID, List[Dict[str, object]]]:
        query = """
            WITH aggregated AS (
                SELECT
                    profile_id,
                    entry_date,
                    jsonb_object_agg(bucket_key, entry_count) AS buckets,
                    SUM(entry_count)::bigint AS total_entries,
                    ROW_NUMBER() OVER (
                        PARTITION BY profile_id
                        ORDER BY entry_date DESC
                    ) AS row_number
                FROM profile_rpe_distribution_mv
                WHERE profile_id = ANY($1)
                GROUP BY profile_id, entry_date
            )
            SELECT *
            FROM aggregated
            WHERE row_number <= $2
            ORDER BY profile_id, entry_date DESC
        """
        rows = await conn.fetch(query, profile_ids, self._progress_limit)
        grouped: Dict[UUID, List[Dict[str, object]]] = {}
        for row in rows:
            buckets = row["buckets"] or {}
            if isinstance(buckets, str):
                buckets = {}
            grouped.setdefault(row["profile_id"], []).append(
                {
                    "date": row["entry_date"],
                    "totalEntries": int(row["total_entries"] or 0),
                    "buckets": {k: int(v) for k, v in dict(buckets).items()},
                }
            )
        return grouped

    async def _fetch_global_summary(self, conn: asyncpg.Connection) -> Dict[str, object]:
        profile_row = await conn.fetchrow(
            """
            SELECT
                COUNT(*)::bigint AS total_profiles,
                COUNT(*) FILTER (
                    WHERE updated_at >= (CURRENT_DATE - INTERVAL '7 days')
                )::bigint AS active_profiles_7d
            FROM profiles
            """,
        )
        fact_row = await conn.fetchrow(
            """
            SELECT
                COUNT(*)::bigint AS total_sessions,
                COUNT(*) FILTER (WHERE status = 'done')::bigint AS completed_sessions,
                COALESCE(SUM(total_volume), 0)::bigint AS total_volume,
                COALESCE(AVG(total_volume), 0)::double precision AS avg_volume
            FROM session_volume_mv
            """,
        )
        return {
            "totalProfiles": int(profile_row["total_profiles"] or 0),
            "activeProfiles7d": int(profile_row["active_profiles_7d"] or 0),
            "totalSessions": int(fact_row["total_sessions"] or 0),
            "completedSessions": int(fact_row["completed_sessions"] or 0),
            "totalVolume": int(fact_row["total_volume"] or 0),
            "averageVolumePerSession": float(fact_row["avg_volume"] or 0.0),
        }

    async def _fetch_platform_weekly_trends(
        self, conn: asyncpg.Connection, order: str = "DESC"
    ) -> List[Dict[str, object]]:
        order_clause = "ASC" if order.upper() == "ASC" else "DESC"
        query = f"""
            SELECT
                DATE_TRUNC('week', facts.planned_at)::date AS week_start,
                COUNT(*)::bigint AS total_sessions,
                COUNT(*) FILTER (WHERE facts.status = 'done')::bigint AS completed_sessions,
                COUNT(DISTINCT facts.profile_id)::bigint AS unique_profiles,
                COALESCE(SUM(facts.total_volume), 0)::bigint AS total_volume
            FROM session_volume_mv facts
            GROUP BY week_start
            ORDER BY week_start {order_clause}
            LIMIT $1
        """
        rows = await conn.fetch(query, self._aggregate_weekly_limit)
        return [
            {
                "weekStart": row["week_start"],
                "totalSessions": int(row["total_sessions"] or 0),
                "completedSessions": int(row["completed_sessions"] or 0),
                "uniqueProfiles": int(row["unique_profiles"] or 0),
                "totalVolume": int(row["total_volume"] or 0),
            }
            for row in rows
        ]

    async def _fetch_top_exercises(self, conn: asyncpg.Connection) -> List[Dict[str, object]]:
        rows = await conn.fetch(
            """
            SELECT
                exercise_key,
                COUNT(*)::bigint AS usage_count
            FROM training_session_exercises
            GROUP BY exercise_key
            ORDER BY usage_count DESC, exercise_key ASC
            LIMIT $1
            """,
            self._top_exercise_limit,
        )
        return [
            {"exerciseKey": row["exercise_key"], "usageCount": int(row["usage_count"] or 0)}
            for row in rows
        ]

    async def _fetch_weekly_series(
        self, conn: asyncpg.Connection, profile_id: UUID, ascending: bool = True
    ) -> List[asyncpg.Record]:
        order = "ASC" if ascending else "DESC"
        query = f"""
            SELECT
                DATE_TRUNC('week', session_date)::date AS week_start,
                COUNT(*) FILTER (WHERE status = 'done')::bigint AS completed_sessions,
                COUNT(*)::bigint AS total_sessions,
                COALESCE(SUM(total_volume), 0)::bigint AS total_volume
            FROM session_volume_mv
            WHERE profile_id = $1
            GROUP BY week_start
            ORDER BY week_start {order}
            LIMIT $2
        """
        return await conn.fetch(query, profile_id, self._aggregate_weekly_limit)
