<template>
  <div class="floating-ai-widget">
    <!-- Floating Button -->
    <button
      type="button"
      class="floating-ai-widget__button"
      :class="{ 'floating-ai-widget__button--active': isOpen }"
      @click="toggleWidget"
      :aria-expanded="isOpen"
      aria-controls="ai-chat-panel"
      aria-label="AI ассистент"
    >
      <span class="floating-ai-widget__icon">
        <NeonIcon :name="isOpen ? 'close' : 'spark'" variant="accent" :size="24" />
      </span>
      <span v-if="hasUnread" class="floating-ai-widget__badge" aria-label="Есть новые сообщения"></span>
    </button>

    <!-- Chat Panel -->
    <Transition name="slide-up">
      <div
        v-if="isOpen"
        id="ai-chat-panel"
        class="floating-ai-widget__panel"
        role="dialog"
        aria-modal="false"
        aria-label="AI ассистент"
      >
        <header class="floating-ai-widget__header">
          <div class="floating-ai-widget__title">
            <NeonIcon name="spark" variant="accent" :size="20" />
            <span>AI Ассистент</span>
          </div>
          <button
            type="button"
            class="floating-ai-widget__close"
            @click="closeWidget"
            aria-label="Закрыть"
          >
            <NeonIcon name="close" variant="neutral" :size="18" />
          </button>
        </header>

        <div ref="messagesRef" class="floating-ai-widget__messages">
          <div v-if="messages.length === 0" class="floating-ai-widget__empty">
            <NeonIcon name="spark" variant="muted" :size="32" />
            <p>Привет! Я твой AI-ассистент. Задай вопрос о тренировках, прогрессе или технике.</p>
          </div>
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="floating-ai-widget__message"
            :class="`floating-ai-widget__message--${msg.role}`"
          >
            <div class="floating-ai-widget__message-content">{{ msg.content }}</div>
          </div>
          <div v-if="loading" class="floating-ai-widget__loading">
            <span class="floating-ai-widget__typing">
              <span></span><span></span><span></span>
            </span>
          </div>
        </div>

        <form class="floating-ai-widget__input" @submit.prevent="sendMessage">
          <input
            v-model="inputText"
            type="text"
            placeholder="Введите сообщение..."
            class="input"
            :disabled="loading"
            @keydown.enter.prevent="sendMessage"
          />
          <button
            type="submit"
            class="button button--primary"
            :disabled="!inputText.trim() || loading"
          >
            <NeonIcon name="send" variant="neutral" :size="18" />
          </button>
        </form>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import { useAppStore } from '@/stores/app';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const appStore = useAppStore();

const isOpen = ref(false);
const inputText = ref('');
const loading = ref(false);
const hasUnread = ref(false);
const messages = ref<ChatMessage[]>([]);
const messagesRef = ref<HTMLElement | null>(null);

const toggleWidget = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    hasUnread.value = false;
  }
};

const closeWidget = () => {
  isOpen.value = false;
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
};

const sendMessage = async () => {
  const text = inputText.value.trim();
  if (!text || loading.value) return;

  messages.value.push({ role: 'user', content: text });
  inputText.value = '';
  loading.value = true;
  await scrollToBottom();

  try {
    const response = await apiClient.assistantReply({
      message: text,
      mode: 'chat',
      persist: true,
    });

    const reply = response.reply || response.message || 'Не удалось получить ответ.';
    messages.value.push({ role: 'assistant', content: reply });
    
    if (!isOpen.value) {
      hasUnread.value = true;
    }
  } catch (error: any) {
    console.error('[FloatingAiWidget] Error:', error);
    messages.value.push({
      role: 'assistant',
      content: 'Произошла ошибка. Попробуйте позже.',
    });
    appStore.showToast({
      title: 'Ошибка AI',
      message: error.message || 'Не удалось получить ответ',
      type: 'error',
    });
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
};

onMounted(() => {
  // Could load conversation history here if needed
});
</script>

<style scoped>
.floating-ai-widget {
  position: fixed;
  bottom: calc(var(--safe-area-bottom, 0px) + 80px);
  right: var(--space-md);
  z-index: var(--z-floating);
}

.floating-ai-widget__button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-accent);
  border: none;
  box-shadow: 0 4px 16px var(--color-accent-shadow, rgba(0, 0, 0, 0.3));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
}

.floating-ai-widget__button:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px var(--color-accent-shadow, rgba(0, 0, 0, 0.4));
}

.floating-ai-widget__button--active {
  background: var(--color-bg-tertiary);
}

.floating-ai-widget__icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-ai-widget__badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-danger);
  border: 2px solid var(--color-bg-primary);
}

.floating-ai-widget__panel {
  position: absolute;
  bottom: 70px;
  right: 0;
  width: 320px;
  max-width: calc(100vw - var(--space-lg) * 2);
  max-height: 450px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.floating-ai-widget__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.floating-ai-widget__title {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: 600;
}

.floating-ai-widget__close {
  background: none;
  border: none;
  padding: var(--space-2xs);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 0.15s ease;
}

.floating-ai-widget__close:hover {
  background: var(--color-bg-tertiary);
}

.floating-ai-widget__messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 200px;
}

.floating-ai-widget__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-sm);
  color: var(--color-text-secondary);
  padding: var(--space-lg);
  flex: 1;
}

.floating-ai-widget__empty p {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.floating-ai-widget__message {
  max-width: 85%;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.floating-ai-widget__message--user {
  align-self: flex-end;
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

.floating-ai-widget__message--assistant {
  align-self: flex-start;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.floating-ai-widget__loading {
  align-self: flex-start;
  padding: var(--space-xs) var(--space-sm);
}

.floating-ai-widget__typing {
  display: flex;
  gap: 4px;
}

.floating-ai-widget__typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-secondary);
  animation: typing 1.4s infinite ease-in-out both;
}

.floating-ai-widget__typing span:nth-child(1) { animation-delay: 0s; }
.floating-ai-widget__typing span:nth-child(2) { animation-delay: 0.2s; }
.floating-ai-widget__typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.floating-ai-widget__input {
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.floating-ai-widget__input .input {
  flex: 1;
}

.floating-ai-widget__input .button {
  padding: var(--space-xs) var(--space-sm);
}

/* Slide up animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

@media (max-width: 400px) {
  .floating-ai-widget__panel {
    width: calc(100vw - var(--space-md) * 2);
    right: calc(-1 * var(--space-md) + 28px);
  }
}
</style>
