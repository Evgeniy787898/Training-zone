"""AI Advisor Service - Core business logic."""

import asyncio
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional

from app.config import config, FLASH_MODEL, PRO_MODEL

from app.models import (
    AdviceContextEntry,
    AdviceRequest,
    AdviceResponse,
    PersonalizationPayload,
)
from app.utils.retry import retry_with_backoff
from providers import ProviderAPIError, ProviderConfig, ProviderResult, ProviderUsage, create_provider

# JSON extraction pattern
JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)

# SLA Thresholds in milliseconds (PERF-AI-001)
SLA_THRESHOLDS = {
    FLASH_MODEL: 2000,  # <2 seconds for Flash
    PRO_MODEL: 5000,    # <5 seconds for Pro
}
SLA_DEFAULT_THRESHOLD = 3000  # Default 3 seconds

# Context Optimization (COST-002)
MAX_CONTEXT_ENTRIES = 5      # Max history entries in prompt
MAX_ADVICE_LENGTH = 100      # Truncate long advice in context
MAX_TIPS_IN_CONTEXT = 2       # Max tips to include from history
MAX_PERSONALIZATION_FIELDS = 6  # Max personalization fields

# Fallback Tips when AI unavailable (UX-AI-002)
FALLBACK_TIPS = [
    "Следите за техникой выполнения — качество важнее количества.",
    "Не забывайте о разминке перед тренировкой.",
    "Отдых между подходами: 60-90 секунд для силовых, 30-60 для кардио.",
    "Пейте воду до, во время и после тренировки.",
    "Прогресс строится на постоянстве — регулярность важнее интенсивности.",
    "Слушайте своё тело — боль это сигнал остановиться.",
    "Записывайте результаты — это мотивирует и помогает отслеживать прогресс.",
    "Сон — часть тренировочного процесса. Старайтесь спать 7-8 часов.",
    "Растяжка после тренировки ускоряет восстановление.",
    "Маленькие шаги каждый день приводят к большим результатам.",
]

FALLBACK_MESSAGE = "✨ AI отдыхает. Вот совет дня:"


def _is_retryable_error(exc: Exception) -> bool:
    """Check if exception is retryable."""
    if isinstance(exc, ProviderAPIError):
        return exc.retryable
    return False


