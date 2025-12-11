<template>
  <div>
    <!-- Security Card -->
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
          <BaseButton variant="secondary" @click="showModal = true">
            Сменить PIN
          </BaseButton>
        </div>
      </div>
    </BaseCard>

    <!-- PIN Change Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showModal" class="pin-modal-overlay" @click.self="closeModal">
          <div class="pin-modal" role="dialog" aria-labelledby="pin-modal-title">
            <header class="pin-modal__header">
              <h2 id="pin-modal-title" class="pin-modal__title">Смена PIN-кода</h2>
              <button class="pin-modal__close" @click="closeModal" aria-label="Закрыть">
                <NeonIcon name="close" :size="20" />
              </button>
            </header>
            
            <form class="pin-modal__form" @submit.prevent="handleSubmit">
              <div class="pin-modal__field">
                <label for="current-pin">Текущий PIN</label>
                <input
                  id="current-pin"
                  v-model="form.current"
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
                  v-model="form.new"
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
                  v-model="form.confirm"
                  type="password"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="6"
                  placeholder="••••"
                  autocomplete="new-password"
                  required
                />
              </div>
              
              <p v-if="error" class="pin-modal__error" role="alert">{{ error }}</p>
              
              <div class="pin-modal__actions">
                <BaseButton type="button" variant="ghost" @click="closeModal">
                  Отмена
                </BaseButton>
                <BaseButton
                  type="submit"
                  variant="primary"
                  :loading="loading"
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
  </div>
</template>

<script setup lang="ts">
/**
 * PinWidget - Security PIN Change Card + Modal
 * Extracted as part of SETT-R05 decomposition
 */
import { ref } from 'vue';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import { apiClient } from '@/services/api';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

const showModal = ref(false);
const loading = ref(false);
const error = ref('');
const form = ref({
  current: '',
  new: '',
  confirm: '',
});

const closeModal = () => {
  showModal.value = false;
  form.value = { current: '', new: '', confirm: '' };
  error.value = '';
};

const handleSubmit = async () => {
  error.value = '';
  
  // Validation
  if (!/^\d{4,6}$/.test(form.value.current)) {
    error.value = 'Текущий PIN должен быть от 4 до 6 цифр';
    return;
  }
  if (!/^\d{4,6}$/.test(form.value.new)) {
    error.value = 'Новый PIN должен быть от 4 до 6 цифр';
    return;
  }
  if (form.value.new !== form.value.confirm) {
    error.value = 'PIN-коды не совпадают';
    return;
  }
  if (form.value.current === form.value.new) {
    error.value = 'Новый PIN не должен совпадать с текущим';
    return;
  }
  
  loading.value = true;
  try {
    await apiClient.changePin(form.value.current, form.value.new);
    appStore.showToast({
      title: 'Успех',
      message: 'PIN-код успешно изменён',
      type: 'success'
    });
    closeModal();
  } catch (err: any) {
    const message = err?.message || 'Не удалось изменить PIN';
    if (message.includes('Неверный') || message.includes('invalid')) {
      error.value = 'Неверный текущий PIN';
    } else {
      error.value = message;
    }
  } finally {
    loading.value = false;
  }
};
</script>
