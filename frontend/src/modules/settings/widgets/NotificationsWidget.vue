<template>
  <BaseCard class="settings-card settings-card--notifications section-surface">
    <template #header>
      <div class="surface-card__header-content">
        <div class="surface-card__title">
          <NeonIcon name="bell" variant="violet" :size="26" class="settings-card__title-icon" />
          <span>Уведомления</span>
        </div>
        <p class="surface-card__subtitle">
          Настрой напоминания о тренировках в Telegram.
        </p>
      </div>
    </template>

    <div class="settings-notifications">
      <div class="settings-notifications__row">
        <label class="settings-notifications__label" for="notification-toggle">
          Напоминания включены
        </label>
        <label class="settings-notifications__switch">
          <input
            id="notification-toggle"
            type="checkbox"
            :checked="enabled"
            @change="handleToggle"
          />
          <span class="settings-notifications__slider"></span>
        </label>
      </div>

      <div v-if="enabled" class="settings-notifications__row">
        <label class="settings-notifications__label" for="notification-time">
          Время напоминания
        </label>
        <input
          id="notification-time"
          type="time"
          :value="time"
          class="input settings-notifications__time"
          @change="handleTimeChange"
        />
      </div>

      <p class="settings-notifications__hint">
        {{ enabled ? `Напоминание в ${time || '10:00'} (${timezone})` : 'Напоминания выключены' }}
      </p>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
/**
 * NotificationsWidget - Telegram Notifications Settings
 * Extracted as part of SETT-R03 decomposition
 * GAP-001: Telegram Notifications Settings
 */
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import BaseCard from '@/components/ui/BaseCard.vue';

defineProps<{
  enabled: boolean;
  time: string;
  timezone: string;
}>();

const emit = defineEmits<{
  (e: 'update:enabled', value: boolean): void;
  (e: 'update:time', value: string): void;
}>();

const handleToggle = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:enabled', target.checked);
};

const handleTimeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:time', target.value);
};
</script>
