<script setup lang="ts">
/**
 * AI Personal Instructions Editor (PERS-INS-002)
 * Allows users to customize AI trainer behavior and preferences
 */
import { ref, computed, onMounted } from 'vue';
import { apiClient } from '@/services/api';
import NeonIcon from '@/components/NeonIcon.vue';

// Instruction types matching backend schema
type InstructionType = 'name' | 'address' | 'injury' | 'preference' | 'prohibition' | 'style' | 'note';

interface PersonalInstruction {
  id: string;
  type: InstructionType;
  value: string;
  priority?: number;
}

interface InstructionTypeConfig {
  type: InstructionType;
  label: string;
  placeholder: string;
  icon: string;
  maxLength: number;
  description: string;
  examples: string[];
}

// Configuration for each instruction type
const INSTRUCTION_TYPES: InstructionTypeConfig[] = [
  {
    type: 'name',
    label: 'Как обращаться',
    placeholder: 'Алексей, Лёша, Саша...',
    icon: 'user',
    maxLength: 50,
    description: 'AI будет обращаться к тебе по этому имени',
    examples: ['Алексей', 'Лёша', 'Чемпион'],
  },
  {
    type: 'address',
    label: 'Стиль обращения',
    placeholder: 'На ты / На вы',
    icon: 'message-circle',
    maxLength: 50,
    description: 'Как AI должен к тебе обращаться',
    examples: ['На ты', 'На вы', 'Неформально'],
  },
  {
    type: 'injury',
    label: 'Травмы и ограничения',
    placeholder: 'Травма колена, проблемы со спиной...',
    icon: 'alert-triangle',
    maxLength: 200,
    description: 'AI НЕ будет рекомендовать упражнения, опасные для этих зон',
    examples: ['Травма левого колена', 'Грыжа поясничного отдела', 'Слабые запястья'],
  },
  {
    type: 'preference',
    label: 'Предпочтения',
    placeholder: 'Люблю силовые, не люблю кардио...',
    icon: 'heart',
    maxLength: 200,
    description: 'Твои предпочтения в тренировках',
    examples: ['Предпочитаю утренние тренировки', 'Люблю HIIT', 'Тренируюсь дома'],
  },
  {
    type: 'prohibition',
    label: 'Не рекомендовать',
    placeholder: 'Бег, прыжки...',
    icon: 'x-circle',
    maxLength: 200,
    description: 'Упражнения или активности, которые AI не должен предлагать',
    examples: ['Бег', 'Прыжки', 'Становая тяга'],
  },
  {
    type: 'style',
    label: 'Стиль общения',
    placeholder: 'Строгий, мотивирующий, мягкий...',
    icon: 'smile',
    maxLength: 200,
    description: 'Как AI должен общаться с тобой',
    examples: ['Строгий тренер', 'Мягко и поддерживающе', 'С юмором'],
  },
  {
    type: 'note',
    label: 'Дополнительные заметки',
    placeholder: 'Любая дополнительная информация...',
    icon: 'file-text',
    maxLength: 500,
    description: 'Другая информация, которую AI должен учитывать',
    examples: ['Вегетарианец', 'Работаю по ночам', 'Готовлюсь к марафону'],
  },
];

