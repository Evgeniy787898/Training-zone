<template>
  <div class="settings-security-section">
    <!-- PIN Card -->
    <BaseCard class="settings-card settings-card--security">
      <template #header>
        <div class="surface-card__title">
          <NeonIcon name="shield" variant="amber" :size="26" class="settings-card__title-icon" />
          <span>Безопасность</span>
        </div>
        <p class="surface-card__subtitle">
          Управляй доступом к приложению через PIN-код.
        </p>
      </template>
      
      <div class="settings-security">
        <div class="settings-security__row">
          <div>
            <span class="settings-security__title">PIN-код</span>
            <span class="settings-security__description">Изменить PIN-код для входа в приложение.</span>
          </div>
          <BaseButton variant="secondary" @click="showPinModal = true">
            Сменить PIN
          </BaseButton>
        </div>
      </div>
    </BaseCard>

    <!-- PIN Change Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showPinModal" class="pin-modal-overlay" @click.self="closePinModal">
          <div class="pin-modal" role="dialog" aria-labelledby="pin-modal-title">
            <header class="pin-modal__header">
              <h2 id="pin-modal-title" class="pin-modal__title">Смена PIN-кода</h2>
              <button class="pin-modal__close" @click="closePinModal" aria-label="Закрыть">
                <NeonIcon name="close" :size="20" />
              </button>
            </header>
            
            <form class="pin-modal__form" @submit.prevent="handlePinChange">
              <div class="pin-modal__field">
                <label for="current-pin">Текущий PIN</label>
                <input
                  id="current-pin"
                  v-model="pinForm.current"
                  type="password"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="6"
                  placeholder="••••"
                  autocomplete="current-password"
                  required
                />
              </div>
              
              <div class="pin-modal__field">
                <label for="new-pin">Новый PIN</label>
                <input
                  id="new-pin"
                  v-model="pinForm.new"
                  type="password"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="6"
                  placeholder="••••"
                  autocomplete="new-password"
                  required
                />
              </div>
              
              <div class="pin-modal__field">
                <label for="confirm-pin">Подтвердите PIN</label>
                <input
                  id="confirm-pin"
                  v-model="pinForm.confirm"
                  type="password"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="6"
                  placeholder="••••"
                  autocomplete="new-password"
                  required
                />
              </div>
              
              <p v-if="pinError" class="pin-modal__error" role="alert">{{ pinError }}</p>
              
              <div class="pin-modal__actions">
                <BaseButton type="button" variant="ghost" @click="closePinModal">
                  Отмена
                </BaseButton>
                <BaseButton
                  type="submit"
                  variant="primary"
                  :loading="pinChanging"
                  loading-text="Сохраняю…"
                >
                  Сохранить
                </BaseButton>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Account Card -->
    <BaseCard class="settings-card">
      <template #header>
        <div class="surface-card__title">
          <NeonIcon name="user" variant="aqua" :size="26" class="settings-card__title-icon" />
          <span>Аккаунт</span>
        </div>
        <p class="surface-card__subtitle">
          Завершай сессию, если нужно выйти из WebApp и обновить авторизацию.
        </p>
      </template>
      
      <div class="settings-account">
        <div>
          <span class="settings-account__title">Выход из аккаунта</span>
          <span class="settings-account__description">Сессия будет завершена после закрытия приложения в Telegram.</span>
        </div>
        <BaseButton variant="danger" @click="logout">
          Выйти
        </BaseButton>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { apiClient } from '@/services/api';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';

const appStore = useAppStore();

// PIN Change Logic
const showPinModal = ref(false);
const pinChanging = ref(false);
const pinError = ref('');
const pinForm = ref({
  current: '',
  new: '',
  confirm: '',
});

const closePinModal = () => {
  showPinModal.value = false;
  pinForm.value = { current: '', new: '', confirm: '' };
  pinError.value = '';
};

const handlePinChange = async () => {
  pinError.value = '';
  
  if (!/^\d{4,6}$/.test(pinForm.value.current)) {
    pinError.value = 'Текущий PIN должен быть от 4 до 6 цифр';
    return;
  }
  if (!/^\d{4,6}$/.test(pinForm.value.new)) {
    pinError.value = 'Новый PIN должен быть от 4 до 6 цифр';
    return;
  }
  if (pinForm.value.new !== pinForm.value.confirm) {
    pinError.value = 'PIN-коды не совпадают';
    return;
  }
  if (pinForm.value.current === pinForm.value.new) {
    pinError.value = 'Новый PIN не должен совпадать с текущим';
    return;
  }
  
  pinChanging.value = true;
  try {
    await apiClient.changePin(pinForm.value.current, pinForm.value.new);
    appStore.showToast({
      title: 'Успех',
      message: 'PIN-код успешно изменён',
      type: 'success'
    });
    closePinModal();
  } catch (error: any) {
    const message = error?.message || 'Не удалось изменить PIN';
    if (message.includes('Неверный') || message.includes('invalid')) {
      pinError.value = 'Неверный текущий PIN';
    } else {
      pinError.value = message;
    }
  } finally {
    pinChanging.value = false;
  }
};

const logout = () => {
  appStore.showToast({
    title: 'Выход',
    message: 'Завершите работу через Telegram (закройте WebApp).',
    type: 'info'
  });
};
</script>
