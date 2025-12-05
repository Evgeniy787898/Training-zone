<template>
  <article :class="['exercise-card', { 'is-expanded': expanded }]">
    <button
      type="button"
      class="exercise-card__trigger"
      @click="$emit('toggle', exercise.key)"
      :aria-expanded="expanded"
      :aria-label="`Переключить детали упражнения ${exercise.title}`"
    >
      <div class="exercise-card__media" aria-hidden="true">
        <OptimizedImage
          v-if="coverSource"
          class="exercise-card__media-img"
          :src="coverSource.src"
          :srcset="coverSource.srcset || undefined"
          :sizes="coverSource.sizes || undefined"
          alt=""
          loading="lazy"
          :lazy="true"
          root-margin="240px"
        />
        <div v-else class="exercise-card__media-placeholder">
          <AppIcon name="dumbbell" :size="32" variant="neutral" tone="ghost" />
        </div>

        <div class="exercise-card__media-overlay">
          <span class="exercise-card__focus">{{ exercise.focus }}</span>
          <div v-if="latest" class="exercise-card__media-meta">
            <span class="exercise-card__level-chip">Уровень {{ latest.level || '—' }}</span>
          </div>
        </div>
      </div>

      <div class="exercise-card__content">
        <div class="exercise-card__header">
          <h3 class="exercise-card__title">{{ exercise.title }}</h3>
          <AppIcon 
            class="exercise-card__chevron" 
            :name="expanded ? 'chevronUp' : 'chevronDown'" 
            variant="neutral" 
            :size="20" 
          />
        </div>
        <span v-if="latest && (latest as any).session_date" class="exercise-card__date-chip">{{ (latest as any).session_date }}</span>
        
        <p v-if="summaryText" class="exercise-card__excerpt">{{ summaryText }}</p>

        <div v-if="exercise.tags && exercise.tags.length" class="exercise-card__tags" role="list">
          <span v-for="tag in exercise.tags" :key="tag" class="exercise-card__tag" role="listitem">
            {{ tag }}
          </span>
        </div>
      </div>
    </button>

    <div v-if="expanded" class="exercise-card__details">
      <p v-if="exercise.description" class="exercise-card__description">
        {{ exercise.description }}
      </p>

      <div v-if="exercise.cue" class="exercise-card__cue">
        <AppIcon name="spark" variant="accent" :size="20" />
        <span>{{ exercise.cue }}</span>
      </div>

      <a
        v-if="exercise.media?.video"
        :href="exercise.media.video"
        target="_blank"
        rel="noopener noreferrer"
        class="exercise-card__video"
        aria-label="Смотреть видеоразбор упражнения"
      >
        Смотреть видеоразбор
      </a>

      <section class="exercise-card__section" aria-label="Прогрессия упражнений">
        <header class="exercise-card__section-head">
          <h4 class="exercise-card__section-title">Прогрессия</h4>
        </header>
        <div class="exercise-card__grid">
          <article v-for="level in exercise.levels || []" :key="level.id" class="exercise-card__level">
            <div class="exercise-card__level-number">{{ level.level || level.id }}</div>
            <div class="exercise-card__level-title">{{ level.title }}</div>
            <div class="exercise-card__level-meta">{{ level.sets }} × {{ level.reps }}</div>
          </article>
        </div>
      </section>

      <section class="exercise-card__section" aria-label="История тренировок">
        <header class="exercise-card__section-head">
          <h4 class="exercise-card__section-title">История</h4>
        </header>
        <p v-if="loadingHistory" class="exercise-card__muted">Загружаю историю...</p>
        <p v-else-if="history.length === 0" class="exercise-card__muted">Пока нет отметок по этому упражнению.</p>
        <div v-else class="exercise-card__history">
          <article v-for="item in history" :key="item.id" class="exercise-card__history-item">
            <div>
              <div class="exercise-card__history-date">{{ item.session?.date || '—' }}</div>
              <div class="exercise-card__history-meta">{{ item.levelResult || '—' }} · RPE {{ item.rpe || '—' }}</div>
            </div>
            <div v-if="item.decision" class="exercise-card__history-decision">
              <AppIcon
                :name="getDecisionIcon(item.decision).name"
                :variant="getDecisionIcon(item.decision).variant"
                :size="18"
              />
              <span>{{ getDecisionLabel(item.decision) }}</span>
            </div>
          </article>
        </div>
      </section>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import OptimizedImage from '@/modules/shared/components/OptimizedImage.vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import type { IconName } from '@/modules/shared/icons/registry';
