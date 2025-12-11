<template>
  <BaseCard class="settings-card settings-card--body-params section-surface">
    <template #header>
      <div class="surface-card__header-content">
        <div class="surface-card__title">
          <NeonIcon name="user" variant="aqua" :size="26" class="settings-card__title-icon" />
          <span>Параметры тела</span>
        </div>
        <span v-if="isSaving" class="badge badge--warning">Сохранение...</span>
        <span v-else-if="lastSaved" class="badge badge--success">Сохранено</span>
      </div>
      <p class="surface-card__subtitle">
        Укажите ваш вес и рост для персонализированных рекомендаций.
      </p>
    </template>

    <LoadingState
      v-if="loading"
      class="settings-card__loader"
      title="Загружаю параметры…"
      description="Получаем данные профиля"
      :skeleton-count="2"
      :skeleton-lines="2"
      inline
    />

    <div v-else class="body-params-form">
      <div class="body-params-row">
        <label class="body-params-label">
          <span class="body-params-label__text">Вес</span>
          <div class="body-params-input-group">
            <input
              v-model.number="localWeight"
              type="number"
              min="30"
              max="300"
              step="0.1"
              class="body-params-input"
              placeholder="75"
              @blur="handleSave"
              @keyup.enter="handleSave"
            />
            <span class="body-params-unit">кг</span>
          </div>
        </label>
      </div>

      <div class="body-params-row">
        <label class="body-params-label">
          <span class="body-params-label__text">Рост</span>
          <div class="body-params-input-group">
            <input
              v-model.number="localHeight"
              type="number"
              min="100"
              max="250"
              step="1"
              class="body-params-input"
              placeholder="175"
              @blur="handleSave"
              @keyup.enter="handleSave"
            />
            <span class="body-params-unit">см</span>
          </div>
        </label>
      </div>

      <div v-if="bmi" class="body-params-bmi">
        <span class="body-params-bmi__label">ИМТ:</span>
        <span class="body-params-bmi__value" :class="bmiClass">{{ bmi }}</span>
        <span class="body-params-bmi__category">{{ bmiCategory }}</span>
      </div>
    </div>

    <template #footer>
      <div class="settings-card__actions">
        <BaseButton 
          variant="primary" 
          :disabled="!hasChanges || isSaving"
          @click="handleSave"
        >
          {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
        </BaseButton>
      </div>
    </template>
  </BaseCard>
</template>

<script setup lang="ts">
/**
 * BodyParamsWidget - Body Parameters Card for SettingsPage
 * FEAT-003: Weight, Height editing with BMI calculation
 */
import { ref, computed, watch } from 'vue';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';

interface BodyParams {
  weightKg?: number | null;
  heightCm?: number | null;
}

const props = defineProps<{
  loading: boolean;
  bodyParams: BodyParams | null;
}>();

const emit = defineEmits<{
  (e: 'update', params: { weightKg: number | null; heightCm: number | null }): void;
}>();

// Local state
const localWeight = ref<number | null>(null);
const localHeight = ref<number | null>(null);
const isSaving = ref(false);
const lastSaved = ref(false);

// Initialize from props
watch(
  () => props.bodyParams,
  (params) => {
    if (params) {
      localWeight.value = params.weightKg ?? null;
      localHeight.value = params.heightCm ?? null;
    }
  },
  { immediate: true }
);

// Check for changes
const hasChanges = computed(() => {
  const origWeight = props.bodyParams?.weightKg ?? null;
  const origHeight = props.bodyParams?.heightCm ?? null;
  return localWeight.value !== origWeight || localHeight.value !== origHeight;
});

// BMI calculation
const bmi = computed(() => {
  if (!localWeight.value || !localHeight.value) return null;
  const heightM = localHeight.value / 100;
  const value = localWeight.value / (heightM * heightM);
  return value.toFixed(1);
});

const bmiCategory = computed(() => {
  if (!bmi.value) return '';
  const val = parseFloat(bmi.value);
  if (val < 18.5) return 'Недостаточный вес';
  if (val < 25) return 'Норма';
  if (val < 30) return 'Избыточный вес';
  return 'Ожирение';
});

const bmiClass = computed(() => {
  if (!bmi.value) return '';
  const val = parseFloat(bmi.value);
  if (val < 18.5) return 'bmi--underweight';
  if (val < 25) return 'bmi--normal';
  if (val < 30) return 'bmi--overweight';
  return 'bmi--obese';
});

// Save handler
const handleSave = async () => {
  if (!hasChanges.value || isSaving.value) return;
  
  isSaving.value = true;
  lastSaved.value = false;
  
  try {
    emit('update', {
      weightKg: localWeight.value,
      heightCm: localHeight.value,
    });
    
    // Show success indicator briefly
    lastSaved.value = true;
    setTimeout(() => {
      lastSaved.value = false;
    }, 2000);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.body-params-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
}

.body-params-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.body-params-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.body-params-label__text {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.body-params-input-group {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.body-params-input {
  flex: 1;
  max-width: 120px;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-weight: 600;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.body-params-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 20%, transparent);
}

.body-params-input::placeholder {
  color: var(--color-text-tertiary);
  font-weight: 400;
}

/* Hide number input spinners */
.body-params-input::-webkit-outer-spin-button,
.body-params-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.body-params-input[type='number'] {
  -moz-appearance: textfield;
}

.body-params-unit {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
  min-width: 24px;
}

.body-params-bmi {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  margin-top: var(--space-xs);
}

.body-params-bmi__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.body-params-bmi__value {
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.body-params-bmi__value.bmi--underweight {
  color: var(--color-warning);
}

.body-params-bmi__value.bmi--normal {
  color: var(--color-success);
}

.body-params-bmi__value.bmi--overweight {
  color: var(--color-warning);
}

.body-params-bmi__value.bmi--obese {
  color: var(--color-error);
}

.body-params-bmi__category {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
</style>
