"""LLM provider helpers for the AI Advisor microservice."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Protocol
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


class AdviceProvider(Protocol):
    """Common interface for the downstream LLM providers."""

    name: str

    def generate(self, *, system_prompt: str, user_prompt: str) -> ProviderResult:
        """Return the provider result for the provided prompts."""


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


class OpenAIAdviceProvider:
    name = "openai"

    def __init__(self, config: ProviderConfig, logger: logging.Logger):
        from openai import OpenAI

        self._config = config
        self._client = OpenAI(api_key=config.api_key or None)
        self._logger = logger

    def generate(self, *, system_prompt: str, user_prompt: str) -> ProviderResult:
        try:
            completion = self._client.chat.completions.create(
                model=self._config.model,
                temperature=self._config.temperature,
                max_tokens=self._config.max_output_tokens,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:  # pragma: no cover - network errors handled at runtime
            raise ProviderAPIError.from_exception("openai", exc) from exc

        choice = completion.choices[0]
        content = choice.message.content
        if isinstance(content, list):
            # The SDK may return a list of content parts; concatenate text blocks.
            combined = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
            )
            self._logger.debug("openai content parts merged", extra={"parts": len(content)})
            text = combined
        else:
            text = content or ""

        usage = getattr(completion, "usage", None)
        normalized_usage = None
        if usage:
            prompt_tokens = _safe_int(getattr(usage, "prompt_tokens", 0))
            completion_tokens = _safe_int(getattr(usage, "completion_tokens", 0))
            total_tokens = _safe_int(getattr(usage, "total_tokens", prompt_tokens + completion_tokens))
            normalized_usage = ProviderUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
            )

        return ProviderResult(text=text, usage=normalized_usage)


class ClaudeAdviceProvider:
    name = "claude"

    def __init__(self, config: ProviderConfig):
        import anthropic

        self._config = config
        self._client = anthropic.Anthropic(api_key=config.api_key)

    def generate(self, *, system_prompt: str, user_prompt: str) -> ProviderResult:
        try:
            response = self._client.messages.create(
                model=self._config.model,
                temperature=self._config.temperature,
                max_tokens=self._config.max_output_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
        except Exception as exc:  # pragma: no cover - network errors handled at runtime
            raise ProviderAPIError.from_exception("claude", exc) from exc

        text_chunks = []
        for block in response.content:
            block_type = getattr(block, "type", None)
            if block_type == "text":
                text_chunks.append(getattr(block, "text", ""))
        usage = getattr(response, "usage", None)
        normalized_usage = None
        if usage:
            prompt_tokens = _safe_int(getattr(usage, "input_tokens", 0))
            completion_tokens = _safe_int(getattr(usage, "output_tokens", 0))
            total_tokens = _safe_int(getattr(usage, "total_tokens", prompt_tokens + completion_tokens))
            normalized_usage = ProviderUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
            )

        return ProviderResult(text="".join(text_chunks), usage=normalized_usage)


class GeminiAdviceProvider:
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


def create_provider(kind: str, config: ProviderConfig, logger: logging.Logger) -> AdviceProvider:
    normalized = kind.strip().lower()
    if normalized in {"openai", "gpt"}:
        return OpenAIAdviceProvider(config, logger)
    if normalized in {"claude", "anthropic"}:
        return ClaudeAdviceProvider(config)
    if normalized in {"gemini", "google"}:
        return GeminiAdviceProvider(config, logger)
    raise ValueError(f"Unsupported AI provider: {kind}")


__all__ = [
    "AdviceProvider",
    "ProviderConfig",
    "ProviderAPIError",
    "OpenAIAdviceProvider",
    "ClaudeAdviceProvider",
    "create_provider",
    "ProviderResult",
    "ProviderUsage",
]


def _safe_int(value: Any) -> int:
    try:
        return int(value) if value is not None else 0
    except (TypeError, ValueError):
        return 0
