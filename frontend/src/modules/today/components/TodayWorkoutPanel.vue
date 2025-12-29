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
      <!-- Horizontal carousel -->
      <div class="exercise-carousel-container">
        <section 
          ref="carouselRef"
          class="exercise-carousel" 
          aria-label="План на сегодня"
          @scroll="updateActiveIndex"
        >
          <TodayExerciseCard
            v-for="(card, cardIndex) in exerciseCards"
            :key="card.key"
            :card="card"
            :status="getResultStatus(card)"
            :is-spark-active="isSparkActive(card.key)"
            :fetch-priority="cardIndex < 2 ? 'high' : 'auto'"
            class="exercise-carousel__item"
            :style="{ animationDelay: `${cardIndex * 0.08}s` }"
          />
        </section>
        
        <!-- Carousel indicators - only show if more than 2 cards -->
        <div v-if="exerciseCards.length > 2" class="carousel-indicators">
          <button
            v-for="(_, index) in exerciseCards"
            :key="index"
            type="button"
            class="carousel-dot"
            :class="{ 'carousel-dot--active': index === activeIndex }"
            @click="scrollToCard(index)"
            :aria-label="`Упражнение ${index + 1}`"
          />
        </div>
      </div>

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
import { ref } from 'vue';
import type { ExerciseCard } from '@/types/today';
import { evaluateResultStatus } from '@/utils/resultLogic';
import TodayExerciseCard from '@/modules/today/components/TodayExerciseCard.vue';
import { hapticLight } from '@/utils/hapticFeedback';

const props = defineProps<{
  showHistoricalPlaceholder: boolean;
  isRestDay: boolean;
  exerciseCards: ExerciseCard[];
  missingExercises: Array<{ key: string; name?: string; reason: string }>;
  exerciseResults: Record<string, number>;
  isSparkActive: (key: string) => boolean;
}>();

const carouselRef = ref<HTMLElement | null>(null);
const activeIndex = ref(0);

const getResultStatus = (card: ExerciseCard) => {
  const actual = props.exerciseResults[card.key] ?? 0;
  return evaluateResultStatus(card, actual);
};

const updateActiveIndex = () => {
  if (!carouselRef.value) return;
  const scrollLeft = carouselRef.value.scrollLeft;
  const cardWidth = carouselRef.value.offsetWidth * 0.48;
  const newIndex = Math.round(scrollLeft / cardWidth);
  if (newIndex !== activeIndex.value) {
    hapticLight();
    activeIndex.value = newIndex;
  }
};

const scrollToCard = (index: number) => {
  if (!carouselRef.value) return;
  const cardWidth = carouselRef.value.offsetWidth * 0.48;
  carouselRef.value.scrollTo({
    left: index * cardWidth,
    behavior: 'smooth'
  });
};
</script>

<style scoped>
.exercise-carousel-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.exercise-carousel {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding: 0.25rem 0;
  scrollbar-width: none;
}

.exercise-carousel::-webkit-scrollbar {
  display: none;
}

.exercise-carousel__item {
  flex: 0 0 48%;
  min-width: 0;
  scroll-snap-align: start;
  animation: cardFadeIn 0.4s ease-out both;
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.carousel-indicators {
  display: flex;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.25rem 0;
}

.carousel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.carousel-dot--active {
  background: var(--color-accent);
  transform: scale(1.2);
}

.carousel-dot:hover {
  background: rgba(255, 255, 255, 0.4);
}

.carousel-dot--active:hover {
  background: var(--color-accent);
}
</style>
