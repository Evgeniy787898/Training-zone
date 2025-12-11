<template>
  <div>
    <BaseCard class="summary-card" hoverable>
      <h3 class="summary-card__title">Заметки к тренировке</h3>
      <textarea
        :value="comment"
        @input="$emit('update:comment', ($event.target as HTMLTextAreaElement).value)"
        placeholder="Как прошла тренировка?"
        aria-label="Заметки к тренировке"
        rows="3"
      ></textarea>
      <BaseButton
        variant="primary"
        size="sm"
        class="summary-card__submit"
        :disabled="saving"
        :loading="saving"
        loading-text="Сохраняю…"
        @click="$emit('submit')"
      >
        Зафиксировать тренировку
      </BaseButton>
    </BaseCard>

    <div v-if="suggestions.length">
      <BaseCard class="post-session-card" hoverable>
        <h3 class="post-session-card__title">Что дальше?</h3>
        <ul class="post-session-card__list">
          <li
            v-for="item in suggestions"
            :key="item.id"
            class="post-session-card__item"
            :class="`post-session-card__item--${item.accent}`"
          >
            <h4>{{ item.title }}</h4>
            <p>{{ item.description }}</p>
          </li>
        </ul>
      </BaseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  accent: 'calm' | 'drive';
}

defineProps<{
  comment: string;
  saving: boolean;
  suggestions: Suggestion[];
}>();

defineEmits<{
  (e: 'update:comment', value: string): void;
  (e: 'submit'): void;
}>();
</script>

<style scoped>
.summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: clamp(1rem, 2.5vw, 1.25rem);
}

.summary-card__title {
  margin: 0;
  font-size: clamp(1rem, 2.4vw, 1.2rem);
  font-weight: 600;
}

.summary-card textarea {
  min-height: 90px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  padding: var(--space-sm) var(--space-sm);  /* 0.6→0.75 */
  resize: vertical;
  font-size: clamp(0.85rem, 2vw, 0.95rem);
}

.summary-card__submit {
  align-self: flex-end;
}

.post-session-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);  /* 0.85→1 close */
  padding: clamp(1rem, 2.5vw, 1.25rem);
  margin-top: 1rem;
}

.post-session-card__title {
  margin: 0;
  font-size: clamp(1rem, 2.4vw, 1.2rem);
}

.post-session-card__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: clamp(0.75rem, 2vw, 1rem);
}

.post-session-card__item {
  border-radius: var(--radius-lg);
  padding: clamp(0.75rem, 2vw, 1rem);
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  border-left: 3px solid color-mix(in srgb, var(--color-border) 75%, transparent);
}

.post-session-card__item--calm {
  border-left-color: color-mix(in srgb, var(--color-accent) 30%, transparent);
}

.post-session-card__item--drive {
  border-left-color: color-mix(in srgb, var(--color-accent) 70%, transparent);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}

.post-session-card__item h4 {
  margin: 0 0 0.35rem;
  font-size: clamp(0.95rem, 2vw, 1.05rem);
}

.post-session-card__item p {
  margin: 0;
  color: var(--color-text-secondary);
}
</style>
