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


# ============================================
# STREAMING SSE ENDPOINT (BE-V03)
# ============================================

from fastapi.responses import StreamingResponse
import asyncio
import json


async def stream_advice_generator(request: AdviceRequest):
    """Generate advice with SSE streaming (BE-V03).
    
    Yields SSE events:
    - event: start - Initial connection
    - event: chunk - Text chunk
    - event: done - Final response with metadata
    - event: error - Error message
    """
    started = time.perf_counter()
    
    # Send start event
    yield f"event: start\ndata: {json.dumps({'status': 'generating'})}\n\n"
    
    try:
        # Generate full response (TODO: integrate with streaming Gemini API)
        response = await advice_generator.generate(request)
        
        # Simulate streaming by chunking the advice
        advice_text = response.advice or ""
        chunk_size = 20  # Characters per chunk
        
        for i in range(0, len(advice_text), chunk_size):
            chunk = advice_text[i:i + chunk_size]
            yield f"event: chunk\ndata: {json.dumps({'text': chunk})}\n\n"
            await asyncio.sleep(0.05)  # 50ms between chunks
        
        # Send done event with full response
        duration_ms = (time.perf_counter() - started) * 1000
        done_data = {
            "status": "complete",
            "advice": response.advice,
            "tips": response.tips,
            "nextSteps": response.nextSteps,
            "latencyMs": round(duration_ms, 2),
        }
        yield f"event: done\ndata: {json.dumps(done_data, ensure_ascii=False)}\n\n"
        
        if metrics_recorder:
            metrics_recorder.increment_counter("advices.streamed")
            
    except ProviderAPIError as exc:
        error_data = {
            "status": "error",
            "code": exc.code,
            "message": str(exc),
            "retryable": exc.retryable,
        }
        yield f"event: error\ndata: {json.dumps(error_data)}\n\n"
        
    except Exception as exc:
        error_data = {
            "status": "error",
            "code": "internal_error",
            "message": str(exc),
        }
        yield f"event: error\ndata: {json.dumps(error_data)}\n\n"


@router.post("/api/advice/stream")
async def stream_advice(request: AdviceRequest):
    """Stream AI advice via Server-Sent Events (BE-V03).
    
    Returns chunked text for real-time rendering like ChatGPT.
    Events: start, chunk, done, error
    """
    return StreamingResponse(
        stream_advice_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
