"""Advice generation routes."""

import logging
import time

from fastapi import APIRouter

from app.models import AdviceRequest, AdviceResponse
from app.services import AdviceGenerator
from providers import ProviderAPIError

# Global instances (will be set in main.py)
advice_generator: AdviceGenerator = None  # type: ignore
metrics_recorder = None  # type: ignore
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/generate-advice", response_model=AdviceResponse)
async def generate_advice(request: AdviceRequest):
    """Generate personalized advice for an exercise."""
    started = time.perf_counter()
    try:
        response = await advice_generator.generate(request)
        if metrics_recorder:
            metrics_recorder.increment_counter("advices.generated")
            metrics_recorder.observe_operation(
                "generate_advice",
                duration_ms=(time.perf_counter() - started) * 1000,
                success=True,
                metadata={
                    "exerciseKey": request.exerciseKey,
                    "currentLevel": request.currentLevel,
                    "provider": advice_generator.provider.name,
                },
            )
        return response
    except ProviderAPIError as exc:
        duration_ms = (time.perf_counter() - started) * 1000
        logger.warning(
            "ai provider error",
            extra={
                "provider": exc.provider,
                "code": exc.code,
                "retryable": exc.retryable,
                "status": exc.status_code,
            },
        )
        if metrics_recorder:
            metrics_recorder.observe_operation(
                "generate_advice",
                duration_ms=duration_ms,
                success=False,
                error=exc.code,
                metadata={
                    "provider": exc.provider,
                    "retryable": exc.retryable,
                },
            )
        return advice_generator.fallback_response(
            request,
            metadata={
                "status": "provider_error",
                "providerErrorCode": exc.code,
                "retryable": exc.retryable,
                "providerStatusCode": exc.status_code,
            },
            latency_ms=duration_ms,
        )
    except Exception as exc:
        duration_ms = (time.perf_counter() - started) * 1000
        if metrics_recorder:
            metrics_recorder.observe_operation(
                "generate_advice",
                duration_ms=duration_ms,
                success=False,
                error=str(exc),
            )
        raise
