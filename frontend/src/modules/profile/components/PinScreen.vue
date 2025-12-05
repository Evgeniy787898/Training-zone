<template>
  <div class="pin-screen" role="dialog" aria-modal="true" :aria-label="success ? 'Загрузка' : 'Ввод PIN-кода'">
    <div class="pin-container" :class="{ 'pin-container--success': success }">
      <!-- Logo -->
      <!-- Logo -->
      <div class="pin-logo" :class="{ 'pin-logo--success': success }">
        <div class="pin-logo__img" :class="{ 'pin-logo__img--success': success }"></div>
      </div>

      <!-- PIN Input UI (hidden on success) -->
      <transition name="fade-out">
        <div v-if="!success" class="pin-input-container">
          <!-- PIN Dots -->
          <div class="pin-dots">
            <div 
          v-for="(digit, index) in pin"
          :key="index"
              :class="['pin-dot', { 
                'pin-dot--filled': digit, 
                'pin-dot--error': error 
              }]"
        />
      </div>

          <!-- Status Messages (Error only - убрали checking spinner) -->
          <div class="pin-status" role="status" aria-live="polite" aria-atomic="true">
            <transition name="fade" mode="out-in">
              <div v-if="error" key="error" class="pin-error-text">{{ error }}</div>
              <div v-else key="empty" class="pin-status-empty"></div>
            </transition>
      </div>

          <!-- Numpad -->
          <div class="pin-numpad">
            <button
              v-for="num in [1, 2, 3, 4, 5, 6, 7, 8, 9]"
              :key="num"
              @click="addDigit(num.toString())"
              :disabled="checking"
              class="pin-key"
              :class="{ 
                'pin-key--error': showErrorOutline,
                'pin-key--success': showSuccessOutline 
              }"
              type="button"
              :style="getKeyStyle(num)"
            >
              {{ num }}
            </button>
            
            <button
              @click="clearPin"
              :disabled="checking || pin.join('').length === 0"
              class="pin-key pin-key--clear"
              :class="{ 
                'pin-key--error': showErrorOutline,
                'pin-key--success': showSuccessOutline 
              }"
              type="button"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            
            <button
              @click="addDigit('0')"
              :disabled="checking"
              class="pin-key"
              :class="{ 
                'pin-key--error': showErrorOutline,
                'pin-key--success': showSuccessOutline 
              }"
              type="button"
              :style="getKeyStyle(0)"
            >
              0
            </button>
            
            <button
              @click="deleteLastDigit"
              :disabled="checking || pin.join('').length === 0"
              class="pin-key pin-key--delete"
              type="button"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
      </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import { configureClient } from '@/services/api';
import { PinVerificationResponse } from '@/types';
import { useBatchUpdates } from '@/composables/useBatchUpdates';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '@/utils/hapticFeedback';

const emit = defineEmits<{
  success: [];
}>();

// Batch updates для оптимизации
const { batchRAF } = useBatchUpdates();

const pin = ref(['', '', '', '']);
const error = ref('');
const checking = ref(false);
const clientConfigured = ref(false);
const success = ref(false);
const showErrorOutline = ref(false);
const showSuccessOutline = ref(false);

// Состояние для быстрого отклика кнопок (анимация нажатия)
const activeKeys = ref<Set<number>>(new Set());

// Флаг для предзагрузки данных
const contentPreloadingStarted = ref(false);

onMounted(async () => {
  // Настраиваем клиент без запроса к /auth/telegram (только сохранение данных)
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initData) {
      await configureClient({
        telegramUser: tg.initDataUnsafe?.user,
        initData: tg.initData,
        skipAuth: true,
      });
      clientConfigured.value = true;
    } else {
      await configureClient({ skipAuth: true });
      clientConfigured.value = true;
    }
  } catch (err) {
    clientConfigured.value = true;
  }
});

