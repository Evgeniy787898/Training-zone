<template>
  <div class="pin-screen">
    <!-- Success state -->
    <Transition name="success-fade">
      <div v-if="success" class="pin-success">
        <div class="pin-success__logo"></div>
      </div>
    </Transition>

    <!-- PIN Entry -->
    <Transition name="fade">
      <div v-if="!success" class="pin-layout">
        <!-- Logo section - fills top -->
        <div class="pin-header">
          <div class="pin-logo"></div>
        </div>

        <!-- PIN input section - bottom -->
        <div class="pin-body">
          <!-- Dots + Numpad together -->
          <div class="pin-dots">
            <div 
              v-for="(digit, i) in pin" 
              :key="i"
              class="pin-dot"
              :class="{ 'filled': digit, 'error': error && digit }"
            />
          </div>

          <div v-if="error" class="pin-error">{{ error }}</div>

          <div class="pin-numpad">
            <button 
              v-for="n in [1,2,3,4,5,6,7,8,9]" 
              :key="n"
              class="pin-key"
              :disabled="checking"
              @click="addDigit(n.toString())"
            >{{ n }}</button>
            
            <button class="pin-key pin-key--icon" :disabled="checking || !hasDigits" @click="clearPin">
              ←
            </button>
            
            <button class="pin-key" :disabled="checking" @click="addDigit('0')">0</button>
            
            <button class="pin-key pin-key--icon" :disabled="checking || !hasDigits" @click="deleteDigit">
              ✕
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import { configureClient } from '@/services/api';
import type { PinVerificationResponse } from '@/types';
import { hapticLight, hapticSuccess, hapticError } from '@/utils/hapticFeedback';

const emit = defineEmits<{ success: [] }>();

const pin = ref(['', '', '', '']);
const error = ref('');
const checking = ref(false);
const success = ref(false);

const hasDigits = computed(() => pin.value.some(d => d));

const addDigit = (digit: string) => {
  if (checking.value || success.value) return;
  const idx = pin.value.findIndex(d => !d);
  if (idx === -1) return;
  pin.value[idx] = digit;
  error.value = '';
  hapticLight();
  if (idx === 3) checkPin();
};

const deleteDigit = () => {
  if (checking.value || success.value) return;
  for (let i = 3; i >= 0; i--) {
    if (pin.value[i]) { pin.value[i] = ''; error.value = ''; hapticLight(); break; }
  }
};

const clearPin = () => {
  if (checking.value || success.value) return;
  pin.value = ['', '', '', ''];
  error.value = '';
  hapticLight();
};

const checkPin = async () => {
  const code = pin.value.join('');
  if (code.length !== 4) return;
  checking.value = true;
  
  try {
    const resp: PinVerificationResponse = await apiClient.verifyPin(code);
    if (resp.valid) {
      if (resp.token) {
        await configureClient({ token: resp.token, profileId: resp.profileId, skipAuth: true });
      }
      checking.value = false;
      success.value = true;
      hapticSuccess();
      setTimeout(() => emit('success'), 1000);
    } else {
      handleError(resp.message);
    }
  } catch (err: any) {
    handleError(err.response?.data?.message || 'Ошибка');
    console.error('PIN error:', err);
  } finally {
    if (!success.value) checking.value = false;
  }
};

const handleError = (msg?: string) => {
  error.value = msg || 'Неверный PIN';
  hapticError();
  setTimeout(() => { pin.value = ['', '', '', '']; error.value = ''; }, 1500);
};

const onKeyDown = (e: KeyboardEvent) => {
  if (checking.value || success.value) return;
  if (e.key >= '0' && e.key <= '9') { e.preventDefault(); addDigit(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); deleteDigit(); }
  else if (e.key === 'Escape') { e.preventDefault(); clearPin(); }
};

onMounted(() => window.addEventListener('keydown', onKeyDown));
onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
</script>

<style scoped>
.pin-screen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #0a0a0a;
  overflow: hidden;
}

/* Main layout - flexbox column */
.pin-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  height: 100dvh;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
}

/* Header with logo - flexible, takes all available space */
.pin-header {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  min-height: 120px;
}

/* Logo - scales based on container */
.pin-logo {
  width: 100%;
  height: 100%;
  max-width: 95vw;
  max-height: 45vh;
  background-color: #fff;
  mask-image: url('/img/logo-train-zone.png');
  -webkit-mask-image: url('/img/logo-train-zone.png');
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
}

/* Body - fixed at bottom, contains dots and numpad */
.pin-body {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem 2rem;
}

/* PIN Dots - compact, close to numpad */
.pin-dots {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.pin-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  background: transparent;
  transition: all 0.2s ease;
}

.pin-dot.filled {
  background: var(--color-accent, #3b82f6);
  border-color: var(--color-accent, #3b82f6);
}

.pin-dot.error {
  background: #ef4444;
  border-color: #ef4444;
  animation: shake 0.4s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

/* Error */
.pin-error {
  font-size: 0.8rem;
  color: #ef4444;
  text-align: center;
  min-height: 1.2rem;
}

/* Numpad - big buttons */
.pin-numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(0.75rem, 3vw, 1.25rem);
  width: 100%;
  max-width: min(400px, 95vw);
}

.pin-key {
  aspect-ratio: 1;
  width: 100%;
  max-width: clamp(80px, 22vw, 110px);
  min-height: clamp(80px, 22vw, 110px);
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: clamp(1.75rem, 6vw, 2.5rem);
  font-weight: 300;
  color: #fff;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.12s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.pin-key:active:not(:disabled) {
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--color-accent, #3b82f6);
  transform: scale(0.94);
}

.pin-key:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.pin-key--icon {
  font-size: 1.2rem;
  border-color: transparent;
  opacity: 0.5;
}

.pin-key--icon:active:not(:disabled) {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* Success */
.pin-success {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0a;
}

.pin-success__logo {
  width: 90vw;
  max-width: 600px;
  height: 50vh;
  background: linear-gradient(135deg, var(--color-accent, #3b82f6) 0%, #f59e0b 100%);
  mask-image: url('/img/logo-train-zone.png');
  -webkit-mask-image: url('/img/logo-train-zone.png');
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
  animation: logoSuccess 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes logoSuccess {
  0% { transform: scale(0.7); opacity: 0; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.success-fade-enter-active { transition: opacity 0.4s ease 0.2s; }
.success-fade-enter-from { opacity: 0; }

/* Small screens */
@media (max-height: 600px) {
  .pin-header { min-height: 80px; }
  .pin-logo { max-height: 30vh; }
  .pin-numpad { gap: 0.5rem; max-width: 240px; }
  .pin-key { max-width: 64px; min-height: 64px; font-size: 1.4rem; }
}
</style>