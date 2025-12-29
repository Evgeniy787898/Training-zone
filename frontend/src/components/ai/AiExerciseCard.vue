<template>
  <div class="ai-card ai-card--exercise" @click="$emit('open', exerciseKey)">
    <div class="ai-card__header">
      <span class="ai-card__icon">🏋️</span>
      <span class="ai-card__title">{{ name }}</span>
      <span class="ai-card__arrow">→</span>
    </div>
    
    <div class="ai-exercise__details">
      <div v-if="level" class="ai-exercise__level">
        <span class="ai-exercise__level-badge">Уровень {{ level }}</span>
      </div>
      <div v-if="lastResult" class="ai-exercise__last">
        {{ lastResult }}
      </div>
      <div v-if="tip" class="ai-exercise__tip">
        💡 {{ tip }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  exerciseKey: string;
  name: string;
  level?: number;
  lastResult?: string;
  tip?: string;
}>();

defineEmits<{
  open: [exerciseKey: string];
}>();
</script>

<style scoped>
.ai-card--exercise {
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dim) 100%);
  border-radius: 16px;
  padding: 16px;
  margin: 12px 0;
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-card--exercise:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.ai-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-card__icon {
  font-size: 1.2rem;
}

.ai-card__title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  flex: 1;
}

.ai-card__arrow {
  color: var(--color-text-secondary);
  transition: transform 0.2s;
}

.ai-card--exercise:hover .ai-card__arrow {
  transform: translateX(4px);
  color: var(--color-accent);
}

.ai-exercise__details {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ai-exercise__level-badge {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.ai-exercise__last {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.ai-exercise__tip {
  width: 100%;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--color-surface-elevated);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
</style>
