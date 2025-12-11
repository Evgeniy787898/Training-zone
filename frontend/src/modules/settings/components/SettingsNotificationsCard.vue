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
            v-model="notificationsEnabled"
            @change="handleNotificationToggle"
          />
          <span class="settings-notifications__slider"></span>
        </label>
      </div>

      <div v-if="notificationsEnabled" class="settings-notifications__row">
        <label class="settings-notifications__label" for="notification-time">
          Время напоминания
        </label>
        <input
          id="notification-time"
          type="time"
          v-model="notificationTime"
          class="input settings-notifications__time"
          @change="handleNotificationTimeChange"
        />
      </div>

      <p class="settings-notifications__hint">
        {{ notificationsEnabled ? `Напоминание в ${notificationTime || '10:00'} (${userTimezone})` : 'Напоминания выключены' }}
      </p>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { apiClient } from '@/services/api';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import BaseCard from '@/components/ui/BaseCard.vue';

const appStore = useAppStore();

const notificationsEnabled = ref(!appStore.profileSummary?.profile?.notificationsPaused);
const notificationTime = ref(appStore.profileSummary?.profile?.notificationTime?.substring(0, 5) || '10:00');
const userTimezone = computed(() => appStore.profileSummary?.profile?.timezone || 'Europe/Moscow');

const handleNotificationToggle = async () => {
  try {
    await apiClient.updateProfile({ notifications_paused: !notificationsEnabled.value });
    appStore.showToast({
      title: notificationsEnabled.value ? 'Уведомления включены' : 'Уведомления выключены',
      message: '',
      type: 'success',
    });
  } catch (error: any) {
    console.error('[SettingsNotificationsCard] Failed to update notification settings:', error);
    notificationsEnabled.value = !notificationsEnabled.value;
    appStore.showToast({ title: 'Ошибка', message: error.message, type: 'error' });
  }
};

const handleNotificationTimeChange = async () => {
  try {
    await apiClient.updateProfile({ notification_time: notificationTime.value + ':00' });
    appStore.showToast({ title: 'Время напоминания обновлено', message: '', type: 'success' });
  } catch (error: any) {
    console.error('[SettingsNotificationsCard] Failed to update notification time:', error);
    appStore.showToast({ title: 'Ошибка', message: error.message, type: 'error' });
  }
};
</script>
