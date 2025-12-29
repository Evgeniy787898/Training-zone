"""AI Advisor Service Configuration.

Supports OpenAI (gpt-4.1-nano) and Gemini providers.
Model selection strategy: Flash 90%, Pro 10% (COST-001).
"""

import os
import sys
from pathlib import Path
from typing import Literal

# Add services directory to path to allow importing python_shared
SERVICES_DIR = Path(__file__).resolve().parents[2]
if SERVICES_DIR.exists() and str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))

# Now we can import from python_shared
from python_shared.config import parse_float, parse_int, BaseServiceConfig


# Default models
DEFAULT_OPENAI_MODEL = "gpt-4.1-nano"  # Cheapest OpenAI model
FLASH_MODEL = "gemini-1.5-flash"
PRO_MODEL = "gemini-1.5-pro"

# Task types that require Pro model (complex analysis)
PRO_TASKS = frozenset({
    "program_generation",  # Full program creation
    "complex_analysis",    # Multi-week analysis
    "injury_assessment",   # Require careful reasoning
})

TaskType = Literal["chat", "advice", "motivation", "analysis", "program_generation", "complex_analysis", "injury_assessment"]


def get_model_for_task(task_type: TaskType, provider: str) -> str:
    """Get optimal model for task type (COST-001).
    
    Returns cheaper model for most tasks, expensive for complex analysis.
    """
    if provider == "openai":
        # OpenAI uses same model for all tasks (gpt-4.1-nano is cheap enough)
        return DEFAULT_OPENAI_MODEL
    
    # Gemini: Flash for most, Pro for complex
    if task_type in PRO_TASKS:
        return PRO_MODEL
    return FLASH_MODEL


class AIAdvisorConfig(BaseServiceConfig):
    """AI Advisor service configuration from environment.
    
    Supports both OpenAI and Gemini providers.
    Default: OpenAI with gpt-4.1-nano (cheapest).
    """

    def __init__(self) -> None:
        super().__init__()
        
        # AI Provider - auto-detect based on available API key
        self.provider = os.getenv("AI_ADVISOR_PROVIDER", "").strip().lower()
        
        # OpenAI settings
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        
        # Gemini settings (backward compatibility)
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        
        # Auto-detect provider if not specified
        if not self.provider:
            if self.openai_api_key:
                self.provider = "openai"
            elif self.gemini_api_key:
                self.provider = "gemini"
            else:
                self.provider = "openai"  # Default to OpenAI
        
        # Model selection based on provider
        if self.provider == "openai":
            self.model = os.getenv("AI_ADVISOR_MODEL", DEFAULT_OPENAI_MODEL).strip()
        else:
            self.model = os.getenv("AI_ADVISOR_MODEL", FLASH_MODEL).strip()
        
        self.pro_model = PRO_MODEL  # For complex tasks (Gemini)
        self.base_prompt = os.getenv("AI_ADVISOR_BASE_PROMPT", "").strip()
        self.temperature = parse_float(os.getenv("AI_ADVISOR_TEMPERATURE"), 0.2)
        self.max_tokens = parse_int(os.getenv("AI_ADVISOR_MAX_TOKENS"), 800)

        # Cost tracking (gpt-4.1-nano pricing)
        # Input: $0.20/1M, Output: $0.80/1M
        if self.provider == "openai":
            self.cost_input_per_1k = parse_float(os.getenv("AI_ADVISOR_COST_INPUT_PER_1K_USD"), 0.0002)
            self.cost_output_per_1k = parse_float(os.getenv("AI_ADVISOR_COST_OUTPUT_PER_1K_USD"), 0.0008)
        else:
            # Gemini Flash pricing
            self.cost_input_per_1k = parse_float(os.getenv("AI_ADVISOR_COST_INPUT_PER_1K_USD"), 0.000075)
            self.cost_output_per_1k = parse_float(os.getenv("AI_ADVISOR_COST_OUTPUT_PER_1K_USD"), 0.0003)

    def validate(self) -> None:
        """Validate required configuration."""
        if not self.model:
            raise RuntimeError("AI_ADVISOR_MODEL is required")
        if not self.base_prompt:
            raise RuntimeError("AI_ADVISOR_BASE_PROMPT is required")

        # Check API key for selected provider
        if self.provider == "openai":
            if not self.openai_api_key:
                raise RuntimeError(
                    "OPENAI_API_KEY is required for OpenAI provider. "
                    "Get your key at https://platform.openai.com/api-keys"
                )
        elif self.provider == "gemini":
            if not self.gemini_api_key:
                raise RuntimeError(
                    "GEMINI_API_KEY is required for Gemini provider. "
                    "Get your key at https://aistudio.google.com/apikey"
                )

    def get_api_key(self) -> str:
        """Get API key for configured provider."""
        if self.provider == "openai":
            return self.openai_api_key
        return self.gemini_api_key

    def get_model(self, task_type: TaskType = "advice") -> str:
        """Get model for task type (COST-001)."""
        return get_model_for_task(task_type, self.provider)


# Global config instance
config = AIAdvisorConfig()


