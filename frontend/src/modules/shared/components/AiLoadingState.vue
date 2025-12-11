<template>
  <div class="ai-loading" role="status" aria-live="polite">
    <div class="ai-loading__header">
      <NeonIcon name="spark" variant="amber" class="ai-loading__icon" :class="{ 'ai-loading__icon--pulse': !error }" />
      <h3 class="ai-loading__title">{{ title }}</h3>
    </div>
    
    <ul class="ai-loading__steps">
      <li 
        v-for="(step, index) in steps" 
        :key="index"
        class="ai-loading__step"
        :class="{ 
          'ai-loading__step--active': step.status === 'active',
          'ai-loading__step--done': step.status === 'done',
          'ai-loading__step--pending': step.status === 'pending'
        }"
      >
        <div class="ai-loading__step-marker">
          <NeonIcon v-if="step.status === 'done'" name="check" variant="success" size="14" />
          <div v-else-if="step.status === 'active'" class="ai-loading__spinner"></div>
          <div v-else class="ai-loading__dot"></div>
        </div>
        <span class="ai-loading__step-text">{{ step.label }}</span>
      </li>
    </ul>

    <p v-if="error" class="ai-loading__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';

export interface AiStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done';
}

defineProps<{
  title?: string;
  steps: AiStep[];
  error?: string | null;
}>();
</script>

<style scoped>
.ai-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--color-surface) 95%, transparent),
    color-mix(in srgb, var(--color-bg-secondary) 40%, transparent)
  );
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
}

.ai-loading__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.ai-loading__icon {
  width: 24px;
  height: 24px;
}

.ai-loading__icon--pulse {
  animation: pulse-glow 2s infinite ease-in-out;
}

.ai-loading__title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.ai-loading__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ai-loading__step {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: color 0.3s ease;
}

.ai-loading__step--active {
  color: var(--color-text-primary);
  font-weight: 500;
}

.ai-loading__step--done {
  color: var(--color-success);
}

.ai-loading__step-marker {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
}

.ai-loading__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.ai-loading__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-text-secondary) 30%, transparent);
}

.ai-loading__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; filter: drop-shadow(0 0 5px var(--color-accent)); }
  50% { opacity: 0.7; filter: drop-shadow(0 0 2px var(--color-accent)); }
}
</style>
