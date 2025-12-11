"""AI Advisor Service - Main application."""

import logging
import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add services directory to path
# Add services directory to path
SERVICES_DIR = Path(__file__).resolve().parent.parent.parent
# Explicitly add the parent directory (services) to sys.path
sys.path.insert(0, str(SERVICES_DIR))
print(f"DEBUG: File: {Path(__file__).resolve()}")
print(f"DEBUG: Services Dir: {SERVICES_DIR}")
print(f"DEBUG: sys.path[0]: {sys.path[0]}")

# Ensure current directory is in path for 'app' import
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from python_shared.graceful_shutdown import GracefulShutdownManager
from python_shared.health import HealthCheckResult, HealthReporter
from python_shared.metrics import MetricsMiddleware, MetricsRecorder
from python_shared.rate_limit import RateLimitConfig, RateLimitMiddleware, RateLimiter
from python_shared.tracing import TraceMiddleware

from app.config import config
from app.routes import advice, health
from app.services import AdviceGenerator

# Setup logging
logging.basicConfig(level=config.log_level)
logger = logging.getLogger("tzona.ai_advisor")

# Validate configuration
try:
    config.validate()
except RuntimeError as e:
    logger.error(f"Configuration error: {e}")
    raise

# Shutdown manager
shutdown_manager = GracefulShutdownManager(service="ai-advisor", logger=logger)

# Create FastAPI app
app = FastAPI(title="TZONA AI Advisor", version="1.0.0", lifespan=shutdown_manager.lifespan())

# Middleware
app.add_middleware(TraceMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
rate_limit_config = RateLimitConfig.from_env("AI_ADVISOR")
rate_limiter = RateLimiter(rate_limit_config)
app.add_middleware(
    RateLimitMiddleware,
    limiter=rate_limiter,
    config=rate_limit_config,
)

# Metrics
metrics_recorder = MetricsRecorder(
    service="ai-advisor",
    environment=config.environment,
)
app.add_middleware(MetricsMiddleware, recorder=metrics_recorder)

# Health reporter
health_reporter = HealthReporter(service="ai-advisor", version=app.version or "unknown")


def _config_health() -> HealthCheckResult:
    """Check configuration health."""
    try:
        config.validate()
        return HealthCheckResult.ok(model=config.model)
    except RuntimeError as e:
        return HealthCheckResult.degraded(reason=str(e))


def _prompt_template_health() -> HealthCheckResult:
    """Check prompt template health."""
    if not config.base_prompt:
        return HealthCheckResult.degraded(reason="base prompt not configured")
    return HealthCheckResult.ok(promptLength=len(config.base_prompt))


def _provider_credentials_health() -> HealthCheckResult:
    """Check provider credentials health."""
    try:
        api_key = config.get_api_key()
        return HealthCheckResult.ok(provider=config.provider)
    except RuntimeError as e:
        return HealthCheckResult.degraded(reason=str(e))


health_reporter.register("config", _config_health)
health_reporter.register("promptTemplate", _prompt_template_health)
health_reporter.register("providerCredentials", _provider_credentials_health)


async def _llm_connectivity_health() -> HealthCheckResult:
    """Check LLM provider connectivity with a minimal test request (AI-I01)."""
    import time
    try:
        # Lazy import to avoid circular dependencies
        from providers import create_provider, ProviderConfig, ProviderAPIError
        
        start = time.time()
        provider_config = ProviderConfig(
            model=config.model,
            temperature=0.1,
            max_output_tokens=10,  # Minimal tokens for quick test
            api_key=config.get_api_key(),
        )
        provider = create_provider(config.provider, provider_config, logger)
        
        # Lightweight test prompt
        result = provider.generate(
            system_prompt="You are a test assistant.",
            user_prompt="Say 'ok'"
        )
        latency_ms = round((time.time() - start) * 1000)
        
        if result.text:
            return HealthCheckResult.ok(
                provider=config.provider,
                model=config.model,
                latencyMs=latency_ms,
                responsePreview=result.text[:20] if result.text else ""
            )
        return HealthCheckResult.degraded(reason="Empty response from LLM")
    except ProviderAPIError as e:
        return HealthCheckResult.error(
            provider=config.provider,
            code=e.code,
            message=str(e),
            retryable=e.retryable
        )
    except Exception as e:
        return HealthCheckResult.error(
            provider=config.provider,
            error=str(e)
        )


health_reporter.register("llmConnectivity", _llm_connectivity_health)
advice_generator = AdviceGenerator(logger)

# Set global instances for routes
advice.advice_generator = advice_generator
advice.metrics_recorder = metrics_recorder

# Register routes
app.include_router(advice.router)


@app.get("/api/health")
async def health_endpoint():
    """Health check endpoint."""
    return await health_reporter.snapshot()


@app.get("/api/metrics")
async def metrics_endpoint():
    """Metrics endpoint."""
    return metrics_recorder.snapshot()


@app.get("/api/usage")
async def usage_endpoint():
    """Usage statistics endpoint (COST-003)."""
    from app.services.usage_tracker import usage_tracker
    return usage_tracker.get_summary()


@shutdown_manager.callback
def _log_shutdown_metrics() -> None:
    """Log metrics on shutdown."""
    logger.info("ai-advisor metrics snapshot", extra={"metrics": metrics_recorder.snapshot()})


if __name__ == "__main__":
    import uvicorn

    is_dev = config.environment in ("development", "dev", "local")
    uvicorn.run(
        "main:app" if is_dev else app,
        host=config.host,
        port=config.port,
        reload=is_dev,
    )

