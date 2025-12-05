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

# Initialize advice generator
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


@shutdown_manager.callback
def _log_shutdown_metrics() -> None:
    """Log metrics on shutdown."""
    logger.info("ai-advisor metrics snapshot", extra={"metrics": metrics_recorder.snapshot()})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.host, port=config.port)
