<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="reps-modal-overlay" @click.self="handleClose">
        <div class="reps-modal" role="dialog" aria-modal="true" aria-labelledby="reps-modal-title">
          <header class="reps-modal__header">
            <h3 id="reps-modal-title" class="reps-modal__title">
              Подход {{ setIndex + 1 }}
            </h3>
            <button class="reps-modal__close" @click="handleClose" aria-label="Закрыть">
              ✕
            </button>
          </header>
          
          <div class="reps-modal__body">
            <!-- Quick adjust buttons -->
            <div class="reps-modal__quick-btns">
              <button 
                class="reps-modal__quick-btn"
                @click="adjustReps(-5)"
                :disabled="localReps <= 5"
              >
                −5
              </button>
              <button 
                class="reps-modal__quick-btn"
                @click="adjustReps(-1)"
                :disabled="localReps <= 0"
              >
                −1
              </button>
              
              <div class="reps-modal__value-display" :class="valueClass">
                {{ localReps }}
              </div>
              
              <button 
                class="reps-modal__quick-btn"
                @click="adjustReps(1)"
              >
                +1
              </button>
              <button 
                class="reps-modal__quick-btn"
                @click="adjustReps(5)"
              >
                +5
              </button>
            </div>
            
            <!-- Phase 7: Inline tier advancement offer -->
            <div 
              v-if="reachableTierOffer" 
              class="reps-modal__tier-offer"
              :class="{ 'reps-modal__tier-offer--success': isNextLevelAdvancement }"
            >
              <div class="reps-modal__tier-offer-achieved">
                ✓ Ты выполнил <strong>{{ localReps }}</strong> повторений в 1-м подходе
              </div>
              <div class="reps-modal__tier-offer-text">
                Добавь ещё <strong>{{ reachableTierOffer.setsToAdd }}</strong> 
                {{ getSetsWord(reachableTierOffer.setsToAdd) }} 
                по <strong>{{ reachableTierOffer.repsNeeded }}</strong> повт.
              </div>
              <div class="reps-modal__tier-offer-target">
                → переход на <strong>{{ reachableTierOffer.targetName }}</strong>
              </div>
              <button 
                class="reps-modal__tier-offer-btn" 
                @click="handleAddSets"
              >
                Добавить {{ reachableTierOffer.setsToAdd }} {{ getSetsWord(reachableTierOffer.setsToAdd) }}
              </button>
            </div>
            
            <!-- Under-target motivational hint -->
            <div v-if="underTargetHint && !reachableTierOffer" class="reps-modal__under-hint">
              <div class="reps-modal__under-hint-message">
                Сейчас: <strong>{{ underTargetHint.current }}</strong> • 
                Цель: <strong>{{ underTargetHint.goal }}</strong>
              </div>
              <div class="reps-modal__under-hint-next">
                💪 В следующий раз попробуй <strong>{{ underTargetHint.nextGoal }}</strong> повт.
              </div>
            </div>
          </div>
          
          <footer class="reps-modal__footer">
            <button class="reps-modal__btn reps-modal__btn--secondary" @click="handleClose">
              Отмена
            </button>
            <button class="reps-modal__btn reps-modal__btn--primary" @click="handleSave">
              Сохранить
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { hapticLight, hapticSelection, hapticSuccess } from '@/utils/hapticFeedback';
import { type ExerciseLevel } from '@/types';

interface Props {
  isOpen: boolean;
  setIndex: number;
  targetReps: number;
  currentReps?: number;
  // Progression props
  currentLevel?: number;
  currentTier?: number;
  totalSets?: number;
  completedSets?: number;
  nextExerciseName?: string;
  // Phase 7: Inline tier advancement
  allTierLevels?: ExerciseLevel[];
  isFirstSet?: boolean;
  levelCode?: string; // e.g., "1.2"
}

// Tier configuration (names only, no volume formulas!)
const TIER_NAMES: Record<number, string> = {
  1: 'Начальный',
  2: 'Продвинутый',
  3: 'Профессиональный',
};

const props = withDefaults(defineProps<Props>(), {
  currentReps: 0,
  currentLevel: 1,
  currentTier: 1,
  totalSets: 1,
  completedSets: 0,
  nextExerciseName: '',
  allTierLevels: () => [],
  isFirstSet: false,
  levelCode: '',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { setIndex: number; reps: number }): void;
  (e: 'addSets', setsToAdd: number): void; // Phase 7: Inline add sets
}>();

