<template>
  <div class="ai-card ai-card--stats">
    <div class="ai-card__header">
      <span class="ai-card__icon">{{ icon || '📊' }}</span>
      <span class="ai-card__title">{{ title || 'Статистика' }}</span>
    </div>
    <div class="ai-card__grid">
      <div 
        v-for="stat in stats" 
        :key="stat.label" 
        class="ai-card__stat"
      >
        <span 
          class="ai-card__value" 
          :class="[
            stat.trend === 'up' && 'ai-card__value--up',
            stat.trend === 'down' && 'ai-card__value--down'
          ]"
        >
          {{ stat.value }}
          <span v-if="stat.trend === 'up'" class="ai-card__trend">↑</span>
          <span v-if="stat.trend === 'down'" class="ai-card__trend">↓</span>
        </span>
        <span class="ai-card__label">{{ stat.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface StatItem {
  value: string | number;
  label: string;
  trend?: 'up' | 'down' | 'neutral';
}

defineProps<{
  title?: string;
  icon?: string;
  stats: StatItem[];
}>();
</script>

<style scoped>
.ai-card--stats {
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dim) 100%);
  border-radius: 16px;
  padding: 16px;
  margin: 12px 0;
  border: 1px solid var(--color-border);
}

.ai-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.ai-card__icon {
  font-size: 1.2rem;
}

.ai-card__title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.ai-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 12px;
}

.ai-card__stat {
  text-align: center;
  padding: 8px;
  background: var(--color-surface-elevated);
  border-radius: 12px;
}

.ai-card__value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.ai-card__value--up {
  color: var(--color-success);
}

.ai-card__value--down {
  color: var(--color-danger);
}

.ai-card__trend {
  font-size: 0.8rem;
  margin-left: 2px;
}

.ai-card__label {
  display: block;
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}
</style>
