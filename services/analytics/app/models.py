"""Analytics Service Data Models."""

from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union, NamedTuple
from uuid import UUID

from pydantic import BaseModel, Field, root_validator, validator


class SessionStatus(str, Enum):
    """Training session status."""
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    SKIPPED = "skipped"


class AnalyticsGroupBy(str, Enum):
    """Grouping dimension for analytics queries."""
    STATUS = "status"
    DISCIPLINE = "discipline"
    PROGRAM = "program"
    WEEK = "week"
    PROFILE = "profile"


class VisualizationType(str, Enum):
    """Type of visualization chart."""
    SESSIONS_TREND = "sessions_trend"
    DISCIPLINE_BREAKDOWN = "discipline_breakdown"
    PROGRAM_COMPLETION = "program_completion"


class AnalyticsFilters(BaseModel):
    """Filters for analytics queries."""
    profileId: Optional[UUID] = None
    programId: Optional[UUID] = None
    disciplineId: Optional[UUID] = None
    status: Optional[SessionStatus] = None
    dateFrom: Optional[date] = Field(None, description="Start date (inclusive)")
    dateTo: Optional[date] = Field(None, description="End date (inclusive)")

    @root_validator(skip_on_failure=True)
    def _validate_dates(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        start = values.get("dateFrom")
        end = values.get("dateTo")
        if start and end and end < start:
            raise ValueError("dateTo must be greater than or equal to dateFrom")
        return values


class GroupedMetricEntry(BaseModel):
    """Single entry in grouped metrics result."""
    key: str
    label: str
    totalSessions: int
    completedSessions: int
    uniqueProfiles: int
    totalVolume: int


class GroupedMetricsResponse(BaseModel):
    """Response for grouped metrics query."""
    groupBy: AnalyticsGroupBy
    generatedAt: datetime
    appliedFilters: AnalyticsFilters
    results: List[GroupedMetricEntry]


class ChartDataset(BaseModel):
    """Chart.js dataset."""
    label: str
    data: List[float]
    borderColor: Optional[str] = None
    backgroundColor: Optional[Union[str, List[str]]] = None
    fill: bool = False


class VisualizationChart(BaseModel):
    """Chart configuration for visualization."""
    type: str
    title: str
    description: str
    labels: List[str]
    datasets: List[ChartDataset]
    options: Dict[str, Any] = Field(default_factory=dict)


class VisualizationRequest(BaseModel):
    """Request for generating a visualization."""
    visualizationType: VisualizationType
    filters: AnalyticsFilters = Field(default_factory=AnalyticsFilters)


class VisualizationResponse(BaseModel):
    """Generated visualization response."""
    visualizationType: VisualizationType
    generatedAt: datetime
    appliedFilters: AnalyticsFilters
    chart: VisualizationChart
    source: Dict[str, Any]


class _GroupingConfig(NamedTuple):
    key_expr_template: str
    label_expr_template: str
    join_clause_template: str = ""
    order_expr: str = "total_sessions DESC, group_label ASC"
    null_label: str = "Unspecified"


GROUPING_CONFIG: Dict[AnalyticsGroupBy, _GroupingConfig] = {
    AnalyticsGroupBy.STATUS: _GroupingConfig(
        key_expr_template="{source}.status",
        label_expr_template="{source}.status",
        null_label="Unknown status",
    ),
    AnalyticsGroupBy.DISCIPLINE: _GroupingConfig(
        key_expr_template="COALESCE({source}.discipline_id::text, 'unassigned')",
        label_expr_template="COALESCE(td.name, 'Без категории')",
        join_clause_template="LEFT JOIN training_disciplines td ON td.id = {source}.discipline_id",
        null_label="Без категории",
    ),
    AnalyticsGroupBy.PROGRAM: _GroupingConfig(
        key_expr_template="COALESCE({source}.program_id::text, 'unassigned')",
        label_expr_template="COALESCE(tp.name, 'Без программы')",
        join_clause_template="LEFT JOIN training_programs tp ON tp.id = {source}.program_id",
        null_label="Без программы",
    ),
    AnalyticsGroupBy.WEEK: _GroupingConfig(
        key_expr_template="DATE_TRUNC('week', {source}.planned_at)::date",
        label_expr_template="TO_CHAR(DATE_TRUNC('week', {source}.planned_at), 'IYYY-\"W\"IW')",
        order_expr="group_key DESC",
    ),
    AnalyticsGroupBy.PROFILE: _GroupingConfig(
        key_expr_template="{source}.profile_id::text",
        label_expr_template=(
            "COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), "
            "CONCAT('Профиль ', SUBSTRING({source}.profile_id::text, 1, 8)))"
        ),
        join_clause_template="LEFT JOIN profiles p ON p.id = {source}.profile_id",
        null_label="Неизвестный профиль",
    ),
}


class WeeklyStat(BaseModel):
    weekStart: date
    completedSessions: int
    totalSessions: int
    totalVolume: int


class ProgressPoint(BaseModel):
    date: date
    totalEntries: int
    buckets: Dict[str, int]


class StatsResponse(BaseModel):
    totalSessions: int
    totalExercises: int
    averagePerformance: float
    weeklyStats: List[WeeklyStat]
    progressOverTime: List[ProgressPoint]


class BatchStatsRequest(BaseModel):
    profileIds: List[UUID] = Field(..., min_length=1, description="Список профилей для расчёта")

    @validator("profileIds")
    def _dedupe(cls, value: List[UUID]) -> List[UUID]:  # noqa: D401 - keep short description
        """Deduplicate ids while preserving the original order."""
        seen = set()
        result: List[UUID] = []
        for profile_id in value:
            if profile_id not in seen:
                seen.add(profile_id)
                result.append(profile_id)
        return result


class BatchStatsResponse(BaseModel):
    requested: int
    processed: int
    limit: int
    results: Dict[str, StatsResponse]


class AggregateSummary(BaseModel):
    totalProfiles: int
    activeProfiles7d: int
    totalSessions: int
    completedSessions: int
    totalVolume: int
    averageVolumePerSession: float


class AggregateWeeklyTrend(BaseModel):
    weekStart: date
    totalSessions: int
    completedSessions: int
    uniqueProfiles: int
    totalVolume: int


class TopExerciseEntry(BaseModel):
    exerciseKey: str
    usageCount: int


class AggregateResponse(BaseModel):
    summary: AggregateSummary
    weeklyTrends: List[AggregateWeeklyTrend]
    topExercises: List[TopExerciseEntry]


class TrendInsight(BaseModel):
    metric: str
    direction: str
    slope: float
    currentValue: float
    forecastValue: float
    confidence: float


class WeeklyTrendPoint(WeeklyStat):
    pass


class TrendResponse(BaseModel):
    generatedAt: datetime
    windowWeeks: int
    weeklySeries: List[WeeklyTrendPoint]
    insights: List[TrendInsight]


class ProfileTrendResponse(TrendResponse):
    profileId: UUID


class PlatformTrendResponse(TrendResponse):
    scope: str


class ExportResource(str, Enum):
    PROFILE_STATS = "profile_stats"
    AGGREGATE = "aggregate"
    PROFILE_TRENDS = "profile_trends"
    PLATFORM_TRENDS = "platform_trends"


class ExportFormat(str, Enum):
    JSON = "json"
    CSV = "csv"


class ExportEnvelope(BaseModel):
    resource: ExportResource
    format: ExportFormat
    generatedAt: datetime
    metadata: Dict[str, Any]
    data: Any


VISUALIZATION_COLOR_PALETTE = [
    "#2563eb",
    "#0ea5e9",
    "#10b981",
    "#f97316",
    "#f43f5e",
    "#a855f7",
    "#14b8a6",
    "#facc15",
]