const localReps = ref(props.currentReps || props.targetReps);

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Initialize with current reps or target
    localReps.value = props.currentReps || props.targetReps;
  }
});

// Result status
const resultStatus = computed(() => {
  const diff = localReps.value - props.targetReps;
  if (diff > 0) return 'exceeded';
  if (diff === 0) return 'exact';
  return 'under';
});

const resultMessage = computed(() => {
  const diff = localReps.value - props.targetReps;
  if (diff > 0) return `+${diff} 🚀 Отлично!`;
  if (diff === 0) return '✓ Точно по цели';
  return `${diff} — не докрутил`;
});

const valueClass = computed(() => ({
  'reps-modal__value-display--exceeded': resultStatus.value === 'exceeded',
  'reps-modal__value-display--exact': resultStatus.value === 'exact',
  'reps-modal__value-display--under': resultStatus.value === 'under'
}));

// ===========================================
// SIMPLE TIER PROGRESSION LOGIC (NO FORMULAS!)
// ===========================================
// targetReps = цель для перехода на СЛЕДУЮЩИЙ тир
// Если выполнил >= targetReps → переход
// Если не выполнил → показываем сколько осталось

// Goal label showing which tier we're working towards
const tierGoalLabel = computed(() => {
  const tier = props.currentTier;
  const level = props.currentLevel;
  const maxTier = level === 10 ? 4 : 3;
  
  if (tier >= maxTier && level >= 10) {
    return '— максимальный уровень';
  }
  
  const nextTier = tier < maxTier ? tier + 1 : 0;
  if (tier === maxTier) {
    // At max tier for this level, goal is next exercise level
    const nextName = props.nextExerciseName || `Уровень ${level + 1}`;
    return `→ переход на ${nextName}`;
  }
  return `→ для перехода на ${TIER_NAMES[nextTier]}`;
});

// Main progression hint
const progressionHint = computed(() => {
  const tier = props.currentTier;
  const level = props.currentLevel;
  const maxTier = level === 10 ? 4 : 3;
  const nextTier = tier < maxTier ? tier + 1 : 0;
  
  // If already at max level (level 10, tier 4)
  if (tier >= maxTier && level >= 10) {
    if (localReps.value >= props.targetReps) {
      return '🏆 Максимальный уровень достигнут!';
    }
    return null;
  }
  
  const repsNeeded = props.targetReps - localReps.value;
  
  // Check if goal reached
  if (localReps.value >= props.targetReps) {
    if (tier === maxTier) {
      // At max tier, advancing to next exercise level
      const nextName = props.nextExerciseName || `Уровень ${level + 1}`;
      return `🎯 Переход на: ${nextName}!`;
    } else {
      // Advancing to next tier
      return `⬆️ Переход на ${TIER_NAMES[nextTier]}!`;
    }
  }
  
  // Show how many reps needed
  if (repsNeeded > 0 && repsNeeded <= 15) {
    if (tier === maxTier) {
      const nextName = props.nextExerciseName || `уровень ${level + 1}`;
      return `Ещё ${repsNeeded} до ${nextName}`;
    }
    return `Ещё ${repsNeeded} до ${TIER_NAMES[nextTier]}`;
  }
  
  // Multi-set encouragement
  if (props.totalSets > 1 && props.completedSets === 0 && repsNeeded > 0) {
    return `💪 Выполни все ${props.totalSets} подходов на максимум!`;
  }
  
  return null;
});

// No secondary hint needed with simplified logic
const progressionHintSecondary = computed(() => null);

const progressionHintClass = computed(() => ({
  'reps-modal__progression--advance': progressionHint.value?.includes('Переход'),
  'reps-modal__progression--max': progressionHint.value?.includes('Максимальный'),
  'reps-modal__progression--hint': progressionHint.value?.includes('Ещё') || progressionHint.value?.includes('Выполни'),
}));

// Under-target motivational hint: suggest +1 or +2 for next time
const underTargetHint = computed(() => {
  if (localReps.value >= props.targetReps) return null;
  if (!props.targetReps || props.targetReps <= 0) return null;
  
  const deficit = props.targetReps - localReps.value;
  const currentReps = localReps.value;
  
  // Only show if they did something
  if (currentReps <= 0) return null;
  
  // Smart suggestion: aim for +1-2 reps next time for gradual improvement
  const suggestedNext = deficit <= 3 ? currentReps + 1 : currentReps + 2;
  
  return {
    current: currentReps,
    goal: props.targetReps,
    nextGoal: suggestedNext,
    increment: suggestedNext - currentReps,
    deficit,
  };
});