// Функция для предзагрузки контента в фоне (безопасная, не блокирующая)
const preloadContent = async () => {
  if (contentPreloadingStarted.value) return;
  contentPreloadingStarted.value = true;

  // Начинаем предзагрузку критичных данных параллельно
  // Используем setTimeout для неблокирующей загрузки
  setTimeout(() => {
    try {
      // Предзагружаем только безопасные данные (без профиля - требует аутентификации)
      // Направления тренировок (приоритетная загрузка, можно загружать без auth)
      apiClient.getTrainingDisciplines().catch(() => {
        // Тихая ошибка - не критично, продолжаем работу
      });
      
      // Не предзагружаем профиль - он требует аутентификации после PIN
    } catch (err) {
      // Тихая ошибка - не критично
    }
  }, 50); // Небольшая задержка для неблокирующей загрузки
};

// Быстрое добавление цифры с оптимизацией
const addDigit = (digit: string) => {
  if (checking.value || success.value) return;
  
  const currentLength = pin.value.filter(d => d).length;
  
  // Проверяем ДО добавления - если уже 4 символа, не добавляем
  if (currentLength >= 4) return;
  
  // Синхронно обновляем PIN для мгновенного отклика
  pin.value[currentLength] = digit;
  error.value = '';

  // Haptic feedback - мгновенно
  hapticLight();

  // Визуальный отклик кнопки через RAF для батчинга
  const num = parseInt(digit);
  batchRAF(() => {
    activeKeys.value.add(num);
    setTimeout(() => {
      activeKeys.value.delete(num);
    }, 100); // Быстрое исчезновение визуального отклика
  });

  // Проверяем ПОСЛЕ добавления цифры (новую длину)
  const newLength = currentLength + 1;
  
  // Начинаем предзагрузку контента после ввода 3-го символа (заранее)
  if (newLength === 3 && !contentPreloadingStarted.value) {
    preloadContent();
  }
  
  // Автоматическая проверка при вводе 4-го символа - без задержки
  if (newLength === 4) {
    // Мгновенная проверка без задержки
    checkPin();
  }
};

const deleteLastDigit = () => {
  if (checking.value || success.value) return;
  
  batchRAF(() => {
    const currentLength = pin.value.filter(d => d).length;
    if (currentLength > 0) {
      pin.value[currentLength - 1] = '';
      error.value = '';
  }
  });

  hapticLight();
};

const clearPin = () => {
  if (checking.value || success.value) return;
  
  batchRAF(() => {
    pin.value = ['', '', '', ''];
    error.value = '';
  });

  hapticMedium();
};

const checkPin = async () => {
  const enteredPin = pin.value.join('');

  if (enteredPin.length !== 4) {
    return;
  }

  // Убеждаемся, что клиент настроен
  if (!clientConfigured.value) {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initData) {
        await configureClient({
          telegramUser: tg.initDataUnsafe?.user,
          initData: tg.initData,
          skipAuth: true,
        });
        clientConfigured.value = true;
      } else {
        await configureClient({ skipAuth: true });
        clientConfigured.value = true;
      }
    } catch (err) {
      // Тихая ошибка
    }
  }

  // Начинаем предзагрузку контента параллельно с проверкой PIN
  if (!contentPreloadingStarted.value) {
    preloadContent();
  }

  checking.value = true;

  try {
    const response: PinVerificationResponse = await apiClient.verifyPin(enteredPin);
    if (response.valid) {
      // Сохраняем токен из ответа (для веб-версии)
      if (response.token) {
        try {
          // Обновляем токен в API клиенте
          await configureClient({
            token: response.token,
            profileId: response.profileId,
            skipAuth: true,
          });
        } catch (configError) {
          // Не критично, если не удалось настроить клиент - токен уже в ответе
          console.warn('Failed to configure client with token:', configError);
        }
      }

      // Показываем зеленую обводку на миг
      showSuccessOutline.value = true;
      setTimeout(() => {
        showSuccessOutline.value = false;
      }, 500); // Зеленая обводка на 500ms

      // Батчим обновление состояния через RAF - мгновенно
      checking.value = false;
      success.value = true;

      hapticSuccess();

      // Эмитим success после анимации (быстрее - 1.2 секунды для совпадения с анимацией)
      setTimeout(() => {
        emit('success');
      }, 1200); // Ускорено до 1.2 секунды для совпадения с анимацией логотипа
    } else {
      showError();
    }
  } catch (err: any) {
    showError();
    console.error('PIN verification failed:', err);
  } finally {
    if (!success.value) {
      batchRAF(() => {
        checking.value = false;
      });
    }
  }
};

