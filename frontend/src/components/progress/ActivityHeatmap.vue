<template>
  <!-- ANAL-F02: GitHub-style activity heatmap for workout visualization -->
  <div class="activity-heatmap">
    <div class="heatmap-header">
      <h3 class="heatmap-title">{{ title }}</h3>
      <div class="heatmap-legend">
        <span class="legend-label">Меньше</span>
        <div class="legend-squares">
          <div 
            v-for="level in 5" 
            :key="level"
            class="legend-square"
            :style="{ backgroundColor: getColorForLevel(level - 1) }"
          />
        </div>
        <span class="legend-label">Больше</span>
      </div>
    </div>
    
    <div class="heatmap-grid" ref="gridRef">
      <!-- Month labels -->
      <div class="month-labels">
        <span 
          v-for="month in monthLabels" 
          :key="month.key"
          class="month-label"
          :style="{ gridColumnStart: month.col }"
        >
          {{ month.name }}
        </span>
      </div>
      
      <!-- Day labels -->
      <div class="day-labels">
        <span class="day-label">Пн</span>
        <span class="day-label"></span>
        <span class="day-label">Ср</span>
        <span class="day-label"></span>
        <span class="day-label">Пт</span>
        <span class="day-label"></span>
        <span class="day-label">Вс</span>
      </div>
      
      <!-- Heatmap cells -->
      <div class="heatmap-cells">
        <div 
          v-for="week in weeks" 
          :key="week.index"
          class="heatmap-week"
        >
          <div 
            v-for="day in week.days" 
            :key="day.date"
            class="heatmap-cell"
            :class="{ 'is-future': day.isFuture, 'is-today': day.isToday }"
            :style="{ backgroundColor: day.isFuture ? 'transparent' : getColorForLevel(day.level) }"
            :title="getTooltip(day)"
            @click="$emit('day-click', day)"
          />
        </div>
      </div>
    </div>
    
    <!-- Summary stats -->
    <div class="heatmap-stats">
      <div class="stat">
        <span class="stat-value">{{ totalWorkouts }}</span>
        <span class="stat-label">тренировок</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ currentStreak }}</span>
        <span class="stat-label">текущая серия</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ longestStreak }}</span>
        <span class="stat-label">лучшая серия</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { format, subDays, startOfWeek, isToday, isFuture, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface DayData {
  date: string; // YYYY-MM-DD
  count: number; // number of workouts/sets/etc
  level: number; // 0-4 intensity level
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekData {
  index: number;
  days: DayData[];
}

interface Props {
  title?: string;
  // Map of date string (YYYY-MM-DD) to count
  data: Record<string, number>;
  // Number of weeks to show (default 52)
  weeksToShow?: number;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Активность тренировок',
  weeksToShow: 52,
});

defineEmits<{
  (e: 'day-click', day: DayData): void;
}>();

// Color palette (dark theme optimized)
const colors = [
  'var(--color-bg-elevated)',     // Level 0 - no activity
  'rgba(16, 163, 127, 0.25)',     // Level 1 - low
  'rgba(16, 163, 127, 0.50)',     // Level 2 - medium-low
  'rgba(16, 163, 127, 0.75)',     // Level 3 - medium-high
  'var(--color-accent)',          // Level 4 - high
];

function getColorForLevel(level: number): string {
  return colors[Math.min(Math.max(level, 0), 4)];
}

// Calculate max value for level normalization
const maxCount = computed(() => {
  const values = Object.values(props.data);
  return Math.max(1, ...values);
});

// Convert count to level (0-4)
function countToLevel(count: number): number {
  if (count === 0) return 0;
  const ratio = count / maxCount.value;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// Generate weeks data
const weeks = computed<WeekData[]>(() => {
  const result: WeekData[] = [];
  const today = new Date();
  const startDate = startOfWeek(subDays(today, (props.weeksToShow - 1) * 7), { weekStartsOn: 1 });
  
  for (let weekIndex = 0; weekIndex < props.weeksToShow; weekIndex++) {
    const weekDays: DayData[] = [];
    
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayOffset = weekIndex * 7 + dayIndex;
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + dayOffset);
      
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = props.data[dateStr] || 0;
      
      weekDays.push({
        date: dateStr,
        count,
        level: countToLevel(count),
        isToday: isToday(date),
        isFuture: isFuture(date),
      });
    }
    
    result.push({ index: weekIndex, days: weekDays });
  }
  
  return result;
});

