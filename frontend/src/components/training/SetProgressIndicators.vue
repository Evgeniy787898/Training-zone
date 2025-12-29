<template>
  <div class="set-indicators-wrapper">
    <div class="set-indicators__hint">Нажмите для ввода</div>
    <div class="set-indicators">
      <div 
        v-for="(set, idx) in sets" 
        :key="idx"
        class="set-indicator-container"
      >
        <button
          class="set-indicator"
          :class="[
            `set-indicator--${getSetStatus(idx)}`,
            { 
              'set-indicator--current': idx === currentSetIndex,
              'set-indicator--dynamic': isDynamicSet(idx)
            }
          ]"
          @click="handleSetClick(idx)"
          :aria-label="`Подход ${idx + 1}: ${getSetLabel(idx)}`"
        >
          <span v-if="set.completed" class="set-indicator__value">{{ set.reps }}</span>
          <span v-else class="set-indicator__target">{{ targetReps }}</span>
        </button>
        <!-- Delete button for dynamic unfilled sets -->
        <button 
          v-if="isDynamicSet(idx) && !set.completed"
          class="set-indicator__delete"
          @click.stop="handleRemoveDynamicSet"
          aria-label="Удалить динамический подход"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { hapticLight } from '@/utils/hapticFeedback';

interface SetData {
  completed: boolean;
  reps: number;
}

interface Props {
  totalSets: number;
  targetReps: number;
  completedSets: { setIndex: number; reps: number }[];
  currentSetIndex: number;
  // Phase 7: Dynamic sets support
  baseSets: number; // Original sets (before adding dynamic ones)
}

const props = withDefaults(defineProps<Props>(), {
  currentSetIndex: 0,
  baseSets: 0,
});

const emit = defineEmits<{
  (e: 'set-click', setIndex: number): void;
  (e: 'remove-dynamic-set'): void; // Phase 7: Remove last dynamic set
}>();

// Build sets array from completedSets
const sets = computed<SetData[]>(() => {
  const result: SetData[] = [];
  for (let i = 0; i < props.totalSets; i++) {
    const completed = props.completedSets.find(s => s.setIndex === i);
    result.push({
      completed: !!completed,
      reps: completed?.reps ?? 0
    });
  }
  return result;
});

// Phase 7: Check if set is dynamic (added after base sets)
const isDynamicSet = (idx: number): boolean => {
  const base = props.baseSets > 0 ? props.baseSets : props.totalSets;
  return idx >= base;
};

// Determine status for each set
type SetStatus = 'empty' | 'current' | 'exact' | 'exceeded' | 'under';

const getSetStatus = (idx: number): SetStatus => {
  const set = sets.value[idx];
  
  if (!set.completed) {
    return idx === props.currentSetIndex ? 'current' : 'empty';
  }
  
  if (set.reps > props.targetReps) {
    return 'exceeded';
  } else if (set.reps === props.targetReps) {
    return 'exact';
  } else {
    return 'under';
  }
};

// Label for accessibility
const getSetLabel = (idx: number): string => {
  const set = sets.value[idx];
  if (!set.completed) {
    return idx === props.currentSetIndex ? 'Текущий' : 'Не выполнен';
  }
  const status = getSetStatus(idx);
  switch (status) {
    case 'exceeded': return `${set.reps} (перевыполнено)`;
    case 'exact': return `${set.reps} (выполнено)`;
    case 'under': return `${set.reps} (не доделано)`;
    default: return '';
  }
};

const handleSetClick = (idx: number) => {
  emit('set-click', idx);
};

// Phase 7: Remove dynamic set
const handleRemoveDynamicSet = () => {
  emit('remove-dynamic-set');
  hapticLight();
};
</script>

<style scoped>
.set-indicators-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.set-indicators__hint {
  font-size: 0.6rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.set-indicators {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.set-indicator {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.set-indicator:active {
  transform: scale(0.95);
}

/* Empty state */
.set-indicator--empty {
  border-color: rgba(255, 255, 255, 0.15);
}

.set-indicator--empty .set-indicator__target {
  opacity: 0.4;
}

/* Current set - simple accent border */
.set-indicator--current {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* Exceeded target (green) */
.set-indicator--exceeded {
  background: color-mix(in srgb, var(--color-success) 80%, transparent);
  border-color: var(--color-success);
  color: white;
  animation: set-complete 0.3s ease-out;
}

/* Exact target (green - same as exceeded) */
.set-indicator--exact {
  background: color-mix(in srgb, var(--color-success) 60%, transparent);
  border-color: var(--color-success);
  color: white;
  animation: set-complete 0.3s ease-out;
}

/* Under target (light green - still completed) */
.set-indicator--under {
  background: color-mix(in srgb, var(--color-success) 40%, transparent);
  border-color: var(--color-success);
  color: var(--color-text-primary);
  animation: set-complete 0.3s ease-out;
}

@keyframes set-complete {
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

.set-indicator__value {
  font-variant-numeric: tabular-nums;
}

.set-indicator__target {
  font-variant-numeric: tabular-nums;
}

/* Phase 7: Dynamic set indicator container */
.set-indicator-container {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}

/* Dynamic sets - simple orange border */
.set-indicator--dynamic {
  border-color: #FF9800;
}

.set-indicator--dynamic.set-indicator--current {
  border-color: #FF9800;
  color: #FF9800;
}

/* Delete button for dynamic sets */
.set-indicator__delete {
  position: absolute;
  bottom: -8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #FF5252;
  border: none;
  color: white;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, background-color 0.15s;
}

.set-indicator__delete:hover {
  background: #FF1744;
  transform: scale(1.1);
}

.set-indicator__delete:active {
  transform: scale(0.9);
}
</style>