const showError = () => {
  // Показываем красную обводку
  showErrorOutline.value = true;
  batchRAF(() => {
    error.value = 'Неверный PIN';
  });

  hapticError();

  setTimeout(() => {
    batchRAF(() => {
      pin.value = ['', '', '', ''];
      error.value = '';
      showErrorOutline.value = false;
    });
  }, 1500);
};

// Функция для стилей кнопок (быстрый визуальный отклик)
const getKeyStyle = (num: number) => {
  return activeKeys.value.has(num)
    ? { transform: 'scale(0.92)', transition: 'transform 0.05s ease' }
    : { transform: 'scale(1)', transition: 'transform 0.1s ease' };
};

// Поддержка физической клавиатуры
const handleKeyPress = (event: KeyboardEvent) => {
  if (checking.value || success.value) return;
  
  const key = event.key;
  
  if (key >= '0' && key <= '9') {
    event.preventDefault();
    addDigit(key);
  } else if (key === 'Backspace' || key === 'Delete') {
    event.preventDefault();
    deleteLastDigit();
  } else if (key === 'Escape') {
    event.preventDefault();
    clearPin();
  } else if (key === 'Enter') {
    event.preventDefault();
    if (pin.value.filter(d => d).length === 4) {
      checkPin();
    }
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyPress);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyPress);
});
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.pin-screen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: stretch; /* Changed from center to stretch */
  justify-content: stretch; /* Changed from center */
  background: linear-gradient(180deg, var(--color-bg) 0%, var(--color-bg-secondary) 100%);
  overflow: hidden;
  padding: 0;
  margin: 0;
}

.pin-container {
  width: 100%;
  max-width: 100%;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: max(env(safe-area-inset-top), 1.5rem) 1rem max(env(safe-area-inset-bottom), 1rem); /* Reset bottom padding */
  animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  position: relative;
  gap: 0;
}

