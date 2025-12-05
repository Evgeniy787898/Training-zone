"""Image Processor Service Configuration."""

import os
import sys
from pathlib import Path
from typing import Optional

# Add services directory to path to allow importing python_shared
SERVICES_DIR = Path(__file__).resolve().parents[2]
if SERVICES_DIR.exists() and str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))

# Now we can import from python_shared
from python_shared.config import parse_int, parse_bool, BaseServiceConfig


class ImageProcessorConfig(BaseServiceConfig):
    """Image Processor service configuration from environment."""

    def __init__(self) -> None:
        super().__init__()

        # Image processing limits
        self.min_dimension = 64
        self.max_dimension = parse_int(os.getenv("IMAGE_PROCESSOR_MAX_DIMENSION"), 4096)
        self.default_max_width = parse_int(os.getenv("IMAGE_PROCESSOR_DEFAULT_MAX_WIDTH"), 1280)
        self.default_max_height = parse_int(os.getenv("IMAGE_PROCESSOR_DEFAULT_MAX_HEIGHT"), 1280)
        self.default_quality = parse_int(os.getenv("IMAGE_PROCESSOR_DEFAULT_QUALITY"), 85)

        # Format settings
        self.default_format = os.getenv("IMAGE_PROCESSOR_DEFAULT_FORMAT", "webp").strip().upper()
        allowed_formats_raw = os.getenv("IMAGE_PROCESSOR_ALLOWED_FORMATS", "webp,jpeg,png")
        self.allowed_formats = tuple(f.strip().upper() for f in allowed_formats_raw.split(",") if f.strip())

        # Mode settings
        self.default_mode = os.getenv("IMAGE_PROCESSOR_DEFAULT_MODE", "contain").strip().lower()
        allowed_modes_raw = os.getenv("IMAGE_PROCESSOR_ALLOWED_MODES", "contain,cover,fill,stretch,pad")
        self.allowed_modes = tuple(m.strip().lower() for m in allowed_modes_raw.split(",") if m.strip())

        # Other settings
        self.default_background = os.getenv("IMAGE_PROCESSOR_DEFAULT_BACKGROUND")
        self.default_strip_metadata = parse_bool(
            os.getenv("IMAGE_PROCESSOR_STRIP_METADATA_DEFAULT", "true"), True
        )

    def clamp_dimension(self, value: Optional[int], fallback: int) -> int:
        """Clamp dimension to valid range."""
        if value is None:
            return fallback
        return max(self.min_dimension, min(self.max_dimension, value))

    def clamp_quality(self, value: Optional[int]) -> int:
        """Clamp quality to valid range (10-100)."""
        if value is None:
            return self.default_quality
        return max(10, min(100, value))


# Global config instance
config = ImageProcessorConfig()
