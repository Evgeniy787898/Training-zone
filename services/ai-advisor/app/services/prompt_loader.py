"""Prompt template loader for the AI Advisor service.

Loads prompt templates from the prompts/ directory with support for:
- Variable substitution using {{variable_name}} syntax
- Template caching for performance
- Fallback to environment variable if template not found
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Dict, Optional

# Template directory path
PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "prompts"

# Regex for variable placeholders {{variable_name}}
VARIABLE_PATTERN = re.compile(r"\{\{(\w+)\}\}")


class PromptLoader:
    """Loads and renders prompt templates from files."""

    _cache: Dict[str, str] = {}

    @classmethod
    def load(
        cls,
        template_name: str,
        variables: Optional[Dict[str, str]] = None,
        *,
        fallback: Optional[str] = None,
    ) -> str:
        """Load a prompt template by name and render with variables.

        Args:
            template_name: Name of the template file (without .md extension).
            variables: Dict of variable name -> value for substitution.
            fallback: Fallback content if template file not found.

        Returns:
            Rendered prompt string.

        Raises:
            FileNotFoundError: If template not found and no fallback provided.
        """
        # Check cache first
        cache_key = template_name
        if cache_key not in cls._cache:
            template_path = PROMPTS_DIR / f"{template_name}.md"
            
            if template_path.exists():
                cls._cache[cache_key] = template_path.read_text(encoding="utf-8")
            elif fallback is not None:
                cls._cache[cache_key] = fallback
            else:
                raise FileNotFoundError(f"Prompt template not found: {template_name}")

        template = cls._cache[cache_key]

        # Substitute variables if provided
        if variables:
            template = cls._render(template, variables)

        return template

    @classmethod
    def _render(cls, template: str, variables: Dict[str, str]) -> str:
        """Substitute {{variable}} placeholders with values."""
        def replace_var(match: re.Match[str]) -> str:
            var_name = match.group(1)
            return str(variables.get(var_name, match.group(0)))

        return VARIABLE_PATTERN.sub(replace_var, template)

    @classmethod
    def list_templates(cls) -> list[str]:
        """List available template names."""
        if not PROMPTS_DIR.exists():
            return []
        return [p.stem for p in PROMPTS_DIR.glob("*.md") if p.stem != "README"]

    @classmethod
    def clear_cache(cls) -> None:
        """Clear the template cache."""
        cls._cache.clear()

    @classmethod
    def get_prompts_dir(cls) -> Path:
        """Get the prompts directory path."""
        return PROMPTS_DIR


__all__ = ["PromptLoader"]
