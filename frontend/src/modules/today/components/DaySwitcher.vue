<template>
  <div class="day-switcher-wrapper">
    <div class="day-switcher" role="group" aria-label="Выбор дня тренировки">
      <button
        type="button"
        class="day-switcher__control"
        @click="handleShift(-1)"
        aria-label="Предыдущий день"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14.5 5.5 9 12l5.5 6.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        class="day-switcher__current"
        @click="openCalendar"
        @keydown.enter.prevent="openCalendar"
        @keydown.space.prevent="openCalendar"
      >
        <span class="day-switcher__weekday">{{ weekdayLabel }}</span>
        <span class="day-switcher__day">{{ dayNumber }}</span>
        <span class="day-switcher__month">{{ monthLabel }}</span>
        <span class="day-switcher__calendar-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <rect x="4" y="5" width="16" height="15" rx="3" />
            <path d="M8 3v4M16 3v4M4 11h16" />
          </svg>
        </span>
      </button>

      <button
        type="button"
        class="day-switcher__control"
        @click="handleShift(1)"
        aria-label="Следующий день"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9.5 5.5 15 12l-5.5 6.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <CustomCalendar
      :is-open="isCalendarOpen"
      :value="date"
      @update:value="handleDateSelect"
      @close="isCalendarOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import CustomCalendar from '@/modules/shared/components/CustomCalendar.vue';

defineOptions({
  name: 'DaySwitcher',
});

const props = defineProps<{
  date: Date;
}>();

const emit = defineEmits<{
  'update:date': [date: Date];
}>();

const isCalendarOpen = ref(false);

const handleShift = (days: number) => {
  const next = new Date(props.date);
  next.setDate(next.getDate() + days);
  emit('update:date', next);
};

const handleDateSelect = (selectedDate: Date) => {
  emit('update:date', selectedDate);
};

const openCalendar = () => {
  isCalendarOpen.value = true;
};

const weekdayLabel = computed(() => format(props.date, 'EEEE', { locale: ru }));
const dayNumber = computed(() => format(props.date, 'd'));
const monthLabel = computed(() => format(props.date, 'LLLL', { locale: ru }));
</script>

<style scoped>
.day-switcher {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: clamp(0.75rem, 2vw, 1.25rem);
  padding: clamp(0.6rem, 2vw, 0.9rem) clamp(0.85rem, 3vw, 1.4rem);
}

.day-switcher__control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-lg);
  border: none;
  background: color-mix(in srgb, var(--color-surface) 65%, transparent);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--color-surface) 35%, transparent);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.day-switcher__control:hover,
.day-switcher__control:focus-visible {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent-light) 45%, transparent);
  box-shadow: 0 14px 28px color-mix(in srgb, var(--color-accent) 18%, transparent);
  outline: none;
}

.day-switcher__control svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
}

.day-switcher__current {
  position: relative;
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: clamp(0.4rem, 1.5vw, 0.65rem);
  padding: clamp(0.55rem, 2vw, 0.8rem) clamp(0.7rem, 3vw, 1.25rem);
  border: none;
  border-radius: var(--radius-xl);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-surface) 90%, transparent) 0%,
    color-mix(in srgb, var(--color-surface-hover) 80%, transparent) 100%
  );
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
  box-shadow: 0 18px 30px color-mix(in srgb, var(--color-surface) 45%, transparent);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.day-switcher__current:hover,
.day-switcher__current:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 20px 34px color-mix(in srgb, var(--color-accent) 22%, transparent);
  outline: none;
}

.day-switcher__weekday {
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  font-weight: 600;
  text-transform: capitalize;
}

.day-switcher__day {
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  font-weight: 700;
}

.day-switcher__month {
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  color: var(--color-text-secondary);
  text-transform: lowercase;
}

.day-switcher__calendar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface-strong) 35%, transparent);
  color: var(--color-text-secondary);
}

.day-switcher__calendar-icon svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 1.6;
  fill: none;
}

@media (max-width: 520px) {
  .day-switcher {
    gap: 0.6rem;
    padding-inline: clamp(0.6rem, 4vw, 0.9rem);
  }

  .day-switcher__control {
    width: 38px;
    height: 38px;
  }

  .day-switcher__current {
    grid-template-columns: auto 1fr auto;
    gap: 0.5rem;
  }

  .day-switcher__weekday {
    display: none;
  }
}
</style>
