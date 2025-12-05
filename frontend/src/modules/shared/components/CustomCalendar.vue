<template>
  <transition name="calendar-fade">
    <div
      v-if="isOpen"
      class="calendar-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Календарь выбора даты"
      @click.self="$emit('close')"
      @keyup.esc="$emit('close')"
    >
      <section class="calendar" @click.stop>
        <header class="calendar__header">
          <div class="calendar__title-group">
            <h3 class="calendar__title">Выберите дату</h3>
            <p class="calendar__subtitle">{{ monthLabel }}</p>
          </div>
          <button
            type="button"
            class="calendar__close"
            @click="$emit('close')"
            aria-label="Закрыть календарь"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div class="calendar__toolbar">
          <button
            type="button"
            class="calendar__nav"
            @click="handlePrevMonth"
            aria-label="Предыдущий месяц"
          >
            ‹
          </button>
          <div class="calendar__meta">
            <span class="calendar__meta-month">{{ monthLabel }}</span>
            <span class="calendar__meta-year">{{ format(currentMonth, 'yyyy') }}</span>
          </div>
          <button
            type="button"
            class="calendar__nav"
            @click="handleNextMonth"
            aria-label="Следующий месяц"
          >
            ›
          </button>
        </div>

        <div class="calendar__weekdays" aria-hidden="true">
          <span
            v-for="day in weekDays"
            :key="day"
            class="calendar__weekday"
          >
            {{ day }}
          </span>
        </div>

        <div class="calendar__grid">
          <button
            v-for="(day, index) in calendarDays"
            :key="index"
            type="button"
            class="calendar__day"
            :class="{
              'is-outside': !day.isCurrentMonth,
              'is-selected': day.isSelected,
              'is-today': day.isToday
            }"
            :disabled="!day.isCurrentMonth"
            :aria-label="day.ariaLabel"
            @click="handleDayClick(day)"
          >
            <span>{{ day.date.getDate() }}</span>
            <span v-if="day.isSelected" class="calendar__check" aria-hidden="true">•</span>
          </button>
        </div>
      </section>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday
} from 'date-fns';
import { ru } from 'date-fns/locale';

const props = defineProps<{
  isOpen: boolean;
  value: Date;
}>();

const emit = defineEmits<{
  'update:value': [date: Date];
  close: [];
}>();

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const currentMonth = ref(new Date(props.value));

watch(
  () => props.value,
  (newValue) => {
    currentMonth.value = new Date(newValue);
  },
  { immediate: true }
);

const monthLabel = computed(() => format(currentMonth.value, 'LLLL yyyy', { locale: ru }));

const calendarDays = computed(() => {
  const monthStart = startOfMonth(currentMonth.value);
  const monthEnd = endOfMonth(currentMonth.value);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = monthStart.getDay();
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const previousDays: Date[] = [];
  for (let i = 0; i < adjustedFirstDay; i += 1) {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - (adjustedFirstDay - i));
    previousDays.push(date);
  }

  const lastDayOfWeek = monthEnd.getDay();
  const adjustedLastDay = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;

  const nextDays: Date[] = [];
  for (let i = 1; i <= adjustedLastDay; i += 1) {
    const date = new Date(monthEnd);
    date.setDate(date.getDate() + i);
    nextDays.push(date);
  }

  const allDays = [...previousDays, ...daysInMonth, ...nextDays];

  return allDays.map((day) => {
    const isCurrentMonth = isSameMonth(day, currentMonth.value);
    const isSelected = isSameDay(day, props.value);
    const today = isToday(day);

    const ariaLabel = `${format(day, 'd LLLL yyyy', { locale: ru })}${today ? ', сегодня' : ''}${
      isSelected ? ', выбрана' : ''
    }${!isCurrentMonth ? ', вне текущего месяца' : ''}`;

    return {
      date: day,
      isCurrentMonth,
      isSelected,
      isToday: today,
      ariaLabel
    };
  });
});

const handlePrevMonth = () => {
  currentMonth.value = subMonths(currentMonth.value, 1);
};

const handleNextMonth = () => {
  currentMonth.value = addMonths(currentMonth.value, 1);
};

