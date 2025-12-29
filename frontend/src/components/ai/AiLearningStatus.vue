<script setup lang="ts">
/**
 * AI Learning Status Component
 * Displays the AI's learning progress and statistics
 */
import { ref, onMounted, computed } from 'vue';
import { api } from '@/services/api';

interface LearningStats {
  learnedInstructions: number;
  topicInterests: string[];
  learningProfile: {
    exists: boolean;
    communicationStyle?: any;
    topics?: any;
  };
}

const stats = ref<LearningStats>({
  learnedInstructions: 0,
  topicInterests: [],
  learningProfile: { exists: false }
});

const loading = ref(true);
const error = ref<string | null>(null);

const hasLearningData = computed(() => 
  stats.value.learnedInstructions > 0 || 
  stats.value.topicInterests.length > 0 ||
  stats.value.learningProfile.exists
);

const loadStats = async () => {
  loading.value = true;
  error.value = null;

  try {
    // Load all stats in parallel
    const [instructionsRes, topicsRes, profileRes] = await Promise.all([
      api.get('/assistant/learned-instructions').catch(() => ({ data: { instructions: [] } })),
      api.get('/assistant/topic-interests').catch(() => ({ data: { topics: [] } })),
      api.get('/assistant/learning-profile').catch(() => ({ data: { exists: false } })),
    ]);

    stats.value = {
      learnedInstructions: instructionsRes.data?.instructions?.length || 0,
      topicInterests: topicsRes.data?.topics || [],
      learningProfile: profileRes.data || { exists: false },
    };
  } catch (err) {
    error.value = 'Не удалось загрузить статистику обучения';
    console.error('[AILearningStatus] Load failed:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadStats();
});

// Topic name translation
const topicLabels: Record<string, string> = {
  training: '💪 Тренировки',
  nutrition: '🥗 Питание',
  recovery: '😴 Восстановление',
  progress: '📈 Прогресс',
  motivation: '🔥 Мотивация',
};
</script>

<template>
  <div class="ai-learning-status">
    <div class="ai-learning-status__header">
      <span class="ai-learning-status__icon">🧠</span>
      <h3 class="ai-learning-status__title">AI Обучение</h3>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="ai-learning-status__loading">
      <span class="ai-learning-status__spinner"></span>
      Загрузка...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="ai-learning-status__error">
      {{ error }}
    </div>

    <!-- No data state -->
    <div v-else-if="!hasLearningData" class="ai-learning-status__empty">
      <p>AI ещё учится!</p>
      <p class="ai-learning-status__empty-hint">
        Ставь 👍 и 👎, чтобы помочь мне стать лучше
      </p>
    </div>

    <!-- Stats display -->
    <div v-else class="ai-learning-status__stats">
      <!-- Learned Instructions -->
      <div class="ai-learning-status__stat">
        <span class="ai-learning-status__stat-value">{{ stats.learnedInstructions }}</span>
        <span class="ai-learning-status__stat-label">правил изучено</span>
      </div>

      <!-- Topic Interests -->
      <div v-if="stats.topicInterests.length > 0" class="ai-learning-status__topics">
        <span class="ai-learning-status__label">Твои интересы:</span>
        <div class="ai-learning-status__topic-list">
          <span 
            v-for="topic in stats.topicInterests.slice(0, 5)" 
            :key="topic"
            class="ai-learning-status__topic-badge"
          >
            {{ topicLabels[topic] || topic }}
          </span>
        </div>
      </div>

      <!-- Learning Profile Status -->
      <div v-if="stats.learningProfile.exists" class="ai-learning-status__profile">
        <span class="ai-learning-status__profile-badge">
          ✓ Профиль обучения активен
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-learning-status {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 1rem;
  border: 1px solid var(--color-border);
}

.ai-learning-status__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.ai-learning-status__icon {
  font-size: 1.25rem;
}

.ai-learning-status__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.ai-learning-status__loading,
.ai-learning-status__error,
.ai-learning-status__empty {
  text-align: center;
  padding: 1rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.ai-learning-status__spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ai-learning-status__error {
  color: var(--color-error);
}

.ai-learning-status__empty-hint {
  font-size: 0.75rem;
  margin-top: 0.25rem;
  opacity: 0.7;
}

.ai-learning-status__stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ai-learning-status__stat {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.ai-learning-status__stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-accent);
}

.ai-learning-status__stat-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.ai-learning-status__topics {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-learning-status__label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ai-learning-status__topic-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ai-learning-status__topic-badge {
  background: var(--color-surface-elevated);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  border: 1px solid var(--color-border);
}

.ai-learning-status__profile {
  margin-top: 0.25rem;
}

.ai-learning-status__profile-badge {
  font-size: 0.75rem;
  color: var(--color-success);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
</style>
