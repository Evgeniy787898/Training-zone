<template>
  <section class="note-list" :aria-label="ariaLabel">
    <header class="note-list__header">
      <div>
        <slot name="title">
          <h3 class="note-list__title">{{ title }}</h3>
        </slot>
        <p v-if="subtitle" class="note-list__subtitle">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </header>
    <slot name="form" />
    <div v-if="loading && !items.length" class="note-list__state">
      <LoadingState :title="loadingTitle" :description="loadingDescription" :skeleton-count="2" />
    </div>
    <div v-else-if="error && !items.length" class="empty-state empty-state--inline">
      <slot name="error" :error="error">
        <AppIcon class="empty-state__icon" name="info" variant="neutral" tone="ghost" :size="30" />
        <div class="empty-state__title">Не удалось загрузить заметки</div>
        <p class="empty-state__description">Попробуй повторить запрос позже.</p>
        <button type="button" class="button button--ghost" @click="$emit('retry')">Обновить</button>
      </slot>
    </div>
    <div v-else class="note-list__body" :class="{ 'note-list__body--virtual': virtualized }">
      <div v-if="!items.length" class="empty-state empty-state--inline">
        <slot name="empty">
          <AppIcon class="empty-state__icon" name="book" variant="neutral" tone="ghost" :size="30" />
          <div class="empty-state__title">Записей пока нет</div>
          <p class="empty-state__description">Добавь первую заметку — это займёт меньше минуты.</p>
        </slot>
      </div>
      <div
        v-else
        class="note-list__items virtual-scroll-container"
        :class="{ 'note-list__items--virtual': virtualized }"
        role="list"
        :style="virtualized ? { '--virtual-scroll-gap': gap } : undefined"
      >
        <template v-if="virtualized">
          <div class="virtual-scroll-spacer" :style="{ height: totalHeight }" aria-hidden="true"></div>
          <div class="virtual-scroll-inner" :style="{ transform: offset }">
            <slot name="virtual-items" />
          </div>
        </template>
        <template v-else>
          <slot name="items" />
        </template>
      </div>
    </div>
    <footer v-if="$slots.footer" class="note-list__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>
<script setup lang="ts">
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
  items: unknown[];
  loading?: boolean;
  error?: Error | null;
  ariaLabel?: string;
  loadingTitle?: string;
  loadingDescription?: string;
  virtualized?: boolean;
  totalHeight?: string;
  offset?: string;
  gap?: string;
}>(), {
  title: 'Заметки',
  subtitle: '',
  items: () => [],
  loading: false,
  error: null,
  ariaLabel: 'Список заметок',
  loadingTitle: 'Загружаем заметки…',
  loadingDescription: 'Готовим последние записи',
  virtualized: false,
  totalHeight: '0px',
  offset: 'translateY(0)',
  gap: '0.75rem',
});
defineEmits<{ (event: 'retry'): void }>();
</script>
<style scoped>
.note-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.note-list__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
}
.note-list__title {
  margin: 0;
  font-size: var(--font-size-lg);
}
.note-list__subtitle {
  margin: 0.25rem 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.note-list__state {
  min-height: 120px;
}
.note-list__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.note-list__items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 360px;
  overflow: auto;
}
.note-list__footer {
  display: flex;
  justify-content: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
</style>
