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


class WorkoutContext(BaseModel):
    """Current workout session context for AI personalization (AI-F02)."""
    disciplineName: Optional[str] = None
    disciplineType: Optional[str] = None  # strength, cardio, flexibility, etc.
    exercisesCompleted: Optional[int] = None
    exercisesTotal: Optional[int] = None
    durationMinutes: Optional[int] = None
    status: Optional[str] = None  # in_progress, paused, completed
    currentExerciseIndex: Optional[int] = None


class AdviceRequest(BaseModel):
    """Request for generating exercise advice."""
    exerciseKey: str
    currentLevel: str
    performance: Dict[str, Any]
    goals: Optional[List[str]] = None
    context: Optional[List[AdviceContextEntry]] = None
    personalization: Optional[PersonalizationPayload] = None
    workoutContext: Optional[WorkoutContext] = None  # AI-F02


class AdviceResponse(BaseModel):
    """Generated advice response."""
    advice: str
    nextSteps: List[str]
    tips: List[str]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ExerciseProgressItem(BaseModel):
    """Progress for a single exercise."""
    key: str
    title: Optional[str] = None
    currentLevel: str
    streak: int = 0
    lastRpe: Optional[float] = None


class MetricItem(BaseModel):
    """Body measurement."""
    type: str
    value: float
    unit: str
    date: str


class ChatUserContext(BaseModel):
    """Full user context for personalized chat responses."""
    # Profile
    firstName: Optional[str] = None
    summaryText: Optional[str] = None  # Pre-formatted full context summary
    goals: Optional[List[str]] = None
    equipment: Optional[List[str]] = None
    timezone: Optional[str] = None
    
    # Current Program
    currentProgram: Optional[str] = None
    currentDiscipline: Optional[str] = None
    currentLevels: Optional[Dict[str, str]] = None  # {exerciseKey: level}
    
    # Sessions Statistics
    totalSessions: Optional[int] = None
    completedSessions: Optional[int] = None
    skippedSessions: Optional[int] = None
    lastSessionDate: Optional[str] = None
    lastSessionStatus: Optional[str] = None
    
    # Exercise Progress
    exerciseProgress: Optional[List[ExerciseProgressItem]] = None
    
    # Achievements
    achievementsCount: Optional[int] = None
    recentAchievements: Optional[List[str]] = None
    
    # Metrics
    latestWeight: Optional[float] = None
    latestMetrics: Optional[List[MetricItem]] = None
    
    # Photos
    photosCount: Optional[int] = None
    lastPhotoDate: Optional[str] = None
    
    # Favorites
    favoriteExercises: Optional[List[str]] = None


class ChatRequest(BaseModel):
    """Simple chat request with user context."""
    message: str
    history: Optional[List[Dict[str, str]]] = None  # [{"role": "user/assistant", "content": "..."}]
    profileId: Optional[str] = None
    context: Optional[ChatUserContext] = None  # User personalization data


class ChatResponse(BaseModel):
    """Simple chat response."""
    reply: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