const handleDayClick = (day: {
  date: Date;
  isCurrentMonth: boolean;
}) => {
  if (!day.isCurrentMonth) return;
  emit('update:value', day.date);
  emit('close');
};
</script>

<style scoped>
.calendar-fade-enter-active,
.calendar-fade-leave-active {
  transition: opacity 0.18s ease;
}

.calendar-fade-enter-from,
.calendar-fade-leave-to {
  opacity: 0;
}

.calendar-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 3vw, 2.5rem);
  background: color-mix(in srgb, rgba(7, 10, 18, 0.75) 70%, transparent);
  backdrop-filter: blur(18px);
}

.calendar {
  inline-size: min(100%, 28rem);
  display: flex;
  flex-direction: column;
  gap: clamp(0.85rem, 1vw, 1.2rem);
  padding: clamp(1.4rem, 3vw, 2rem);
  border-radius: var(--radius-2xl);
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: linear-gradient(
    150deg,
    color-mix(in srgb, var(--panel-surface-base) 92%, transparent) 0%,
    color-mix(in srgb, var(--panel-surface-gradient) 65%, transparent) 100%
  );
  box-shadow: var(--shadow-lg);
}

.calendar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.calendar__title-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.calendar__title {
  margin: 0;
  font-size: clamp(1.1rem, 2.4vw, 1.4rem);
  font-weight: 600;
}

.calendar__subtitle {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  text-transform: capitalize;
}

.calendar__close {
  inline-size: clamp(2.4rem, 2vw + 2rem, 2.8rem);
  block-size: clamp(2.4rem, 2vw + 2rem, 2.8rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  color: var(--color-text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.calendar__close:hover,
.calendar__close:focus-visible {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--color-surface-hover) 70%, transparent);
  color: var(--color-text-primary);
  outline: none;
}

.calendar__toolbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-md);
  padding: 0.5rem 0;
}

.calendar__nav {
  inline-size: 2.8rem;
  block-size: 2.8rem;
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: color-mix(in srgb, var(--color-surface) 65%, transparent);
  color: var(--color-text-primary);
  font-size: 1.45rem;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.calendar__nav:hover,
.calendar__nav:focus-visible {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--color-accent-light) 40%, transparent);
  border-color: color-mix(in srgb, var(--color-accent) 65%, transparent);
  outline: none;
}

.calendar__meta {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  justify-content: center;
}

.calendar__meta-month {
  font-size: clamp(1.05rem, 2.4vw, 1.3rem);
  font-weight: 600;
  text-transform: capitalize;
}

.calendar__meta-year {
  font-size: clamp(0.9rem, 2vw, 1rem);
  color: var(--color-text-secondary);
}

.calendar__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.35rem;
  text-transform: uppercase;
  font-size: clamp(0.7rem, 1.8vw, 0.8rem);
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.calendar__weekday {
  text-align: center;
  padding: 0.4rem 0;
}

.calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.35rem;
}

.calendar__day {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.75rem 0.25rem;
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
  color: var(--color-text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.calendar__day:hover,
.calendar__day:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-accent) 45%, transparent);
  background: color-mix(in srgb, var(--color-accent-light) 40%, transparent);
  outline: none;
}

.calendar__day.is-selected {
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  border-color: color-mix(in srgb, var(--color-accent) 55%, transparent);
  color: var(--color-accent);
  font-weight: 600;
}

.calendar__day.is-today:not(.is-selected) {
  border-color: color-mix(in srgb, var(--color-info) 55%, transparent);
}

.calendar__day.is-outside {
  color: var(--color-text-muted);
  border-style: dashed;
  cursor: default;
}

.calendar__day.is-outside:hover,
.calendar__day.is-outside:focus-visible {
  transform: none;
  border-color: transparent;
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
}

.calendar__day:disabled {
  cursor: not-allowed;
}

.calendar__check {
  font-size: 0.75rem;
  color: currentColor;
}

@media (max-width: 640px) {
  .calendar {
    inline-size: min(100%, 22rem);
    padding: clamp(1.1rem, 5vw, 1.6rem);
  }

  .calendar__grid {
    gap: 0.25rem;
  }

  .calendar__day {
    padding: 0.6rem 0.2rem;
  }
}
</style>
