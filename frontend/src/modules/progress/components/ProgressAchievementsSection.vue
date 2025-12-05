<template>
  <section class="surface-card progress-card">
    <header class="surface-card__header">
      <div class="surface-card__title">
        <NeonIcon name="trophy" variant="amber" :size="24" class="progress-card__title-icon" />
        <span>Достижения</span>
      </div>
    </header>
    <div class="progress-achievements__toolbar">
      <label class="sr-only" for="achievements-search">Поиск достижений</label>
      <input
        id="achievements-search"
        class="progress-achievements__search"
        type="search"
        inputmode="search"
        autocomplete="off"
        :value="searchValue"
        placeholder="Поиск по названию"
        @input="onSearchInput"
      />
    </div>
    <p v-if="achievementsSourceHint" class="progress-source-note" role="status">
      {{ achievementsSourceHint }}
    </p>
    <div v-if="!hasAchievements" class="empty-state empty-state--inline">
      <div class="empty-state__icon">🎯</div>
      <div class="empty-state__title">Пока нет достижений</div>
      <p class="empty-state__description">Выполненные тренировки откроют награды и новые подсказки.</p>
    </div>
    <div v-else-if="achievements.length === 0" class="empty-state empty-state--inline">
      <div class="empty-state__icon">🔍</div>
      <div class="empty-state__title">Не найдено</div>
      <p class="empty-state__description">Скорректируй запрос, чтобы увидеть подходящие достижения.</p>
    </div>
    <div
      v-else
      ref="containerRef"
      class="progress-achievements soft-scroll"
      role="list"
      :class="{ 'progress-achievements--virtual virtual-scroll-container': achievementsVirtualized }"
      :style="achievementsVirtualized ? { '--virtual-scroll-gap': '0.75rem' } : undefined"
    >
      <template v-if="achievementsVirtualized">
        <div class="virtual-scroll-spacer" aria-hidden="true" :style="{ height: `${achievementsVirtualHeight}px` }"></div>
        <div class="virtual-scroll-inner" :style="{ transform: `translateY(${achievementsVirtualOffset}px)` }">
          <article
            v-for="{ item, index } in achievementsVirtualItems"
            :key="item.id || `achievement-${index}`"
            class="progress-achievements__item"
            role="listitem"
          >
            <NeonIcon name="trophy" variant="lime" :size="24" />
            <div>
              <div class="progress-achievements__title">{{ item.title }}</div>
              <div v-if="item.description" class="progress-achievements__description">{{ item.description }}</div>
            </div>
          </article>
        </div>
      </template>
      <template v-else>
        <article
          v-for="item in achievements"
          :key="item.id"
          class="progress-achievements__item"
          role="listitem"
        >
          <NeonIcon name="trophy" variant="lime" :size="24" />
          <div>
            <div class="progress-achievements__title">{{ item.title }}</div>
            <div v-if="item.description" class="progress-achievements__description">{{ item.description }}</div>
          </div>
        </article>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watchEffect } from 'vue';
import type { Achievement } from '@/types';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';

const props = defineProps<{
  achievements: Achievement[];
  achievementsSourceHint: string | null;
  achievementsVirtualized: boolean;
  achievementsVirtualHeight: number;
  achievementsVirtualOffset: number;
  achievementsVirtualItems: { item: Achievement; index: number }[];
  bindListRef?: (el: HTMLElement | null) => void;
  hasAchievements: boolean;
  searchValue: string;
}>();

const emit = defineEmits<{ 'update:search-value': [string] }>();

const containerRef = ref<HTMLElement | null>(null);

const onSearchInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  emit('update:search-value', target?.value ?? '');
};

watchEffect(() => {
  if (props.bindListRef) {
    props.bindListRef(containerRef.value);
  }
});

onMounted(() => {
  if (props.bindListRef) {
    props.bindListRef(containerRef.value);
  }
});

onBeforeUnmount(() => {
  if (props.bindListRef) {
    props.bindListRef(null);
  }
});
</script>

<style scoped>
.progress-achievements__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.progress-achievements__search {
  width: 100%;
  max-width: 320px;
  padding: 0.65rem 0.9rem;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.progress-achievements__search:focus {
  border-color: color-mix(in srgb, var(--color-accent) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 16%, transparent);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