// State
const instructions = ref<PersonalInstruction[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const activeTypeIndex = ref<number | null>(null);
const editingId = ref<string | null>(null);
const newValue = ref('');

// Computed
const instructionsByType = computed(() => {
  const map: Record<InstructionType, PersonalInstruction[]> = {
    name: [],
    address: [],
    injury: [],
    preference: [],
    prohibition: [],
    style: [],
    note: [],
  };
  
  for (const inst of instructions.value) {
    if (map[inst.type]) {
      map[inst.type].push(inst);
    }
  }
  
  return map;
});

const totalInstructions = computed(() => instructions.value.length);
const canAddMore = computed(() => totalInstructions.value < 20);

// Generate unique ID
function generateId(): string {
  return `inst_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Load instructions from API
async function loadInstructions() {
  isLoading.value = true;
  error.value = null;
  
  try {
    const response = await apiClient.getAiInstructions();
    
    if (response?.instructions && Array.isArray(response.instructions)) {
      instructions.value = response.instructions.map((item: any) => ({
        id: item.id || generateId(),
        type: item.type,
        value: item.value,
        priority: item.priority,
      }));
    }
  } catch (err) {
    error.value = 'Не удалось загрузить настройки';
    console.error('Failed to load instructions:', err);
  } finally {
    isLoading.value = false;
  }
}

// Save instructions via API
async function saveInstructions() {
  isSaving.value = true;
  error.value = null;
  successMessage.value = null;
  
  try {
    const payload = instructions.value.map(inst => ({
      type: inst.type as any,
      value: inst.value,
      priority: inst.priority,
    }));
    
    await apiClient.updateAiInstructions(payload);
    
    successMessage.value = 'Настройки сохранены';
    setTimeout(() => {
      successMessage.value = null;
    }, 3000);
  } catch (err) {
    error.value = 'Не удалось сохранить настройки';
    console.error('Failed to save instructions:', err);
  } finally {
    isSaving.value = false;
  }
}

// Add new instruction
function addInstruction(type: InstructionType, value: string) {
  if (!value.trim() || !canAddMore.value) return;
  
  instructions.value.push({
    id: generateId(),
    type,
    value: value.trim(),
  });
  
  newValue.value = '';
  saveInstructions();
}

// Remove instruction
function removeInstruction(id: string) {
  const index = instructions.value.findIndex(i => i.id === id);
  if (index !== -1) {
    instructions.value.splice(index, 1);
    saveInstructions();
  }
}

// Start editing
function startEdit(instruction: PersonalInstruction) {
  editingId.value = instruction.id;
  newValue.value = instruction.value;
}

// Save edit
function saveEdit(id: string) {
  const instruction = instructions.value.find(i => i.id === id);
  if (instruction && newValue.value.trim()) {
    instruction.value = newValue.value.trim();
    saveInstructions();
  }
  editingId.value = null;
  newValue.value = '';
}

// Cancel edit
function cancelEdit() {
  editingId.value = null;
  newValue.value = '';
}

// Toggle type section
function toggleType(index: number) {
  activeTypeIndex.value = activeTypeIndex.value === index ? null : index;
  newValue.value = '';
}

// Lifecycle
onMounted(() => {
  loadInstructions();
});
</script>

<template>
  <div class="ai-instructions">
    <!-- Header -->
    <div class="ai-instructions__header">
      <div class="ai-instructions__title">
        <NeonIcon name="settings" class="ai-instructions__title-icon" />
        <span>Настройки AI-тренера</span>
      </div>
      <p class="ai-instructions__subtitle">
        Персонализируй поведение AI под себя
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="ai-instructions__loading">
      <div class="ai-instructions__spinner"></div>
      <span>Загрузка настроек...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="ai-instructions__error">
      <NeonIcon name="alert-circle" />
      <span>{{ error }}</span>
      <button @click="loadInstructions" class="ai-instructions__retry-btn">
        Повторить
      </button>
    </div>

    <!-- Main Content -->
    <div v-else class="ai-instructions__content">
      <!-- Success Message -->
      <transition name="fade">
        <div v-if="successMessage" class="ai-instructions__success">
          <NeonIcon name="check-circle" />
          <span>{{ successMessage }}</span>
        </div>
      </transition>

      <!-- Stats -->
      <div class="ai-instructions__stats">
        <span class="ai-instructions__stats-count">
          {{ totalInstructions }}/20 инструкций
        </span>
        <div 
          class="ai-instructions__stats-bar"
          :style="{ '--progress': `${(totalInstructions / 20) * 100}%` }"
        ></div>
      </div>

      <!-- Instruction Types -->
      <div class="ai-instructions__types">
        <div 
          v-for="(typeConfig, index) in INSTRUCTION_TYPES" 
          :key="typeConfig.type"
          class="ai-instructions__type"
          :class="{ 'ai-instructions__type--active': activeTypeIndex === index }"
        >
          <!-- Type Header -->
          <button 
            class="ai-instructions__type-header"
            @click="toggleType(index)"
          >
            <div class="ai-instructions__type-info">
              <NeonIcon :name="typeConfig.icon" class="ai-instructions__type-icon" />
              <div class="ai-instructions__type-text">
                <span class="ai-instructions__type-label">{{ typeConfig.label }}</span>
                <span class="ai-instructions__type-count">
                  {{ instructionsByType[typeConfig.type]?.length || 0 }}
                </span>
              </div>
            </div>
            <NeonIcon 
              :name="activeTypeIndex === index ? 'chevron-up' : 'chevron-down'" 
              class="ai-instructions__type-arrow"
            />
          </button>

          <!-- Type Content (Expanded) -->
          <transition name="slide">
            <div v-if="activeTypeIndex === index" class="ai-instructions__type-content">
              <!-- Description -->
              <p class="ai-instructions__type-desc">
                {{ typeConfig.description }}
              </p>

              <!-- Existing Instructions -->
              <div 
                v-for="instruction in instructionsByType[typeConfig.type]"
                :key="instruction.id"
                class="ai-instructions__item"
              >
                <!-- View Mode -->
                <template v-if="editingId !== instruction.id">
                  <span class="ai-instructions__item-value">{{ instruction.value }}</span>
                  <div class="ai-instructions__item-actions">
                    <button 
                      @click="startEdit(instruction)"
                      class="ai-instructions__item-btn ai-instructions__item-btn--edit"
                      title="Редактировать"
                    >
                      <NeonIcon name="edit-2" />
                    </button>
                    <button 
                      @click="removeInstruction(instruction.id)"
                      class="ai-instructions__item-btn ai-instructions__item-btn--delete"
                      title="Удалить"
                    >
                      <NeonIcon name="trash-2" />
                    </button>
                  </div>
                </template>

                <!-- Edit Mode -->
                <template v-else>
                  <input 
                    v-model="newValue"
                    class="ai-instructions__input"
                    :maxlength="typeConfig.maxLength"
                    @keyup.enter="saveEdit(instruction.id)"
                    @keyup.escape="cancelEdit"
                  />
                  <div class="ai-instructions__item-actions">
                    <button 
                      @click="saveEdit(instruction.id)"
                      class="ai-instructions__item-btn ai-instructions__item-btn--save"
                      title="Сохранить"
                    >
                      <NeonIcon name="check" />
                    </button>
                    <button 
                      @click="cancelEdit"
                      class="ai-instructions__item-btn ai-instructions__item-btn--cancel"
                      title="Отмена"
                    >
                      <NeonIcon name="x" />
                    </button>
                  </div>
                </template>
              </div>

              <!-- Add New -->
              <div v-if="canAddMore" class="ai-instructions__add">
                <input 
                  v-if="editingId === null"
                  v-model="newValue"
                  class="ai-instructions__input"
                  :placeholder="typeConfig.placeholder"
                  :maxlength="typeConfig.maxLength"
                  @keyup.enter="addInstruction(typeConfig.type, newValue)"
                />
                <button 
                  v-if="editingId === null && newValue.trim()"
                  @click="addInstruction(typeConfig.type, newValue)"
                  class="ai-instructions__add-btn"
                  :disabled="isSaving"
                >
                  <NeonIcon name="plus" />
                  Добавить
                </button>
              </div>

              <!-- Examples -->
              <div class="ai-instructions__examples">
                <span class="ai-instructions__examples-label">Примеры:</span>
                <div class="ai-instructions__examples-list">
                  <button 
                    v-for="example in typeConfig.examples" 
                    :key="example"
                    class="ai-instructions__example-chip"
                    @click="newValue = example"
                  >
                    {{ example }}
                  </button>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- Quick Tips -->
      <div class="ai-instructions__tips">
        <div class="ai-instructions__tips-header">
          <NeonIcon name="lightbulb" />
          <span>Советы</span>
        </div>
        <ul class="ai-instructions__tips-list">
          <li>Указывай травмы — AI не будет предлагать опасные упражнения</li>
          <li>Выбери стиль общения: строгий тренер или мягкая поддержка</li>
          <li>Добавь предпочтения для более релевантных рекомендаций</li>
        </ul>
      </div>
    </div>

    <!-- Saving Indicator -->
    <transition name="fade">
      <div v-if="isSaving" class="ai-instructions__saving">
        <div class="ai-instructions__saving-spinner"></div>
        <span>Сохранение...</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.ai-instructions {
  padding: var(--spacing-lg);
  max-width: 600px;
  margin: 0 auto;
}

.ai-instructions__header {
  margin-bottom: var(--spacing-xl);
  text-align: center;
}

.ai-instructions__title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
}

.ai-instructions__title-icon {
  color: var(--color-accent);
}

.ai-instructions__subtitle {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

/* Loading & Error States */
.ai-instructions__loading,
.ai-instructions__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

.ai-instructions__spinner,
.ai-instructions__saving-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ai-instructions__error {
  color: var(--color-error);
}

.ai-instructions__retry-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

/* Success Message */
.ai-instructions__success {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-success-bg, rgba(34, 197, 94, 0.1));
  color: var(--color-success, #22c55e);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
}

/* Stats */
.ai-instructions__stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.ai-instructions__stats-count {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.ai-instructions__stats-bar {
  flex: 1;
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}

.ai-instructions__stats-bar::after {
  content: '';
  display: block;
  width: var(--progress, 0%);
  height: 100%;
  background: var(--color-accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* Type Sections */
.ai-instructions__types {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.ai-instructions__type {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: border-color 0.2s;
}

.ai-instructions__type--active {
  border-color: var(--color-accent);
}

.ai-instructions__type-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--spacing-md);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text);
}

.ai-instructions__type-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.ai-instructions__type-icon {
  width: 20px;
  height: 20px;
  color: var(--color-accent);
}

.ai-instructions__type-text {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.ai-instructions__type-label {
  font-weight: 500;
}

.ai-instructions__type-count {
  font-size: 0.75rem;
  padding: 2px 8px;
  background: var(--color-accent);
  color: white;
  border-radius: 10px;
}

.ai-instructions__type-count:empty {
  display: none;
}

.ai-instructions__type-arrow {
  width: 18px;
  height: 18px;
  color: var(--color-text-secondary);
  transition: transform 0.2s;
}

/* Type Content */
.ai-instructions__type-content {
  padding: 0 var(--spacing-md) var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.ai-instructions__type-desc {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: var(--spacing-sm) 0 var(--spacing-md);
}

/* Instruction Items */
.ai-instructions__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
}

.ai-instructions__item-value {
  flex: 1;
  color: var(--color-text);
}

.ai-instructions__item-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.ai-instructions__item-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.ai-instructions__item-btn:hover {
  background: var(--color-surface);
}

.ai-instructions__item-btn--edit:hover {
  color: var(--color-accent);
}

.ai-instructions__item-btn--delete:hover {
  color: var(--color-error);
}

.ai-instructions__item-btn--save {
  color: var(--color-success, #22c55e);
}

.ai-instructions__item-btn--cancel {
  color: var(--color-error);
}

/* Input */
.ai-instructions__input {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.ai-instructions__input:focus {
  border-color: var(--color-accent);
}

.ai-instructions__input::placeholder {
  color: var(--color-text-secondary);
}

/* Add Button */
.ai-instructions__add {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.ai-instructions__add-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.ai-instructions__add-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Examples */
.ai-instructions__examples {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px dashed var(--color-border);
}

.ai-instructions__examples-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  display: block;
  margin-bottom: var(--spacing-xs);
}

.ai-instructions__examples-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.ai-instructions__example-chip {
  padding: 4px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.ai-instructions__example-chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* Tips */
.ai-instructions__tips {
  margin-top: var(--spacing-xl);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border-left: 3px solid var(--color-accent);
}

.ai-instructions__tips-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-weight: 500;
  color: var(--color-accent);
  margin-bottom: var(--spacing-sm);
}

.ai-instructions__tips-list {
  margin: 0;
  padding-left: var(--spacing-lg);
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.ai-instructions__tips-list li {
  margin-bottom: var(--spacing-xs);
}

/* Saving Indicator */
.ai-instructions__saving {
  position: fixed;
  bottom: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  color: var(--color-text);
  z-index: 1000;
}

.ai-instructions__saving-spinner {
  width: 18px;
  height: 18px;
  border-width: 2px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-enter-to,
.slide-leave-from {
  max-height: 500px;
}
</style>
