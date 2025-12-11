<template>
  <BaseCard class="settings-card settings-card--theme">
    <template #header>
      <div class="surface-card__title">
        <NeonIcon name="palette" variant="violet" :size="26" class="settings-card__title-icon" />
        <span>Оформление</span>
      </div>
      <p class="surface-card__subtitle">
        Выбери стиль интерфейса и акцентный цвет.
      </p>
    </template>

    <div class="theme-widget">
      <div class="theme-widget__row">
        <div class="theme-widget__info">
          <span class="theme-widget__label">Тема</span>
          <span class="theme-widget__value">{{ currentThemeLabel }}</span>
        </div>
        <BaseButton variant="secondary" size="sm" @click="toggleTheme">
          {{ isDark ? 'Светлая' : 'Тёмная' }}
        </BaseButton>
      </div>

      <div class="theme-widget__row">
        <div class="theme-widget__info">
          <span class="theme-widget__label">Акцент</span>
          <div class="theme-widget__accent-preview" :style="{ background: currentAccent }"></div>
        </div>
        <BaseButton variant="secondary" size="sm" @click="$emit('open-customizer')">
          Настроить
        </BaseButton>
      </div>

      <div v-if="currentPalette" class="theme-widget__row">
        <div class="theme-widget__info">
          <span class="theme-widget__label">Пресет</span>
          <span class="theme-widget__value">{{ currentPalette }}</span>
        </div>
        <BaseButton variant="ghost" size="sm" @click="resetTheme">
          Сбросить
        </BaseButton>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
/**
 * ThemeWidget - Theme and Accent Color Settings Card
 * Extracted as part of SETT-R06 decomposition
 */
import { computed } from 'vue';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

defineEmits<{
  (e: 'open-customizer'): void;
}>();

const isDark = computed(() => appStore.theme === 'dark');

const currentThemeLabel = computed(() => isDark.value ? 'Тёмная' : 'Светлая');

const currentAccent = computed(() => {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#10a37f';
});

const currentPalette = computed(() => appStore.customThemePalette);

const toggleTheme = () => {
  // Note: Currently only 'nocturne' preset exists
  // Theme toggle is a no-op until more presets are added
  appStore.setThemePreset('nocturne');
};

const resetTheme = () => {
  appStore.setThemePreset('nocturne');
  appStore.showToast({
    title: 'Тема сброшена',
    message: 'Применены стандартные настройки',
    type: 'success'
  });
};
</script>

<style scoped>
.theme-widget {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.theme-widget__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.theme-widget__row:last-child {
  border-bottom: none;
}

.theme-widget__info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.theme-widget__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  min-width: 60px;
}

.theme-widget__value {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.theme-widget__accent-preview {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-border);
}
</style>
