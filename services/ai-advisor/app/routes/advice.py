"""Advice generation routes."""

import logging
import time

from fastapi import APIRouter

from app.models import AdviceRequest, AdviceResponse, ChatRequest, ChatResponse
from app.services import AdviceGenerator
from app.config import config
from providers import ProviderAPIError, ProviderConfig, create_provider, ProviderUsage

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


# ============================================
# SIMPLE CHAT ENDPOINT
# ============================================

CHAT_SYSTEM_PROMPT_BASE = """Ты — «Тренер», персональный AI-помощник в приложении "Training Zone".

## ТВОЯ ЛИЧНОСТЬ
- **Эмоциональный и энергичный**, но требовательный
- **Ироничный**, с хорошим чувством юмора — можешь подколоть за пропуски
- **Друг и наставник**, а не просто инструктор
- **Мотивирующий**, но честный — не льстишь, говоришь правду
- Используешь эмодзи в меру, но уместно (🔥💪💡😤🎉)

## СТИЛЬ ОБЩЕНИЯ
- Называй пользователя на "ты", как друга
- Хвали за успехи конкретно: "Ого, 30 отжиманий! Это +5 к прошлому разу!"
- При пропусках подшучивай: "Диван снова победил? 😏 Ладно, бывает, но завтра без отговорок!"
- Ответы до 100-150 слов, по делу
- Реагируй эмоционально на сообщения

## ИНСТРУМЕНТЫ (TOOLS)
Ты можешь управлять приложением, добавляя специальные команды в конец ответа.
Формат: <tool>{"name": "toolName", "params": {...}}</tool>

Доступные инструменты:
1. **Таймер**: `setTimer`
   - params: `{"seconds": 60}`
   - Пример: "Минута отдыха! <tool>{"name": "setTimer", "params": {"seconds": 60}}</tool>"

2. **Навигация**: `navigate`
   - params: `{"target": "Programs" | "Progress" | "Profile" | "Evolution"}`
   - Пример: "Глянем прогресс! <tool>{"name": "navigate", "params": {"target": "Progress"}}</tool>"

3. **Запись данных**: `recordMetric`
   - params: `{"type": "weight" | "chest" | "biceps" | "waist", "value": 75.5, "unit": "kg" | "cm"}`

4. **Мотивация**: `generateMotivation`
   - params: `{"quote": "Текст", "author": "Автор", "theme": "fire" | "calm"}`

## РЕАКЦИИ
В начале ответа можешь добавить свою реакцию на сообщение пользователя:
- 🔥 — когда пользователь делится успехом или рекордом
- 💪 — мотивация, поддержка
- 😤 — лёгкое недовольство (пропуски, отговорки)
- 🤔 — вопрос или совет
- 🎉 — поздравление
- 😏 — ирония, подкол

## РЕЖИМ "ROAST" (если попросят):
Будь саркастичным, жёстко критикуй пропуски с чёрным юмором, но в конце мотивируй.

## ВАЖНО
- Не спрашивай "хочешь поставлю таймер?" — просто ставь
- Инструменты скрыты от пользователя
- Используй ТОЛЬКО данные из раздела "ДАННЫЕ ПОЛЬЗОВАТЕЛЯ"
- Если данных мало — спроси, чтобы узнать больше"""


