"""Analytics API Routes."""

import json
import time
from datetime import datetime, date
from typing import Any, Callable, Dict, List, Optional, AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from pydantic import ValidationError

from app.models import (
    AggregateResponse,
    AnalyticsFilters,
    AnalyticsGroupBy,
    BatchStatsRequest,
    BatchStatsResponse,
    ExportEnvelope,
    ExportFormat,
    ExportResource,
    GroupedMetricEntry,
    GroupedMetricsResponse,
    PlatformTrendResponse,
    ProfileTrendResponse,
    SessionStatus,
    StatsResponse,
    VisualizationRequest,
    VisualizationResponse,
    VisualizationChart,
    VisualizationType,
    ChartDataset,
)
from app.globals import (
    database,
    analytics_cache,
    metrics_recorder,
    realtime_broadcaster,
    PROFILE_STATS_CACHE_TTL,
    AGGREGATE_CACHE_TTL,
    TREND_CACHE_TTL,
    GROUPED_CACHE_TTL,
    GROUPED_RESULTS_LIMIT,
    VISUALIZATION_CACHE_TTL,
    BATCH_PROFILE_LIMIT,
)
from app.services.export import serialize_export_csv
from app.services.realtime import RealtimeCapacityError
from app.utils.helpers import (
    _build_grouped_cache_key,
    _build_visualization_cache_key,
    _empty_profile_stats,
    _format_week_label,
    _cycle_colors,
    _completion_percentage,
)

router = APIRouter()


async def _load_with_cache(
    *,
    key: str,
    ttl_seconds: float,
    metric: str,
    loader: Callable[[], Any],
) -> Dict[str, object]:
    cached = await analytics_cache.get(key)
    if cached is not None:
        metrics_recorder.increment_counter(f"{metric}.cache_hit")
        return cached

    async def _loader() -> Dict[str, object]:
        metrics_recorder.increment_counter(f"{metric}.cache_miss")
        return await loader()

    return await analytics_cache.remember(
        key,
        _loader,
        ttl_seconds=ttl_seconds,
    )


async def _generate_visualization_chart(
    visualization_type: VisualizationType, filters: AnalyticsFilters
) -> Any:
    # Tuple[VisualizationChart, Dict[str, Any]]
    if visualization_type == VisualizationType.SESSIONS_TREND:
        if filters.profileId:
            source = await database.fetch_profile_trends(filters.profileId)
            title = "Динамика тренировок профиля"
            description = "Сколько тренировок выполняет конкретный профиль каждую неделю."
        else:
            source = await database.fetch_platform_trends()
            title = "Динамика тренировок платформы"
            description = "Общий тренд завершённых тренировок и объёма по всей платформе."
        points = source.get("weeklySeries", [])
        labels = [_format_week_label(point.get("weekStart")) for point in points]
        chart = VisualizationChart(
            type="line",
            title=title,
            description=description,
            labels=labels,
            datasets=[
                ChartDataset(
                    label="Завершённые тренировки",
                    data=[float(point.get("completedSessions", 0)) for point in points],
                    borderColor="#2563eb",
                    fill=False,
                ),
                ChartDataset(
                    label="Общий объём",
                    data=[float(point.get("totalVolume", 0)) for point in points],
                    borderColor="#f97316",
                    fill=False,
                ),
            ],
            options={"stacked": False, "unit": "sessions"},
        )
        return chart, source

    if visualization_type == VisualizationType.DISCIPLINE_BREAKDOWN:
        rows = await database.fetch_grouped_metrics(
            filters=filters,
            group_by=AnalyticsGroupBy.DISCIPLINE,
            limit=GROUPED_RESULTS_LIMIT,
        )
        labels = [row["label"] for row in rows]
        chart = VisualizationChart(
            type="doughnut",
            title="Распределение по дисциплинам",
            description="Какие типы тренировок чаще всего выполняют пользователи.",
            labels=labels,
            datasets=[
                ChartDataset(
                    label="Завершённые тренировки",
                    data=[float(row.get("completedSessions", 0)) for row in rows],
                    backgroundColor=_cycle_colors(len(rows)),
                    fill=True,
                )
            ],
            options={"legendPosition": "bottom"},
        )
        return chart, {"groupBy": AnalyticsGroupBy.DISCIPLINE.value, "rows": rows}

    if visualization_type == VisualizationType.PROGRAM_COMPLETION:
        rows = await database.fetch_grouped_metrics(
            filters=filters,
            group_by=AnalyticsGroupBy.PROGRAM,
            limit=GROUPED_RESULTS_LIMIT,
        )
        labels = [row["label"] for row in rows]
        dataset = ChartDataset(
            label="Завершено, %",
            data=[
                _completion_percentage(
                    int(row.get("totalSessions", 0)), int(row.get("completedSessions", 0))
                )
                for row in rows
            ],
            borderColor="#a855f7",
            backgroundColor="rgba(168,85,247,0.25)",
            fill=True,
        )
        chart = VisualizationChart(
            type="bar",
            title="Завершённость программ",
            description="Показывает какой процент тренировок завершён в каждой программе.",
            labels=labels,
            datasets=[dataset],
            options={"yAxisUnit": "percent"},
        )
        return chart, {"groupBy": AnalyticsGroupBy.PROGRAM.value, "rows": rows}

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported visualization type: {visualization_type}",
    )


