<template>
  <div class="page-shell library-page">
    <header class="page-header library-page__header">
      <div>
        <h1 class="page-title">
          <AppIcon
            class="page-title__icon"
            name="book"
            variant="violet"
            :size="28"
          />
          <span>Информационный стенд</span>
        </h1>
        <p class="page-subtitle">
          Всё, что нужно для осознанных тренировок: база калистеники, структура занятий и быстрые шпаргалки.
        </p>
      </div>
    </header>

    <section class="surface-card library-card">
      <header class="surface-card__header">
        <div class="surface-card__title">
          <NeonIcon name="spark" variant="lime" :size="22" class="library-card__title-icon" />
          <span>Калистеника — твоя база силы</span>
        </div>
      </header>
      <p class="library-card__text">
        Развиваем силу, контроль и выносливость без сложного инвентаря. План подстраивается под цели и оборудование. Отмечай
        результат в отчёте — так алгоритм корректирует уровень и объём.
      </p>
      <ul class="list-reset library-highlights">
        <li>
          <NeonIcon name="calendar" variant="lime" :size="18" />
          <span>3–5 тренировок в неделю</span>
        </li>
        <li>
          <NeonIcon name="hex" variant="violet" :size="18" />
          <span>Баланс «нагрузка → восстановление»</span>
        </li>
        <li>
          <NeonIcon name="spark" variant="emerald" :size="18" />
          <span>Прогрессия по уровням упражнений</span>
        </li>
      </ul>
    </section>

    <div class="page-grid page-grid--two library-grid">
      <section
        v-for="section in knowledgeSections"
        :key="section.title"
        class="surface-card library-section"
      >
        <header class="library-section__header">
          <h2>{{ section.title }}</h2>
          <p>{{ section.description }}</p>
        </header>
        <ul class="list-reset library-section__list">
          <li v-for="item in section.highlights" :key="item.text">
            <NeonIcon :name="item.icon.name" :variant="item.icon.variant" :size="18" />
            <span>{{ item.text }}</span>
          </li>
        </ul>
      </section>
    </div>

    <section class="surface-card library-card">
      <header class="surface-card__header">
        <div class="surface-card__title">
          <NeonIcon name="spark" variant="lime" :size="22" class="library-card__title-icon" />
          <span>Быстрые наборы и шпаргалки</span>
        </div>
      </header>
      <div class="library-tips">
        <article v-for="tip in quickTips" :key="tip.title" class="library-tip">
          <h3>{{ tip.title }}</h3>
          <p>{{ tip.description }}</p>
          <ul class="list-reset">
            <li v-for="item in tip.items" :key="item">• {{ item }}</li>
          </ul>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import type { IconName } from '@/modules/shared/icons/registry';

type NeonIconVariant = 'lime' | 'emerald' | 'violet' | 'amber' | 'aqua' | 'neutral';

interface KnowledgeSectionHighlight {
  icon: { name: IconName; variant: NeonIconVariant };
  text: string;
}

interface KnowledgeSection {
  title: string;
  description: string;
  highlights: KnowledgeSectionHighlight[];
}

const knowledgeSections: KnowledgeSection[] = [
  {
    title: 'Основы калистеники',
    description: 'Работаем с собственным весом, опираемся на прогрессию и качество техники.',
    highlights: [
      { icon: { name: 'spark', variant: 'emerald' }, text: 'Постепенно усложняй: добавляй объём или уровень только после уверенного прохождения.' },
      { icon: { name: 'spark', variant: 'violet' }, text: 'Контролируй технику и темп (3-1-1-0) — качество движения важнее скорости.' },
      { icon: { name: 'rest', variant: 'aqua' }, text: 'Отслеживай самочувствие: усталость допустима, боль — сигнал упростить.' },
    ],
  },
  {
    title: 'Структура тренировки',
    description: 'Каждый блок выполняет свою роль: подготовить, нагрузить и восстановить.',
    highlights: [
      { icon: { name: 'rest', variant: 'aqua' }, text: 'Разминка 5–7 минут — суставная гимнастика, лёгкое кардио, резинки.' },
      { icon: { name: 'pulse', variant: 'lime' }, text: 'Основная часть: 2–4 упражнения, темп и объём подстраиваем под RPE.' },
      { icon: { name: 'crescent', variant: 'emerald' }, text: 'Заминка: дыхание и растяжка рабочих мышц, чтобы ускорить восстановление.' },
    ],
  },
  {
    title: 'Продвижение по уровням',
    description: 'Фиксируем прогресс через отчёты и рекомендации бота.',
    highlights: [
      { icon: { name: 'rocket', variant: 'lime' }, text: 'RPE ≤7 и запас по повторениям — переходи на следующий уровень.' },
      { icon: { name: 'target', variant: 'violet' }, text: 'RPE 8–9 — закрепляем навык, повторяем тот же уровень.' },
      { icon: { name: 'reset', variant: 'amber' }, text: 'Если RPE 10 или техника рушится, смело упрощай и отрабатывай форму.' },
    ],
  },
  {
    title: 'Режим восстановления',
    description: 'Нагрузку и отдых чередуем осознанно — так прогресс держится стабильно.',
    highlights: [
      { icon: { name: 'crescent', variant: 'emerald' }, text: 'Раз в неделю планируй день восстановления с мягкой мобилизацией.' },
      { icon: { name: 'info', variant: 'neutral' }, text: 'Если самочувствие просело, включи режим восстановления в приложении или через чат.' },
      { icon: { name: 'rest', variant: 'aqua' }, text: 'Боль или травма — уменьшай объём, работай над техникой и сообщай тренеру.' },
    ],
  },
];

const quickTips = [
  {
    title: 'Мини-калистеника',
    description: 'Комплекс из трёх упражнений, который можно выполнить без оборудования.',
    items: [
      'Отжимания от стены — 3×12',
      'Приседания с поддержкой — 3×15',
      'Планка на предплечьях — 3×40 сек',
    ],
  },
  {
    title: 'Контроль RPE',
    description: 'Шкала нагрузки помогает дозировать тренировку и держать баланс нагрузки.',
    items: [
      '5 — умеренно, готов повторить',
      '7 — тяжело, но техника под контролем',
      '9 — почти предел, снижаем объём в следующий раз',
    ],
  },
  {
    title: 'Ритуалы восстановления',
    description: 'Два-три действия после тренировки ускорят возвращение в тонус.',
    items: [
      'Замедленное дыхание 2 минуты',
      'Лёгкая растяжка рабочих мышц',
      'Заметка о самочувствии в отчёте',
    ],
  },
];
</script>

<style scoped>
.library-page {
  gap: clamp(1.5rem, 4vw, 2.5rem);
}

.library-card {
  gap: clamp(1rem, 3vw, 1.75rem);
}

.library-card__title-icon {
  filter: drop-shadow(0 6px 12px rgba(79, 70, 229, 0.25));
}

.library-card__text {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.library-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  color: var(--color-text-secondary);
}

.library-highlights li {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
  border: 1px solid var(--color-border-subtle);
}

.library-grid {
  align-items: stretch;
}

.library-section {
  gap: var(--space-md);
}

.library-section__header h2 {
  margin: 0 0 0.5rem;
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-primary);
}

.library-section__header p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.library-section__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  color: var(--color-text-secondary);
}

.library-section__list li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  line-height: 1.5;
}

.library-tips {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: clamp(1rem, 3vw, 1.5rem);
}

.library-tip {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-subtle);
  background: color-mix(in srgb, var(--color-bg-elevated) 92%, transparent);
}

.library-tip h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.library-tip p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.library-tip ul {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  color: var(--color-text-secondary);
}
</style>
