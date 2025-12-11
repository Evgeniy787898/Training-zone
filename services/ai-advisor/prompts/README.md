# Prompt Templates for AI Advisor

This directory contains prompt templates for the AI Advisor microservice.

## Template Format

Templates are markdown files with optional variable placeholders using `{{variable_name}}` syntax.

## Available Templates

| Template | Purpose | Variables |
|----------|---------|-----------|
| `exercise_advice.md` | Advice for exercise progression | None (context comes from request) |
| `daily_motivation.md` | Daily motivational tips | `day_of_week`, `has_training`, `streak_days`, `avg_rpe` |

## Adding New Templates

1. Create a new `.md` file in this directory
2. Use `{{variable_name}}` for dynamic content
3. Document the template in this README
4. Update `PromptLoader` in `app/services/prompt_loader.py` if needed

## Template Versioning

Templates are versioned by git. Major changes should be documented in commit messages.

## Testing

Templates are validated on service startup via health check.