def build_personalized_system_prompt(context) -> str:
    """Build system prompt enriched with FULL user context from database."""
    prompt_parts = [CHAT_SYSTEM_PROMPT_BASE]
    
    if context:
        # USE PRE-CALCULATED SUMMARY IF AVAILABLE
        if context.summaryText:
            prompt_parts.append("\n=== ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ===")
            prompt_parts.append(context.summaryText)
            return "\n".join(prompt_parts)

        # FALLBACK: Construct summary from structured data
        sections = []
        
        # === ПРОФИЛЬ ===
        profile_info = []
        if context.firstName:
            profile_info.append(f"Имя: {context.firstName}")
        if context.timezone:
            profile_info.append(f"Часовой пояс: {context.timezone}")
        if context.goals and len(context.goals) > 0:
            profile_info.append(f"Цели: {', '.join(context.goals)}")
        if context.equipment and len(context.equipment) > 0:
            profile_info.append(f"Оборудование: {', '.join(context.equipment)}")
        if profile_info:
            sections.append("📋 ПРОФИЛЬ:\n" + "\n".join(f"  • {x}" for x in profile_info))
        
        # === ТЕКУЩАЯ ПРОГРАММА ===
        program_info = []
        if context.currentProgram:
            program_info.append(f"Программа: {context.currentProgram}")
        if context.currentDiscipline:
            program_info.append(f"Дисциплина: {context.currentDiscipline}")
        if context.currentLevels and len(context.currentLevels) > 0:
            levels_str = ", ".join(f"{k}:{v}" for k, v in list(context.currentLevels.items())[:6])
            program_info.append(f"Текущие уровни: {levels_str}")
        if program_info:
            sections.append("🏋️ ТЕКУЩАЯ ПРОГРАММА:\n" + "\n".join(f"  • {x}" for x in program_info))
        
        # === СТАТИСТИКА ТРЕНИРОВОК ===
        stats_info = []
        if context.totalSessions is not None:
            stats_info.append(f"Всего сессий: {context.totalSessions}")
        if context.completedSessions is not None:
            stats_info.append(f"Завершено: {context.completedSessions}")
        if context.skippedSessions is not None:
            stats_info.append(f"Пропущено: {context.skippedSessions}")
        if context.lastSessionDate:
            status_map = {"done": "✅ завершена", "skipped": "⏭️ пропущена", "planned": "📅 запланирована"}
            status = status_map.get(context.lastSessionStatus, context.lastSessionStatus or "")
            stats_info.append(f"Последняя ({context.lastSessionDate}): {status}")
        if stats_info:
            sections.append("📊 СТАТИСТИКА ТРЕНИРОВОК:\n" + "\n".join(f"  • {x}" for x in stats_info))
        
        # === ПРОГРЕСС ПО УПРАЖНЕНИЯМ ===
        if context.exerciseProgress and len(context.exerciseProgress) > 0:
            progress_lines = []
            for p in context.exerciseProgress[:6]:
                rpe_str = f", RPE {p.lastRpe}" if p.lastRpe else ""
                streak_str = f", серия {p.streak}" if p.streak > 0 else ""
                progress_lines.append(f"  • {p.key}: уровень {p.currentLevel}{streak_str}{rpe_str}")
            sections.append("📈 ПРОГРЕСС ПО УПРАЖНЕНИЯМ:\n" + "\n".join(progress_lines))
        
        # === ДОСТИЖЕНИЯ ===
        if context.achievementsCount is not None and context.achievementsCount > 0:
            achievements_line = f"🏆 ДОСТИЖЕНИЯ: {context.achievementsCount} получено"
            if context.recentAchievements and len(context.recentAchievements) > 0:
                achievements_line += f"\n  Последние: {', '.join(context.recentAchievements)}"
            sections.append(achievements_line)
        
        # === ИЗМЕРЕНИЯ ТЕЛА ===
        metrics_info = []
        if context.latestWeight is not None:
            metrics_info.append(f"Вес: {context.latestWeight} кг")
        if context.latestMetrics and len(context.latestMetrics) > 0:
            for m in context.latestMetrics[:4]:
                if m.type != "weight":
                    metrics_info.append(f"{m.type}: {m.value} {m.unit}")
        if metrics_info:
            sections.append("📏 ИЗМЕРЕНИЯ ТЕЛА:\n" + "\n".join(f"  • {x}" for x in metrics_info))
        
        # === ФОТО ПРОГРЕССА ===
        if context.photosCount is not None and context.photosCount > 0:
            photos_line = f"📸 ФОТО: {context.photosCount} фото"
            if context.lastPhotoDate:
                photos_line += f" (последнее: {context.lastPhotoDate})"
            sections.append(photos_line)
        
        # === ИЗБРАННОЕ ===
        if context.favoriteExercises and len(context.favoriteExercises) > 0:
            sections.append(f"⭐ ИЗБРАННЫЕ УПРАЖНЕНИЯ: {', '.join(context.favoriteExercises)}")
        
        if sections:
            prompt_parts.append("\n\n" + "=" * 40)
            prompt_parts.append("ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ИЗ БАЗЫ ДАННЫХ:")
            prompt_parts.append("=" * 40)
            prompt_parts.append("\n\n".join(sections))
            prompt_parts.append("\n" + "=" * 40)
            prompt_parts.append("Отвечай ТОЛЬКО на основе этих данных!")
    
    return "\n".join(prompt_parts)


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Simple chat endpoint for conversational AI with personalization."""
    started = time.perf_counter()
    
    try:
        # Build personalized system prompt
        system_prompt = build_personalized_system_prompt(request.context)
        
        # Build messages for OpenAI
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add history if provided
        if request.history:
            for msg in request.history[-10:]:  # Last 10 messages
                if msg.get("role") in ("user", "assistant") and msg.get("content"):
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
        
        # Add current message
        messages.append({"role": "user", "content": request.message})
        
        # Create provider and generate
        provider_config = ProviderConfig(
            model=config.model,
            temperature=config.temperature,
            max_output_tokens=config.max_tokens,
            api_key=config.get_api_key(),
        )
        provider = create_provider(config.provider, provider_config, logger)
        
        # Generate using system+user prompt format
        result = provider.generate(
            system_prompt=system_prompt,
            user_prompt=request.message
        )
        
        duration_ms = (time.perf_counter() - started) * 1000
        
        # Build metadata
        metadata = {
            "provider": config.provider,
            "model": config.model,
            "latencyMs": round(duration_ms, 2),
        }
        
        if result.usage:
            metadata["usage"] = {
                "promptTokens": result.usage.prompt_tokens,
                "completionTokens": result.usage.completion_tokens,
                "totalTokens": result.usage.total_tokens,
            }
        
        if metrics_recorder:
            metrics_recorder.increment_counter("chats.generated")
            metrics_recorder.observe_operation(
                "chat",
                duration_ms=duration_ms,
                success=True,
                metadata={"provider": config.provider},
            )
        
        return ChatResponse(reply=result.text, metadata=metadata)
        
    except ProviderAPIError as exc:
        logger.warning(
            "Chat provider error",
            extra={
                "provider": exc.provider,
                "code": exc.code,
                "retryable": exc.retryable,
            },
        )
        
        if metrics_recorder:
            metrics_recorder.observe_operation(
                "chat",
                duration_ms=(time.perf_counter() - started) * 1000,
                success=False,
                error=exc.code,
            )
        
        # Return friendly error message
        return ChatResponse(
            reply="Извини, не удалось получить ответ. Попробуй ещё раз через минуту 🙏",
            metadata={
                "status": "error",
                "errorCode": exc.code,
                "retryable": exc.retryable,
            }
        )
    except Exception as exc:
        logger.exception("Unexpected chat error")
        return ChatResponse(
            reply="Произошла ошибка. Попробуй позже.",
            metadata={"status": "error", "errorCode": "internal_error"}
        )

