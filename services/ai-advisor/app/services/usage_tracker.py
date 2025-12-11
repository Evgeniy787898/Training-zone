"""Usage Tracker for AI Advisor (COST-003).

Tracks token usage and estimated costs per day/week/month.
In-memory implementation - resets on restart.
"""

import time
from dataclasses import dataclass, field
from typing import Dict, Any
from collections import defaultdict


@dataclass
class UsageStats:
    """Usage statistics for a time period."""
    total_requests: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0


class UsageTracker:
    """Tracks AI usage statistics (COST-003).
    
    In-memory tracker for token usage and cost estimation.
    Data resets on service restart.
    """

    def __init__(self) -> None:
        # Daily stats by date string (YYYY-MM-DD)
        self._daily_stats: Dict[str, UsageStats] = defaultdict(UsageStats)
        # Per-user request counts (for top users)
        self._user_requests: Dict[str, int] = defaultdict(int)
        # Per-task type counts (for top scenarios)
        self._task_counts: Dict[str, int] = defaultdict(int)
        # Cost rates (from config, can be updated)
        self._input_cost_per_1k: float = 0.000075  # Flash default
        self._output_cost_per_1k: float = 0.0003   # Flash default

    def _get_date_key(self) -> str:
        """Get current date as YYYY-MM-DD."""
        return time.strftime("%Y-%m-%d")

    def record_usage(
        self,
        user_id: str,
        task_type: str,
        input_tokens: int,
        output_tokens: int,
    ) -> None:
        """Record a single AI request usage."""
        date_key = self._get_date_key()
        stats = self._daily_stats[date_key]
        
        # Update stats
        stats.total_requests += 1
        stats.total_input_tokens += input_tokens
        stats.total_output_tokens += output_tokens
        
        # Calculate cost
        input_cost = (input_tokens / 1000) * self._input_cost_per_1k
        output_cost = (output_tokens / 1000) * self._output_cost_per_1k
        stats.total_cost_usd += input_cost + output_cost
        
        # Update user and task counts
        self._user_requests[user_id] += 1
        self._task_counts[task_type] += 1

    def get_today_stats(self) -> Dict[str, Any]:
        """Get today's usage statistics."""
        date_key = self._get_date_key()
        stats = self._daily_stats.get(date_key, UsageStats())
        return {
            "date": date_key,
            "requests": stats.total_requests,
            "inputTokens": stats.total_input_tokens,
            "outputTokens": stats.total_output_tokens,
            "totalTokens": stats.total_input_tokens + stats.total_output_tokens,
            "estimatedCostUsd": round(stats.total_cost_usd, 6),
        }

    def get_top_users(self, limit: int = 5) -> list:
        """Get top users by request count."""
        sorted_users = sorted(
            self._user_requests.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return [{"userId": u, "requests": c} for u, c in sorted_users[:limit]]

    def get_top_tasks(self, limit: int = 5) -> list:
        """Get top task types by usage."""
        sorted_tasks = sorted(
            self._task_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return [{"taskType": t, "count": c} for t, c in sorted_tasks[:limit]]

    def get_summary(self) -> Dict[str, Any]:
        """Get full usage summary (COST-003 dashboard data)."""
        return {
            "today": self.get_today_stats(),
            "topUsers": self.get_top_users(5),
            "topTasks": self.get_top_tasks(5),
            "totalDaysTracked": len(self._daily_stats),
        }


# Global singleton
usage_tracker = UsageTracker()
