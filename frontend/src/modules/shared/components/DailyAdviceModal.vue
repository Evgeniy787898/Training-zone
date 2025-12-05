<template>
  <ModalDialog
    :model-value="isOpen"
    title="Ежедневный совет"
    icon="lightbulb"
    icon-variant="amber"
    size="md"
    @update:modelValue="handleVisibilityChange"
    @close="emit('close')"
  >
    <LoadingState
      v-if="loading"
      class="advice-modal__loading"
      title="Загружаю рекомендации…"
      description="Готовим идеи под выбранный день"
      :skeleton-count="2"
      :skeleton-lines="3"
      inline
    />

    <div v-else-if="advice" class="advice-modal__content">
      <article class="advice-modal__highlight">
        <h3 class="advice-modal__headline">{{ advice.shortText }}</h3>
        <p class="advice-modal__description">{{ advice.fullText }}</p>
      </article>

      <section v-if="advice.ideas && advice.ideas.length" class="advice-modal__ideas" aria-label="Идеи для дня">
        <h4 class="advice-modal__ideas-title">Идеи для действия</h4>
        <ul class="advice-modal__ideas-list">
          <li v-for="(idea, index) in advice.ideas" :key="index" class="advice-modal__idea">
            <span class="advice-modal__idea-index">{{ index + 1 }}</span>
            <span class="advice-modal__idea-text">{{ idea }}</span>
          </li>
        </ul>
      </section>
    </div>
  </ModalDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import ModalDialog from '@/modules/shared/components/ModalDialog.vue';

const props = defineProps<{
  isOpen: boolean;
  date?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const loading = ref(false);
const advice = ref<any>(null);

const handleVisibilityChange = (value: boolean) => {
  if (!value) {
    emit('close');
  }
};

const loadAdvice = async () => {
  if (!props.isOpen) return;
  
  loading.value = true;
  try {
    const date = props.date || new Date().toISOString().split('T')[0];
    advice.value = await apiClient.getDailyAdvice(date);
  } catch (error) {
    console.error('Failed to load advice:', error);
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      loadAdvice();
    } else {
      advice.value = null;
      loading.value = false;
    }
  }
);
</script>

<style scoped>
.advice-modal__loading {
  padding: var(--space-xs) 0;
}

.advice-modal__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.advice-modal__highlight {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: clamp(1.1rem, 0.95rem + 0.7vw, 1.4rem);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-info) 25%, transparent);
  background-image: linear-gradient(150deg, color-mix(in srgb, var(--color-info) 20%, transparent) 0%, transparent 70%),
    var(--panel-surface-gradient);
  box-shadow: var(--shadow-sm);
}

.advice-modal__headline {
  margin: 0;
  font-size: clamp(1.05rem, 0.95rem + 0.8vw, 1.4rem);
  font-weight: 600;
  line-height: 1.5;
  color: var(--color-text-primary);
}

.advice-modal__description {
  margin: 0;
  font-size: clamp(0.9rem, 0.85rem + 0.35vw, 1.05rem);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.advice-modal__ideas {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.advice-modal__ideas-title {
  margin: 0;
  font-size: clamp(0.95rem, 0.9rem + 0.35vw, 1.15rem);
  font-weight: 600;
  color: var(--color-text-primary);
}

.advice-modal__ideas-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.advice-modal__idea {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: color-mix(in srgb, var(--color-surface) 75%, transparent);
}

.advice-modal__idea-index {
  inline-size: 2rem;
  block-size: 2rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  color: color-mix(in srgb, var(--color-accent) 60%, var(--color-text-primary));
  font-weight: 600;
}

.advice-modal__idea-text {
  color: var(--color-text-secondary);
  font-size: clamp(0.85rem, 0.8rem + 0.35vw, 1rem);
}

@media (max-width: 36rem) {
  .advice-modal {
    padding: var(--space-md);
  }

  .advice-modal__dialog {
    gap: var(--space-md);
    padding: clamp(1.25rem, 1.05rem + 0.8vw, 1.75rem);
  }
}
</style>