import { buildExerciseImageSource } from '@/utils/exerciseImages';
import { ExerciseCatalogItem, ExerciseHistoryItem } from '@/types';

type AppIconVariant = 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral';

interface Props {
  exercise: ExerciseCatalogItem;
  expanded?: boolean;
  history?: ExerciseHistoryItem[];
  loadingHistory?: boolean;
}

const props = defineProps<Props>();

const latest = computed(() => props.exercise.latest_progress as any);
const history = computed(() => props.history ?? []);
const loadingHistory = computed(() => props.loadingHistory ?? false);

const coverSource = computed(() =>
  buildExerciseImageSource(props.exercise.media?.image ?? null, {
    defaultWidth: 960,
    maxHeight: 540,
  }),
);

const summaryText = computed(() => props.exercise.description || props.exercise.cue || '');

const DECISION_ICON_MAP: Record<string, { name: IconName; variant: AppIconVariant }> = {
  advance: { name: 'rocket', variant: 'success' },
  hold: { name: 'target', variant: 'info' },
  regress: { name: 'reset', variant: 'warning' },
};

const getDecisionIcon = (decision: string) => {
  return DECISION_ICON_MAP[decision] || { name: 'info', variant: 'neutral' };
};

const getDecisionLabel = (decision: string) => {
  const labels: Record<string, string> = {
    advance: 'Прогрессируем',
    hold: 'Закрепляем',
    regress: 'Облегчаем',
  };
  return labels[decision] || decision;
};
</script>

<style scoped>
.exercise-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  overflow: hidden;
  transition: border-color 0.2s ease;
}

.exercise-card.is-expanded {
  border-color: var(--color-accent);
}

.exercise-card__trigger {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: 100%;
  padding: var(--space-md);
  text-align: left;
  border: none;
  background: transparent;
  cursor: pointer;
}

.exercise-card__media {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  isolation: isolate;
  min-block-size: 180px;
  background: var(--color-bg-elevated);
}

.exercise-card__media-img,
.exercise-card__media-placeholder {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  min-height: 180px;
}

.exercise-card__media-img :deep(img) {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.exercise-card__media-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevated);
  color: var(--color-text-tertiary);
}

.exercise-card__media-overlay {
  position: absolute;
  inset: 0;
  padding: var(--space-sm);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  /* Clean gradient for text protection only */
  background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.7) 100%);
}

.exercise-card__focus {
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  backdrop-filter: blur(4px);
}

.exercise-card__media-meta {
  display: flex;
  gap: var(--space-xs);
}

.exercise-card__level-chip {
  font-size: 0.8rem;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.exercise-card__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.exercise-card__header {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  justify-content: space-between;
}

.exercise-card__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.exercise-card__chevron {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
  transition: transform 0.2s ease;
}

.exercise-card.is-expanded .exercise-card__chevron {
  transform: rotate(180deg);
  color: var(--color-accent);
}

.exercise-card__excerpt {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.exercise-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.exercise-card__tag {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
}

.exercise-card__details {
  padding: 0 var(--space-md) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-sm);
  padding-top: var(--space-md);
}

.exercise-card__description {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-primary);
}

.exercise-card__cue {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.exercise-card__video {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.25rem;
  border-radius: 999px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-accent);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
  transition: background-color 0.2s ease;
}

.exercise-card__video:active {
  background: var(--color-bg-surface);
}

.exercise-card__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.exercise-card__section-title {
  margin: 0;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.exercise-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-sm);
}

.exercise-card__level {
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
}

.exercise-card__level-number {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--color-accent);
}

.exercise-card__level-title {
  margin-top: 2px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.exercise-card__level-meta {
  margin-top: 4px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.exercise-card__muted {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: 0.9rem;
  font-style: italic;
}

.exercise-card__history {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.exercise-card__history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border);
}

.exercise-card__history-item:last-child {
  border-bottom: none;
}

.exercise-card__history-date {
  font-weight: 500;
  font-size: 0.9rem;
}

.exercise-card__history-meta {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.exercise-card__history-decision {
  display: flex;
  gap: 6px;
  align-items: center;
  font-weight: 500;
  font-size: 0.85rem;
}
</style>
