<template>
  <div
    class="stage-panel"
    role="tabpanel"
    id="stage-panel-workout"
    aria-labelledby="stage-tab-workout"
    data-animate="fade-up"
  >
    <div
      v-if="showHistoricalPlaceholder"
      class="stage-placeholder stage-placeholder--muted"
    >
      <h3>Нет записи тренировки</h3>
      <p>За выбранную дату тренировка не была зафиксирована. Используйте вкладку «Программы тренировок», чтобы повторить технику.</p>
    </div>

    <div v-else-if="isRestDay" class="stage-placeholder">
      <h3>День восстановления</h3>
      <p>Сегодня в плане только восстановление. Проверь заметки в настройках программы или выбери другую дату.</p>
    </div>

    <div v-else-if="!exerciseCards.length" class="stage-placeholder stage-placeholder--muted">
      <h3>Недостаточно данных</h3>
      <p>Не удалось подготовить упражнения для этой тренировки. Проверь выбранную программу или обнови уровни упражнений.</p>
    </div>

    <template v-else>
      <section class="exercise-grid" aria-label="План на сегодня">
        <TodayExerciseCard
          v-for="(card, cardIndex) in exerciseCards"
          :key="card.key"
          :card="card"
          :status="getResultStatus(card)"
          :is-spark-active="isSparkActive(card.key)"
          :fetch-priority="cardIndex < 2 ? 'high' : 'auto'"
          data-animate="stagger-item"
          :style="{ '--animate-order': cardIndex }"
        />
      </section>

      <div v-if="missingExercises.length" class="missing-data-card" data-animate="fade-up">
        <h4>Что ещё осталось уточнить</h4>
        <ul>
          <li v-for="item in missingExercises" :key="item.key">
            {{ item.name || item.key }} — {{ item.reason }}
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ExerciseCard } from '@/types/today';
import { evaluateResultStatus } from '@/utils/resultLogic';
import TodayExerciseCard from '@/modules/today/components/TodayExerciseCard.vue';

const props = defineProps<{
  showHistoricalPlaceholder: boolean;
  isRestDay: boolean;
  exerciseCards: ExerciseCard[];
  missingExercises: Array<{ key: string; name?: string; reason: string }>;
  exerciseResults: Record<string, number>;
  isSparkActive: (key: string) => boolean;
}>();

const getResultStatus = (card: ExerciseCard) => {
  const actual = props.exerciseResults[card.key] ?? 0;
  return evaluateResultStatus(card, actual);
};
</script>

<style scoped>
/* Styles inherited from parent or global CSS */
</style>
