"""AI Advisor Service Data Models."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AdviceContextEntry(BaseModel):
    """Historical advice entry for context."""
    exerciseKey: str
    currentLevel: str
    advice: str
    nextSteps: Optional[List[str]] = None
    tips: Optional[List[str]] = None
    goals: Optional[List[str]] = None
    performance: Optional[Dict[str, str]] = None
    createdAt: Optional[str] = None


class PersonalizationProfile(BaseModel):
    """User profile data."""
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    timezone: Optional[str] = None
    notificationTime: Optional[str] = None
    preferredLanguage: Optional[str] = None


class PersonalizationStats(BaseModel):
    """User training statistics."""
    completionRate30d: Optional[float] = None
    plannedSessions30d: Optional[int] = None
    completedSessions30d: Optional[int] = None
    latestSessionStatus: Optional[str] = None
    latestSessionDiscipline: Optional[str] = None
    latestSessionPlannedAt: Optional[str] = None


class PersonalizationAchievements(BaseModel):
    """User achievement data."""
    latestTitle: Optional[str] = None
    latestAwardedAt: Optional[str] = None
    totalCount: Optional[int] = None


class PersonalizationReadiness(BaseModel):
    """User readiness metrics."""
    avgRpe7d: Optional[float] = None


class PersonalizationPayload(BaseModel):
    """Complete personalization data."""
    profile: Optional[PersonalizationProfile] = None
    goals: Optional[List[str]] = None
    equipment: Optional[List[str]] = None
    focusAreas: Optional[List[str]] = None
    injuries: Optional[List[str]] = None
    tone: Optional[str] = None
    stats: Optional[PersonalizationStats] = None
    achievements: Optional[PersonalizationAchievements] = None
    readiness: Optional[PersonalizationReadiness] = None


class AdviceRequest(BaseModel):
    """Request for generating exercise advice."""
    exerciseKey: str
    currentLevel: str
    performance: Dict[str, Any]
    goals: Optional[List[str]] = None
    context: Optional[List[AdviceContextEntry]] = None
    personalization: Optional[PersonalizationPayload] = None


class AdviceResponse(BaseModel):
    """Generated advice response."""
    advice: str
    nextSteps: List[str]
    tips: List[str]
    metadata: Dict[str, Any] = Field(default_factory=dict)
