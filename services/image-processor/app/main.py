"""Image Processor Service - Main application."""

import logging
import os
import sys
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from starlette import status
from starlette.responses import Response

# Add services directory to path
SERVICES_DIR = Path(__file__).resolve().parent.parent.parent
# Explicitly add the parent directory (services) to sys.path
sys.path.insert(0, str(SERVICES_DIR))
print(f"DEBUG: Added {SERVICES_DIR} to sys.path")

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
from app.routes import process
from app.services import ImageProcessor

# Setup logging
logging.basicConfig(level=config.log_level)
logger = logging.getLogger("tzona.image_processor")

# Shutdown manager
shutdown_manager = GracefulShutdownManager(service="image-processor", logger=logger)

# Create FastAPI app
app = FastAPI(title="TZONA Image Processor", version="1.0.0", lifespan=shutdown_manager.lifespan())

# Middleware
REQUEST_ID_HEADER = "X-Request-ID"

app.add_middleware(TraceMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
rate_limit_config = RateLimitConfig.from_env("IMAGE_PROCESSOR")
rate_limiter = RateLimiter(rate_limit_config)
app.add_middleware(
    RateLimitMiddleware,
    limiter=rate_limiter,
    config=rate_limit_config,
)

# Metrics
metrics_recorder = MetricsRecorder(
    service="image-processor",
    environment=config.environment,
)
app.add_middleware(MetricsMiddleware, recorder=metrics_recorder)

# Health reporter
health_reporter = HealthReporter(service="image-processor", version=app.version or "unknown")


def _runtime_config_check() -> HealthCheckResult:
    """Check runtime configuration."""
    return HealthCheckResult.ok(
        allowedFormats=list(config.allowed_formats),
        allowedModes=list(config.allowed_modes),
        maxDimension=config.max_dimension,
    )


def _pillow_check() -> HealthCheckResult:
    """Check PIL/Pillow functionality."""
    try:
        import io
        buffer = io.BytesIO()
        image = Image.new("RGB", (2, 2), color=(255, 0, 0))
        image.save(buffer, format="PNG")
        return HealthCheckResult.ok(pillowVersion=Image.__version__)
    except Exception as exc:
        return HealthCheckResult.error(error=str(exc))


health_reporter.register("runtime", _runtime_config_check)
health_reporter.register("pillow", _pillow_check)

# Initialize image processor
image_processor = ImageProcessor(logger, metrics_recorder)

# Set global instances for routes
process.image_processor = image_processor

# Register routes
app.include_router(process.router)


@app.get("/api/health")
async def health_endpoint():
    """Health check endpoint."""
    return await health_reporter.snapshot()


@app.get("/api/metrics")
async def metrics_endpoint():
    """Metrics endpoint."""
    return metrics_recorder.snapshot()


# Request context middleware
@app.middleware("http")
async def request_context(request: Request, call_next):
    """Add request ID and timing."""
    import time
    request_id = request.headers.get(REQUEST_ID_HEADER) or uuid4().hex
    request.state.request_id = request_id
    start = time.perf_counter()
    try:
        response: Response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "request.failed",
            extra={
                "path": request.url.path,
                "method": request.method,
                "request_id": request_id,
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "request.completed",
        extra={
            "path": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "request_id": request_id,
            "duration_ms": round(duration_ms, 2),
        },
    )
    response.headers.setdefault(REQUEST_ID_HEADER, request_id)
    return response


# Error handlers
@app.exception_handler(HTTPException)
async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions."""
    request_id = getattr(request.state, "request_id", uuid4().hex)
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    logger.warning(
        "request.http_error",
        extra={
            "path": request.url.path,
            "method": request.method,
            "status_code": exc.status_code,
            "request_id": request_id,
        },
    )
    code = "bad_request" if exc.status_code < status.HTTP_500_INTERNAL_SERVER_ERROR else "server_error"
    return JSONResponse(
        status_code=exc.status_code,
        headers={REQUEST_ID_HEADER: request_id},
        content={
            "error": {
                "code": code,
                "message": message,
                "requestId": request_id,
            }
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_exception(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    request_id = getattr(request.state, "request_id", uuid4().hex)
    logger.exception(
        "request.unhandled_error",
        extra={
            "path": request.url.path,
            "method": request.method,
            "request_id": request_id,
        },
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        headers={REQUEST_ID_HEADER: request_id},
        content={
            "error": {
                "code": "internal_error",
                "message": "Internal server error",
                "requestId": request_id,
            }
        },
    )


@shutdown_manager.callback
def _log_shutdown_metrics() -> None:
    """Log metrics on shutdown."""
    logger.info("image-processor metrics snapshot", extra={"metrics": metrics_recorder.snapshot()})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.host, port=config.port)
