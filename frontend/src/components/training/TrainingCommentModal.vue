<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="comment-modal-overlay" @click.self="handleSkip">
        <div class="comment-modal" role="dialog" aria-modal="true" aria-labelledby="comment-modal-title">
          <header class="comment-modal__header">
            <h3 id="comment-modal-title" class="comment-modal__title">
              💬 Как прошла тренировка?
            </h3>
          </header>
          
          <div class="comment-modal__body">
            <!-- Quick tags -->
            <div class="comment-modal__tags">
              <button
                v-for="tag in quickTags"
                :key="tag.emoji"
                class="comment-modal__tag"
                :class="{ 'comment-modal__tag--active': selectedTags.includes(tag.emoji) }"
                @click="toggleTag(tag.emoji)"
              >
                {{ tag.emoji }} {{ tag.label }}
              </button>
            </div>
            
            <!-- Textarea -->
            <div class="comment-modal__textarea-wrapper">
              <textarea
                v-model="localComment"
                class="comment-modal__textarea"
                :placeholder="placeholder"
                :maxlength="maxLength"
                rows="4"
              ></textarea>
              <span class="comment-modal__char-count">
                {{ localComment.length }} / {{ maxLength }}
              </span>
            </div>
          </div>
          
          <footer class="comment-modal__footer">
            <button class="comment-modal__btn comment-modal__btn--secondary" @click="handleSkip">
              Пропустить
            </button>
            <button class="comment-modal__btn comment-modal__btn--primary" @click="handleSave">
              Сохранить
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { hapticLight, hapticSelection } from '@/utils/hapticFeedback';

interface Props {
  isOpen: boolean;
  currentComment?: string;
}

const props = withDefaults(defineProps<Props>(), {
  currentComment: ''
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', comment: string): void;
  (e: 'skip'): void;
}>();

const maxLength = 500;
const localComment = ref('');
const selectedTags = ref<string[]>([]);

const quickTags = [
  { emoji: '💪', label: 'Легко' },
  { emoji: '🔥', label: 'Интенсивно' },
  { emoji: '😓', label: 'Тяжело' },
  { emoji: '🎯', label: 'Точно по плану' },
  { emoji: '🚀', label: 'Перевыполнил' },
];

const placeholder = computed(() => {
  if (selectedTags.value.length > 0) {
    return 'Добавь подробности...';
  }
  return 'Заметки по тренировке...';
});

watch(() => props.isOpen, (open) => {
  if (open) {
    localComment.value = props.currentComment;
    selectedTags.value = [];
  }
});

const toggleTag = (emoji: string) => {
  const idx = selectedTags.value.indexOf(emoji);
  if (idx >= 0) {
    selectedTags.value.splice(idx, 1);
  } else {
    selectedTags.value.push(emoji);
  }
  hapticLight();
};

const getFullComment = (): string => {
  const tags = selectedTags.value.join(' ');
  if (tags && localComment.value) {
    return `${tags} ${localComment.value}`;
  }
  return tags || localComment.value;
};

const handleSave = () => {
  hapticSelection();
  emit('save', getFullComment());
  emit('close');
};

const handleSkip = () => {
  emit('skip');
  emit('close');
};
</script>

<style scoped>
.comment-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  padding: 16px;
}

.comment-modal {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.comment-modal__header {
  padding: 20px 20px 12px;
  text-align: center;
}

.comment-modal__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.comment-modal__body {
  padding: 0 20px 20px;
}

.comment-modal__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.comment-modal__tag {
  padding: 8px 12px;
  border-radius: 20px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.comment-modal__tag--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.comment-modal__tag:active {
  transform: scale(0.95);
}

.comment-modal__textarea-wrapper {
  position: relative;
}

.comment-modal__textarea {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 0.9375rem;
  font-family: inherit;
  resize: none;
  transition: border-color 0.2s;
}

.comment-modal__textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.comment-modal__textarea::placeholder {
  color: var(--color-text-muted);
}

.comment-modal__char-count {
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.comment-modal__footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

.comment-modal__btn {
  flex: 1;
  padding: 12px 16px;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.comment-modal__btn--secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.comment-modal__btn--primary {
  background: var(--color-accent);
  color: white;
}

.comment-modal__btn:active {
  transform: scale(0.98);
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-active .comment-modal,
.modal-fade-leave-active .comment-modal {
  transition: transform 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .comment-modal,
.modal-fade-leave-to .comment-modal {
  transform: scale(0.95) translateY(10px);
}
</style>
