"""AI Advisor Service - Core business logic."""

import asyncio
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional

from app.config import config
from app.models import (
    AdviceContextEntry,
    AdviceRequest,
    AdviceResponse,
    PersonalizationPayload,
)
from providers import ProviderAPIError, ProviderConfig, ProviderResult, ProviderUsage, create_provider

# JSON extraction pattern
JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


class AdviceGenerator:
    """Generates personalized exercise advice using LLM providers."""

    def __init__(self, logger: logging.Logger) -> None:
        self._logger = logger
        self._base_prompt = config.base_prompt

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
        """Generate advice for an exercise."""
        user_prompt = self._build_user_prompt(request)
        started = time.perf_counter()
        provider_result = await asyncio.to_thread(
            self.provider.generate,
            system_prompt=self._base_prompt,
            user_prompt=user_prompt,
        )
        latency_ms = (time.perf_counter() - started) * 1000
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
        return (
            "Ты персональный тренер и помогаешь пользователю прогрессировать в упражнениях.\\n"
            "Ответь строго валидным JSON в формате:\\n"
            f"{self.schema_hint}\\n\\n"
            f"{context_block}{personalization_block}"
            "Используй следующие данные:\\n"
            f"{json.dumps(payload, ensure_ascii=False, indent=2)}\\n\\n"
            "Дай короткое резюме и 2-3 практичных шага."
        )

    def _format_context(self, context: Optional[List[AdviceContextEntry]]) -> str:
        """Format historical context for the prompt."""
        if not context:
            return ""

        recent_entries = context[-5:]
        serialized: List[Dict[str, Any]] = []
        for entry in recent_entries:
            serialized.append(
                {
                    "exerciseKey": entry.exerciseKey,
                    "currentLevel": entry.currentLevel,
                    "advice": entry.advice,
                    "nextSteps": entry.nextSteps or [],
                    "tips": entry.tips or [],
                    "goals": entry.goals or [],
                    "performance": entry.performance or {},
                    "createdAt": entry.createdAt,
                }
            )

        return (
            "История последних советов (используй для персонализации, не повторяй дословно):\\n"
            f"{json.dumps(serialized, ensure_ascii=False, indent=2)}\\n\\n"
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
            self._logger.warning("Failed to parse AI response", extra={"response": provider_result.text})
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