@router.get("/api/realtime/metrics")
async def stream_realtime_metrics(request: Request) -> StreamingResponse:
    async def _event_stream() -> AsyncGenerator[str, None]:
        async for chunk in realtime_broadcaster.iter_events(request):
            yield chunk

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    try:
        return StreamingResponse(_event_stream(), media_type="text/event-stream", headers=headers)
    except RealtimeCapacityError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="realtime capacity reached",
        ) from exc


@router.post("/api/refresh")
async def refresh_analytics() -> Dict[str, str]:
    """Force refresh of materialized views."""
    started = time.perf_counter()
    try:
        await database.refresh_views()
        metrics_recorder.observe_operation(
            "refresh_views",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=True,
        )
        return {"status": "ok", "message": "Materialized views refreshed"}
    except Exception as exc:
        metrics_recorder.observe_operation(
            "refresh_views",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh views: {exc}",
        )


@router.get("/api/stats/{userId}", response_model=StatsResponse)
async def get_stats(userId: str) -> StatsResponse:
    """Получение статистики пользователя"""
    started = time.perf_counter()
    try:
        try:
            profile_id = UUID(userId)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid profile id") from exc

        async def _loader() -> Dict[str, object]:
            return await database.fetch_profile_stats(profile_id)

        payload = await _load_with_cache(
            key=f"stats:profile:{profile_id}",
            ttl_seconds=PROFILE_STATS_CACHE_TTL,
            metric="stats.profile",
            loader=_loader,
        )
        response = StatsResponse(**payload)
        metrics_recorder.increment_counter("stats.generated")
        metrics_recorder.observe_operation(
            "fetch_stats",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=True,
            metadata={"userId": userId},
        )
        return response
    except HTTPException:
        metrics_recorder.observe_operation(
            "fetch_stats",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error="validation_error",
            metadata={"userId": userId},
        )
        raise
    except Exception as exc:
        metrics_recorder.observe_operation(
            "fetch_stats",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error=str(exc),
            metadata={"userId": userId},
        )
        raise


@router.post("/api/batch/profile-stats", response_model=BatchStatsResponse)
async def get_batch_profile_stats(payload: BatchStatsRequest) -> BatchStatsResponse:
    started = time.perf_counter()
    unique_ids = payload.profileIds[:BATCH_PROFILE_LIMIT]
    results: Dict[str, StatsResponse] = {}
    missing: List[UUID] = []
    cache_hits = 0

    for profile_id in unique_ids:
        cached = await analytics_cache.get(f"stats:profile:{profile_id}")
        if cached is not None:
            cache_hits += 1
            results[str(profile_id)] = StatsResponse(**cached)
        else:
            missing.append(profile_id)

    if cache_hits:
        metrics_recorder.increment_counter(
            "stats.profile.batch.cache_hit", value=float(cache_hits)
        )

    if missing:
        metrics_recorder.increment_counter(
            "stats.profile.batch.cache_miss", value=float(len(missing))
        )
        batch_payload = await database.fetch_profile_stats_batch(missing)
        for profile_id in missing:
            stats = batch_payload.get(profile_id, _empty_profile_stats())
            await analytics_cache.set(
                f"stats:profile:{profile_id}", stats, ttl_seconds=PROFILE_STATS_CACHE_TTL
            )
            results[str(profile_id)] = StatsResponse(**stats)

    metrics_recorder.observe_operation(
        "fetch_profile_stats_batch",
        duration_ms=(time.perf_counter() - started) * 1000,
        success=True,
        metadata={
            "requested": len(payload.profileIds),
            "processed": len(unique_ids),
            "limit": BATCH_PROFILE_LIMIT,
        },
    )

    return BatchStatsResponse(
        requested=len(payload.profileIds),
        processed=len(unique_ids),
        limit=BATCH_PROFILE_LIMIT,
        results=results,
    )


