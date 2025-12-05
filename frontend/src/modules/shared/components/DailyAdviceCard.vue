<template>
  <article
    v-if="advice"
    ref="cardRoot"
    class="surface-card surface-card--overlay advice-card"
    :class="[
      { 'is-expanded': expanded, 'is-rest': isRest }
    ]"
    role="button"
    :aria-expanded="expanded"
    :aria-label="buttonLabel"
    tabindex="0"
    @click="handleToggle"
    @keyup.enter.prevent="handleToggle"
    @keyup.space.prevent="handleToggle"
  >
    <header class="advice-card__header">
      <NeonIcon
        :name="advice.icon || (isRest ? 'crescent' : 'run')"
        :variant="isRest ? 'emerald' : 'lime'"
        :size="36"
      />

      <div class="advice-card__summary">
        <p class="advice-card__eyebrow">
          {{ isRest ? 'Восстановление' : 'Прогресс' }}
        </p>
        <p class="advice-card__title">
          {{ advice.shortText }}
        </p>
      </div>

      <NeonIcon
        :name="expanded ? 'chevronUp' : 'chevronDown'"
        variant="aqua"
        :size="22"
        class="advice-card__chevron"
      />
    </header>

    <section v-if="expanded" class="advice-card__details" @click.stop>
      <p class="advice-card__description">
        {{ advice.fullText }}
      </p>

      <button
        type="button"
        class="advice-card__ideas"
        @click.stop="handleIdeasClick"
      >
        <span>{{ buttonLabel }}</span>
        <NeonIcon name="lightbulb" variant="amber" :size="18" />
      </button>
    </section>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import { useInteractiveSurfaces } from '@/composables/useInteractiveSurfaces';

interface Props {
  session?: any;
  date?: string;
}

const props = withDefaults(defineProps<Props>(), {
  session: null,
  date: undefined,
});

const appStore = useAppStore();
const { showToast } = appStore;

const advice = ref<any>(null);
const expanded = ref(false);
const cardRoot = ref<HTMLElement | null>(null);

useInteractiveSurfaces(cardRoot);

const isRest = computed(() => advice.value?.type === 'rest');
const buttonLabel = computed(() => isRest.value ? 'Идеи для отдыха' : 'Идеи для мотивации');

const loadAdvice = async () => {
  try {
    const data = await apiClient.getDailyAdvice(props.date);
    advice.value = data;
  } catch (error) {
    console.error('Failed to load advice:', error);
    // Fallback на статичные данные
    advice.value = {
      type: props.session ? 'training' : 'rest',
      shortText: props.session
        ? 'Фокус на прогрессе — сегодня тренировка с упором на технику.'
        : 'Фокус на восстановлении — сегодня день отдыха и регенерации.',
      fullText: props.session
        ? 'Правильная техника важнее скорости. Следи за формой каждого повторения, дыханием и концентрацией.'
        : 'Полноценный отдых — это активный процесс восстановления.',
      ideas: props.session
        ? ['Сфокусируйся на технике', 'Записывай ощущения', 'Дыши ритмично']
        : ['Прогулка 30 минут', '10 минут растяжки', 'Контрастный душ'],
      icon: props.session ? 'run' : 'rest',
      theme: props.session ? 'progress' : 'recovery',
    };
  } finally {
  }
};

const handleToggle = () => {
  expanded.value = !expanded.value;
};

const handleIdeasClick = (e: Event) => {
  e.stopPropagation();
  if (!advice.value?.ideas || advice.value.ideas.length === 0) return;

  const message = advice.value.ideas.join(' • ');
  showToast({
    title: advice.value.type === 'training' ? 'Идеи для мотивации' : 'Идеи для отдыха',
    message,
    type: 'info',
  });
};

watch([() => props.session, () => props.date], () => {
  loadAdvice();
}, { immediate: true });
</script>

<style scoped>
.advice-card {
  --advice-accent: var(--color-accent);
  --advice-accent-soft: color-mix(in srgb, var(--advice-accent) 16%, transparent);
  --advice-accent-muted: color-mix(in srgb, var(--advice-accent) 20%, var(--color-text-secondary));
  cursor: pointer;
  user-select: none;
  gap: clamp(1rem, 0.9rem + 0.4vw, 1.5rem);
  padding: clamp(1.35rem, 1.1rem + 1vw, 1.95rem);
  background-image: linear-gradient(150deg, var(--advice-accent-soft) 0%, transparent 65%),
    var(--panel-surface-gradient);
  box-shadow: 0 24px 40px color-mix(in srgb, var(--advice-accent) 16%, transparent);
}

.advice-card:hover,
.advice-card:focus-visible {
  outline: none;
  box-shadow: 0 28px 48px color-mix(in srgb, var(--advice-accent) 20%, transparent);
}

.advice-card.is-rest {
  --advice-accent: var(--color-success);
  --advice-accent-soft: color-mix(in srgb, var(--advice-accent) 20%, transparent);
}

.advice-card.is-expanded {
  box-shadow: 0 30px 50px color-mix(in srgb, var(--advice-accent) 22%, transparent);
}

.advice-card__header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
}

.advice-card__summary {
  flex: 1;
  min-inline-size: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
}

.advice-card__eyebrow {
  margin: 0;
  font-size: clamp(0.8rem, 0.74rem + 0.35vw, 0.95rem);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--advice-accent) 60%, var(--color-text-secondary));
  text-transform: uppercase;
}

.advice-card__title {
  margin: 0;
  font-size: clamp(0.95rem, 0.9rem + 0.7vw, 1.25rem);
  color: var(--color-text-primary);
  line-height: 1.45;
}

.advice-card__chevron {
  flex-shrink: 0;
  color: var(--advice-accent);
}

.advice-card__details {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
  position: relative;
}

.advice-card__details::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--surface-divider);
}

.advice-card__description {
  margin: 0;
  font-size: clamp(0.9rem, 0.85rem + 0.35vw, 1.05rem);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.advice-card__ideas {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  padding: var(--space-xxs) var(--space-sm);
  border-radius: 999px;
  border: none;
  background: color-mix(in srgb, var(--advice-accent) 22%, transparent);
  color: color-mix(in srgb, var(--advice-accent) 28%, var(--color-text-primary));
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.advice-card__ideas:hover,
.advice-card__ideas:focus-visible {
  outline: none;
  box-shadow: 0 18px 32px color-mix(in srgb, var(--advice-accent) 26%, transparent);
  transform: translateY(-0.06rem);
}

.advice-card__ideas span {
  font-size: clamp(0.75rem, 0.72rem + 0.25vw, 0.85rem);
}
</style>
