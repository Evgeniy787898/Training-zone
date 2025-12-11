<template>
  <div class="page-shell history-page">
    <!-- Background -->
    <div class="page-bg">
      <div class="page-bg__grid"></div>
      <div class="page-bg__glow page-bg__glow--1"></div>
      <div class="page-bg__glow page-bg__glow--2"></div>
    </div>
    <header class="page-header history-page__header">
      <div>
        <h1 class="page-title">
          <AppIcon
            class="page-title__icon"
            name="calendar"
            variant="violet"
            :size="28"
          />
          <span>История тренировок</span>
        </h1>
        <p class="page-subtitle">
          Твой путь и достижения. Все завершенные тренировки в одном месте.
        </p>
      </div>
    </header>

    <section v-if="loading && !historyItems.length" class="surface-card surface-card--overlay history-page__loading">
      <SkeletonCard :lines="5" />
    </section>

    <section v-else-if="error && !historyItems.length" class="surface-card surface-card--overlay history-page__error">
      <ErrorState :message="error.message" action-label="Попробовать снова" @retry="loadHistory(true)" />
    </section>

    <section v-else class="history-page__content">
      <div v-if="!historyItems.length" class="surface-card surface-card--overlay history-page__empty">
        <div class="empty-state empty-state--inline">
          <div class="empty-state__icon">📜</div>
          <div class="empty-state__title">История пуста</div>
          <p class="empty-state__description">
            Завершенные тренировки будут появляться здесь.
          </p>
          <button type="button" class="button button--primary" @click="goToToday">
            Перейти к тренировке
          </button>
        </div>
      </div>

      <template v-else>
        <div class="history-list" role="list">
          <div
            v-for="session in historyItems"
            :key="session.id"
            class="surface-card history-card"
            role="article"
            @click="goToSession(session)"
          >
            <header class="history-card__header">
              <div class="history-card__date-group">
                <span class="history-card__day">{{ formatDay(session.plannedAt) }}</span>
                <span class="history-card__date">{{ formatDate(session.plannedAt) }}</span>
              </div>
              <NeonIcon
                name="success"
                variant="emerald"
                :size="20"
              />
            </header>

            <div class="history-card__body">
              <span class="history-card__type">{{ session.session_type || 'Тренировка' }}</span>
              <span v-if="session.focus" class="history-card__focus">
                <NeonIcon name="target" variant="violet" :size="16" />
                {{ session.focus }}
              </span>
              <span class="history-card__volume">
                <NeonIcon name="calendar" variant="aqua" :size="20" />
                {{ getSessionVolume(session) }}
              </span>
            </div>
            
            <div class="history-card__footer" v-if="session.discipline">
               <span class="history-card__discipline">{{ session.discipline.name }}</span>
            </div>
          </div>
        </div>

        <div v-if="hasMore" class="history-page__load-more">
          <button 
            type="button" 
            class="button button--ghost" 
            @click="loadMore"
            :disabled="loading"
          >
            {{ loading ? 'Загрузка...' : 'Показать еще' }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useRouter } from 'vue-router';
import { apiClient } from '@/services/api'; // Direct import for now as cachedApi might strict
import type { TrainingSession } from '@/types';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import ErrorState from '@/modules/shared/components/ErrorState.vue';
import SkeletonCard from '@/modules/shared/components/SkeletonCard.vue';
import { useAppStore } from '@/stores/app';

const router = useRouter();
const appStore = useAppStore();

const historyItems = ref<TrainingSession[]>([]);
const loading = ref(false);
const error = ref<Error | null>(null);
const page = ref(1);
const hasMore = ref(true);
const pageSize = 10;

const formatDay = (dateStr?: string | Date | null) => {
  if (!dateStr) return '';
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return format(date, 'EE', { locale: ru });
};

const formatDate = (dateStr?: string | Date | null) => {
  if (!dateStr) return '';
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return format(date, 'd MMMM yyyy', { locale: ru });
};

const getSessionVolume = (session: TrainingSession): string => {
  if (!session.exercises?.length) return 'Нет упражнений';
  
  let totalSets = 0;
  let totalReps = 0;
  
  session.exercises.forEach(ex => {
    const sets = ex.actualSets ?? ex.target?.sets ?? 0;
    const reps = ex.actualReps ?? ex.target?.reps ?? 0;
    
    if (sets > 0) {
      totalSets += sets;
      if (reps > 0) {
        totalReps += sets * reps;
      }
    }
  });
  
  if (totalSets === 0) return '0 подходов';
  return `${totalSets} подх. • ${totalReps} повт.`;
};

const loadHistory = async (reset = false) => {
  if (loading.value) return;
  
  if (reset) {
    page.value = 1;
    historyItems.value = [];
    hasMore.value = true;
  }

  loading.value = true;
  error.value = null;

  try {
    const result = await apiClient.getHistory(page.value, pageSize);
    
    if (result.items.length < pageSize) {
      hasMore.value = false;
    }
    
    if (reset) {
      historyItems.value = result.items;
    } else {
      historyItems.value = [...historyItems.value, ...result.items];
    }
    
    page.value++;
  } catch (err: any) {
    error.value = err;
    appStore.showToast({
       title: 'Ошибка загрузки истории',
       message: err.message,
       type: 'error'
    });
  } finally {
    loading.value = false;
  }
};

const loadMore = () => {
  loadHistory();
};

const goToToday = () => {
  router.push('/today');
};

const goToSession = (session: TrainingSession) => {
   // Navigate to today page but with specific date? 
   // Or maybe we need a read-only session view?
   // For now, let's navigate to TodayPage with query param date
   if (session.plannedAt) {
       const dateStr = format(parseISO(session.plannedAt as string), 'yyyy-MM-dd');
       router.push({ path: '/today', query: { date: dateStr } });
   }
};

onMounted(() => {
  loadHistory(true);
});
</script>

<style scoped>
.history-page {
  position: relative;
  gap: clamp(1.5rem, 4vw, 2.5rem);
}

/* Background */
.page-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.page-bg__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 28px 28px;
}
.page-bg__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
}
.page-bg__glow--1 { width: 180px; height: 180px; top: -40px; right: -20px; background: var(--color-accent); }
.page-bg__glow--2 { width: 140px; height: 140px; bottom: 25%; left: -30px; background: #a855f7; }

.history-page__content {
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 4vw, 2.25rem);
}

.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
}

.history-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: clamp(1.1rem, 1vw + 0.8rem, 1.6rem);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--color-border) 62%, transparent);
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--color-surface) 40%, transparent) 0%,
    color-mix(in srgb, var(--color-surface-hover) 20%, transparent) 100%
  );
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.history-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
}

.history-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.history-card__date-group {
    display: flex;
    flex-direction: column;
}

.history-card__day {
  font-weight: 600;
  text-transform: uppercase;
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  color: var(--color-text-secondary);
}

.history-card__date {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-text-primary);
}

.history-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.history-card__type {
  font-weight: 600;
  color: var(--color-accent);
}

.history-card__focus {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.history-card__volume {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--space-2xs);
}

.history-card__footer {
    margin-top: auto;
    padding-top: var(--space-sm);
    border-top: 1px dashed color-mix(in srgb, var(--color-border) 40%, transparent);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

.history-page__load-more {
  display: flex;
  justify-content: center;
  padding-block: var(--space-md);
}
</style>
