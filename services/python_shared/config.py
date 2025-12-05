"""Shared configuration helpers for TZONA microservices."""

import os
from typing import Optional


def parse_int(value: str | None, default: int) -> int:
    """Parse integer from environment variable with fallback.
    
    Args:
        value: String value to parse
        default: Default value if parsing fails
        
    Returns:
        Parsed integer or default
    """
    if not value:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def parse_float(value: str | None, default: float) -> float:
    """Parse float from environment variable with fallback.
    
    Args:
        value: String value to parse
        default: Default value if parsing fails
        
    Returns:
        Parsed float or default
    """
    if not value:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def parse_bool(value: str | None, default: bool) -> bool:
    """Parse boolean from environment variable with fallback.
    
    Args:
        value: String value to parse (1/true/yes/on for True)
        default: Default value if parsing fails
        
    Returns:
        Parsed boolean or default
    """
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off", ""}:
        return False
    return default


def parse_str(value: str | None, default: str) -> str:
    """Parse string from environment variable with fallback.
    
    Args:
        value: String value
        default: Default value if value is None or empty
        
    Returns:
        Stripped string or default
    """
    if not value:
        return default
    stripped = value.strip()
    return stripped if stripped else default


class BaseServiceConfig:
    """Base configuration class for TZONA microservices.
    
    All services should extend this class and add their specific config fields.
    """

    def __init__(self) -> None:
        """Initialize base service configuration from environment."""
        self.port = parse_int(os.getenv("PORT"), 3000)
        self.host = os.getenv("HOST", "0.0.0.0")
        self.log_level = parse_str(os.getenv("LOG_LEVEL"), "INFO")
        self.environment = parse_str(os.getenv("ENVIRONMENT"), "unknown")
