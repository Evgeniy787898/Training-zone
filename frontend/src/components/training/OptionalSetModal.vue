<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="optional-set-overlay" @click.self="handleSkip">
        <div class="optional-set-modal">
          <div class="modal-icon">🎉</div>
          <h3 class="modal-title">Отличный результат!</h3>
          
          <p class="result-text">
            Ты выполнил <strong>{{ completedReps }}</strong> повторов!
          </p>
          
          <div class="tier-offer">
            <template v-if="targetTier === 'next_level'">
              <p class="offer-text">
                Добавь ещё <strong>{{ setsToAdd }}</strong> 
                {{ setsWord }} по <strong>{{ repsNeeded }}</strong> повторов
              </p>
              <p class="offer-highlight">для перехода на следующий уровень:</p>
              <div class="next-level-name">{{ targetName }}</div>
            </template>
            <template v-else>
              <p class="offer-text">
                Добавь ещё <strong>{{ setsToAdd }}</strong> 
                {{ setsWord }} по <strong>{{ repsNeeded }}</strong> повторов
              </p>
              <p class="offer-highlight">
                для перехода на <strong>{{ targetName }}</strong>
              </p>
            </template>
          </div>
          
          <footer class="modal-actions">
            <button class="btn btn-primary" @click="handleAccept">
              Добавить {{ setsToAdd }} {{ setsWord }}
            </button>
            <button class="btn btn-secondary" @click="handleSkip">
              Пропустить
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { hapticSuccess, hapticLight } from '@/utils/hapticFeedback';

interface Props {
  show: boolean;
  completedReps: number;
  targetTier: number | 'next_level';
  targetName: string;
  setsToAdd: number;
  repsNeeded: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'accept', setsToAdd: number): void;
  (e: 'skip'): void;
}>();

const setsWord = computed(() => {
  const n = props.setsToAdd;
  if (n === 1) return 'подход';
  if (n >= 2 && n <= 4) return 'подхода';
  return 'подходов';
});

const handleAccept = () => {
  hapticSuccess();
  emit('accept', props.setsToAdd);
};

const handleSkip = () => {
  hapticLight();
  emit('skip');
};
</script>

<style scoped>
.optional-set-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  padding: 16px;
}

.optional-set-modal {
  width: 100%;
  max-width: 360px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
  padding: 24px;
  text-align: center;
}

.modal-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 12px;
}

.result-text {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin-bottom: 20px;
}

.result-text strong {
  color: var(--color-accent);
  font-size: 1.1rem;
}

.tier-offer {
  background: linear-gradient(135deg, 
    color-mix(in srgb, var(--color-accent) 15%, transparent),
    color-mix(in srgb, var(--color-accent) 5%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 20px;
}

.offer-text {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin: 0 0 8px;
}

.offer-text strong {
  color: var(--color-accent);
}

.offer-highlight {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
}

.offer-highlight strong {
  color: var(--color-accent);
}

.next-level-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-accent);
  margin-top: 8px;
  padding: 8px;
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  border-radius: var(--radius-md);
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn {
  padding: 14px 20px;
  border-radius: var(--radius-lg);
  font-size: 0.95rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--color-accent);
  color: white;
}

.btn-primary:hover {
  filter: brightness(1.1);
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary);
}

/* Transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .optional-set-modal,
.modal-fade-leave-to .optional-set-modal {
  transform: scale(0.95) translateY(10px);
}
</style>