@router.get("/api/aggregate", response_model=AggregateResponse)
async def get_aggregate_metrics() -> AggregateResponse:
    started = time.perf_counter()
    try:
        async def _loader() -> Dict[str, object]:
            return await database.fetch_aggregate_metrics()

        payload = await _load_with_cache(
            key="aggregate:platform",
            ttl_seconds=AGGREGATE_CACHE_TTL,
            metric="aggregate",
            loader=_loader,
        )
        metrics_recorder.increment_counter("aggregate.generated")
        metrics_recorder.observe_operation(
            "fetch_aggregate",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=True,
        )
        return AggregateResponse(**payload)
    except Exception as exc:  # pragma: no cover - surfaced via monitoring
        metrics_recorder.observe_operation(
            "fetch_aggregate",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error=str(exc),
        )
        raise


@router.get("/api/trends/profile/{userId}", response_model=ProfileTrendResponse)
async def get_profile_trends(userId: str) -> ProfileTrendResponse:
    started = time.perf_counter()
    try:
        try:
            profile_id = UUID(userId)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid profile id") from exc

        async def _loader() -> Dict[str, object]:
            return await database.fetch_profile_trends(profile_id)

        payload = await _load_with_cache(
            key=f"trends:profile:{profile_id}",
            ttl_seconds=TREND_CACHE_TTL,
            metric="trends.profile",
            loader=_loader,
        )
        metrics_recorder.increment_counter("trends.profile.generated")
        metrics_recorder.observe_operation(
            "fetch_profile_trends",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=True,
            metadata={"userId": userId},
        )
        return ProfileTrendResponse(**payload)
    except HTTPException:
        metrics_recorder.observe_operation(
            "fetch_profile_trends",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error="validation_error",
            metadata={"userId": userId},
        )
        raise
    except Exception as exc:
        metrics_recorder.observe_operation(
            "fetch_profile_trends",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error=str(exc),
            metadata={"userId": userId},
        )
        raise


@router.get("/api/trends/platform", response_model=PlatformTrendResponse)
async def get_platform_trends() -> PlatformTrendResponse:
    started = time.perf_counter()
    try:
        async def _loader() -> Dict[str, object]:
            return await database.fetch_platform_trends()

        payload = await _load_with_cache(
            key="trends:platform",
            ttl_seconds=TREND_CACHE_TTL,
            metric="trends.platform",
            loader=_loader,
        )
        metrics_recorder.increment_counter("trends.platform.generated")
        metrics_recorder.observe_operation(
            "fetch_platform_trends",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=True,
        )
        return PlatformTrendResponse(**payload)
    except Exception as exc:
        metrics_recorder.observe_operation(
            "fetch_platform_trends",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error=str(exc),
        )
        raise


@router.get("/api/grouped-metrics", response_model=GroupedMetricsResponse)
async def get_grouped_metrics(
    groupBy: AnalyticsGroupBy,
    sessionStatus: Optional[SessionStatus] = Query(None, alias="status"),
    profileId: Optional[UUID] = Query(None),
    programId: Optional[UUID] = Query(None),
    disciplineId: Optional[UUID] = Query(None),
    dateFrom: Optional[date] = Query(None),
    dateTo: Optional[date] = Query(None),
):
    started = time.perf_counter()
    try:
        try:
            filters = AnalyticsFilters(
                profileId=profileId,
                programId=programId,
                disciplineId=disciplineId,
                status=sessionStatus,
                dateFrom=dateFrom,
                dateTo=dateTo,
            )
        except ValidationError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.errors()) from exc

        async def _loader() -> Dict[str, object]:
            rows = await database.fetch_grouped_metrics(
                filters=filters,
                group_by=groupBy,
                limit=GROUPED_RESULTS_LIMIT,
            )
            return {"results": rows}

        cache_key = _build_grouped_cache_key(groupBy, filters)
        payload = await _load_with_cache(
            key=cache_key,
            ttl_seconds=GROUPED_CACHE_TTL,
            metric="grouped.metrics",
            loader=_loader,
        )
        metrics_recorder.observe_operation(
            "grouped_metrics",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=True,
            metadata={"groupBy": groupBy.value},
        )
        return GroupedMetricsResponse(
            groupBy=groupBy,
            generatedAt=datetime.utcnow(),
            appliedFilters=filters,
            results=[GroupedMetricEntry(**entry) for entry in payload["results"]],
        )
    except HTTPException:
        metrics_recorder.observe_operation(
            "grouped_metrics",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error="validation_error",
            metadata={"groupBy": groupBy.value},
        )
        raise
    except Exception as exc:
        metrics_recorder.observe_operation(
            "grouped_metrics",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error=str(exc),
            metadata={"groupBy": groupBy.value},
        )
        raise


