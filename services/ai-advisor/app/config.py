"""AI Advisor Service Configuration.

Simplified for Gemini-only (MIGRATE-001/003).
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


# Model selection strategy (COST-001)
# Flash: fast, cheap, good for chat/advice (90% of requests)
# Pro: powerful, expensive, for complex analysis (10% of requests)
FLASH_MODEL = "gemini-1.5-flash"
PRO_MODEL = "gemini-1.5-pro"

# Task types that require Pro model (complex analysis)
PRO_TASKS = frozenset({
    "program_generation",  # Full program creation
    "complex_analysis",    # Multi-week analysis
    "injury_assessment",   # Require careful reasoning
})

TaskType = Literal["chat", "advice", "motivation", "analysis", "program_generation", "complex_analysis", "injury_assessment"]


def get_model_for_task(task_type: TaskType) -> str:
    """Get optimal model for task type (COST-001).
    
    Returns Flash (cheaper) for most tasks, Pro for complex analysis.
    """
    if task_type in PRO_TASKS:
        return PRO_MODEL
    return FLASH_MODEL


class AIAdvisorConfig(BaseServiceConfig):
    """AI Advisor service configuration from environment.
    
    Simplified for Gemini-only. All other providers have been removed.
    """

    def __init__(self) -> None:
        super().__init__()
        
        # AI Provider (Gemini-only, kept for backward compatibility)
        self.provider = os.getenv("AI_ADVISOR_PROVIDER", "gemini").strip().lower()
        self.model = os.getenv("AI_ADVISOR_MODEL", FLASH_MODEL).strip()
        self.pro_model = PRO_MODEL  # For complex tasks
        self.base_prompt = os.getenv("AI_ADVISOR_BASE_PROMPT", "").strip()
        self.temperature = parse_float(os.getenv("AI_ADVISOR_TEMPERATURE"), 0.2)
        self.max_tokens = parse_int(os.getenv("AI_ADVISOR_MAX_TOKENS"), 800)

        # API Key (Gemini-only)
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()

        # Cost tracking (COST-001)
        # Flash: $0.075/1M input, $0.30/1M output
        # Pro: $1.25/1M input, $5.00/1M output
        self.cost_input_per_1k = parse_float(os.getenv("AI_ADVISOR_COST_INPUT_PER_1K_USD"), 0.000075)
        self.cost_output_per_1k = parse_float(os.getenv("AI_ADVISOR_COST_OUTPUT_PER_1K_USD"), 0.0003)

    def validate(self) -> None:
        """Validate required configuration."""
        if not self.model:
            raise RuntimeError("AI_ADVISOR_MODEL is required")
        if not self.base_prompt:
            raise RuntimeError("AI_ADVISOR_BASE_PROMPT is required")

        # Check Gemini API key
        if not self.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is required. "
                "Get your key at https://aistudio.google.com/apikey"
            )

    def get_api_key(self) -> str:
        """Get API key (Gemini-only)."""
        return self.gemini_api_key

    def get_model(self, task_type: TaskType = "advice") -> str:
        """Get model for task type (COST-001)."""
        return get_model_for_task(task_type)


# Global config instance
config = AIAdvisorConfig()

