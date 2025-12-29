<template>
  <div class="ai-card ai-card--progress">
    <div class="ai-card__header">
      <span class="ai-card__icon">{{ icon || '📈' }}</span>
      <span class="ai-card__title">{{ title || 'Прогресс' }}</span>
    </div>
    
    <div class="ai-progress__items">
      <div 
        v-for="item in items" 
        :key="item.name"
        class="ai-progress__item"
      >
        <div class="ai-progress__info">
          <span class="ai-progress__name">{{ item.name }}</span>
          <span class="ai-progress__level">
            Уровень {{ item.currentLevel }}/{{ item.maxLevel }}
          </span>
        </div>
        <div class="ai-progress__bar-wrapper">
          <div 
            class="ai-progress__bar" 
            :style="{ width: `${(item.currentLevel / item.maxLevel) * 100}%` }"
          />
        </div>
        <div v-if="item.lastResult" class="ai-progress__last">
          {{ item.lastResult }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ProgressItem {
  name: string;
  currentLevel: number;
  maxLevel: number;
  lastResult?: string;
}

defineProps<{
  title?: string;
  icon?: string;
  items: ProgressItem[];
}>();
</script>

<style scoped>
.ai-card--progress {
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

.ai-progress__items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-progress__item {
  padding: 10px 12px;
  background: var(--color-surface-elevated);
  border-radius: 12px;
}

.ai-progress__info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ai-progress__name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.ai-progress__level {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.ai-progress__bar-wrapper {
  height: 6px;
  background: var(--color-surface-dim);
  border-radius: 3px;
  overflow: hidden;
}

.ai-progress__bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent), var(--color-success));
  border-radius: 3px;
  transition: width 0.3s ease;
}

.ai-progress__last {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-top: 6px;
}
</style>
