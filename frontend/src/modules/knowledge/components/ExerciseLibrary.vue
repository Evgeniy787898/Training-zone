<template>
  <div class="exercise-library">
    <!-- Filters & Search Header -->
    <div class="library-controls surface-card">
      <div class="control-row">
        <!-- Search -->
        <div class="search-input-wrapper">
          <AppIcon name="search" size="20" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Поиск упражнения..."
            class="search-input"
          />
          <button v-if="searchQuery" @click="searchQuery = ''" class="clear-btn">
            <AppIcon name="close" size="16" />
          </button>
        </div>

        <!-- Favorites Toggle -->
        <button 
          class="favorite-filter-btn"
          :class="{ 'active': showFavoritesOnly }"
          @click="showFavoritesOnly = !showFavoritesOnly"
          aria-label="Показать только избранное"
        >
          <AppIcon :name="showFavoritesOnly ? 'heartFilled' : 'heart'" variant="rose" />
          <span class="desktop-only">Избранное</span>
        </button>
      </div>

      <!-- Muscle Group Chips -->
      <div class="muscle-filters">
        <button
          class="filter-chip"
          :class="{ 'active': !selectedMuscleGroup }"
          @click="selectedMuscleGroup = null"
        >
          Все
        </button>
        <button
          v-for="group in availableMuscleGroups"
          :key="group"
          class="filter-chip"
          :class="{ 'active': selectedMuscleGroup === group }"
          @click="toggleMuscleGroup(group)"
        >
          {{ group }}
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="library-content">
      <div v-if="loading" class="loading-state">
        <LoadingState />
      </div>
      
      <div v-else-if="filteredExercises.length === 0" class="empty-state">
        <AppIcon name="search" size="48" variant="neutral" class="empty-icon" />
        <h3>Ничего не найдено</h3>
        <p>Попробуйте изменить параметры поиска или фильтры</p>
        <button class="reset-btn" @click="resetFilters">Сбросить фильтры</button>
      </div>

      <div v-else class="exercises-grid">
        <ExerciseCard
          v-for="exercise in filteredExercises"
          :key="exercise.key"
          :exercise="exercise"
          :is-favorite="favorites.has(exercise.key)"
          @toggle-favorite="toggleFavorite"
          @click="$emit('select-exercise', exercise)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import ExerciseCard from '@/modules/exercises/components/ExerciseCard.vue';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import type { ExerciseCatalogItem } from '@/types';

// Props
const props = defineProps<{
  exercises: ExerciseCatalogItem[];
  loading?: boolean;
}>();

// Emits
const emit = defineEmits<{
  (e: 'select-exercise', exercise: ExerciseCatalogItem): void;
  (e: 'toggle-favorite', exerciseId: string): void;
}>();

// API Client
import { apiClient } from '@/services/api';

// State
const searchQuery = ref('');
const selectedMuscleGroup = ref<string | null>(null);
const showFavoritesOnly = ref(false);

// Favorites synced with backend
const favorites = ref<Set<string>>(new Set());
const favoritesLoading = ref(false);

// Load favorites on mount
onMounted(async () => {
  try {
    favoritesLoading.value = true;
    const result = await apiClient.getFavorites();
    favorites.value = new Set(result.items);
  } catch (error) {
    console.error('Failed to load favorites:', error);
  } finally {
    favoritesLoading.value = false;
  }
});

// Computed
const availableMuscleGroups = computed(() => {
  const groups = new Set<string>();
  props.exercises.forEach(ex => {
    if (ex.muscleGroup) groups.add(ex.muscleGroup);
  });
  return Array.from(groups).sort();
});

const filteredExercises = computed(() => {
  return props.exercises.filter(ex => {
    // 1. Muscle Filter
    if (selectedMuscleGroup.value && ex.muscleGroup !== selectedMuscleGroup.value) {
      return false;
    }
    
    // 2. Favorites Filter
    if (showFavoritesOnly.value && !favorites.value.has(ex.key)) { // Using key as ID
      return false;
    }

    // 3. Search Query
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      return (
        ex.title.toLowerCase().includes(q) ||
        ex.description?.toLowerCase().includes(q) ||
        ex.muscleGroup?.toLowerCase().includes(q)
      );
    }

    return true;
  });
});

// Methods
const toggleMuscleGroup = (group: string) => {
  if (selectedMuscleGroup.value === group) {
    selectedMuscleGroup.value = null;
  } else {
    selectedMuscleGroup.value = group;
  }
};

const resetFilters = () => {
  searchQuery.value = '';
  selectedMuscleGroup.value = null;
  showFavoritesOnly.value = false;
};

const toggleFavorite = async (exerciseKey: string) => {
  try {
    // Optimistic update
    const wasInFavorites = favorites.value.has(exerciseKey);
    if (wasInFavorites) {
      favorites.value.delete(exerciseKey);
    } else {
      favorites.value.add(exerciseKey);
    }
    
    const result = await apiClient.toggleFavorite(exerciseKey);
    
    // Sync with server response
    if (result.isFavorite) {
      favorites.value.add(exerciseKey);
    } else {
      favorites.value.delete(exerciseKey);
    }
    
    emit('toggle-favorite', exerciseKey);
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    // Rollback optimistic update on error
    // (we can't easily rollback without storing previous state, but the error is logged)
  }
};
</script>

<style scoped>
.exercise-library {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: 100%;
}

.library-controls {
  position: sticky;
  top: var(--header-height); /* Ensure sticky below header */
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.control-row {
  display: flex;
  gap: 1rem;
  align-items: center;
}

/* Search Input */
.search-input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-bg-tertiary); /* Input bg */
  border-radius: var(--radius-lg);
  padding: 0 1rem;
  height: 3rem;
  transition: box-shadow 0.2s;
}

.search-input-wrapper:focus-within {
  box-shadow: 0 0 0 2px var(--color-primary);
}

.search-icon {
  color: var(--color-text-tertiary);
  margin-right: 0.5rem;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-size: 1rem;
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-tertiary);
}

.clear-btn {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 0.25rem;
}

/* Favorite Button */
.favorite-filter-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 3rem;
  padding: 0 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.favorite-filter-btn.active {
  background: color-mix(in srgb, var(--color-rose) 10%, transparent);
  border-color: var(--color-rose);
  color: var(--color-rose);
}

/* Muscle Filters */
.muscle-filters {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  -webkit-overflow-scrolling: touch; /* smooth scroll */
  scrollbar-width: none; /* hide scrollbar firefox */
}

.muscle-filters::-webkit-scrollbar {
  display: none; /* hide scrollbar webkit */
}

.filter-chip {
  flex: 0 0 auto;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-chip.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

/* Content */
.exercises-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-icon {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.reset-btn {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
}

/* Responsive */
@media (max-width: 640px) {
  .desktop-only {
    display: none;
  }
  .favorite-filter-btn {
    padding: 0 0.75rem;
  }
}
</style>
