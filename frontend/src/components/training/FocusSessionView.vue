<template>
  <div class="focus-session" data-animate="fade-in">
    <header class="focus-session__header">
      <div class="focus-session__timer">
        <!-- Minimal timer display -->
        <span class="timer-value">{{ formattedTime }}</span>
      </div>
      <button class="focus-session__close" @click="$emit('exit')">
        <NeonIcon name="close" :size="24" />
      </button>
    </header>

    <div class="focus-session__body">
      <transition name="slide-fade" mode="out-in">
        <div :key="currentExercise?.key" class="focus-card" v-if="currentExercise">
          <div class="focus-card__media" v-if="currentExercise.imageUrl">
             <img :src="currentExercise.imageUrl" :alt="currentExercise.levelLabel" loading="lazy" />
          </div>
          
          <div class="focus-card__content">
            <h2 class="focus-card__title">{{ currentExercise.levelLabel }}</h2>
            <div class="focus-card__targets">
              <div class="target-item">
                <span class="target-label">Подходы</span>
                <span class="target-value">{{ currentExercise.sets }}</span>
              </div>
              <div class="target-item">
                <span class="target-label">Повторы</span>
                <span class="target-value">{{ currentExercise.reps }}</span>
              </div>
            </div>

            <div class="focus-card__input-area">
                <label class="input-label">Сколько сделал?</label>
                <div class="input-row">
                    <button class="adjust-btn" @click="decrementReps">
                        <NeonIcon name="minus" />
                    </button>
                    <div class="reps-display">{{ currentReps }}</div>
                    <button class="adjust-btn" @click="incrementReps">
                        <NeonIcon name="plus" />
                    </button>
                </div>
            </div>
          </div>
        </div>
        <div v-else class="focus-completion">
            <h2>Тренировка завершена!</h2>
            <p>Отличная работа. Жми "Готово" чтобы сохранить.</p>
        </div>
      </transition>
    </div>

    <footer class="focus-session__footer">
        <BaseButton 
            variant="ghost" 
            class="skip-btn"
            @click="prevExercise"
            :disabled="isFirst"
        >
            Назад
        </BaseButton>

        <BaseButton 
            variant="primary" 
            size="lg" 
            class="action-btn"
            @click="handleNext"
        >
            {{ isLast ? 'Завершить' : 'Далее' }}
        </BaseButton>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { type ExerciseCard } from '@/types/today';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps<{
  exercises: ExerciseCard[];
  results: Record<string, number>;
  timerElapsed: number;
}>();

const emit = defineEmits<{
  (e: 'exit'): void;
  (e: 'update-result', payload: { key: string; value: number }): void;
  (e: 'complete'): void;
}>();

const currentIndex = ref(0);
const currentReps = ref(0);

const currentExercise = computed(() => props.exercises[currentIndex.value]);
const isFirst = computed(() => currentIndex.value === 0);
const isLast = computed(() => currentIndex.value === props.exercises.length - 1);

const formattedTime = computed(() => {
    const min = Math.floor(props.timerElapsed / 60).toString().padStart(2, '0');
    const sec = (props.timerElapsed % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
});

watch(currentExercise, (newEx) => {
    if (newEx) {
        currentReps.value = props.results[newEx.key] || newEx.reps;
    }
}, { immediate: true });

const incrementReps = () => {
    currentReps.value++;
    emit('update-result', { key: currentExercise.value.key, value: currentReps.value });
};

const decrementReps = () => {
    if (currentReps.value > 0) {
        currentReps.value--;
        emit('update-result', { key: currentExercise.value.key, value: currentReps.value });
    }
};

const handleNext = () => {
    // Save current
    emit('update-result', { key: currentExercise.value.key, value: currentReps.value });
    
    if (isLast.value) {
        emit('complete');
    } else {
        currentIndex.value++;
    }
};

const prevExercise = () => {
    if (!isFirst.value) {
        currentIndex.value--;
    }
};
</script>

<style scoped>
.focus-session {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--color-bg);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-4);
    padding-bottom: env(safe-area-inset-bottom, 20px);
}

.focus-session__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
}

.timer-value {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-accent);
}

.focus-session__close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: var(--spacing-2);
}

.focus-session__body {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow-y: auto;
}

.focus-card {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
    text-align: center;
}

.focus-card__title {
    font-size: var(--font-size-3xl);
    font-weight: 800;
    color: var(--color-text-primary);
    line-height: 1.1;
}

.focus-card__media img {
    width: 100%;
    height: 300px;
    object-fit: cover;
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
}

.focus-card__targets {
    display: flex;
    justify-content: center;
    gap: var(--spacing-8);
}

.target-item {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.target-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.target-value {
    font-size: var(--font-size-4xl);
    font-weight: 900;
    color: var(--color-text-primary);
}

.focus-card__input-area {
    margin-top: var(--spacing-4);
    background: var(--color-bg-secondary);
    padding: var(--spacing-6);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border);
}

.input-label {
    display: block;
    margin-bottom: var(--spacing-4);
    color: var(--color-text-secondary);
    font-size: var(--font-size-lg);
}

.input-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-6);
}

.adjust-btn {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
}

.adjust-btn:active {
    transform: scale(0.95);
    background: var(--color-surface-hover);
}

.reps-display {
    font-size: 4rem;
    font-weight: 700;
    color: var(--color-accent);
    min-width: 120px;
}

.focus-session__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--spacing-4);
    gap: var(--spacing-4);
}

.action-btn {
    flex: 2;
    height: 64px;
    font-size: var(--font-size-xl);
}

.skip-btn {
    flex: 1;
    height: 64px;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
