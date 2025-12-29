"""LLM provider helpers for the AI Advisor microservice.

Simplified Gemini-only implementation (MIGRATE-001).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional
import logging


@dataclass(slots=True)
class ProviderUsage:
    """Normalized token usage for a provider response."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass(slots=True)
class ProviderResult:
    text: str
    usage: Optional[ProviderUsage] = None


@dataclass(slots=True)
class ProviderConfig:
    model: str
    temperature: float
    max_output_tokens: int
    api_key: str


@dataclass(slots=True)
class ProviderAPIError(Exception):
    """Represents a normalized downstream provider failure."""

    provider: str
    code: str
    message: str
    retryable: bool = False
    status_code: Optional[int] = None
    details: Optional[Dict[str, Any]] = None

    def __str__(self) -> str:  # pragma: no cover - repr helper
        return f"[{self.provider}] {self.code}: {self.message}"

    @classmethod
    def from_exception(cls, provider: str, exc: Exception) -> "ProviderAPIError":
        status = getattr(exc, "status_code", None) or getattr(exc, "status", None)
        name = exc.__class__.__name__.lower()
        message = str(exc) or f"{provider} provider error"

        code = "provider_error"
        retryable = False

        if status in {500, 502, 503, 504}:
            code = "provider_unavailable"
            retryable = True
        elif status == 429 or ("rate" in name and "limit" in name):
            code = "provider_rate_limited"
            retryable = True
            status = status or 429
        elif status in {408, 499} or "timeout" in name:
            code = "provider_timeout"
            retryable = True
        elif "connection" in name:
            code = "provider_network_error"
            retryable = True

        return cls(
            provider=provider,
            code=code,
            message=message,
            retryable=retryable,
            status_code=status,
            details={"exception": exc.__class__.__name__},
        )


class GeminiAdviceProvider:
    """Gemini LLM provider for AI advice generation."""
    
    name = "gemini"

    def __init__(self, config: ProviderConfig, logger: logging.Logger):
        import google.generativeai as genai

        self._config = config
        self._logger = logger
        genai.configure(api_key=config.api_key)

    def generate(self, *, system_prompt: str, user_prompt: str) -> ProviderResult:
        import google.generativeai as genai

        try:
            # Initialize model with system instruction
            model = genai.GenerativeModel(
                self._config.model,
                system_instruction=system_prompt
            )

            response = model.generate_content(
                user_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=self._config.temperature,
                    max_output_tokens=self._config.max_output_tokens,
                )
            )
            
            # Check if response was blocked or empty
            if not response.parts:
                if response.prompt_feedback:
                    self._logger.warning("Gemini prompt feedback", extra={"feedback": str(response.prompt_feedback)})
                raise ValueError("Gemini returned empty response (possibly blocked)")

            text = response.text
            
            usage = response.usage_metadata
            normalized_usage = None
            if usage:
                normalized_usage = ProviderUsage(
                    prompt_tokens=usage.prompt_token_count,
                    completion_tokens=usage.candidates_token_count,
                    total_tokens=usage.total_token_count
                )

            return ProviderResult(text=text, usage=normalized_usage)

        except Exception as exc:
            raise ProviderAPIError.from_exception("gemini", exc) from exc


class OpenAIAdviceProvider:
    """OpenAI LLM provider for AI advice generation.
    
    Supports GPT-4.1-nano and other OpenAI models.
    """
    
    name = "openai"

    def __init__(self, config: ProviderConfig, logger: logging.Logger):
        from openai import OpenAI
        
        self._client = OpenAI(api_key=config.api_key)
        self._config = config
        self._logger = logger

    def generate(self, *, system_prompt: str, user_prompt: str) -> ProviderResult:
        from openai import APIError, APIConnectionError, RateLimitError
        
        try:
            response = self._client.chat.completions.create(
                model=self._config.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=self._config.temperature,
                max_tokens=self._config.max_output_tokens,
            )
            
            # Extract text from response
            text = response.choices[0].message.content or ""
            
            # Normalize usage
            normalized_usage = None
            if response.usage:
                normalized_usage = ProviderUsage(
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    total_tokens=response.usage.total_tokens,
                )
            
            return ProviderResult(text=text, usage=normalized_usage)
            
        except RateLimitError as exc:
            raise ProviderAPIError(
                provider="openai",
                code="provider_rate_limited",
                message=str(exc),
                retryable=True,
                status_code=429,
            ) from exc
        except APIConnectionError as exc:
            raise ProviderAPIError(
                provider="openai",
                code="provider_network_error",
                message=str(exc),
                retryable=True,
            ) from exc
        except APIError as exc:
            raise ProviderAPIError(
                provider="openai",
                code="provider_error",
                message=str(exc),
                status_code=getattr(exc, "status_code", None),
                retryable=getattr(exc, "status_code", 500) >= 500,
            ) from exc
        except Exception as exc:
            raise ProviderAPIError.from_exception("openai", exc) from exc


def create_provider(kind: str, config: ProviderConfig, logger: logging.Logger):
    """Create an AI provider instance.
    
    Supports:
    - 'openai': OpenAI models (gpt-4.1-nano, gpt-4o-mini, etc.)
    - 'gemini': Google Gemini models
    """
    normalized = kind.strip().lower()
    
    if normalized == "openai":
        return OpenAIAdviceProvider(config, logger)
    elif normalized in {"gemini", "google"}:
        return GeminiAdviceProvider(config, logger)
    
    raise ValueError(
        f"Unsupported AI provider: {kind}. "
        "Supported: 'openai', 'gemini'. Set AI_ADVISOR_PROVIDER in .env"
    )


class ProviderWithFallback:
    """Provider wrapper with model fallback (MS-002).
    
    Falls back from primary model (Flash) to backup model (Pro) on error.
    """
    
    name = "gemini_with_fallback"
    
    def __init__(
        self,
        primary_config: ProviderConfig,
        fallback_config: ProviderConfig,
        logger: logging.Logger,
    ):
        self._primary = GeminiAdviceProvider(primary_config, logger)
        self._fallback = GeminiAdviceProvider(fallback_config, logger)
        self._logger = logger

    def generate(self, *, system_prompt: str, user_prompt: str) -> ProviderResult:
        """Generate with primary, fallback to secondary on error."""
        try:
            return self._primary.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
        except ProviderAPIError as primary_err:
            if not primary_err.retryable:
                raise
            
            self._logger.warning(
                "Primary model failed, trying fallback",
                extra={
                    "primaryError": primary_err.code,
                    "primaryModel": self._primary._config.model,
                    "fallbackModel": self._fallback._config.model,
                },
            )
            
            try:
                result = self._fallback.generate(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                )
                self._logger.info("Fallback model succeeded")
                return result
            except ProviderAPIError:
                # Re-raise original error if fallback also fails
                raise primary_err


__all__ = [
    "GeminiAdviceProvider",
    "OpenAIAdviceProvider",
    "ProviderConfig",
    "ProviderAPIError",
    "ProviderResult",
    "ProviderUsage",
    "ProviderWithFallback",
    "create_provider",
]
