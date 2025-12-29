<template>
  <Transition name="rpe-fade">
    <div v-if="isOpen" class="rpe-overlay">
      <div class="rpe-modal">
        <h3 class="rpe-title">Насколько тяжело было?</h3>
        
        <div class="rpe-scale">
          <div class="rpe-emoji-row">
            <span class="rpe-emoji" :class="{ active: localValue <= 2 }">😴</span>
            <span class="rpe-emoji" :class="{ active: localValue >= 3 && localValue <= 4 }">😊</span>
            <span class="rpe-emoji" :class="{ active: localValue >= 5 && localValue <= 6 }">💪</span>
            <span class="rpe-emoji" :class="{ active: localValue >= 7 && localValue <= 8 }">😤</span>
            <span class="rpe-emoji" :class="{ active: localValue >= 9 }">🔥</span>
          </div>
          
          <div class="rpe-slider-container">
            <input
              type="range"
              class="rpe-slider"
              :value="localValue"
              @input="handleSliderInput"
              min="1"
              max="10"
              step="1"
            />
            <div class="rpe-slider-labels">
              <span v-for="i in 10" :key="i" class="rpe-label" :class="{ active: i === localValue }">
                {{ i }}
              </span>
            </div>
          </div>
          
          <div class="rpe-value-display" :style="{ color: getRpeColor(localValue) }">
            {{ localValue }} — {{ getRpeLabel(localValue) }}
          </div>
        </div>
        
        <div class="rpe-actions">
          <button class="rpe-btn rpe-btn--skip" @click="handleSkip">
            Пропустить
          </button>
          <button class="rpe-btn rpe-btn--save" @click="handleSave">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { hapticLight, hapticSelection } from '@/utils/hapticFeedback';

interface Props {
  isOpen: boolean;
  currentValue?: number;
}

const props = withDefaults(defineProps<Props>(), {
  currentValue: 5
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', rpe: number): void;
  (e: 'skip'): void;
}>();

const localValue = ref(props.currentValue);

watch(() => props.isOpen, (open) => {
  if (open) {
    localValue.value = props.currentValue;
  }
});

const handleSliderInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  localValue.value = parseInt(target.value, 10);
  hapticLight();
};

const getRpeColor = (value: number): string => {
  if (value <= 3) return 'var(--color-success)';
  if (value <= 6) return 'var(--color-warning)';
  return 'var(--color-danger)';
};

const getRpeLabel = (value: number): string => {
  const labels: Record<number, string> = {
    1: 'Очень легко',
    2: 'Легко',
    3: 'Комфортно',
    4: 'Умеренно',
    5: 'Средне',
    6: 'Чувствуется',
    7: 'Тяжело',
    8: 'Очень тяжело',
    9: 'Максимум',
    10: 'Предел'
  };
  return labels[value] || '';
};

const handleSave = () => {
  hapticSelection();
  emit('save', localValue.value);
  emit('close');
};

const handleSkip = () => {
  emit('skip');
  emit('close');
};
</script>

<style scoped>
.rpe-overlay {
  position: fixed;
  inset: 0;
  z-index: 1150;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  padding: 16px;
}

.rpe-modal {
  width: 100%;
  max-width: 360px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  padding: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.rpe-title {
  text-align: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 24px;
}

.rpe-scale {
  margin-bottom: 24px;
}

.rpe-emoji-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 0 8px;
}

.rpe-emoji {
  font-size: 1.5rem;
  opacity: 0.3;
  transition: all 0.2s;
}

.rpe-emoji.active {
  opacity: 1;
  transform: scale(1.2);
}

.rpe-slider-container {
  position: relative;
}

.rpe-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(
    to right,
    var(--color-success) 0%,
    var(--color-warning) 50%,
    var(--color-danger) 100%
  );
  -webkit-appearance: none;
  appearance: none;
  outline: none;
}

.rpe-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: white;
  border: 3px solid var(--color-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

.rpe-slider::-moz-range-thumb {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: white;
  border: 3px solid var(--color-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

.rpe-slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding: 0 4px;
}

.rpe-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  width: 20px;
  text-align: center;
}

.rpe-label.active {
  color: var(--color-accent);
  font-weight: 700;
}

.rpe-value-display {
  text-align: center;
  font-size: 1.125rem;
  font-weight: 700;
  margin-top: 16px;
  padding: 12px;
  border-radius: 12px;
  background: var(--color-bg-secondary);
}

.rpe-actions {
  display: flex;
  gap: 12px;
}

.rpe-btn {
  flex: 1;
  padding: 14px 16px;
  border-radius: 12px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.rpe-btn--skip {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.rpe-btn--save {
  background: var(--color-accent);
  color: white;
}

.rpe-btn:active {
  transform: scale(0.98);
}

/* Transitions */
.rpe-fade-enter-active,
.rpe-fade-leave-active {
  transition: opacity 0.3s ease;
}

.rpe-fade-enter-active .rpe-modal,
.rpe-fade-leave-active .rpe-modal {
  transition: transform 0.3s ease;
}

.rpe-fade-enter-from,
.rpe-fade-leave-to {
  opacity: 0;
}

.rpe-fade-enter-from .rpe-modal,
.rpe-fade-leave-to .rpe-modal {
  transform: scale(0.9) translateY(20px);
}
</style>