// ===== Phase 7: Inline Tier Advancement =====
// Calculate if user can advance to higher tier by adding sets
const reachableTierOffer = computed(() => {
  // Only show on first set and when tier levels are available
  if (!props.isFirstSet || props.allTierLevels.length === 0) return null;
  
  const reps = localReps.value;
  const levelMatch = props.levelCode?.match(/^(\d+)\.(\d+)$/);
  if (!levelMatch) return null;
  
  const levelNum = parseInt(levelMatch[1], 10);
  const tierNum = parseInt(levelMatch[2], 10);
  
  // Get tier data
  const getTierData = (level: number, tier: number) => 
    props.allTierLevels.find(l => l.level === `${level}.${tier}`);
  
  const tier1 = getTierData(levelNum, 1);
  const tier2 = getTierData(levelNum, 2);
  const tier3 = getTierData(levelNum, 3);
  const nextLevel = getTierData(levelNum + 1, 1);
  
  const currentSets = props.totalSets;
  
  // Check for Профессиональный → next level
  if (tier3?.reps && reps >= tier3.reps && tierNum <= 3) {
    const setsToAdd = (tier3.sets ?? 3) - currentSets;
    if (setsToAdd > 0) {
      return {
        targetTier: 'next_level' as const,
        targetName: nextLevel?.title ?? `Уровень ${levelNum + 1}`,
        setsToAdd,
        repsNeeded: tier3.reps,
      };
    }
  }
  
  // Check for Продвинутый → Профессиональный  
  if (tier2?.reps && reps >= tier2.reps && tierNum < 3) {
    const targetSets = tier3?.sets ?? 3;
    const setsToAdd = targetSets - currentSets;
    if (setsToAdd > 0) {
      return {
        targetTier: 3,
        targetName: 'Профессиональный',
        setsToAdd,
        repsNeeded: tier3?.reps ?? reps,
      };
    }
  }
  
  // Check for Начальный → Продвинутый
  if (tier1?.reps && reps >= tier1.reps && tierNum < 2) {
    const targetSets = tier2?.sets ?? 2;
    const setsToAdd = targetSets - currentSets;
    if (setsToAdd > 0) {
      return {
        targetTier: 2,
        targetName: 'Продвинутый',
        setsToAdd,
        repsNeeded: tier2?.reps ?? reps,
      };
    }
  }
  
  return null;
});

// Check if this is a next level advancement (GREEN) vs tier advancement (YELLOW)
const isNextLevelAdvancement = computed(() => 
  reachableTierOffer.value?.targetTier === 'next_level'
);

// Helper for proper Russian declension of 'подход'
const getSetsWord = (n: number): string => {
  if (n === 1) return 'подход';
  if (n >= 2 && n <= 4) return 'подхода';
  return 'подходов';
};

// Handle inline add sets
const handleAddSets = () => {
  if (reachableTierOffer.value) {
    emit('addSets', reachableTierOffer.value.setsToAdd);
    hapticSuccess();
  }
};

// Actions
const adjustReps = (delta: number) => {
  localReps.value = Math.max(0, localReps.value + delta);
  hapticLight();
};

const handleSave = () => {
  hapticSelection();
  emit('save', { setIndex: props.setIndex, reps: localReps.value });
  emit('close');
};

const handleClose = () => {
  emit('close');
};
</script>

<style scoped>
.reps-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.reps-modal {
  width: 100%;
  max-height: 80vh;
  background: var(--color-bg-modal, var(--color-bg-elevated));
  border-top-left-radius: 32px;
  border-top-right-radius: 32px;
  border: 1px solid var(--color-border);
  border-bottom: none;
  overflow: hidden;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.reps-modal__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--color-bg-modal, var(--color-bg-elevated));
  border-bottom: 1px solid var(--color-border);
  position: relative;
}

.reps-modal__title {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, var(--color-text-primary) 0%, var(--color-text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.reps-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  background: transparent;
  border: 2px solid var(--color-border-strong, var(--color-border));
  cursor: pointer;
  color: var(--color-text-primary);
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  z-index: 10;
}

.reps-modal__close:hover {
  border-color: var(--color-text-primary);
  transform: rotate(90deg) scale(1.1);
}

.reps-modal__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 16px 20px;
  text-align: center;
  overflow: hidden;
}

.reps-modal__target {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: 20px;
}