.pin-container--success {
  justify-content: center;
  gap: 0;
  padding: 0;
  transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.pin-input-container {
  width: 100%;
  max-width: 400px;
  flex: 0 0 auto; /* Size to content, don't grow/shrink arbitrarily */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 2rem;
  padding-bottom: max(env(safe-area-inset-bottom), 3rem); /* Ensure distance from bottom */
}

@keyframes fadeIn {
  from { 
    opacity: 0; 
    transform: translateY(10px);
  }
  to { 
    opacity: 1; 
    transform: translateY(0);
  }
}

/* Logo - Крупный, современный стиль */
.pin-logo {
  position: relative;
  width: 100%;
  flex: 1; /* Grow to fill available space */
  min-height: 100px; /* Minimum height to ensure visibility */
  display: flex;
  display: flex;
  align-items: center; /* Center vertically */
  justify-content: center;
  padding-bottom: 0; /* Remove padding to center properly */
  margin-bottom: auto; /* Push content below it down if needed */
  will-change: transform, opacity;
  padding-bottom: 2rem; /* Visual separation from dots */
}

.pin-logo__img {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 90vw;
  max-height: 100%; /* Fill the flex container */
  object-fit: contain; /* Ensure aspect ratio is preserved */
  background-color: var(--color-text-primary);
  mask-image: url('/img/logo-train-zone.png');
  -webkit-mask-image: url('/img/logo-train-zone.png');
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform: scale(2) translateY(15%); /* Scale + shift down within container */
}

.pin-logo--success {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  width: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: logoSuccessContainer 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.pin-logo__img--success {
  background: linear-gradient(135deg, #3b82f6 0%, #f59e0b 100%);
  width: 2100px;
  height: 455px;
  filter: drop-shadow(0 0 40px rgba(59, 130, 246, 0.6));
  animation: logoSimpleScale 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  max-width: 98vw;
}

/* Новая анимация контейнера логотипа - плавное появление с bounce */
@keyframes logoSuccessContainer {
  0% {
    transform: translate(-50%, -50%) scale(0.7);
    opacity: 0.6;
  }
  30% {
    transform: translate(-50%, -50%) scale(1.08);
    opacity: 0.95;
  }
  55% {
    transform: translate(-50%, -50%) scale(0.96);
    opacity: 1;
  }
  75% {
    transform: translate(-50%, -50%) scale(1.02);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

/* Простая анимация масштабирования без прыжков - быстрее */
@keyframes logoSimpleScale {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  40% {
    transform: scale(1.1);
    opacity: 1;
  }
  100% {
    transform: scale(1.2);
    opacity: 1;
  }
}

/* PIN Dots */
.pin-dots {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  align-items: center;
  min-height: 24px;
  width: 100%;
}

.pin-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, background, box-shadow;
}

.pin-dot--filled {
  background: #3b82f6;
  border-color: #3b82f6;
  transform: scale(1.3);
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
}

.pin-dot--error {
  background: #ef4444;
  border-color: #ef4444;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.6);
  animation: shake 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}

/* Status Container */
.pin-status {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.pin-status-empty {
  height: 24px;
  width: 100%;
}

/* Error Text */
.pin-error-text {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: #ef4444;
  text-align: center;
  width: 100%;
  position: absolute;
  text-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
  animation: errorFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes errorFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Numpad - Оптимизирован для быстрого отклика */
.pin-numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(1rem, 2.5vw, 1.5rem);
  width: 100%;
  max-width: 380px;
  justify-items: center;
}

.pin-key {
  aspect-ratio: 1;
  width: 100%;
  max-width: 110px; /* Larger buttons */
  min-height: 110px; /* Larger buttons */
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', 'Roboto Flex', 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: clamp(2rem, 6vw, 2.5rem); /* Increased font size */
  font-weight: 400;
  color: #fff;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  will-change: transform, background, box-shadow;
  backdrop-filter: blur(10px);
}

.pin-key:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.05);
}

.pin-key:active:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  color: #60a5fa;
  transform: scale(0.95);
  box-shadow: 0 0 25px rgba(59, 130, 246, 0.3);
  transition: all 0.05s cubic-bezier(0.4, 0, 0.2, 1);
}

.pin-key:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  transform: scale(0.98);
}

/* Красная обводка при ошибке - тусклая, мягкая */
.pin-key--error {
  border-color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.1) !important;
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
  animation: errorPulse 0.4s ease-out;
}

