<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="progression-overlay" @click.self="handleSkip">
        <div class="progression-modal">
          <!-- Header with result icon -->
          <div class="progression-modal__header">
            <div class="progression-modal__icon" :class="`progression-modal__icon--${recommendation}`">
              {{ getIcon() }}
            </div>
            <h3 class="progression-modal__title">{{ getTitle() }}</h3>
          </div>
          
          <!-- Reasoning -->
          <p class="progression-modal__reasoning">
            {{ result.reasoning }}
          </p>
          
          <!-- Level change visualization -->
          <div v-if="showLevelChange" class="progression-modal__change">
            <div class="level-badge level-badge--current">
              {{ formatLevel(currentLevel, currentTier) }}
            </div>
            <span class="level-arrow">{{ recommendation === 'regress' ? '⟵' : '⟶' }}</span>
            <div class="level-badge level-badge--new">
              {{ formatLevel(result.suggestedLevel || currentLevel, result.suggestedTier || currentTier) }}
            </div>
          </div>
          
          <!-- Confidence indicator -->
          <div class="progression-modal__confidence">
            <span class="confidence-label">Уверенность:</span>
            <div class="confidence-bar">
              <div 
                class="confidence-fill" 
                :style="{ width: `${result.confidence * 100}%` }"
                :class="getConfidenceClass()"
              />
            </div>
            <span class="confidence-value">{{ Math.round(result.confidence * 100) }}%</span>
          </div>
          
          <!-- Actions -->
          <div class="progression-modal__actions">
            <button 
              v-if="recommendation === 'stay'"
              class="progression-btn progression-btn--primary"
              @click="handleAccept"
            >
              Закрепить уровень
            </button>
            
            <template v-else-if="recommendation === 'advance_tier' || recommendation === 'advance_level'">
              <button class="progression-btn progression-btn--secondary" @click="handleSkip">
                Остаться
              </button>
              <button class="progression-btn progression-btn--primary" @click="handleAccept">
                {{ recommendation === 'advance_level' ? 'Перейти на уровень' : 'Повысить тир' }}
              </button>
            </template>
            
            <template v-else-if="recommendation === 'deload'">
              <button class="progression-btn progression-btn--secondary" @click="handleSkip">
                Игнорировать
              </button>
              <button class="progression-btn progression-btn--warning" @click="handleAccept">
                Начать разгрузку
              </button>
            </template>
            
            <template v-else-if="recommendation === 'regress'">
              <button class="progression-btn progression-btn--secondary" @click="handleSkip">
                Остаться
              </button>
              <button class="progression-btn progression-btn--danger" @click="handleAccept">
                Вернуться назад
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { hapticSuccess, hapticMedium } from '@/utils/hapticFeedback';
import type { ProgressionResult, ProgressionRecommendation } from '@/utils/progressionCalculator';
import { formatLevel } from '@/utils/progressionCalculator';

interface Props {
  isOpen: boolean;
  result: ProgressionResult;
  currentLevel: number;
  currentTier: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'accept', result: ProgressionResult): void;
  (e: 'skip'): void;
}>();

const recommendation = computed(() => props.result.recommendation);

const showLevelChange = computed(() => {
  return ['advance_tier', 'advance_level', 'regress'].includes(recommendation.value);
});

const getIcon = (): string => {
  const icons: Record<ProgressionRecommendation, string> = {
    stay: '✓',
    advance_tier: '⬆️',
    advance_level: '🚀',
    deload: '😴',
    regress: '⬇️',
  };
  return icons[recommendation.value] || '❓';
};

const getTitle = (): string => {
  const titles: Record<ProgressionRecommendation, string> = {
    stay: 'Продолжаем!',
    advance_tier: 'Готов к повышению!',
    advance_level: 'Новый уровень!',
    deload: 'Нужен отдых',
    regress: 'Шаг назад',
  };
  return titles[recommendation.value] || 'Результат';
};

const getConfidenceClass = (): string => {
  if (props.result.confidence >= 0.8) return 'confidence-fill--high';
  if (props.result.confidence >= 0.5) return 'confidence-fill--medium';
  return 'confidence-fill--low';
};

const handleAccept = () => {
  hapticSuccess();
  emit('accept', props.result);
  emit('close');
};

const handleSkip = () => {
  hapticMedium();
  emit('skip');
  emit('close');
};
</script>

<style scoped>
.progression-overlay {
  position: fixed;
  inset: 0;
  z-index: 1150;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  padding: 16px;
}

.progression-modal {
  width: 100%;
  max-width: 360px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  padding: 24px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.progression-modal__header {
  margin-bottom: 16px;
}

.progression-modal__icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  background: var(--color-bg-secondary);
}

.progression-modal__icon--stay {
  background: color-mix(in srgb, var(--color-success) 20%, var(--color-bg));
}

.progression-modal__icon--advance_tier,
.progression-modal__icon--advance_level {
  background: color-mix(in srgb, var(--color-accent) 20%, var(--color-bg));
  animation: icon-pulse 0.6s ease-out;
}

.progression-modal__icon--deload {
  background: color-mix(in srgb, var(--color-warning) 20%, var(--color-bg));
}

.progression-modal__icon--regress {
  background: color-mix(in srgb, var(--color-danger) 20%, var(--color-bg));
}

@keyframes icon-pulse {
  0% { transform: scale(0.8); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.progression-modal__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.progression-modal__reasoning {
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 20px;
}

/* Level change visualization */
.progression-modal__change {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 20px;
}

.level-badge {
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 1.25rem;
  font-weight: 700;
}

.level-badge--current {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.level-badge--new {
  background: var(--color-accent);
  color: white;
  animation: badge-glow 1s ease-in-out infinite;
}

@keyframes badge-glow {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 40%, transparent); }
  50% { box-shadow: 0 0 0 8px transparent; }
}

.level-arrow {
  font-size: 1.5rem;
  color: var(--color-text-muted);
}

/* Confidence */
.progression-modal__confidence {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.confidence-label {
  white-space: nowrap;
}

.confidence-bar {
  flex: 1;
  height: 6px;
  background: var(--color-bg-secondary);
  border-radius: 3px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.confidence-fill--high {
  background: var(--color-success);
}

.confidence-fill--medium {
  background: var(--color-warning);
}

.confidence-fill--low {
  background: var(--color-danger);
}

.confidence-value {
  min-width: 32px;
  text-align: right;
}

/* Actions */
.progression-modal__actions {
  display: flex;
  gap: 12px;
}

.progression-btn {
  flex: 1;
  padding: 14px 16px;
  border-radius: 12px;
  border: none;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.progression-btn:active {
  transform: scale(0.98);
}

.progression-btn--primary {
  background: var(--color-accent);
  color: white;
}

.progression-btn--secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.progression-btn--warning {
  background: var(--color-warning);
  color: rgb(30, 30, 30);
}

.progression-btn--danger {
  background: var(--color-danger);
  color: white;
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-active .progression-modal,
.modal-fade-leave-active .progression-modal {
  transition: transform 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .progression-modal,
.modal-fade-leave-to .progression-modal {
  transform: scale(0.9) translateY(20px);
}
</style>
