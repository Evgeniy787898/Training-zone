"""Simple trace context propagation for FastAPI services."""

import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

TRACE_HEADER = "x-trace-id"


def _coerce_trace_id(value: str | None) -> str:
    if value and value.strip():
        return value.strip()
    return uuid.uuid4().hex


class TraceMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, header_name: str = TRACE_HEADER):
        super().__init__(app)
        self.header_name = header_name

    async def dispatch(self, request: Request, call_next: Callable[[Request], Response]) -> Response:  # type: ignore[override]
        trace_id = _coerce_trace_id(request.headers.get(self.header_name) or request.headers.get("traceparent"))
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers[self.header_name] = trace_id
        return response


def get_trace_id(request: Request) -> str:
    value = getattr(request.state, "trace_id", None)
    return _coerce_trace_id(value)
