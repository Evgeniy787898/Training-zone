<template>
  <!-- ANAL-F03: Personal records display with history -->
  <div class="personal-records">
    <div class="records-header">
      <h3 class="records-title">
        <span class="title-icon">🏆</span>
        {{ title }}
      </h3>
      <button 
        v-if="records.length > 3"
        class="toggle-btn"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Скрыть' : `Показать все (${records.length})` }}
      </button>
    </div>

    <div v-if="loading" class="records-loading">
      <div class="loading-spinner" />
      <span>Загрузка рекордов...</span>
    </div>

    <div v-else-if="records.length === 0" class="records-empty">
      <span class="empty-icon">📊</span>
      <p>Пока нет записей о рекордах</p>
      <p class="empty-hint">Завершите тренировки, чтобы увидеть ваши достижения</p>
    </div>

    <div v-else class="records-list">
      <TransitionGroup name="record">
        <div 
          v-for="record in displayedRecords" 
          :key="record.exerciseKey"
          class="record-card"
          @click="$emit('record-click', record)"
        >
          <div class="record-icon">
            <img 
              v-if="record.iconUrl" 
              :src="record.iconUrl" 
              :alt="record.exerciseName"
              class="exercise-icon"
            />
            <span v-else class="icon-placeholder">💪</span>
          </div>
          
          <div class="record-info">
            <h4 class="exercise-name">{{ record.exerciseName }}</h4>
            <div class="record-details">
              <span class="record-value">{{ formatValue(record) }}</span>
              <span class="record-meta">
                {{ formatDate(record.achievedAt) }}
              </span>
            </div>
          </div>
          
          <div class="record-badge" :class="getBadgeClass(record)">
            <span v-if="record.isNew" class="new-badge">NEW</span>
            <span class="improvement" v-if="record.improvement > 0">
              +{{ record.improvement }}%
            </span>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Summary -->
    <div v-if="records.length > 0" class="records-summary">
      <div class="summary-stat">
        <span class="stat-value">{{ totalRecords }}</span>
        <span class="stat-label">рекордов</span>
      </div>
      <div class="summary-stat">
        <span class="stat-value">{{ recentRecords }}</span>
        <span class="stat-label">за месяц</span>
      </div>
      <div class="summary-stat">
        <span class="stat-value">{{ avgImprovement }}%</span>
        <span class="stat-label">средний рост</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { format, isAfter, subDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface PersonalRecord {
  exerciseKey: string;
  exerciseName: string;
  iconUrl?: string;
  recordType: 'max_weight' | 'max_reps' | 'max_time' | 'max_level';
  value: number;
  unit: string;
  previousValue?: number;
  improvement: number; // Percentage improvement from previous
  achievedAt: string; // ISO date string
  isNew: boolean; // Achieved in last 7 days
}

interface Props {
  title?: string;
  records: PersonalRecord[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Персональные рекорды',
  loading: false,
});

defineEmits<{
  (e: 'record-click', record: PersonalRecord): void;
}>();

const showAll = ref(false);

const displayedRecords = computed(() => {
  if (showAll.value) return props.records;
  return props.records.slice(0, 5);
});

const totalRecords = computed(() => props.records.length);

const recentRecords = computed(() => {
  const thirtyDaysAgo = subDays(new Date(), 30);
  return props.records.filter(r => {
    try {
      return isAfter(parseISO(r.achievedAt), thirtyDaysAgo);
    } catch {
      return false;
    }
  }).length;
});

const avgImprovement = computed(() => {
  const improvements = props.records.filter(r => r.improvement > 0).map(r => r.improvement);
  if (improvements.length === 0) return 0;
  return Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
});

function formatValue(record: PersonalRecord): string {
  switch (record.recordType) {
    case 'max_weight':
      return `${record.value} ${record.unit}`;
    case 'max_reps':
      return `${record.value} повт.`;
    case 'max_time':
      const mins = Math.floor(record.value / 60);
      const secs = record.value % 60;
      return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
    case 'max_level':
      return `Уровень ${record.value}`;
    default:
      return `${record.value} ${record.unit}`;
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'd MMM yyyy', { locale: ru });
  } catch {
    return dateStr;
  }
}

function getBadgeClass(record: PersonalRecord): string {
  if (record.isNew) return 'badge-new';
  if (record.improvement >= 20) return 'badge-high';
  if (record.improvement >= 10) return 'badge-medium';
  return 'badge-low';
}
</script>

<style scoped>
.personal-records {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-md);
}

.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.records-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.title-icon {
  font-size: 1.2em;
}

.toggle-btn {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast);
}

.toggle-btn:hover {
  background: var(--color-accent-subtle);
}

.records-loading,
.records-empty {
  text-align: center;
  padding: var(--space-xl) var(--space-md);
  color: var(--color-text-secondary);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto var(--space-sm);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: var(--space-sm);
}

.empty-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.record-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.record-card:hover {
  border-color: var(--color-accent);
  transform: translateX(4px);
}

.record-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.exercise-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.icon-placeholder {
  font-size: 1.5rem;
}

.record-info {
  flex: 1;
  min-width: 0;
}

.exercise-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0 0 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.record-details {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.record-value {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-accent);
}

.record-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.record-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.new-badge {
  font-size: 9px;
  font-weight: 700;
  color: white;
  background: var(--color-warning);
  padding: 2px 6px;
  border-radius: var(--radius-full);
}

.improvement {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-success);
}

.badge-high .improvement { color: var(--color-accent); }
.badge-medium .improvement { color: var(--color-success); }
.badge-low .improvement { color: var(--color-text-secondary); }

.records-summary {
  display: flex;
  justify-content: space-around;
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.summary-stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-accent);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

/* Transitions */
.record-enter-active,
.record-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
}

.record-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.record-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Mobile */
@media (max-width: 640px) {
  .record-card {
    padding: var(--space-sm);
    gap: var(--space-sm);
  }
  
  .record-icon {
    width: 36px;
    height: 36px;
  }
  
  .records-summary {
    flex-wrap: wrap;
    gap: var(--space-md);
  }
}
</style>
