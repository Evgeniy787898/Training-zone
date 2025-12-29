<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="settings-modal-overlay" @click.self="handleClose">
        <div class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
          <header class="settings-modal__header">
            <h3 id="settings-modal-title" class="settings-modal__title">
              ⚙️ Настройки таймера
            </h3>
            <button class="settings-modal__close" @click="handleClose" aria-label="Закрыть">
              ✕
            </button>
          </header>
          
          <div class="settings-modal__body">
            <div class="settings-field">
              <label class="settings-field__label">
                Работа в подходе
                <span class="settings-field__hint">секунды</span>
              </label>
              <div class="settings-field__control">
                <button class="settings-field__btn" @click="adjust('work', -5)">−5</button>
                <span class="settings-field__value">{{ localSettings.work }}</span>
                <button class="settings-field__btn" @click="adjust('work', 5)">+5</button>
              </div>
            </div>
            
            <div class="settings-field">
              <label class="settings-field__label">
                Отдых между повторениями
                <span class="settings-field__hint">секунды</span>
              </label>
              <div class="settings-field__control">
                <button class="settings-field__btn" @click="adjust('rest', -5)">−5</button>
                <span class="settings-field__value">{{ localSettings.rest }}</span>
                <button class="settings-field__btn" @click="adjust('rest', 5)">+5</button>
              </div>
            </div>
            
            <div class="settings-field">
              <label class="settings-field__label">
                Отдых между подходами
                <span class="settings-field__hint">секунды</span>
              </label>
              <div class="settings-field__control">
                <button class="settings-field__btn" @click="adjust('restBetweenSets', -10)">−10</button>
                <span class="settings-field__value">{{ localSettings.restBetweenSets }}</span>
                <button class="settings-field__btn" @click="adjust('restBetweenSets', 10)">+10</button>
              </div>
            </div>
            
            <div class="settings-field">
              <label class="settings-field__label">
                Отдых между упражнениями
                <span class="settings-field__hint">секунды</span>
              </label>
              <div class="settings-field__control">
                <button class="settings-field__btn" @click="adjust('restBetweenExercises', -15)">−15</button>
                <span class="settings-field__value">{{ localSettings.restBetweenExercises }}</span>
                <button class="settings-field__btn" @click="adjust('restBetweenExercises', 15)">+15</button>
              </div>
            </div>
          </div>
          
          <footer class="settings-modal__footer">
            <button class="settings-modal__btn settings-modal__btn--secondary" @click="resetDefaults">
              Сбросить
            </button>
            <button class="settings-modal__btn settings-modal__btn--primary" @click="handleSave">
              Сохранить
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { hapticLight } from '@/utils/hapticFeedback';

interface TabataSettings {
  work: number;
  rest: number;
  restBetweenSets: number;
  restBetweenExercises: number;
}

interface Props {
  isOpen: boolean;
  settings: TabataSettings;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', settings: TabataSettings): void;
}>();

const DEFAULT_SETTINGS: TabataSettings = {
  work: 45,
  rest: 15,
  restBetweenSets: 90,
  restBetweenExercises: 180
};

const LIMITS: Record<keyof TabataSettings, { min: number; max: number }> = {
  work: { min: 10, max: 300 },
  rest: { min: 5, max: 120 },
  restBetweenSets: { min: 30, max: 300 },
  restBetweenExercises: { min: 60, max: 600 }
};

const localSettings = reactive<TabataSettings>({ ...props.settings });

watch(() => props.isOpen, (open) => {
  if (open) {
    Object.assign(localSettings, props.settings);
  }
});

const adjust = (field: keyof TabataSettings, delta: number) => {
  const newValue = localSettings[field] + delta;
  const { min, max } = LIMITS[field];
  localSettings[field] = Math.max(min, Math.min(max, newValue));
  hapticLight();
};

const resetDefaults = () => {
  Object.assign(localSettings, DEFAULT_SETTINGS);
  hapticLight();
};

const handleSave = () => {
  emit('save', { ...localSettings });
  emit('close');
};

const handleClose = () => {
  emit('close');
};
</script>

<style scoped>
.settings-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.settings-modal {
  width: 100%;
  max-height: 85vh;
  background: var(--color-bg-modal, var(--color-bg-elevated));
  border-top-left-radius: 32px;
  border-top-right-radius: 32px;
  border: 1px solid var(--color-border);
  border-bottom: none;
  overflow: hidden;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
}

.settings-modal__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  background: var(--color-bg-modal, var(--color-bg-elevated));
  border-bottom: 1px solid var(--color-border);
  position: relative;
}

.settings-modal__title {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, var(--color-text-primary) 0%, var(--color-text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.settings-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  background: transparent;
  border: 2px solid var(--color-border-strong, var(--color-border));
  cursor: pointer;
  color: var(--color-text-primary);
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.settings-modal__close:hover {
  border-color: var(--color-text-primary);
  transform: rotate(90deg) scale(1.1);
}

.settings-modal__body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.settings-field__label {
  flex: 1;
  font-size: 0.875rem;
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-field__hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.settings-field__control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-field__btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.settings-field__btn:active {
  transform: scale(0.95);
  background: var(--color-bg-tertiary);
}

.settings-field__value {
  min-width: 48px;
  text-align: center;
  font-size: 1.125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-accent);
}

.settings-modal__footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

.settings-modal__btn {
  flex: 1;
  padding: 12px 16px;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.settings-modal__btn--secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.settings-modal__btn--primary {
  background: var(--color-accent);
  color: white;
}

.settings-modal__btn:active {
  transform: scale(0.98);
}

/* Transitions - slide from bottom */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-active .settings-modal,
.modal-fade-leave-active .settings-modal {
  transition: transform 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .settings-modal,
.modal-fade-leave-to .settings-modal {
  transform: translateY(100%);
}
</style>
