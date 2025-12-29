<template>
  <!-- PHOTO-F02: Body measurements form for progress photo uploads -->
  <div class="body-measurements-form">
    <div class="form-header">
      <h3 class="form-title">
        <span class="title-icon">📏</span>
        {{ title }}
      </h3>
      <p class="form-subtitle">Добавьте замеры для отслеживания прогресса</p>
    </div>

    <form @submit.prevent="handleSubmit" class="form-content">
      <!-- Weight -->
      <div class="form-section">
        <h4 class="section-title">Вес</h4>
        <div class="form-group">
          <label class="form-label" for="weight">Вес (кг)</label>
          <div class="input-with-unit">
            <input
              id="weight"
              v-model.number="formData.weight"
              type="number"
              step="0.1"
              min="30"
              max="300"
              class="form-input"
              placeholder="75.5"
            />
            <span class="unit">кг</span>
          </div>
        </div>
      </div>

      <!-- Body Measurements -->
      <div class="form-section">
        <h4 class="section-title">Обхваты (см)</h4>
        
        <div class="measurements-grid">
          <div 
            v-for="field in measurementFields" 
            :key="String(field.key)"
            class="form-group"
          >
            <label class="form-label" :for="String(field.key)">
              {{ field.icon }} {{ field.label }}
            </label>
            <div class="input-with-unit">
              <input
                :id="String(field.key)"
                v-model.number="formData[field.key as string]"
                type="number"
                step="0.5"
                :min="field.min"
                :max="field.max"
                class="form-input"
                :placeholder="field.placeholder"
              />
              <span class="unit">см</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="form-section">
        <h4 class="section-title">Примечания</h4>
        <div class="form-group">
          <textarea
            v-model="formData.notes"
            class="form-textarea"
            placeholder="Условия измерения, время суток, самочувствие..."
            rows="2"
          />
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button 
          type="button" 
          class="quick-btn"
          @click="copyFromLastMeasurement"
          :disabled="!lastMeasurement"
        >
          📋 Скопировать предыдущие
        </button>
        <button 
          type="button" 
          class="quick-btn"
          @click="clearForm"
        >
          🗑️ Очистить
        </button>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <button 
          type="button" 
          class="btn btn-secondary"
          @click="$emit('cancel')"
        >
          Пропустить
        </button>
        <button 
          type="submit" 
          class="btn btn-primary"
          :disabled="!hasData"
        >
          Сохранить замеры
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

export interface BodyMeasurements {
  weight: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  bicepLeft: number | null;
  bicepRight: number | null;
  thighLeft: number | null;
  thighRight: number | null;
  calf: number | null;
  neck: number | null;
  notes: string;
  date: string;
  [key: string]: number | null | string | undefined;
}

interface MeasurementField {
  key: keyof BodyMeasurements;
  label: string;
  icon: string;
  min: number;
  max: number;
  placeholder: string;
}

interface Props {
  title?: string;
  initialData?: Partial<BodyMeasurements>;
  lastMeasurement?: Partial<BodyMeasurements> | null;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Замеры тела',
  lastMeasurement: null,
});

const emit = defineEmits<{
  (e: 'submit', data: BodyMeasurements): void;
  (e: 'cancel'): void;
}>();

const measurementFields: MeasurementField[] = [
  { key: 'chest', label: 'Грудь', icon: '🫁', min: 50, max: 200, placeholder: '100' },
  { key: 'waist', label: 'Талия', icon: '⭕', min: 40, max: 180, placeholder: '80' },
  { key: 'hips', label: 'Бёдра', icon: '🍑', min: 50, max: 200, placeholder: '95' },
  { key: 'bicepLeft', label: 'Бицепс Л', icon: '💪', min: 15, max: 70, placeholder: '35' },
  { key: 'bicepRight', label: 'Бицепс П', icon: '💪', min: 15, max: 70, placeholder: '35' },
  { key: 'thighLeft', label: 'Бедро Л', icon: '🦵', min: 30, max: 100, placeholder: '55' },
  { key: 'thighRight', label: 'Бедро П', icon: '🦵', min: 30, max: 100, placeholder: '55' },
  { key: 'calf', label: 'Голень', icon: '🦶', min: 20, max: 60, placeholder: '38' },
  { key: 'neck', label: 'Шея', icon: '🦒', min: 25, max: 60, placeholder: '40' },
];

const defaultFormData: BodyMeasurements = {
  weight: null,
  chest: null,
  waist: null,
  hips: null,
  bicepLeft: null,
  bicepRight: null,
  thighLeft: null,
  thighRight: null,
  calf: null,
  neck: null,
  notes: '',
  date: new Date().toISOString().split('T')[0],
};

const formData = ref<BodyMeasurements>({ ...defaultFormData, ...props.initialData });

const hasData = computed(() => {
  return formData.value.weight !== null || 
    measurementFields.some(f => formData.value[f.key] !== null);
});

watch(() => props.initialData, (newData) => {
  if (newData) {
    formData.value = { ...defaultFormData, ...newData };
  }
}, { deep: true });

function handleSubmit() {
  if (!hasData.value) return;
  emit('submit', { ...formData.value });
}

function copyFromLastMeasurement() {
  if (!props.lastMeasurement) return;
  
  formData.value = {
    ...formData.value,
    ...props.lastMeasurement,
    notes: '', // Reset notes
    date: new Date().toISOString().split('T')[0],
  };
}

function clearForm() {
  formData.value = { ...defaultFormData };
}
</script>

<style scoped>
.body-measurements-form {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.form-header {
  padding: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.form-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-xs) 0;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.title-icon {
  font-size: 1.2em;
}

.form-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.form-content {
  padding: var(--space-md);
}

.form-section {
  margin-bottom: var(--space-lg);
}

.section-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--space-sm) 0;
}

.form-group {
  margin-bottom: var(--space-sm);
}

.form-label {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.input-with-unit {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.form-input {
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  transition: border-color var(--duration-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.unit {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  min-width: 24px;
}

.measurements-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-sm);
}

.form-textarea {
  width: 100%;
  padding: var(--space-sm);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  resize: vertical;
  min-height: 60px;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.quick-actions {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.quick-btn {
  flex: 1;
  padding: var(--space-sm);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.quick-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: flex-end;
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.btn {
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-accent);
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-secondary {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--color-text-secondary);
}

@media (max-width: 640px) {
  .measurements-grid {
    grid-template-columns: 1fr;
  }
  
  .quick-actions {
    flex-direction: column;
  }
  
  .form-actions {
    flex-direction: column-reverse;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
