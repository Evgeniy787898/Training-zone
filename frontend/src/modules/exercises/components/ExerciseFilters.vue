<template>
  <div class="exercise-filters">
    <!-- GAP-004: Exercise Search -->
    <div class="exercise-filters__search">
      <input
        :value="searchQuery"
        type="text"
        class="input exercise-filters__input"
        placeholder="Поиск упражнения..."
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
      <span 
        v-if="searchQuery" 
        class="exercise-filters__clear" 
        @click="$emit('clear-search')"
      >×</span>
    </div>

    <!-- GAP-005: Equipment Filter -->
    <div v-if="availableEquipment.length > 0" class="exercise-filters__equipment">
      <button
        v-for="eq in availableEquipment"
        :key="eq"
        class="exercise-filters__chip"
        :class="{ 'exercise-filters__chip--active': equipmentFilter.includes(eq) }"
        @click="$emit('toggle-equipment', eq)"
      >
        {{ eq }}
      </button>
      <button
        v-if="equipmentFilter.length > 0"
        class="exercise-filters__chip exercise-filters__chip--clear"
        @click="$emit('clear-equipment')"
      >
        Сбросить
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ExerciseFilters - Search and equipment filter component
 * Extracted from ExercisesPage.vue as part of PROG-R02
 */
defineProps<{
  searchQuery: string;
  equipmentFilter: string[];
  availableEquipment: string[];
}>();

defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'clear-search'): void;
  (e: 'toggle-equipment', eq: string): void;
  (e: 'clear-equipment'): void;
}>();
</script>

<style scoped>
.exercise-filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* Search */
.exercise-filters__search {
  position: relative;
  padding: 0 var(--space-sm);
}

.exercise-filters__input {
  width: 100%;
  padding-right: var(--space-xl);
}

.exercise-filters__clear {
  position: absolute;
  right: var(--space-lg);
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-xs);
  line-height: 1;
  transition: color 0.15s ease;
}

.exercise-filters__clear:hover {
  color: var(--color-text-primary);
}

/* Equipment Filter */
.exercise-filters__equipment {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  padding: 0 var(--space-sm);
}

.exercise-filters__chip {
  padding: var(--space-2xs) var(--space-sm);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.exercise-filters__chip:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
}

.exercise-filters__chip--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-on-accent, #fff);
}

.exercise-filters__chip--active:hover {
  background: var(--color-accent);
  filter: brightness(1.1);
}

.exercise-filters__chip--clear {
  background: transparent;
  border-color: rgba(255, 100, 100, 0.3);
  color: rgba(255, 100, 100, 0.8);
}

.exercise-filters__chip--clear:hover {
  background: rgba(255, 100, 100, 0.1);
  border-color: rgba(255, 100, 100, 0.5);
}
</style>
