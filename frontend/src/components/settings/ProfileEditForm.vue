<template>
  <!-- SETT-F03: Profile editing form for weight, height, goals -->
  <div class="profile-edit-form">
    <div class="form-header">
      <h3 class="form-title">
        <span class="title-icon">⚙️</span>
        {{ title }}
      </h3>
    </div>

    <form @submit.prevent="handleSubmit" class="form-content">
      <!-- Personal Info Section -->
      <div class="form-section">
        <h4 class="section-title">Личные данные</h4>
        
        <div class="form-group">
          <label class="form-label" for="firstName">Имя</label>
          <input
            id="firstName"
            v-model="formData.firstName"
            type="text"
            class="form-input"
            placeholder="Ваше имя"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="lastName">Фамилия</label>
          <input
            id="lastName"
            v-model="formData.lastName"
            type="text"
            class="form-input"
            placeholder="Ваша фамилия"
          />
        </div>
      </div>

      <!-- Body Metrics Section -->
      <div class="form-section">
        <h4 class="section-title">Параметры тела</h4>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="weight">Вес (кг)</label>
            <input
              id="weight"
              v-model.number="formData.weight"
              type="number"
              step="0.1"
              min="30"
              max="300"
              class="form-input"
              placeholder="70"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="height">Рост (см)</label>
            <input
              id="height"
              v-model.number="formData.height"
              type="number"
              min="100"
              max="250"
              class="form-input"
              placeholder="175"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="birthYear">Год рождения</label>
          <input
            id="birthYear"
            v-model.number="formData.birthYear"
            type="number"
            min="1920"
            :max="currentYear"
            class="form-input"
            placeholder="1990"
          />
        </div>
      </div>

      <!-- Goals Section -->
      <div class="form-section">
        <h4 class="section-title">Цели тренировок</h4>
        
        <div class="goals-grid">
          <label 
            v-for="goal in availableGoals" 
            :key="goal.value"
            class="goal-option"
            :class="{ 'is-selected': formData.goals.includes(goal.value) }"
          >
            <input
              type="checkbox"
              :value="goal.value"
              v-model="formData.goals"
              class="goal-checkbox"
            />
            <span class="goal-icon">{{ goal.icon }}</span>
            <span class="goal-label">{{ goal.label }}</span>
          </label>
        </div>
      </div>

      <!-- Training Preferences -->
      <div class="form-section">
        <h4 class="section-title">Предпочтения</h4>
        
        <div class="form-group">
          <label class="form-label" for="experience">Опыт тренировок</label>
          <select id="experience" v-model="formData.experience" class="form-select">
            <option value="beginner">Начинающий (до 1 года)</option>
            <option value="intermediate">Средний (1-3 года)</option>
            <option value="advanced">Продвинутый (3+ лет)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="workoutsPerWeek">Тренировок в неделю</label>
          <div class="range-input">
            <input
              id="workoutsPerWeek"
              v-model.number="formData.workoutsPerWeek"
              type="range"
              min="1"
              max="7"
              class="form-range"
            />
            <span class="range-value">{{ formData.workoutsPerWeek }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <button 
          type="button" 
          class="btn btn-secondary"
          @click="handleReset"
          :disabled="saving"
        >
          Сбросить
        </button>
        <button 
          type="submit" 
          class="btn btn-primary"
          :disabled="saving || !hasChanges"
        >
          <span v-if="saving" class="btn-spinner" />
          {{ saving ? 'Сохранение...' : 'Сохранить' }}
        </button>
      </div>

      <!-- Success/Error Messages -->
      <Transition name="fade">
        <div v-if="message" :class="['form-message', message.type]">
          {{ message.text }}
        </div>
      </Transition>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

export interface ProfileFormData {
  firstName: string;
  lastName: string;
  weight: number | null;
  height: number | null;
  birthYear: number | null;
  goals: string[];
  experience: 'beginner' | 'intermediate' | 'advanced';
  workoutsPerWeek: number;
}

interface Props {
  title?: string;
  initialData?: Partial<ProfileFormData>;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Редактирование профиля',
});

const emit = defineEmits<{
  (e: 'save', data: ProfileFormData): void;
  (e: 'cancel'): void;
}>();

const currentYear = new Date().getFullYear();

const availableGoals = [
  { value: 'strength', label: 'Сила', icon: '💪' },
  { value: 'muscle', label: 'Масса', icon: '🏋️' },
  { value: 'endurance', label: 'Выносливость', icon: '🏃' },
  { value: 'flexibility', label: 'Гибкость', icon: '🧘' },
  { value: 'weight_loss', label: 'Похудение', icon: '📉' },
  { value: 'health', label: 'Здоровье', icon: '❤️' },
];

const defaultFormData: ProfileFormData = {
  firstName: '',
  lastName: '',
  weight: null,
  height: null,
  birthYear: null,
  goals: [],
  experience: 'beginner',
  workoutsPerWeek: 3,
};

const formData = ref<ProfileFormData>({ ...defaultFormData });
const originalData = ref<ProfileFormData>({ ...defaultFormData });
const saving = ref(false);
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null);

const hasChanges = computed(() => {
  return JSON.stringify(formData.value) !== JSON.stringify(originalData.value);
});

onMounted(() => {
  if (props.initialData) {
    const merged = { ...defaultFormData, ...props.initialData };
    formData.value = { ...merged };
    originalData.value = { ...merged };
  }
});

watch(() => props.initialData, (newData) => {
  if (newData) {
    const merged = { ...defaultFormData, ...newData };
    formData.value = { ...merged };
    originalData.value = { ...merged };
  }
}, { deep: true });

async function handleSubmit() {
  if (!hasChanges.value || saving.value) return;
  
  saving.value = true;
  message.value = null;
  
  try {
    emit('save', { ...formData.value });
    originalData.value = { ...formData.value };
    message.value = { type: 'success', text: 'Профиль успешно сохранён!' };
    
    setTimeout(() => {
      message.value = null;
    }, 3000);
  } catch (error) {
    message.value = { type: 'error', text: 'Ошибка сохранения. Попробуйте позже.' };
  } finally {
    saving.value = false;
  }
}

function handleReset() {
  formData.value = { ...originalData.value };
  message.value = null;
}
</script>

<style scoped>
.profile-edit-form {
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
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
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
  margin: 0 0 var(--space-md) 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.form-group {
  margin-bottom: var(--space-md);
}

.form-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xs);
}

.form-input,
.form-select {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  transition: border-color var(--duration-fast);
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-accent);
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

.goals-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-sm);
}

.goal-option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.goal-option:hover {
  border-color: var(--color-accent);
}

.goal-option.is-selected {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
}

.goal-checkbox {
  display: none;
}

.goal-icon {
  font-size: 1.2em;
}

.goal-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.range-input {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.form-range {
  flex: 1;
  height: 6px;
  background: var(--color-bg);
  border-radius: var(--radius-full);
  appearance: none;
}

.form-range::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--color-accent);
  border-radius: 50%;
  cursor: pointer;
}

.range-value {
  min-width: 2em;
  text-align: center;
  font-weight: 600;
  color: var(--color-accent);
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
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
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

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.form-message {
  margin-top: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  text-align: center;
}

.form-message.success {
  background: rgba(16, 163, 127, 0.1);
  color: var(--color-success);
}

.form-message.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .goals-grid {
    grid-template-columns: 1fr;
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
