"""A Advisor Service Configuration."""

import os
import sys
from pathlib import Path

# Add services directory to path to allow importing python_shared
SERVICES_DIR = Path(__file__).resolve().parents[2]
if SERVICES_DIR.exists() and str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))

# Now we can import from python_shared
from python_shared.config import parse_float, parse_int, BaseServiceConfig


class AIAdvisorConfig(BaseServiceConfig):
    """AI Advisor service configuration from environment."""

    def __init__(self) -> None:
        super().__init__()
        
        # AI Provider
        self.provider = os.getenv("AI_ADVISOR_PROVIDER", "openai").strip().lower()
        self.model = os.getenv("AI_ADVISOR_MODEL", "").strip()
        self.base_prompt = os.getenv("AI_ADVISOR_BASE_PROMPT", "").strip()
        self.temperature = parse_float(os.getenv("AI_ADVISOR_TEMPERATURE"), 0.2)
        self.max_tokens = parse_int(os.getenv("AI_ADVISOR_MAX_TOKENS"), 800)

        # API Keys
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()

        # Cost tracking
        self.cost_input_per_1k = parse_float(os.getenv("AI_ADVISOR_COST_INPUT_PER_1K_USD"), 0.0)
        self.cost_output_per_1k = parse_float(os.getenv("AI_ADVISOR_COST_OUTPUT_PER_1K_USD"), 0.0)

    def validate(self) -> None:
        """Validate required configuration."""
        if not self.model:
            raise RuntimeError("AI_ADVISOR_MODEL is required")
        if not self.base_prompt:
            raise RuntimeError("AI_ADVISOR_BASE_PROMPT is required")

        # Check API key based on provider
        if self.provider in {"openai", "gpt"}:
            if not self.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY is required for OpenAI provider")
        elif self.provider in {"gemini", "google"}:
            if not self.gemini_api_key:
                raise RuntimeError("GEMINI_API_KEY is required for Gemini provider")
        elif not self.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is required for Anthropic provider")

    def get_api_key(self) -> str:
        """Get API key for the configured provider."""
        if self.provider in {"openai", "gpt"}:
            return self.openai_api_key
        if self.provider in {"gemini", "google"}:
            return self.gemini_api_key
        return self.anthropic_api_key


# Global config instance
config = AIAdvisorConfig()