// Month labels
const monthLabels = computed(() => {
  const labels: { key: string; name: string; col: number }[] = [];
  const today = new Date();
  const startDate = startOfWeek(subDays(today, (props.weeksToShow - 1) * 7), { weekStartsOn: 1 });
  
  let lastMonth = -1;
  
  for (let weekIndex = 0; weekIndex < props.weeksToShow; weekIndex++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + weekIndex * 7);
    const month = date.getMonth();
    
    if (month !== lastMonth) {
      labels.push({
        key: `${month}-${date.getFullYear()}`,
        name: format(date, 'LLL', { locale: ru }),
        col: weekIndex + 1,
      });
      lastMonth = month;
    }
  }
  
  return labels;
});

// Calculate stats
const totalWorkouts = computed(() => {
  return Object.values(props.data).reduce((sum, count) => sum + count, 0);
});

const currentStreak = computed(() => {
  let streak = 0;
  const today = new Date();
  
  for (let i = 0; i < 365; i++) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    if (props.data[dateStr] && props.data[dateStr] > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  
  return streak;
});

const longestStreak = computed(() => {
  const dates = Object.keys(props.data).sort();
  let longest = 0;
  let current = 0;
  let prevDate: Date | null = null;
  
  for (const dateStr of dates) {
    if (props.data[dateStr] > 0) {
      const date = parseISO(dateStr);
      
      if (prevDate) {
        const diff = (date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          current++;
        } else {
          current = 1;
        }
      } else {
        current = 1;
      }
      
      longest = Math.max(longest, current);
      prevDate = date;
    }
  }
  
  return longest;
});

function getTooltip(day: DayData): string {
  if (day.isFuture) return '';
  const date = parseISO(day.date);
  const formattedDate = format(date, 'd MMMM yyyy', { locale: ru });
  
  if (day.count === 0) {
    return `${formattedDate}: нет тренировок`;
  }
  return `${formattedDate}: ${day.count} тренировок`;
}
</script>

<style scoped>
.activity-heatmap {
  padding: var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.heatmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.heatmap-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.legend-squares {
  display: flex;
  gap: 2px;
}

.legend-square {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.heatmap-grid {
  overflow-x: auto;
  padding-bottom: var(--space-xs);
}

.month-labels {
  display: grid;
  grid-template-columns: repeat(52, 12px);
  gap: 3px;
  margin-left: 28px;
  margin-bottom: var(--space-xs);
}

.month-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: capitalize;
}

.day-labels {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.day-label {
  height: 12px;
  font-size: 9px;
  color: var(--color-text-muted);
  line-height: 12px;
}

.heatmap-cells {
  display: flex;
  gap: 3px;
  margin-left: 28px;
}

.heatmap-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-out);
}

.heatmap-cell:hover:not(.is-future) {
  transform: scale(1.3);
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.heatmap-cell.is-today {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 1px;
}

.heatmap-cell.is-future {
  border: 1px dashed var(--color-border-subtle);
  cursor: default;
}

.heatmap-stats {
  display: flex;
  justify-content: space-around;
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-accent);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

/* Mobile optimization */
@media (max-width: 640px) {
  .heatmap-grid {
    font-size: 0.8em;
  }
  
  .heatmap-cell {
    width: 10px;
    height: 10px;
  }
  
  .month-labels {
    grid-template-columns: repeat(52, 10px);
  }
  
  .heatmap-stats {
    flex-wrap: wrap;
    gap: var(--space-md);
  }
}
</style>