class AdviceGenerator:
    """Generates personalized exercise advice using LLM providers."""

    def __init__(self, logger: logging.Logger) -> None:
        self._logger = logger
        
        # Load base prompt from template file (with env fallback for backward compatibility)
        from app.services.prompt_loader import PromptLoader
        try:
            self._base_prompt = PromptLoader.load("exercise_advice", fallback=config.base_prompt)
            logger.info("Loaded prompt from template file", extra={"template": "exercise_advice"})
        except FileNotFoundError:
            self._base_prompt = config.base_prompt
            logger.info("Using prompt from environment variable")

        # Create provider
        provider_config = ProviderConfig(
            model=config.model,
            temperature=config.temperature,
            max_output_tokens=config.max_tokens,
            api_key=config.get_api_key(),
        )
        self.provider = create_provider(config.provider, provider_config, logger)

        # Schema hint for LLM
        self.schema_hint = json.dumps(
            {
                "advice": "строка с персональным советом",
                "nextSteps": ["список конкретных шагов"],
                "tips": ["дополнительные короткие подсказки"],
            },
            ensure_ascii=False,
            indent=2,
        )

        # Cost tracking
        self._input_cost_per_1k = config.cost_input_per_1k
        self._output_cost_per_1k = config.cost_output_per_1k

    async def generate(self, request: AdviceRequest) -> AdviceResponse:
        """Generate advice for an exercise with retry logic."""
        user_prompt = self._build_user_prompt(request)
        started = time.perf_counter()

        async def _call_provider() -> ProviderResult:
            return await asyncio.to_thread(
                self.provider.generate,
                system_prompt=self._base_prompt,
                user_prompt=user_prompt,
            )

        try:
            provider_result = await retry_with_backoff(
                _call_provider,
                max_retries=3,
                base_delay=1.0,
                max_delay=30.0,
                jitter=0.5,
                is_retryable=_is_retryable_error,
                logger=self._logger,
            )
        except ProviderAPIError as exc:
            self._logger.error(
                "Provider error after retries",
                extra={"provider": exc.provider, "code": exc.code, "message": exc.message},
            )
            latency_ms = (time.perf_counter() - started) * 1000
            return self.fallback_response(
                request,
                metadata={"status": "fallback", "reason": exc.code},
                latency_ms=latency_ms,
            )

        latency_ms = (time.perf_counter() - started) * 1000
        
        # SLA check (PERF-AI-001)
        sla_threshold = SLA_THRESHOLDS.get(config.model, SLA_DEFAULT_THRESHOLD)
        if latency_ms > sla_threshold:
            self._logger.warning(
                "SLA violation",
                extra={
                    "latencyMs": round(latency_ms, 2),
                    "thresholdMs": sla_threshold,
                    "model": config.model,
                    "exceededBy": round(latency_ms - sla_threshold, 2),
                },
            )
        
        return self._parse_response(provider_result, request, latency_ms)

    def _build_user_prompt(self, request: AdviceRequest) -> str:
        """Build the user prompt from request data."""
        payload = {
            "exerciseKey": request.exerciseKey,
            "currentLevel": request.currentLevel,
            "performance": request.performance,
            "goals": request.goals or [],
        }
        context_block = self._format_context(request.context)
        personalization_block = self._format_personalization(request.personalization)
        workout_block = self._format_workout_context(request.workoutContext)  # AI-F02
        return (
            "Ты персональный тренер и помогаешь пользователю прогрессировать в упражнениях.\\n"
            "Ответь строго валидным JSON в формате:\\n"
            f"{self.schema_hint}\\n\\n"
            f"{context_block}{personalization_block}{workout_block}"
            "Используй следующие данные:\\n"
            f"{json.dumps(payload, ensure_ascii=False, indent=2)}\\n\\n"
            "Дай короткое резюме и 2-3 практичных шага."
        )

    def _format_context(self, context: Optional[List[AdviceContextEntry]]) -> str:
        """Format historical context for the prompt (COST-002 optimized)."""
        if not context:
            return ""

        # Limit context entries (COST-002)
        recent_entries = context[-MAX_CONTEXT_ENTRIES:]
        serialized: List[Dict[str, Any]] = []
        for entry in recent_entries:
            # Truncate advice to save tokens (COST-002)
            advice = entry.advice or ""
            if len(advice) > MAX_ADVICE_LENGTH:
                advice = advice[:MAX_ADVICE_LENGTH] + "..."
            
            serialized.append(
                {
                    "exerciseKey": entry.exerciseKey,
                    "currentLevel": entry.currentLevel,
                    "advice": advice,  # Truncated
                    "tips": (entry.tips or [])[:MAX_TIPS_IN_CONTEXT],  # Limited
                    # Removed: nextSteps, goals, performance, createdAt (COST-002)
                }
            )

        return (
            "Контекст (краткий):\\n"
            f"{json.dumps(serialized, ensure_ascii=False)}\\n\\n"
        )

    def _format_personalization(self, personalization: Optional[PersonalizationPayload]) -> str:
        """Format personalization data for the prompt."""
        if not personalization:
            return ""
        summary: Dict[str, Any] = {}
        if personalization.profile:
            profile = personalization.profile.dict(exclude_none=True)
            if profile:
                summary["profile"] = profile
        for key in ("goals", "equipment", "focusAreas", "injuries"):
            value = getattr(personalization, key, None)
            if value:
                summary[key] = value
        if personalization.tone:
            summary["tone"] = personalization.tone
        if personalization.stats:
            stats = personalization.stats.dict(exclude_none=True)
            if stats:
                summary["stats"] = stats
        if personalization.achievements:
            achievements = personalization.achievements.dict(exclude_none=True)
            if achievements:
                summary["achievements"] = achievements
        if personalization.readiness:
            readiness = personalization.readiness.dict(exclude_none=True)
            if readiness:
                summary["readiness"] = readiness
        if not summary:
            return ""
        return (
            "Персональные данные пользователя (учитывай тон и ограничения):\\n"
            f"{json.dumps(summary, ensure_ascii=False, indent=2)}\\n\\n"
        )

    def _format_workout_context(self, workout: Optional[Any]) -> str:
        """Format current workout session context for the prompt (AI-F02)."""
        if not workout:
            return ""
        
        # Import here to avoid circular imports
        from app.models import WorkoutContext
        
        if not isinstance(workout, WorkoutContext):
            return ""
        
        summary: Dict[str, Any] = {}
        
        if workout.disciplineName:
            summary["discipline"] = workout.disciplineName
        if workout.disciplineType:
            summary["type"] = workout.disciplineType
        if workout.exercisesCompleted is not None and workout.exercisesTotal is not None:
            summary["progress"] = f"{workout.exercisesCompleted}/{workout.exercisesTotal}"
        if workout.durationMinutes is not None:
            summary["durationMin"] = workout.durationMinutes
        if workout.status:
            summary["status"] = workout.status
        if workout.currentExerciseIndex is not None:
            summary["currentExercise"] = workout.currentExerciseIndex + 1  # 1-indexed
        
        if not summary:
            return ""
        
        return (
            "Текущая тренировка (учитывай контекст сессии):\\n"
            f"{json.dumps(summary, ensure_ascii=False)}\\n\\n"
        )


    def _parse_response(
        self, provider_result: ProviderResult, request: AdviceRequest, latency_ms: float
    ) -> AdviceResponse:
        """Parse provider response into AdviceResponse."""
        candidate = provider_result.text.strip()
        match = JSON_BLOCK_RE.search(candidate)
        if match:
            candidate = match.group(0)
        try:
            payload = json.loads(candidate)
        except json.JSONDecodeError:
            self._logger.warning("Failed to parse AI response", extra={"responseLength": len(provider_result.text)})
            return self.fallback_response(
                request,
                metadata={
                    "status": "fallback",
                    "reason": "invalid_response",
                },
                latency_ms=latency_ms,
            )

        advice = str(payload.get("advice", "")).strip()
        next_steps = self._normalize_list(payload.get("nextSteps"))
        tips = self._normalize_list(payload.get("tips"))

        if not advice:
            advice = self._fallback_advice(request)
        if not next_steps:
            next_steps = self._default_next_steps(request)
        if not tips:
            tips = ["Следите за техникой и фиксируйте прогресс в приложении."]

        metadata = self._build_metadata(
            status="ok",
            context_used=bool(request.context),
            latency_ms=latency_ms,
            usage=provider_result.usage,
        )
        return AdviceResponse(advice=advice, nextSteps=next_steps, tips=tips, metadata=metadata)

    def _normalize_list(self, value: Any) -> List[str]:
        """Normalize value to list of strings."""
        if isinstance(value, str):
            normalized = value.strip()
            return [normalized] if normalized else []
        if isinstance(value, list):
            result: List[str] = []
            for item in value:
                text = str(item).strip()
                if text:
                    result.append(text)
            return result
        return []

    def _default_next_steps(self, request: AdviceRequest) -> List[str]:
        """Generate default next steps."""
        return [
            f"Удерживайте уровень {request.currentLevel} в упражнении {request.exerciseKey} ещё 1-2 тренировки.",
            "Добавьте прогресс после стабильных повторений и фиксируйте результат в TZONA.",
        ]

    def _fallback_advice(self, request: AdviceRequest) -> str:
        """Generate fallback advice."""
        return (
            f"Продолжайте работать над {request.exerciseKey} на уровне {request.currentLevel}, уделяя внимание контролю "
            "движения и восстановлению."
        )

    def fallback_response(
        self,
        request: AdviceRequest,
        *,
        metadata: Optional[Dict[str, Any]] = None,
        latency_ms: Optional[float] = None,
    ) -> AdviceResponse:
        """Generate fallback response when provider fails."""
        extra = metadata.copy() if metadata else {}
        status = str(extra.get("status")) if extra.get("status") else "fallback"
        base_metadata = self._build_metadata(
            status=status,
            context_used=bool(request.context),
            latency_ms=latency_ms,
            usage=None,
        )
        base_metadata.update(extra)

        return AdviceResponse(
            advice=self._fallback_advice(request),
            nextSteps=self._default_next_steps(request),
            tips=["Следите за дыханием и делайте разминку."],
            metadata=base_metadata,
        )

    def _build_metadata(
        self,
        *,
        status: str,
        context_used: bool,
        latency_ms: Optional[float],
        usage: Optional[ProviderUsage],
    ) -> Dict[str, Any]:
        """Build response metadata."""
        metadata: Dict[str, Any] = {
            "provider": self.provider.name,
            "status": status,
            "contextUsed": context_used,
        }
        if latency_ms is not None:
            metadata["latencyMs"] = round(latency_ms, 2)
        usage_payload = self._usage_metadata(usage)
        if usage_payload:
            metadata["usage"] = usage_payload
            cost_payload = self._estimate_cost(usage)
            if cost_payload:
                metadata["cost"] = cost_payload
        return metadata

    def _usage_metadata(self, usage: Optional[ProviderUsage]) -> Optional[Dict[str, Any]]:
        """Format usage metadata."""
        if not usage:
            return None
        return {
            "promptTokens": usage.prompt_tokens,
            "completionTokens": usage.completion_tokens,
            "totalTokens": usage.total_tokens,
        }

    def _estimate_cost(self, usage: Optional[ProviderUsage]) -> Optional[Dict[str, float]]:
        """Estimate request cost."""
        if not usage:
            return None
        if self._input_cost_per_1k <= 0 and self._output_cost_per_1k <= 0:
            return None
        input_cost = (usage.prompt_tokens / 1000) * self._input_cost_per_1k
        output_cost = (usage.completion_tokens / 1000) * self._output_cost_per_1k
        total = input_cost + output_cost
        return {
            "inputUsd": round(input_cost, 6),
            "outputUsd": round(output_cost, 6),
            "totalUsd": round(total, 6),
        }
