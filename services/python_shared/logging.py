"""Shared logging setup for TZONA microservices."""

import logging
import sys
from typing import Optional


def setup_logger(
    service_name: str,
    log_level: str = "INFO",
    format_string: Optional[str] = None,
) -> logging.Logger:
    """Setup and return a configured logger for a TZONA microservice.
    
    Args:
        service_name: Name of the service (e.g., "ai-advisor", "analytics")
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        format_string: Optional custom format string
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(f"tzona.{service_name}")
    
    # Avoid duplicate handlers if setup is called multiple times
    if logger.handlers:
        return logger
    
    # Set log level
    level = getattr(logging, log_level.upper(), logging.INFO)
    logger.setLevel(level)
    
    # Create console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    
    # Set format
    if format_string is None:
        format_string = "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
    
    formatter = logging.Formatter(format_string, datefmt="%Y-%m-%d %H:%M:%S")
    handler.setFormatter(formatter)
    
    logger.addHandler(handler)
    
    # Prevent propagation to root logger
    logger.propagate = False
    
    return logger