@keyframes errorPulse {
  0% { border-color: #ef4444; }
  50% { border-color: #ef4444; }
  100% { border-color: #ef4444; }
}

/* Зеленая обводка при успехе - тусклая, мягкая */
.pin-key--success {
  border-color: #10b981 !important;
  background: rgba(16, 185, 129, 0.1) !important;
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
  animation: successPulse 0.6s ease-out;
}

@keyframes successPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.pin-key--clear,
.pin-key--delete {
  font-size: 1rem;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.pin-key--clear svg,
.pin-key--delete svg {
  width: 32px;
  height: 32px;
  stroke: rgba(255, 255, 255, 0.5);
  transition: stroke 0.2s ease;
}

.pin-key--clear:hover svg,
.pin-key--delete:hover svg {
  stroke: #fff;
}

.pin-key--clear:active:not(:disabled),
.pin-key--delete:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: transparent;
  box-shadow: none;
  transform: scale(0.9);
}

.pin-key--clear:active:not(:disabled) svg,
.pin-key--delete:active:not(:disabled) svg {
  stroke: #fff;
}

/* Transitions */
.fade-enter-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1) 0.05s;
}

.fade-leave-active {
  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Fade out transition for pin input */
.fade-out-enter-active,
.fade-out-leave-active {
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-out-enter-from,
.fade-out-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-15px);
}

/* Responsive */
@media (max-width: 480px) {
  .pin-container {
    gap: 2rem;
  }

  .pin-input-container {
    gap: 2rem;
  }

  .pin-numpad {
    gap: 1rem;
    max-width: 340px;
  }

  .pin-key {
    max-width: 84px;
    min-height: 84px;
    font-size: 1.8rem;
  }
  
  .pin-logo__img {
    width: 600px;
    height: 130px;
    max-width: 90vw;
  }

  .pin-logo__img--success {
    width: 700px;
    height: 150px;
    max-width: 95vw;
  }
}

@media (max-width: 480px) {
  .pin-container {
    gap: 2rem;
  }

  .pin-input-container {
    gap: 2rem;
  }

  .pin-numpad {
    gap: 1rem;
    max-width: 340px;
  }

  .pin-key {
    max-width: 84px;
    min-height: 84px;
    font-size: 1.8rem;
  }
  
  .pin-logo__img {
    width: 280px;
    height: 60px;
  }
  
  .pin-logo__img--success {
    width: 320px;
    height: 70px;
  }
}

@media (max-width: 360px) {
  .pin-numpad {
    gap: 0.75rem;
    max-width: 300px;
  }

  .pin-key {
    max-width: 76px;
    min-height: 76px;
    font-size: 1.6rem;
  }

  .pin-dots {
    gap: 1.25rem;
  }

  .pin-dot {
    width: 14px;
    height: 14px;
  }
  
  .pin-logo__img {
    width: 240px;
    height: 52px;
  }
  
  .pin-logo__img--success {
    width: 280px;
    height: 60px;
  }
}

/* Landscape & Short screens */
@media (max-height: 700px) {
  .pin-container {
    gap: 2rem;
    padding: max(env(safe-area-inset-top), 1.25rem) 1rem max(env(safe-area-inset-bottom), 1.25rem);
  }
  
  .pin-logo__img {
    width: 400px;
    height: 86px;
  }

  .pin-logo__img--success {
    width: 460px;
    height: 100px;
  }
  
  .pin-status {
    height: 28px;
  }

  .pin-input-container {
    gap: 1.75rem;
  }
}

@media (max-height: 600px) {
  .pin-container {
    gap: 1.5rem;
  }

  .pin-logo__img {
    width: 300px;
    height: 65px;
  }
  
  .pin-logo__img--success {
    width: 350px;
    height: 75px;
  }

  .pin-dots {
    min-height: 20px;
    gap: 0.875rem;
  }
  
  .pin-dot {
    width: 14px;
    height: 14px;
  }
  
  .pin-status {
    height: 24px;
  }
  
  .pin-input-container {
    gap: 1.5rem;
  }

  .pin-numpad {
    gap: 0.5rem;
    max-width: 320px;
  }
  
  .pin-key {
    max-width: 64px;
    min-height: 64px;
    font-size: 1.25rem;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Touch improvements - минимум 48px для тач-элементов */
@media (hover: none) and (pointer: coarse) {
  .pin-key {
    min-height: 88px;
    min-width: 88px;
  }
  
  .pin-key:active:not(:disabled) {
    transform: scale(0.92);
    transition: all 0.05s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* Desktop hover effects */
@media (hover: hover) and (pointer: fine) {
  .pin-key:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-border-subtle) 100%);
    border-color: var(--color-border-strong);
    transform: translateY(-1px);
    box-shadow: 
      var(--shadow-dark-md),
      inset 0 1px 0 var(--overlay-strong);
  }
  
  .pin-key--clear:hover:not(:disabled),
  .pin-key--delete:hover:not(:disabled) {
    background: var(--color-bg-secondary);
    border-color: var(--color-border);
    box-shadow: var(--shadow-sm);
  }

  .pin-key--clear:hover:not(:disabled) svg,
  .pin-key--delete:hover:not(:disabled) svg {
    stroke: var(--color-text-primary);
  }
}
</style>