.reps-modal__tier-goal {
  display: block;
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--color-accent);
  font-weight: 500;
}

.reps-modal__quick-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.reps-modal__quick-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.reps-modal__quick-btn:active:not(:disabled) {
  transform: scale(0.95);
  background: var(--color-bg-tertiary);
}

.reps-modal__quick-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.reps-modal__value-display {
  min-width: 80px;
  padding: 12px 16px;
  font-size: 2.5rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border-radius: 16px;
  border: 2px solid var(--color-border);
  transition: all 0.2s;
}

.reps-modal__value-display--exceeded {
  border-color: var(--color-success);
  color: var(--color-success);
}

.reps-modal__value-display--exact {
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.reps-modal__value-display--under {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.reps-modal__result {
  margin-top: 16px;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 20px;
}

.reps-modal__result--exceeded {
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
}

.reps-modal__result--exact {
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
}

.reps-modal__result--under {
  background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  color: var(--color-danger);
}

/* Progression hint */
.reps-modal__progression {
  margin-top: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 16px;
  text-align: center;
}

.reps-modal__progression--advance {
  background: color-mix(in srgb, var(--color-accent) 15%, transparent);
  color: var(--color-accent);
  animation: progression-pulse 1s ease-in-out infinite;
}

.reps-modal__progression--max {
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  color: #1a1a1a;
}

.reps-modal__progression--hint {
  background: color-mix(in srgb, var(--color-text-muted) 15%, transparent);
  color: var(--color-text-secondary);
}

.reps-modal__progression--secondary {
  margin-top: 6px;
  font-size: 0.7rem;
  opacity: 0.8;
  background: transparent;
  border: 1px dashed var(--color-border);
  color: var(--color-text-muted);
}

@keyframes progression-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.reps-modal__footer {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-modal, var(--color-bg-elevated));
}

.reps-modal__btn {
  flex: 1;
  padding: 12px 16px;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.reps-modal__btn--secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.reps-modal__btn--primary {
  background: var(--color-accent);
  color: white;
}

.reps-modal__btn:active {
  transform: scale(0.98);
}

/* Transitions - slide from bottom */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-active .reps-modal,
.modal-fade-leave-active .reps-modal {
  transition: transform 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .reps-modal,
.modal-fade-leave-to .reps-modal {
  transform: translateY(100%);
}

/* Under-target motivational hint */
.reps-modal__under-hint {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(220, 38, 38, 0.08) 100%);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  text-align: center;
}

.reps-modal__under-hint-message {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.35rem;
}

.reps-modal__under-hint-message strong {
  color: var(--color-text-primary);
}

.reps-modal__under-hint-next {
  font-size: 0.95rem;
  color: var(--color-text-primary);
  font-weight: 500;
}

.reps-modal__under-hint-next strong {
  color: #22d3ee;
  font-weight: 700;
  font-size: 1.05rem;
}

/* Phase 7: Tier advancement offer - YELLOW default */
.reps-modal__tier-offer {
  margin-top: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 152, 0, 0.1) 100%);
  border: 2px solid rgba(255, 193, 7, 0.5);
  border-radius: 16px;
  text-align: center;
}

/* GREEN theme for next level advancement */
.reps-modal__tier-offer--success {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%);
  border-color: rgba(34, 197, 94, 0.5);
}

.reps-modal__tier-offer-achieved {
  font-size: 0.9rem;
  font-weight: 600;
  color: #f59e0b;
  margin-bottom: 0.5rem;
}

.reps-modal__tier-offer-info {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.reps-modal__tier-offer-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 0.35rem;
}

.reps-modal__tier-offer-target {
  font-size: 1rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.reps-modal__tier-offer-target strong {
  color: #f59e0b;
  font-weight: 700;
  font-size: 1.1rem;
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}

.reps-modal__tier-offer--success .reps-modal__tier-offer-target strong {
  color: #22c55e;
  text-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
}

.reps-modal__tier-offer--success .reps-modal__tier-offer-achieved,
.reps-modal__tier-offer--success .reps-modal__tier-offer-target {
  color: #22c55e;
}

/* Button - yellow default */
.reps-modal__tier-offer-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #000;
  font-weight: 700;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1rem;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

/* Green button for next level */
.reps-modal__tier-offer--success .reps-modal__tier-offer-btn {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.reps-modal__tier-offer-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.5);
}

.reps-modal__tier-offer-btn:active {
  transform: scale(0.98);
}
</style>