@router.post("/api/visualizations", response_model=VisualizationResponse)
async def create_visualization(payload: VisualizationRequest) -> VisualizationResponse:
    started = time.perf_counter()
    filters = payload.filters or AnalyticsFilters()
    cache_key = _build_visualization_cache_key(payload.visualizationType, filters)

    async def _loader() -> Dict[str, Any]:
        chart, source = await _generate_visualization_chart(payload.visualizationType, filters)
        return {"chart": chart.dict(), "source": source}

    try:
        cached = await _load_with_cache(
            key=cache_key,
            ttl_seconds=VISUALIZATION_CACHE_TTL,
            metric="visualizations",
            loader=_loader,
        )
        metrics_recorder.observe_operation(
            "visualizations",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=True,
            metadata={"type": payload.visualizationType.value},
        )
        return VisualizationResponse(
            visualizationType=payload.visualizationType,
            generatedAt=datetime.utcnow(),
            appliedFilters=filters,
            chart=VisualizationChart(**cached["chart"]),
            source=cached["source"],
        )
    except HTTPException:
        metrics_recorder.observe_operation(
            "visualizations",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error="validation_error",
            metadata={"type": payload.visualizationType.value},
        )
        raise
    except Exception as exc:
        metrics_recorder.observe_operation(
            "visualizations",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error=str(exc),
            metadata={"type": payload.visualizationType.value},
        )
        raise


@router.get(
    "/api/export",
    response_model=ExportEnvelope,
    responses={
        200: {
            "content": {
                "application/json": {},
                "text/csv": {
                    "schema": {"type": "string", "description": "CSV export"}
                },
            }
        }
    },
)
async def export_analytics(
    resource: ExportResource,
    format: ExportFormat = ExportFormat.JSON,
    profileId: Optional[str] = None,
):
    """Export analytics datasets in JSON or CSV format."""

    started = time.perf_counter()
    metadata: Dict[str, Any] = {"resource": resource.value}
    profile_uuid: Optional[UUID] = None

    try:
        if resource in (ExportResource.PROFILE_STATS, ExportResource.PROFILE_TRENDS):
            if not profileId:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="profileId is required for the selected resource",
                )
            try:
                profile_uuid = UUID(profileId)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="invalid profile id",
                ) from exc
            metadata["profileId"] = str(profile_uuid)

        loader: Callable[[], Any]
        cache_key: str
        ttl_seconds: float
        metric: str

        if resource == ExportResource.PROFILE_STATS and profile_uuid:
            cache_key = f"stats:profile:{profile_uuid}"
            ttl_seconds = PROFILE_STATS_CACHE_TTL
            metric = "stats.profile"

            async def _loader() -> Dict[str, object]:
                return await database.fetch_profile_stats(profile_uuid)

        elif resource == ExportResource.AGGREGATE:
            cache_key = "aggregate:platform"
            ttl_seconds = AGGREGATE_CACHE_TTL
            metric = "aggregate"

            async def _loader() -> Dict[str, object]:
                return await database.fetch_aggregate_metrics()

        elif resource == ExportResource.PROFILE_TRENDS and profile_uuid:
            cache_key = f"trends:profile:{profile_uuid}"
            ttl_seconds = TREND_CACHE_TTL
            metric = "trends.profile"

            async def _loader() -> Dict[str, object]:
                return await database.fetch_profile_trends(profile_uuid)

        elif resource == ExportResource.PLATFORM_TRENDS:
            cache_key = "trends:platform"
            ttl_seconds = TREND_CACHE_TTL
            metric = "trends.platform"

            async def _loader() -> Dict[str, object]:
                return await database.fetch_platform_trends()

        else:  # pragma: no cover - guarded by enums
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="unsupported resource",
            )

        payload = await _load_with_cache(
            key=cache_key,
            ttl_seconds=ttl_seconds,
            metric=metric,
            loader=_loader,
        )

        metrics_recorder.observe_operation(
            "export_analytics",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=True,
            metadata=metadata,
        )

        generated_at = datetime.utcnow()
        if format == ExportFormat.CSV:
            csv_body = serialize_export_csv(resource, payload)
            filename = f"{resource.value}-{generated_at.strftime('%Y%m%dT%H%M%SZ')}.csv"
            return PlainTextResponse(
                content=csv_body,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "X-Export-Resource": resource.value,
                },
            )

        envelope = ExportEnvelope(
            resource=resource,
            format=format,
            generatedAt=generated_at,
            metadata=metadata,
            data=payload,
        )
        return JSONResponse(content=json.loads(envelope.json()))
    except HTTPException as exc:
        metrics_recorder.observe_operation(
            "export_analytics",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error=str(exc.detail),
            metadata=metadata,
        )
        raise
    except Exception as exc:  # pragma: no cover - surfaced via monitoring
        metrics_recorder.observe_operation(
            "export_analytics",
            duration_ms=(time.perf_counter() - started) * 1000,
            success=False,
            error=str(exc),
            metadata=metadata,
        )
        raise


@router.get("/api/metrics")
async def metrics():
    return metrics_recorder.snapshot()
