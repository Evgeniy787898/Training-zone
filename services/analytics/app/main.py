import logging
import os
import sys
from pathlib import Path

# Ensure we can import 'app' package
# If running as script, add parent directory to sys.path
if __name__ == "__main__" or True:
    # We always do this because even with uvicorn main:app, if main is app/main.py, we might need it?
    # Actually, if running via symlink main.py -> app/main.py, __file__ resolves to app/main.py
    # We need services/analytics in path
    # Add services directory to path
    SERVICES_DIR = Path(__file__).resolve().parent.parent.parent
    # Explicitly add the parent directory (services) to sys.path
    sys.path.insert(0, str(SERVICES_DIR))
    print(f"DEBUG: Added {SERVICES_DIR} to sys.path")

    # Ensure current directory is in path for 'app' import
    CURRENT_DIR = Path(__file__).resolve().parent
    if str(CURRENT_DIR) not in sys.path:
        sys.path.insert(0, str(CURRENT_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.globals import (
    database,
    metrics_recorder,
    realtime_broadcaster,
    LOGGER,
)
from app.routes import analytics, health

# Shared modules
from python_shared.graceful_shutdown import GracefulShutdownManager
from python_shared.metrics import MetricsMiddleware
from python_shared.tracing import TraceMiddleware
from python_shared.rate_limit import RateLimitConfig, RateLimitMiddleware, RateLimiter

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

shutdown_manager = GracefulShutdownManager(service="analytics", logger=LOGGER)

app = FastAPI(title="TZONA Analytics", version="1.0.0", lifespan=shutdown_manager.lifespan())

app.add_middleware(TraceMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rate_limit_config = RateLimitConfig.from_env("ANALYTICS")
rate_limiter = RateLimiter(rate_limit_config)
app.add_middleware(
    RateLimitMiddleware,
    limiter=rate_limiter,
    config=rate_limit_config,
)

app.add_middleware(MetricsMiddleware, recorder=metrics_recorder)

# Register routes
app.include_router(health.router)
app.include_router(analytics.router)

# Register startup/shutdown events
@app.on_event("startup")
async def _connect_database() -> None:
    await database.connect()
    realtime_broadcaster.start()

@shutdown_manager.callback
def _log_shutdown_metrics() -> None:
    LOGGER.info("analytics metrics snapshot", extra={"metrics": metrics_recorder.snapshot()})

@shutdown_manager.callback
async def _close_database() -> None:
    await database.disconnect()
    await realtime_broadcaster.stop()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3004)
