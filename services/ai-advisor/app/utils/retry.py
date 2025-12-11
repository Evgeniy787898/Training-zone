"""Retry utilities with exponential backoff for AI provider calls."""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")


async def retry_with_backoff(
    fn: Callable[[], Awaitable[T]],
    *,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    jitter: float = 0.5,
    is_retryable: Callable[[Exception], bool] = lambda e: True,
    logger: logging.Logger | None = None,
) -> T:
    """Execute async function with exponential backoff retry.
    
    Args:
        fn: Async function to execute.
        max_retries: Maximum number of retry attempts (default: 3).
        base_delay: Initial delay in seconds (default: 1.0).
        max_delay: Maximum delay cap in seconds (default: 30.0).
        jitter: Random jitter factor 0-1 (default: 0.5).
        is_retryable: Predicate to check if exception is retryable.
        logger: Optional logger for retry attempts.
    
    Returns:
        Result from successful function call.
    
    Raises:
        Last exception if all retries exhausted.
    """
    last_error: Exception | None = None
    
    for attempt in range(max_retries + 1):
        try:
            return await fn()
        except Exception as exc:
            last_error = exc
            
            # Check if we should retry
            if attempt >= max_retries:
                if logger:
                    logger.warning(
                        "All retries exhausted",
                        extra={"attempts": attempt + 1, "error": str(exc)},
                    )
                raise
            
            if not is_retryable(exc):
                if logger:
                    logger.debug(
                        "Error not retryable, failing immediately",
                        extra={"error": str(exc)},
                    )
                raise
            
            # Calculate delay with exponential backoff and jitter
            delay = min(base_delay * (2 ** attempt), max_delay)
            jitter_amount = delay * jitter * random.random()
            actual_delay = delay + jitter_amount
            
            if logger:
                logger.info(
                    "Retrying after error",
                    extra={
                        "attempt": attempt + 1,
                        "max_retries": max_retries,
                        "delay_seconds": round(actual_delay, 2),
                        "error": str(exc),
                    },
                )
            
            await asyncio.sleep(actual_delay)
    
    # Should not reach here, but satisfy type checker
    assert last_error is not None
    raise last_error


__all__ = ["retry_with_backoff"]
