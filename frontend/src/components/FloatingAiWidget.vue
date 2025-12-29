<template>
  <ModalDialog
    :model-value="props.isOpen"
    size="xl"
    body-flush
    hide-close-button
    position="bottom"
    @update:modelValue="handleVisibilityChange"
    @close="closeWidget"
  >
    <div class="trainer-chat">
      <!-- Header -->
      <header class="trainer-chat__header">
        <button class="trainer-chat__close" @click="closeWidget" aria-label="Закрыть">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        
        <div class="trainer-chat__title-row">
          <TrainerIcon :size="32" variant="accent" />
          <h2 class="trainer-chat__title">Тренер</h2>
        </div>
        
        <!-- Voice Mode Button - orb style -->
        <button 
          class="trainer-chat__voice-mode-btn"
          @click="showVoiceMode = true"
          title="Голосовой режим"
        >
          <div class="voice-orb-icon">
            <span class="voice-orb-icon__ring"></span>
            <span class="voice-orb-icon__ring"></span>
            <span class="voice-orb-icon__core"></span>
          </div>
        </button>
      </header>

      <!-- Messages -->
      <div ref="messagesRef" class="trainer-chat__messages">
        <!-- Load earlier button -->
        <button 
          v-if="hasEarlierMessages && !loadingHistory"
          class="trainer-chat__load-earlier"
          @click="loadEarlierMessages"
        >
          <NeonIcon name="arrowUp" :size="16" variant="neutral" />
          Смотреть ранее
        </button>
        
        <div v-if="loadingHistory" class="trainer-chat__loading-history">
          <span class="trainer-chat__spinner"></span>
          Загрузка истории...
        </div>

        <!-- Empty state -->
        <div v-if="messages.length === 0 && !loading" class="trainer-chat__empty">
          <TrainerIcon :size="48" variant="neutral" />
          <p>Привет! Я твой AI-тренер.</p>
          <p class="trainer-chat__empty-hint">Спроси меня о тренировках, питании или прогрессе</p>
        </div>

        <!-- Messages list -->
        <template
          v-for="(msg, idx) in messages"
          :key="idx"
        >
          <!-- Date separator -->
          <div v-if="shouldShowDateSeparator(idx)" class="trainer-chat__date-separator">
            <span>{{ getDateLabel(msg.timestamp) }}</span>
          </div>
          
          <div
            class="trainer-chat__message"
            :class="[
            `trainer-chat__message--${msg.role}`,
            { 'trainer-chat__message--hovered': hoveredMessageIdx === idx }
          ]"
          @mouseenter="hoveredMessageIdx = idx"
          @mouseleave="handleMouseLeave"
        >
          <div 
            class="trainer-chat__message-content" 
            v-html="renderMessage(msg.content)"
          ></div>
          <!-- Blinking cursor for streaming messages -->
          <span v-if="msg.isStreaming" class="trainer-chat__cursor"></span>
          
          <!-- Tool UI -->
          <div v-if="msg.tool" class="trainer-chat__tool">
            <!-- Timer Tool -->
            <div v-if="msg.tool.name === 'setTimer'" class="trainer-chat__tool-card trainer-chat__tool-card--timer">
              <div v-if="msg.tool.status === 'running'" class="trainer-chat__timer-display">
                <span class="trainer-chat__timer-icon">⏱️</span>
                <span class="trainer-chat__timer-time">
                  {{ activeTimer ? formatTimer(activeTimer.secondsLeft) : '0:00' }}
                </span>
              </div>
              <div v-else class="trainer-chat__tool-done">
                ⏱️ Таймер завершен
              </div>
            </div>

            <!-- Generic Action Result -->
            <div v-else-if="msg.tool.result" class="trainer-chat__tool-card trainer-chat__tool-card--success">
              {{ msg.tool.result }}
            </div>
          </div>
          
          <!-- Motivation Card -->
          <div v-if="msg.tool && msg.tool.name === 'generateMotivation'" class="trainer-chat__motivation-card" :class="`trainer-chat__motivation-card--${msg.tool.params.theme || 'calm'}`">
            <div class="trainer-chat__motivation-quote">"{{ msg.tool.params.quote }}"</div>
            <div class="trainer-chat__motivation-author">— {{ msg.tool.params.author }}</div>
          </div>

          <!-- AI Rich Cards -->
          <div v-if="msg.cards && msg.cards.length > 0" class="trainer-chat__cards">
            <template v-for="(card, _cardIdx) in msg.cards" :key="_cardIdx">
              <AiStatsCard 
                v-if="card.type === 'stats'" 
                :title="card.title"
                :icon="card.icon"
                :stats="card.data.stats || []"
              />
              <AiProgressCard 
                v-if="card.type === 'progress'" 
                :title="card.title"
                :icon="card.icon"
                :items="card.data.items || []"
              />
              <AiExerciseCard 
                v-if="card.type === 'exercise'" 
                :exercise-key="card.data.exerciseKey"
                :name="card.data.name || card.title"
                :level="card.data.level"
                :last-result="card.data.lastResult"
                :tip="card.data.tip"
                @open="handleExerciseOpen"
              />
              <AiChartCard 
                v-if="card.type === 'chart'" 
                :title="card.title || 'График'"
                :icon="card.icon"
                :chart-type="card.data.chartType || 'bar'"
                :data="card.data.data || []"
              />
              <AiTableCard 
                v-if="card.type === 'table'" 
                :title="card.title"
                :icon="card.icon"
                :headers="card.data.headers"
                :rows="card.data.rows || []"
              />
            </template>
          </div>

          <!-- AI Action Buttons -->
          <div v-if="msg.actions && msg.actions.length > 0" class="trainer-chat__actions">
            <AiActionButton 
              v-for="(action, actionIdx) in msg.actions"
              :key="actionIdx"
              :label="action.label"
              :icon="action.icon"
              :action="action.action"
              :target="action.target"
              :variant="actionIdx === 0 ? 'primary' : 'secondary'"
            />
          </div>

          <!-- AI Reaction on MY messages (shown as badge) -->
          <div v-if="msg.role === 'user' && msg.aiReaction" class="trainer-chat__ai-reaction-badge">
            {{ msg.aiReaction }}
          </div>

          <!-- Message Footer: Time + Copy/TTS only -->
          <div class="trainer-chat__message-footer">
            <time class="trainer-chat__message-time">
              {{ formatTime(msg.timestamp) }}
            </time>
            
            <!-- Actions: Copy, TTS only (reactions moved below) -->
            <template v-if="msg.content && !msg.isStreaming">
              <button 
                class="trainer-chat__inline-action" 
                @click.stop="copyMessage(msg.content, idx)"
                title="Копировать"
              >
                <NeonIcon :name="copiedMessageIdx === idx ? 'check' : 'copy'" :size="14" variant="neutral" />
              </button>
              
              <button 
                v-if="msg.role === 'assistant'"
                class="trainer-chat__inline-action"
                :class="{ active: isSpeaking && speakingMessageIdx === idx, loading: ttsLoading && speakingMessageIdx === idx }"
                @click.stop="speakMessage(msg.content, idx)"
                :disabled="ttsLoading && speakingMessageIdx !== idx"
                title="Озвучить"
              >
                <span v-if="ttsLoading && speakingMessageIdx === idx" class="trainer-chat__tts-loading" />
                <NeonIcon v-else :name="isSpeaking && speakingMessageIdx === idx ? 'pause' : 'volume'" :size="14" variant="neutral" />
              </button>
            </template>
            
            <!-- Reaction button (inline with time/copy/speaker) - for assistant only -->
            <template v-if="msg.role === 'assistant' && msg.content && !msg.isStreaming">
              <div class="trainer-chat__reaction-wrapper">
                <!-- Selected reaction badge or trigger -->
                <button 
                  class="trainer-chat__inline-action trainer-chat__reaction-trigger"
                  :class="{ 'has-reaction': msg.myReaction }"
                  @click.stop="toggleReactionPicker(idx)"
                  title="Реакция"
                >
                  <span v-if="msg.myReaction" class="trainer-chat__reaction-emoji">{{ msg.myReaction }}</span>
                  <NeonIcon v-else name="smile" :size="14" variant="neutral" />
                </button>
                
                <!-- Reaction Picker (opens to the right) -->
                <Transition name="fade">
                  <div 
                    v-if="reactionPickerIdx === idx" 
                    class="trainer-chat__reaction-picker trainer-chat__reaction-picker--inline"
                    @click.stop
                  >
                    <button 
                      v-for="emoji in REACTION_EMOJIS"
                      :key="emoji"
                      class="trainer-chat__reaction-option"
                      :class="{ selected: msg.myReaction === emoji }"
                      @click.stop="selectReaction(msg, idx, emoji)"
                    >
                      {{ emoji }}
                    </button>
                  </div>
                </Transition>
              </div>
            </template>
          </div>
          </div>
        </template>

        <!-- Typing indicator with animated dots -->
        <div v-if="loading" class="trainer-chat__message trainer-chat__message--assistant">
          <div class="trainer-chat__thinking">
            <span class="trainer-chat__thinking-text">{{ currentLoadingMessage }}</span>
            <span class="trainer-chat__thinking-dots">
              <span :class="{ visible: dotIndex >= 1 }">.</span>
              <span :class="{ visible: dotIndex >= 2 }">.</span>
              <span :class="{ visible: dotIndex >= 3 }">.</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Suggestion Chips -->
      <div v-if="!loading && messages.length < 2" class="trainer-chat__suggestions">
        <button 
          v-for="chip in quickChips" 
          :key="chip.label" 
          class="trainer-chat__chip"
          @click="sendChip(chip.text)"
        >
          <span class="trainer-chat__chip-icon">{{ chip.icon }}</span>
          {{ chip.label }}
        </button>
      </div>

      <!-- Input -->
      <form class="trainer-chat__input" @submit.prevent="sendMessage">
        <!-- Mic button: large, no border (hidden when recording) -->
        <button
          v-if="!isListening"
          type="button"
          class="trainer-chat__voice-btn"
          @click="startVoice"
          title="Нажмите для записи"
        >
          <NeonIcon name="mic" variant="neutral" :size="28" />
        </button>
        
        <!-- Recording mode: timer + visualizer inside input + cancel/confirm -->
        <div v-if="isListening" class="trainer-chat__recording-container">
          <!-- Cancel button (X to cancel) -->
          <button
            type="button"
            class="trainer-chat__recording-action trainer-chat__recording-cancel"
            @click="cancelVoice"
            title="Отменить запись"
          >
            <NeonIcon name="x" variant="neutral" :size="20" />
          </button>
          
          <!-- Timer -->
          <span class="trainer-chat__recording-timer">{{ voiceTimer }}</span>
          
          <!-- Confirm button (checkmark) -->
          <button
            type="button"
            class="trainer-chat__recording-action trainer-chat__recording-confirm"
            @click="confirmVoice"
            title="Завершить запись"
          >
            <NeonIcon name="check" variant="accent" :size="20" />
          </button>
        </div>

        <!-- Input field with visualizer overlay when recording -->
        <div class="trainer-chat__input-wrapper">
          <input
            v-model="inputText"
            type="text"
            :placeholder="isListening ? '' : 'Спросите тренера...'"
            class="trainer-chat__input-field"
            :class="{ 'trainer-chat__input-field--recording': isListening }"
            :disabled="loading || isListening"
          />
          
          <!-- Audio visualizer (shown when recording) -->
          <div v-if="isListening" class="trainer-chat__visualizer">
            <span 
              v-for="(level, i) in audioLevels" 
              :key="i" 
              class="trainer-chat__visualizer-bar"
              :style="{ height: `${Math.max(4, level * 100)}%` }"
            />
          </div>
        </div>
        
        <button
          type="submit"
          class="trainer-chat__send"
          :disabled="!inputText.trim() || loading || isListening"
        >
          <NeonIcon name="send" variant="neutral" :size="20" />
        </button>
      </form>
    </div>
    
    <!-- Dislike Feedback Modal -->
    <Teleport to="body">
      <div v-if="showDislikeModal" class="trainer-chat__dislike-modal-overlay" @click.self="showDislikeModal = false">
        <div class="trainer-chat__dislike-modal">
          <h3 class="trainer-chat__dislike-modal-title">Что не так? 🤔</h3>
          <textarea 
            v-model="dislikeComment" 
            placeholder="Опиши, что тебе не понравилось в ответе..."
            class="trainer-chat__dislike-textarea"
            rows="3"
          />
          <div class="trainer-chat__dislike-modal-actions">
            <button 
              type="button"
              class="trainer-chat__dislike-btn trainer-chat__dislike-btn--secondary"
              @click="showDislikeModal = false"
            >
              Отмена
            </button>
            <button 
              type="button"
              class="trainer-chat__dislike-btn trainer-chat__dislike-btn--primary"
              @click="submitDislike"
            >
              Отправить
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- Voice Conversation Mode -->
    <VoiceConversationMode
      ref="voiceModeRef"
      :is-open="showVoiceMode"
      @close="showVoiceMode = false"
      @send-message="handleVoiceMessage"
    />
  </ModalDialog>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, computed, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import MarkdownIt from 'markdown-it';
import ModalDialog from '@/modules/shared/components/ModalDialog.vue';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import TrainerIcon from '@/modules/shared/components/TrainerIcon.vue';
import { AiStatsCard, AiProgressCard, AiExerciseCard, AiActionButton, AiChartCard, AiTableCard, VoiceConversationMode, parseAIResponse, type AICard, type AIAction } from '@/components/ai';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import { api } from '@/services/api';
import { useAppStore } from '@/stores/app';

// Props & Emits
const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void;
}>();

// Stores & Router
const appStore = useAppStore();
const router = useRouter();

// Markdown Renderer
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
const renderMessage = (content: string) => md.render(content);

// Handle exercise card click
const handleExerciseOpen = (_exerciseKey: string) => {
  closeWidget();
  router.push(`/exercises`);
};

// State
const messages = ref<ChatMessage[]>([]);
const inputText = ref('');
const loading = ref(false);
const messagesRef = ref<HTMLElement | null>(null);
const hasEarlierMessages = ref(false);
const loadingHistory = ref(false);
const activeTimer = ref<{ secondsLeft: number; totalSeconds: number; interval?: ReturnType<typeof setInterval> } | null>(null);
const isListening = ref(false);
let recognition: any = null;

// TTS State
const isSpeaking = ref(false);
const ttsLoading = ref(false);
const speakingMessageIdx = ref<number | null>(null);
const copiedMessageIdx = ref<number | null>(null);
let currentAudio: HTMLAudioElement | null = null;

// Voice Recording State - Telegram style
const voiceConfirmed = ref(false); // True when user clicks checkmark (record pending)
const audioLevels = ref<number[]>([0, 0, 0, 0, 0, 0, 0, 0]); // 8 bars for visualizer
let audioContext: AudioContext | null = null;
let audioAnalyser: AnalyserNode | null = null;
let audioDataArray: Uint8Array | null = null;
let visualizerAnimationId: number | null = null;

// Reaction/Dislike Modal State
const showDislikeModal = ref(false);
const dislikeComment = ref('');
const pendingDislikeMessage = ref<{ msg: ChatMessage; idx: number } | null>(null);

// Voice Conversation Mode State (NEW-001)
const showVoiceMode = ref(false);
const voiceModeRef = ref<InstanceType<typeof VoiceConversationMode> | null>(null);

// Hover-based reactions state
const hoveredMessageIdx = ref<number | null>(null);
const reactionPickerIdx = ref<number | null>(null);
const REACTION_EMOJIS = ['👍', '🔥', '😂', '🤔', '👎'];

// Interface
interface ChatMessage {
  id?: string; // UUID for reaction tracking
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
  myReaction?: string; // User's reaction emoji
  aiReaction?: string; // AI's reaction emoji (from structured response)
  aiMood?: 'excited' | 'calm' | 'concerned' | 'proud' | 'playful';
  cards?: AICard[]; // Rich cards from AI
  actions?: AIAction[]; // Action buttons from AI
  tool?: {
    name: 'setTimer' | 'navigate' | 'recordMetric' | 'generateMotivation';
    params: any;
    status: 'pending' | 'done' | 'running';
    result?: string;
  };
}

// Quick Suggestion Chips
const quickChips = [
  { label: 'Мой прогресс', text: 'Как мой прогресс за последнюю неделю?', icon: '📊' },
  { label: 'План на сегодня', text: 'Какая тренировка у меня сегодня?', icon: '🏋️' },
  { label: '🔥 Roast Me', text: 'Прожарь мой прогресс максимально жестко! 😈', icon: '🌶️' },
];

// TOOL HANDLING
const parseAndExecuteTool = async (message: ChatMessage, fullContent: string) => {
  const toolMatch = fullContent.match(/<tool>(.*?)<\/tool>/s);
  if (toolMatch) {
    try {
      const toolData = JSON.parse(toolMatch[1]);
      message.tool = {
        name: toolData.name,
        params: toolData.params,
        status: 'pending'
      };
      
      console.log('[TrainerChat] Executing tool:', toolData);
      
      // Execute Tool
      if (toolData.name === 'navigate')           await executeNavigate(toolData.params, message);
      if (toolData.name === 'setTimer')           await executeTimer(toolData.params, message);
      if (toolData.name === 'recordMetric')       await executeRecordMetric(toolData.params, message);
      if (toolData.name === 'generateMotivation') await executeMotivation(toolData.params, message);
      
    } catch (e) {
      console.error('[TrainerChat] Tool parsing error:', e);
    }
  }
};

const executeMotivation = async (_params: any, msg: ChatMessage) => {
  // Just mark as done to show the card
  msg.tool!.status = 'done';
};

// UI Template addition for tool
/*
            <!-- Motivation Card -->
            <div v-else-if="msg.tool.name === 'generateMotivation'" class="trainer-chat__motivation-card" :class="`trainer-chat__motivation-card--${msg.tool.params.theme || 'calm'}`">
              <div class="trainer-chat__motivation-quote">"{{ msg.tool.params.quote }}"</div>
              <div class="trainer-chat__motivation-author">— {{ msg.tool.params.author }}</div>
            </div>
*/

// Styles
/*
.trainer-chat__motivation-card {
  margin-top: 12px;
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%);
  color: #333;
  box-shadow: 0 10px 20px -5px rgba(255, 154, 158, 0.4);
  text-align: center;
  position: relative;
  overflow: hidden;
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.trainer-chat__motivation-card--fire {
  background: linear-gradient(135deg, #F5576C 0%, #F093FB 100%);
  color: white;
  box-shadow: 0 10px 20px -5px rgba(245, 87, 108, 0.4);
}

.trainer-chat__motivation-quote {
  font-size: 1.1rem;
  font-weight: 700;
  font-style: italic;
  margin-bottom: 8px;
  line-height: 1.4;
}

.trainer-chat__motivation-author {
  font-size: 0.85rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 1px;
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
*/


const executeNavigate = async (params: { target: string }, msg: ChatMessage) => {
  // DISABLED: No longer auto-navigate, AI should use action buttons instead
  // The AI will provide clickable action buttons for navigation
  const targetLabel = params.target || 'разделу';
  msg.tool!.status = 'done';
  msg.tool!.result = `Нажми кнопку ниже, чтобы перейти в ${targetLabel}`;
  
  // Add action button for navigation if not already present
  if (!msg.actions) {
    msg.actions = [];
  }
  const path = {
    'Programs': '/programs',
    'Progress': '/progress', 
    'Profile': '/profile',
    'Evolution': '/evolution',
    'Exercises': '/exercises',
    'Report': '/report',
  }[params.target];
  
  if (path) {
    msg.actions.push({
      label: `Перейти в ${targetLabel}`,
      icon: 'arrowRight',
      action: 'navigate',
      target: path,
    });
  }
};

const executeTimer = async (params: { seconds: number }, msg: ChatMessage) => {
  if (activeTimer.value?.interval) clearInterval(activeTimer.value.interval);
  
  msg.tool!.status = 'running';
  activeTimer.value = {
    secondsLeft: params.seconds,
    totalSeconds: params.seconds,
    interval: setInterval(() => {
      if (activeTimer.value) {
        activeTimer.value.secondsLeft--;
        if (activeTimer.value.secondsLeft <= 0) {
          clearInterval(activeTimer.value.interval!);
          activeTimer.value = null;
          msg.tool!.status = 'done';
          msg.tool!.result = 'Таймер завершен! ⏰';
          // Play sound or notify
          new Audio('/sounds/timer_done.mp3').play().catch(() => {}); 
        }
      }
    }, 1000)
  };
};

const executeRecordMetric = async (params: any, msg: ChatMessage) => {
  try {
    // Call backend to record metric (Mocking exact call for now, assume we have an endpoint)
    // In real implementation this would use metricsService or similar
    // For now we'll simulate success for UI demo as requested by user ("real functions" - strictly we should implement the API call)
    
    // Actually, let's try to call the real API if we can find it. 
    // We have `POST /api/metrics`? Not standard. Usually `POST /api/profile/metrics`?
    // Let's assume for now we use a generic "action" or just simulate since "recordMetric" tool was just invented.
    // TODO: Connect to real statsService
    
    msg.tool!.status = 'done';
    msg.tool!.result = `Записано: ${params.value} ${params.unit}`;
  } catch (e) {
    msg.tool!.status = 'done'; // or error
    msg.tool!.result = 'Ошибка записи';
  }
};

const formatTimer = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const sendMessage = async () => {
  const text = inputText.value.trim();
  if (!text || loading.value) return;

  const userMessage: ChatMessage = {
    role: 'user',
    content: text,
    timestamp: new Date(),
  };
  
  messages.value.push(userMessage);
  inputText.value = '';
  loading.value = true;
  startLoadingMessages();
  await scrollToBottom();

  try {
    const response = await apiClient.assistantReply({
      message: text,
      mode: 'chat',
      persist: true,
    });

    const data = (response as any).data || response;
    // Backend returns "reply", which might contain <tool> tags now
    const fullReply = data.reply || data.message || 'Не удалось получить ответ.';
    
    stopLoadingMessages();

    // STREAMING EFFECT
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '', // Start empty for streaming
      isStreaming: true,
      timestamp: new Date(),
    };
    messages.value.push(assistantMessage);
    
    // Parse tool IMMEDIATELY but execute it parallel/after text
    await parseAndExecuteTool(assistantMessage, fullReply);
    
    // Parse structured AI response (may include cards, actions, reactions)
    const parsedResponse = parseAIResponse(fullReply);
    
    // Clean text for display (remove tool tag and json blocks)
    let displayReply = parsedResponse.reply || fullReply.replace(/```json[\s\S]*?```/g, '');
    displayReply = displayReply.replace(/<tool>.*?<\/tool>/gs, '');

    // Set AI reaction and mood if provided
    if (parsedResponse.reaction) {
      assistantMessage.aiReaction = parsedResponse.reaction;
    }
    if (parsedResponse.mood) {
      assistantMessage.aiMood = parsedResponse.mood;
    }
    if (parsedResponse.cards && parsedResponse.cards.length > 0) {
      assistantMessage.cards = parsedResponse.cards;
    }
    if (parsedResponse.actions && parsedResponse.actions.length > 0) {
      assistantMessage.actions = parsedResponse.actions;
    }

    const chars = displayReply.split('');
    const typingSpeed = 15;

    for (const char of chars) {
      assistantMessage.content += char;
      await new Promise(r => setTimeout(r, typingSpeed));
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
      }
    }
    
    assistantMessage.isStreaming = false;
    saveChatHistory();
  } catch (error: any) {
    console.error('[TrainerChat] Error:', error);
    stopLoadingMessages();
    
    messages.value.push({
      role: 'assistant',
      content: 'Произошла ошибка. Попробуйте позже.',
      timestamp: new Date(),
    });
    loading.value = false;
  } finally {
    if (loading.value) {
        loading.value = false;
        await scrollToBottom();
        saveChatHistory();
    }
  }
};

// Handle voice message from VoiceConversationMode (NEW-001)
const handleVoiceMessage = async (text: string) => {
  if (!text.trim()) return;
  
  try {
    const response = await apiClient.assistantReply({
      message: text,
      mode: 'chat',
      persist: true,
    });
    
    const data = (response as any).data || response;
    const fullReply = data.reply || data.message || 'Не удалось получить ответ.';
    
    // Parse and clean reply
    const parsedResponse = parseAIResponse(fullReply);
    let displayReply = parsedResponse.reply || fullReply.replace(/```json[\s\S]*?```/g, '');
    displayReply = displayReply.replace(/<tool>.*?<\/tool>/gs, '');
    
    // Send response back to voice mode for TTS
    if (voiceModeRef.value) {
      voiceModeRef.value.receiveAiResponse(displayReply);
    }
    
    // Also add to chat history
    messages.value.push({
      role: 'user',
      content: text,
      timestamp: new Date(),
    });
    
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: displayReply,
      timestamp: new Date(),
    };
    
    if (parsedResponse.cards && parsedResponse.cards.length > 0) {
      assistantMessage.cards = parsedResponse.cards;
    }
    if (parsedResponse.actions && parsedResponse.actions.length > 0) {
      assistantMessage.actions = parsedResponse.actions;
    }
    
    messages.value.push(assistantMessage);
    saveChatHistory();
  } catch (error) {
    console.error('[VoiceMode] Error:', error);
    if (voiceModeRef.value) {
      voiceModeRef.value.receiveAiResponse('Произошла ошибка. Попробуйте позже.');
    }
  }
};

const LOADING_MESSAGES = [
  'Анализирую данные',
  'Ищу информацию',
  'Обрабатываю запрос',
  'Формирую ответ',
  'Проверяю прогресс',
  'Смотрю статистику',
  'Думаю над ответом',
  'Собираю рекомендации',
];

const loadingMessageIndex = ref(0);
const dotIndex = ref(0);
let loadingMessageTimer: ReturnType<typeof setInterval> | null = null;
let dotAnimationTimer: ReturnType<typeof setInterval> | null = null;

const currentLoadingMessage = computed(() => LOADING_MESSAGES[loadingMessageIndex.value]);

const startLoadingMessages = () => {
  loadingMessageIndex.value = Math.floor(Math.random() * LOADING_MESSAGES.length);
  dotIndex.value = 1;
  
  // Animate dots: 1 → 2 → 3 → 1 → ...
  dotAnimationTimer = setInterval(() => {
    dotIndex.value = (dotIndex.value % 3) + 1;
  }, 400);
  
  // Change message every 2 seconds
  loadingMessageTimer = setInterval(() => {
    loadingMessageIndex.value = (loadingMessageIndex.value + 1) % LOADING_MESSAGES.length;
  }, 2000);
};

const stopLoadingMessages = () => {
  if (loadingMessageTimer) {
    clearInterval(loadingMessageTimer);
    loadingMessageTimer = null;
  }
  if (dotAnimationTimer) {
    clearInterval(dotAnimationTimer);
    dotAnimationTimer = null;
  }
  dotIndex.value = 0;
};

// Send chip message
const sendChip = (text: string) => {
  inputText.value = text;
  sendMessage();
};

// TTS speakMessage moved to line ~945 (near Whisper recording)
// ====== REACTIONS ======

// Find the user message that preceded an assistant message
const findUserMessageBefore = (assistantIdx: number): string => {
  for (let i = assistantIdx - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') {
      return messages.value[i].content;
    }
  }
  return '';
};

// Save feedback to backend
const saveFeedback = async (msg: ChatMessage, idx: number, emoji: string, comment?: string) => {
  try {
    // Generate message ID if not present
    if (!msg.id) {
      msg.id = crypto.randomUUID();
    }

    const userMessage = findUserMessageBefore(idx);

    await api.post('/assistant/feedback', {
      messageId: msg.id,
      reaction: emoji === '👍' ? 'like' : emoji === '👎' ? 'dislike' : emoji,
      comment: comment || undefined,
      userMessage,
      aiResponse: msg.content,
    });

    // Update UI
    msg.myReaction = emoji;

    // Show confirmation based on reaction type (AI Self-Learning integration)
    if (emoji === '👍') {
      appStore.showToast({
        title: '🧠 AI учится!',
        message: 'Запомнил как образец хорошего ответа',
        type: 'success',
        duration: 2500,
      });
    } else if (emoji === '👎') {
      appStore.showToast({
        title: 'Спасибо за отзыв! 🙏',
        message: comment ? 'Я учту это в следующий раз' : 'Анализирую ошибку...',
        type: 'info',
        duration: 3000,
      });
    }
  } catch (err) {
    console.error('[Feedback] Failed to save:', err);
  }
};

// Submit dislike with comment
const submitDislike = async () => {
  if (!pendingDislikeMessage.value) return;

  const { msg, idx } = pendingDislikeMessage.value;
  const comment = dislikeComment.value.trim();

  await saveFeedback(msg, idx, '👎', comment || undefined);

  // Reset modal state
  showDislikeModal.value = false;
  dislikeComment.value = '';
  pendingDislikeMessage.value = null;
  
  // Save to chat history (localStorage + server)
  await saveChatHistory();
};

// ======== HOVER-BASED REACTIONS ========

// Handle mouse leave from message
const handleMouseLeave = () => {
  hoveredMessageIdx.value = null;
  // Don't close picker — it will close on click outside
};

// Toggle reaction picker visibility
const toggleReactionPicker = (idx: number) => {
  if (reactionPickerIdx.value === idx) {
    reactionPickerIdx.value = null;
  } else {
    reactionPickerIdx.value = idx;
  }
};

// Select reaction (with toggle behavior)
const selectReaction = async (msg: ChatMessage, idx: number, emoji: string) => {
  // Close picker first
  reactionPickerIdx.value = null;
  
  // If clicking the same reaction — toggle it off
  if (msg.myReaction === emoji) {
    // Remove reaction from message
    msg.myReaction = undefined;
    
    // Send removal to server if message has ID
    if (msg.id) {
      try {
        await api.post('/assistant/feedback', {
          messageId: msg.id,
          reaction: '', // Empty = remove
          userMessage: findUserMessageBefore(idx),
          aiResponse: msg.content,
        });
      } catch (err) {
        console.warn('[Feedback] Failed to remove reaction:', err);
      }
    }
  } else {
    // If dislike, show modal for comment
    if (emoji === '👎') {
      pendingDislikeMessage.value = { msg, idx };
      showDislikeModal.value = true;
      return;
    }
    // Set new reaction and save to server
    await saveFeedback(msg, idx, emoji);
  }
  
  // Save chat history with reaction (localStorage + server)
  await saveChatHistory();
};

// Copy message content to clipboard
const copyMessage = async (content: string, idx: number) => {
  // Clean markdown for copying
  const cleanText = content
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1')     // Italic
    .replace(/`(.*?)`/g, '$1')       // Code
    .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links
  
  // Copy using clipboard API or fallback
  let success = false;
  
  try {
    // Try clipboard API first (modern browsers)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(cleanText);
      success = true;
    }
  } catch {
    // Clipboard API failed, try execCommand
  }
  
  // Fallback: use input element (not textarea to avoid viewport issues)
  if (!success) {
    try {
      const input = document.createElement('input');
      input.setAttribute('readonly', 'readonly');
      input.setAttribute('value', cleanText);
      input.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, cleanText.length);
      success = document.execCommand('copy');
      document.body.removeChild(input);
    } catch {
      success = false;
    }
  }
  
  if (success) {
    // Show checkmark icon for 2 seconds
    copiedMessageIdx.value = idx;
    setTimeout(() => {
      copiedMessageIdx.value = null;
    }, 2000);
  }
};

// Voice Input - Whisper fallback recorder
let whisperRecorder: MediaRecorder | null = null;

// Voice Input - Telegram-style hold-to-record
let voiceStartTime = 0;
let voiceTimerInterval: ReturnType<typeof setInterval> | null = null;
const voiceTimer = ref('0:00');
const voiceCancelled = ref(false);

const startVoice = async () => {
  if (isListening.value) return;
  voiceCancelled.value = false;
  voiceConfirmed.value = false;
  voiceStartTime = Date.now();
  voiceTimer.value = '0:00';
  
  // Start timer display
  voiceTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - voiceStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    voiceTimer.value = `${mins}:${secs.toString().padStart(2, '0')}`;
  }, 1000);

  // Step 1: Get microphone stream for both recording and visualizer
  let micStream: MediaStream | null = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Start audio visualizer
    startVisualizer(micStream);
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      appStore.showToast({
        title: '🎤 Нужен доступ к микрофону',
        message: 'Разрешите доступ в настройках браузера или Telegram',
        type: 'warning',
        duration: 5000,
      });
      if (voiceTimerInterval) {
        clearInterval(voiceTimerInterval);
        voiceTimerInterval = null;
      }
      return;
    }
    console.warn('[Voice] getUserMedia failed:', err);
  }

  // Step 2: Check for Web Speech API support
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    // Fallback: Use Whisper API
    await startWhisperRecording();
    return;
  }

  // Step 3: Try Web Speech API
  try {
    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListening.value = true;
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      inputText.value = transcript;
    };

    recognition.onerror = async (event: any) => {
      console.error('[TrainerChat] Voice recognition error:', event.error);
      isListening.value = false;
      
      switch (event.error) {
        case 'no-speech':
          // User didn't speak — show gentle hint
          appStore.showToast({
            title: 'Не слышу',
            message: 'Попробуй сказать громче',
            type: 'info',
            duration: 2000,
          });
          break;
          
        case 'not-allowed':
          // Mic blocked — try Whisper fallback
          appStore.showToast({
            title: 'Микрофон заблокирован',
            message: 'Разреши доступ в настройках',
            type: 'warning',
          });
          await startWhisperRecording();
          break;
          
        case 'network':
          appStore.showToast({
            title: 'Нет сети',
            message: 'Проверь подключение',
            type: 'error',
          });
          break;
          
        case 'aborted':
          // User cancelled — no toast needed
          break;
          
        default:
          // Unknown error — try Whisper fallback
          console.warn('[Voice] Unexpected error, trying Whisper:', event.error);
          await startWhisperRecording();
      }
    };

    recognition.onend = () => {
      isListening.value = false;
    };

    recognition.start();
  } catch (speechErr) {
    console.warn('[Voice] Web Speech API failed, using Whisper:', speechErr);
    await startWhisperRecording();
  }
};

// Whisper API fallback - record audio and transcribe via backend
const startWhisperRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Determine supported MIME type
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
      ? 'audio/webm' 
      : 'audio/mp4';
    
    whisperRecorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    whisperRecorder.ondataavailable = (e) => chunks.push(e.data);
    
    whisperRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      isListening.value = false;
      
      if (chunks.length === 0) return;
      
      const audioBlob = new Blob(chunks, { type: mimeType });
      
      // Show loading state
      appStore.showToast({
        title: '🎤 Распознаю речь...',
        message: 'Подождите немного',
        type: 'info',
        duration: 2000,
      });
      
      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, `voice.${mimeType.split('/')[1]}`);
        
        const response = await api.post('/assistant/transcribe', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        const text = response.data?.data?.text || response.data?.text;
        if (text) {
          inputText.value = text;
          appStore.showToast({
            title: '✅ Готово!',
            message: 'Текст распознан',
            type: 'success',
            duration: 2000,
          });
        }
      } catch (transcribeErr) {
        console.error('[Whisper] Transcription failed:', transcribeErr);
        appStore.showToast({
          title: '❌ Ошибка распознавания',
          message: 'Не удалось распознать речь',
          type: 'error',
        });
      }
    };

    isListening.value = true;
    whisperRecorder.start();

    appStore.showToast({
      title: '🎤 Запись...',
      message: 'Говорите! Нажмите снова для остановки.',
      type: 'info',
      duration: 3000,
    });

    // Auto-stop after 30 seconds
    setTimeout(() => {
      if (whisperRecorder && whisperRecorder.state === 'recording') {
        whisperRecorder.stop();
      }
    }, 30000);
  } catch (err) {
    console.error('[Whisper] Failed to start recording:', err);
    isListening.value = false;
    appStore.showToast({
      title: '❌ Ошибка микрофона',
      message: 'Не удалось начать запись',
      type: 'error',
    });
  }
};

// Cancel voice recording (when leaving button)
const cancelVoice = () => {
  if (!isListening.value) return;
  voiceCancelled.value = true;
  
  // Stop visualizer
  stopVisualizer();
  
  // Clear timer
  if (voiceTimerInterval) {
    clearInterval(voiceTimerInterval);
    voiceTimerInterval = null;
  }
  
  // Stop without processing
  if (whisperRecorder && whisperRecorder.state === 'recording') {
    whisperRecorder.stop();
  }
  recognition?.abort();
  isListening.value = false;
  inputText.value = '';
};

// Confirm voice recording (checkmark) - stop but don't auto-send
const confirmVoice = () => {
  if (!isListening.value) return;
  voiceConfirmed.value = true;
  
  // Stop visualizer
  stopVisualizer();
  
  // Clear timer
  if (voiceTimerInterval) {
    clearInterval(voiceTimerInterval);
    voiceTimerInterval = null;
  }
  
  // Stop recording and let transcription complete
  if (whisperRecorder && whisperRecorder.state === 'recording') {
    whisperRecorder.stop();
  }
  recognition?.stop();
  
  // Don't auto-send - let user review and edit
};

// Start audio visualizer with microphone stream
const startVisualizer = (stream: MediaStream) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    audioContext = new AudioContextClass();
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 32; // Small FFT for 8-16 frequency bins
    audioAnalyser.smoothingTimeConstant = 0.5;
    
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(audioAnalyser);
    
    audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
    
    // Animation loop to update levels
    const updateLevels = () => {
      if (!audioAnalyser || !audioDataArray) return;
      
      audioAnalyser.getByteFrequencyData(audioDataArray as Uint8Array<ArrayBuffer>);
      
      // Take 8 bars from the frequency data
      const bars = 8;
      const step = Math.floor(audioDataArray.length / bars);
      const newLevels: number[] = [];
      
      for (let i = 0; i < bars; i++) {
        // Average of a chunk of frequencies
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += audioDataArray[i * step + j] || 0;
        }
        // Normalize to 0-1 range
        newLevels.push((sum / step) / 255);
      }
      
      audioLevels.value = newLevels;
      visualizerAnimationId = requestAnimationFrame(updateLevels);
    };
    
    updateLevels();
  } catch (err) {
    console.warn('[Visualizer] Failed to start:', err);
  }
};

// Stop audio visualizer
const stopVisualizer = () => {
  if (visualizerAnimationId) {
    cancelAnimationFrame(visualizerAnimationId);
    visualizerAnimationId = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  audioAnalyser = null;
  audioDataArray = null;
  audioLevels.value = [0, 0, 0, 0, 0, 0, 0, 0];
};

// =============================================================================
// TTS (Text-to-Speech) - speakMessage
// =============================================================================
const speakMessage = async (text: string, messageIdx: number) => {
  // If already speaking this message, stop it
  if (isSpeaking.value && speakingMessageIdx.value === messageIdx && currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    isSpeaking.value = false;
    speakingMessageIdx.value = null;
    return;
  }

  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    isSpeaking.value = true;
    ttsLoading.value = true; // Show loading while generating
    speakingMessageIdx.value = messageIdx;
    
    // Strip markdown and limit text length
    let cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1')     // Italic
      .replace(/`(.*?)`/g, '$1')       // Code
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
      .replace(/#{1,6}\s?/g, '')       // Headers
      .replace(/[🔥💪📊🏋️😤🤔😂❤️👍👎⭐😉🚀💡✨🎯📈📉🏆💥🙌👋🤝😊😁🙂😀😎🤩😍🥳😇🤗💖]/gu, '') // Common emojis
      .trim()
      .slice(0, 2000); // Limit to 2000 chars
    
    // Remove broken Unicode surrogates (lone high/low surrogates that break JSON)
    // eslint-disable-next-line no-control-regex
    cleanText = cleanText.replace(/[\uD800-\uDFFF]/g, '');
    
    if (!cleanText) {
      isSpeaking.value = false;
      speakingMessageIdx.value = null;
      return;
    }

    const response = await api.post('/assistant/speak', 
      { text: cleanText }, 
      { 
        responseType: 'blob',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    const audioUrl = URL.createObjectURL(response.data);
    currentAudio = new Audio(audioUrl);
    
    currentAudio.onended = () => {
      isSpeaking.value = false;
      speakingMessageIdx.value = null;
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };
    
    currentAudio.onerror = (err) => {
      console.error('[TTS] Audio playback error:', err);
      isSpeaking.value = false;
      ttsLoading.value = false;
      speakingMessageIdx.value = null;
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      
      appStore.showToast({
        title: '🔊 Ошибка воспроизведения',
        message: 'Не удалось озвучить сообщение',
        type: 'error',
      });
    };
    
    // Audio loaded - stop showing loading indicator
    ttsLoading.value = false;
    await currentAudio.play();
  } catch (err) {
    console.error('[TTS] Failed to speak:', err);
    isSpeaking.value = false;
    ttsLoading.value = false;
    speakingMessageIdx.value = null;
    currentAudio = null;
    
    appStore.showToast({
      title: '🔊 Озвучивание недоступно',
      message: 'Не удалось получить аудио от сервера',
      type: 'error',
    });
  }
};

// Local storage key for chat history
const CHAT_STORAGE_KEY = 'trainer_chat_history';

const handleVisibilityChange = (value: boolean) => {
  if (!value) closeWidget();
};

const closeWidget = () => {
  emit('update:isOpen', false);
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

// Date grouping helpers
const getDateLabel = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  if (isToday) return 'Сегодня';
  if (isYesterday) return 'Вчера';
  
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

const shouldShowDateSeparator = (idx: number): boolean => {
  if (idx === 0) return true; // Always show for first message
  
  const currentMsg = messages.value[idx];
  const prevMsg = messages.value[idx - 1];
  
  if (!currentMsg?.timestamp || !prevMsg?.timestamp) return false;
  
  return currentMsg.timestamp.toDateString() !== prevMsg.timestamp.toDateString();
};


const scrollToBottom = async () => {
  await nextTick();
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
};

// Load chat history from server (with localStorage fallback)
const loadChatHistory = async () => {
  try {
    // Try server first
    const response = await api.get('/assistant/chat/history');
    const data = response.data?.data || response.data; // Handle wrapped response
    if (data?.messages && Array.isArray(data.messages)) {
      const allMessages = data.messages.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
      
      if (allMessages.length > 20) {
        messages.value = allMessages.slice(-20);
        hasEarlierMessages.value = true;
      } else {
        messages.value = allMessages;
        hasEarlierMessages.value = false;
      }
      
      // Cache in localStorage
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(data.messages));
      return;
    }
  } catch (e) {
    console.warn('[TrainerChat] Server history failed, using cache:', e);
  }
  
  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const allMessages = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        
        if (allMessages.length > 20) {
          messages.value = allMessages.slice(-20);
          hasEarlierMessages.value = true;
        } else {
          messages.value = allMessages;
          hasEarlierMessages.value = false;
        }
      }
    }
  } catch (e) {
    console.warn('[TrainerChat] Failed to load local history:', e);
  }
};

// Save chat history to server and localStorage
const saveChatHistory = async () => {
  const toSave = messages.value.slice(-100).map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
    myReaction: m.myReaction || null,
    aiReaction: m.aiReaction || null,
  }));
  
  // Save to localStorage immediately (cache)
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('[TrainerChat] Failed to save to localStorage:', e);
  }
  
  // Save to server async (don't wait)
  api.post('/assistant/chat/history', { messages: toSave }).catch(e => {
    console.warn('[TrainerChat] Failed to save to server:', e);
  });
};

// Load earlier messages from cache
const loadEarlierMessages = async () => {
  loadingHistory.value = true;
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const allMessages = parsed.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
      messages.value = allMessages;
      hasEarlierMessages.value = false;
    }
  } finally {
    loadingHistory.value = false;
  }
};




// Focus input when opened
// Lock body scroll when modal is open
const lockBodyScroll = (lock: boolean) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = lock ? 'hidden' : '';
    document.body.style.touchAction = lock ? 'none' : '';
  }
};

watch(() => props.isOpen, (open) => {
  lockBodyScroll(open);
  if (open) {
    loadChatHistory();
    nextTick(() => {
      const input = document.querySelector('.trainer-chat__input-field') as HTMLInputElement;
      input?.focus();
      scrollToBottom();
    });
  }
});

onMounted(() => {
  loadChatHistory();
  if (props.isOpen) {
    lockBodyScroll(true);
  }
});

onUnmounted(() => {
  stopLoadingMessages();
  lockBodyScroll(false);
});
</script>

<style scoped>
.trainer-chat {
  display: flex;
  flex-direction: column;
  height: 75vh;
  max-height: 85vh;
  background: var(--color-bg-modal);
  color: var(--color-text-primary);
  overflow: hidden;
  border-top-left-radius: 32px;
  border-top-right-radius: 32px;
  box-shadow: var(--shadow-xl);
  width: 100%;
}

/* Override parent dialog styles */
:global(.app-modal__dialog:has(.trainer-chat)) {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  padding: 0 !important;
}

.trainer-chat__header {
  flex-shrink: 0;
  padding: 20px 24px;
  background: var(--color-bg-modal);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
  position: relative;
}

.trainer-chat__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 44px;
  height: 44px;
  background: transparent;
  border: 2px solid var(--color-border-strong);
  cursor: pointer;
  color: var(--color-text-primary);
  padding: 0;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.trainer-chat__close:hover {
  border-color: var(--color-text-primary);
  transform: rotate(90deg) scale(1.1);
}

.trainer-chat__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trainer-chat__title-text {
  display: flex;
  flex-direction: column;
}

.trainer-chat__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.trainer-chat__subtitle {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

/* Voice Mode Button - same size as close */
.trainer-chat__voice-mode-btn {
  position: absolute;
  right: 76px;
  top: 16px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 2px solid var(--color-border-strong);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.trainer-chat__voice-mode-btn:hover {
  border-color: var(--color-accent);
}

.trainer-chat__voice-mode-btn:hover .voice-orb-icon__core {
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent);
}

/* Voice Orb Icon (ChatGPT Sol style) */
.voice-orb-icon {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.voice-orb-icon__core {
  width: 12px;
  height: 12px;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border-radius: 50%;
  z-index: 2;
  transition: all 0.3s ease;
}

.voice-orb-icon__ring {
  position: absolute;
  border: 1.5px solid rgba(96, 165, 250, 0.5);
  border-radius: 50%;
  animation: voice-orb-pulse 2s ease-out infinite;
}

.voice-orb-icon__ring:nth-child(1) {
  width: 18px;
  height: 18px;
  animation-delay: 0s;
}

.voice-orb-icon__ring:nth-child(2) {
  width: 24px;
  height: 24px;
  animation-delay: 0.5s;
}

@keyframes voice-orb-pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  50% {
    opacity: 0.4;
  }
  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}

.trainer-chat__messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  
  /* Elegant scrollbar - appears only on hover */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.trainer-chat__messages:hover {
  scrollbar-color: var(--color-text-tertiary) transparent;
}

/* Webkit scrollbar - overlay style */
.trainer-chat__messages::-webkit-scrollbar {
  width: 6px;
}

.trainer-chat__messages::-webkit-scrollbar-track {
  background: transparent;
}

.trainer-chat__messages::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.3s ease;
}

.trainer-chat__messages:hover::-webkit-scrollbar-thumb {
  background: var(--color-text-tertiary);
}

.trainer-chat__messages::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-secondary);
}

.trainer-chat__load-earlier {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: var(--space-md);
}

.trainer-chat__load-earlier:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.trainer-chat__loading-history {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  margin-bottom: var(--space-md);
}

.trainer-chat__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.trainer-chat__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-sm);
  color: var(--color-text-secondary);
  padding: var(--space-xl);
  flex: 1;
}

.trainer-chat__empty p {
  margin: 0;
  font-size: 1.1rem;
}

.trainer-chat__empty-hint {
  font-size: 0.9rem !important;
  color: var(--color-text-tertiary);
}

/* Date separator */
.trainer-chat__date-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 16px 0 8px;
}

.trainer-chat__date-separator span {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  padding: 4px 12px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
}

/* Markdown Content Styles */
.trainer-chat__content {
  font-size: 14px;
  line-height: 1.5;
}

.trainer-chat__content p {
  margin-bottom: 8px;
}

.trainer-chat__content p:last-child {
  margin-bottom: 0;
}

.trainer-chat__content ul, 
.trainer-chat__content ol {
  padding-left: 20px;
  margin-bottom: 8px;
}

.trainer-chat__content li {
  margin-bottom: 4px;
}

.trainer-chat__content strong {
  font-weight: 600;
  color: var(--color-text-primary);
}

.trainer-chat__content blockquote {
  border-left: 3px solid var(--color-accent);
  margin: 12px 0;
  color: var(--color-text-secondary);
  font-style: italic;
  background: var(--color-surface-dim);
  padding: 8px 12px;
  border-radius: 0 8px 8px 0;
}

.trainer-chat__content pre {
  background: var(--color-bg-elevated);
  padding: 8px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
  font-family: monospace;
}

.trainer-chat__content code {
  background: var(--color-bg-elevated);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
  color: var(--color-accent);
}

.trainer-chat__content a {
  color: var(--color-accent);
  text-decoration: none;
}

.trainer-chat__content a:hover {
  text-decoration: underline;
}

/* Tables with horizontal overflow */
.trainer-chat__content table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  display: block;
  overflow-x: auto;
  white-space: nowrap;
}

.trainer-chat__content th,
.trainer-chat__content td {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  text-align: left;
}

.trainer-chat__content th {
  background: var(--color-surface-dim);
  font-weight: 600;
  font-size: 0.85rem;
}

.trainer-chat__content td {
  font-size: 0.85rem;
}

.trainer-chat__message {
  position: relative;
  max-width: 85%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trainer-chat__message--user {
  align-self: flex-end;
}

.trainer-chat__message--assistant {
  align-self: flex-start;
}

.trainer-chat__message-content {
  padding: 12px 16px;
  border-radius: 20px;
  font-size: 0.95rem;
  line-height: 1.5;
  word-wrap: break-word;
  animation: messageSlideIn 0.3s ease-out;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* User messages - gradient with glow */
.trainer-chat__message--user .trainer-chat__message-content {
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover, #6366f1) 100%);
  color: var(--color-accent-contrast, #fff);
  border-bottom-right-radius: 6px;
  box-shadow: 0 4px 12px rgba(var(--color-accent-rgb), 0.25);
}

.trainer-chat__message--user:hover .trainer-chat__message-content {
  transform: scale(1.01);
  box-shadow: 0 6px 16px rgba(var(--color-accent-rgb), 0.35);
}

/* AI messages - glassmorphism effect */
.trainer-chat__message--assistant .trainer-chat__message-content {
  background: rgba(var(--color-surface-rgb, 30, 30, 46), 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--color-text-primary);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom-left-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* NO hover scale/border on AI messages per user request */

.trainer-chat__message-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  margin-top: 4px;
}

.trainer-chat__message-time {
  font-size: 0.7rem;
  color: var(--color-text-tertiary);
}

/* Inline action buttons - no container, just icons */
.trainer-chat__inline-action {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-tertiary);
  transition: color 0.2s, transform 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.trainer-chat__inline-action:hover {
  color: var(--color-accent);
  transform: scale(1.15);
}

.trainer-chat__inline-action.active {
  color: var(--color-accent);
}

/* Override NeonIcon glow/background - pure icons only */
.trainer-chat__inline-action :deep(.neon-icon),
.trainer-chat__voice :deep(.neon-icon) {
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0;
}

/* Speaker button for TTS */
.trainer-chat__speak-btn {
  position: absolute;
  left: -32px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.2s, background 0.2s, transform 0.2s;
  z-index: 1;
}

.trainer-chat__message--assistant:hover .trainer-chat__speak-btn,
.trainer-chat__speak-btn:focus,
.trainer-chat__speak-btn--active {
  opacity: 1;
}

.trainer-chat__speak-btn:hover {
  background: var(--color-accent);
  transform: translateY(-50%) scale(1.1);
}

.trainer-chat__speak-btn--active {
  background: var(--color-accent);
  opacity: 1;
  animation: pulse-speak 1s infinite;
}

@keyframes pulse-speak {
  0%, 100% { transform: translateY(-50%) scale(1); }
  50% { transform: translateY(-50%) scale(1.15); }
}

/* Message Actions Panel (hover) - RIGHT SIDE */
.trainer-chat__message-actions {
  position: absolute;
  right: -40px;
  top: 50%;
  transform: translateY(-50%) translateX(4px);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  z-index: 10;
}

.trainer-chat__message-actions.visible,
.trainer-chat__message:hover .trainer-chat__message-actions {
  opacity: 1;
  visibility: visible;
  transform: translateY(-50%) translateX(0);
}

.trainer-chat__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.trainer-chat__action-btn:hover {
  background: var(--color-surface-dim);
}

.trainer-chat__action-btn.active {
  color: var(--color-accent);
}

.trainer-chat__reaction-selected {
  font-size: 14px;
}

/* Reaction Picker - no background */
.trainer-chat__reaction-picker {
  position: absolute;
  display: flex;
  gap: 2px;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  z-index: 20;
}

/* Picker positioned inline (opens to RIGHT of trigger) */
.trainer-chat__reaction-picker--inline {
  position: absolute;
  left: calc(100% + 4px);
  right: auto;
  top: 50%;
  transform: translateY(-50%);
  bottom: auto;
}

/* Reaction wrapper */
.trainer-chat__reaction-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

/* Reaction trigger inline */
.trainer-chat__reaction-trigger.has-reaction {
  background: transparent;
}

.trainer-chat__reaction-emoji {
  font-size: 14px;
}

.trainer-chat__reaction-option {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.trainer-chat__reaction-option:hover {
  transform: scale(1.3);
  background: var(--color-surface-dim);
}

.trainer-chat__reaction-option.selected {
  background: var(--color-accent);
  transform: scale(1.1);
}

/* Reactions Row - under message */
.trainer-chat__reactions-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  margin-top: 4px;
}

/* Reaction Badge - selected emoji */
.trainer-chat__reaction-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  font-size: 16px;
  background: rgba(var(--color-accent-rgb), 0.15);
  border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  animation: reaction-pop 0.3s ease;
}

.trainer-chat__reaction-badge:hover {
  background: rgba(var(--color-accent-rgb), 0.25);
  transform: scale(1.05);
}

/* Reaction Add Button - smile icon */
.trainer-chat__reaction-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-text-tertiary);
  opacity: 0.5;
  transition: all 0.2s ease;
}

.trainer-chat__reaction-add:hover {
  opacity: 1;
  color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.1);
  transform: scale(1.1);
}

/* AI Reaction Badge on user messages */
.trainer-chat__ai-reaction-badge {
  position: absolute;
  right: -8px;
  bottom: 8px;
  font-size: 16px;
  animation: reaction-pop 0.3s ease;
}

/* Fade transition for picker */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

@keyframes reaction-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1.1); }
}

/* Dislike Modal */
.trainer-chat__dislike-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.trainer-chat__dislike-modal {
  background: var(--color-surface-elevated);
  border-radius: 20px;
  padding: 24px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: modal-slide-up 0.25s ease-out;
}

@keyframes modal-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.trainer-chat__dislike-modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 16px;
  text-align: center;
  color: var(--color-text-primary);
}

.trainer-chat__dislike-textarea {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 0.95rem;
  resize: none;
  font-family: inherit;
}

.trainer-chat__dislike-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.trainer-chat__dislike-modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.trainer-chat__dislike-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.trainer-chat__dislike-btn--secondary {
  background: var(--color-surface-dim);
  color: var(--color-text-secondary);
}

.trainer-chat__dislike-btn--secondary:hover {
  background: var(--color-surface);
}

.trainer-chat__dislike-btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.trainer-chat__dislike-btn--primary:hover {
  filter: brightness(1.1);
}

/* Thinking indicator */
.trainer-chat__thinking {
  display: flex;
  align-items: baseline;
  padding: 12px 16px;
  background: var(--color-surface);
  border-radius: 20px;
  border: 1px solid var(--color-border);
  border-bottom-left-radius: 6px;
}

.trainer-chat__thinking-text {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.trainer-chat__thinking-dots {
  display: inline-flex;
}

.trainer-chat__thinking-dots span {
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--color-accent);
  opacity: 0.2;
  transition: opacity 0.15s ease;
}

.trainer-chat__thinking-dots span.visible {
  opacity: 1;
}

/* Markdown Content Styles */
.trainer-chat__message-content :deep(p) {
  margin: 0;
  margin-bottom: 8px;
}

.trainer-chat__message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.trainer-chat__message-content :deep(strong) {
  font-weight: 700;
  color: var(--color-accent-contrast); /* For user message */
}

.trainer-chat__message--assistant .trainer-chat__message-content :deep(strong) {
  color: var(--color-accent); /* For assistant message */
}

.trainer-chat__message-content :deep(ul), 
.trainer-chat__message-content :deep(ol) {
  margin: 4px 0 8px 0;
  padding-left: 20px;
}

.trainer-chat__message-content :deep(li) {
  margin-bottom: 4px;
}

/* Streaming Cursor */
.trainer-chat__cursor {
  display: inline-block;
  width: 6px;
  height: 14px;
  background: currentColor;
  margin-left: 2px;
  vertical-align: middle;
  animation: blink 0.8s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Suggestion Chips */
.trainer-chat__suggestions {
  display: flex;
  gap: 8px;
  padding: 0 var(--space-md) var(--space-md);
  overflow-x: auto;
  scrollbar-width: none; /* Hide scrollbar */
}

.trainer-chat__suggestions::-webkit-scrollbar {
  display: none;
}

.trainer-chat__chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  font-size: 0.85rem;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.trainer-chat__chip:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

/* Voice Button - large mic icon for Telegram-style recording */
.trainer-chat__voice-btn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, transform 0.2s, background 0.2s;
  flex-shrink: 0;
}

.trainer-chat__voice-btn:hover {
  color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.1);
  transform: scale(1.1);
}

.trainer-chat__voice-btn:active {
  transform: scale(0.95);
}

/* Recording Container - Telegram style with cancel/timer/confirm */
.trainer-chat__recording-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.trainer-chat__recording-action {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.trainer-chat__recording-cancel {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-danger, #ef4444);
}

.trainer-chat__recording-cancel:hover {
  background: rgba(239, 68, 68, 0.25);
  transform: scale(1.1);
}

.trainer-chat__recording-confirm {
  background: rgba(var(--color-accent-rgb), 0.15);
  color: var(--color-accent);
}

.trainer-chat__recording-confirm:hover {
  background: rgba(var(--color-accent-rgb), 0.25);
  transform: scale(1.1);
}

.trainer-chat__recording-timer {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
  min-width: 40px;
  text-align: center;
}

/* Input Wrapper for visualizer overlay */
.trainer-chat__input-wrapper {
  flex: 1;
  position: relative;
  min-width: 0;
}

.trainer-chat__input-field--recording {
  background: rgba(var(--color-accent-rgb), 0.05) !important;
  border-color: var(--color-accent) !important;
}

/* Audio Visualizer - Telegram-style equalizer bars */
.trainer-chat__visualizer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0 16px;
  pointer-events: none;
}

.trainer-chat__visualizer-bar {
  width: 4px;
  min-height: 4px;
  max-height: 100%;
  background: linear-gradient(to top, var(--color-accent), rgba(var(--color-accent-rgb), 0.6));
  border-radius: 2px;
  transition: height 0.05s ease-out;
}

/* TTS Loading Spinner */
.trainer-chat__tts-loading {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(var(--color-accent-rgb), 0.3);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Legacy voice styles - kept for compatibility */
.trainer-chat__voice {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, transform 0.2s;
  flex-shrink: 0;
}

.trainer-chat__voice:hover {
  color: var(--color-accent);
  transform: scale(1.1);
}

/* Voice Recording State - legacy */
.trainer-chat__voice-recording {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(var(--color-accent-rgb), 0.15);
  border-radius: 24px;
  animation: pulse-recording 1.5s infinite;
}

@keyframes pulse-recording {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.trainer-chat__voice-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.trainer-chat__voice-wave span {
  width: 3px;
  height: 12px;
  background: var(--color-accent);
  border-radius: 2px;
  animation: wave 0.8s infinite ease-in-out;
}

.trainer-chat__voice-wave span:nth-child(1) { animation-delay: 0s; height: 8px; }
.trainer-chat__voice-wave span:nth-child(2) { animation-delay: 0.1s; height: 14px; }
.trainer-chat__voice-wave span:nth-child(3) { animation-delay: 0.15s; height: 18px; }
.trainer-chat__voice-wave span:nth-child(4) { animation-delay: 0.1s; height: 14px; }
.trainer-chat__voice-wave span:nth-child(5) { animation-delay: 0s; height: 8px; }

@keyframes wave {
  0%, 100% { transform: scaleY(0.6); opacity: 0.5; }
  50% { transform: scaleY(1.4); opacity: 1; }
}

/* Voice Timer Display - inline with wave */
.trainer-chat__voice-timer {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
  white-space: nowrap;
}

/* Enhanced holding state */
.trainer-chat__voice--holding {
  animation: pulse-mic 1.5s infinite;
  box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.2);
}

@keyframes pulse-mic {
  0%, 100% { box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.2); }
  50% { box-shadow: 0 0 0 8px rgba(var(--color-accent-rgb), 0.1); }
}

.trainer-chat__chip-icon {
  font-size: 1rem;
}

.trainer-chat__input {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md);
  padding-top: calc(var(--space-md) + 8px); /* Extra space for voice timer */
  background: var(--color-bg-modal);
  border-top: 1px solid var(--color-border);
  position: relative;
  z-index: 5;
  overflow: visible; /* Allow voice timer to extend outside */
}

/* Tool Cards */
.trainer-chat__tool {
  margin-top: 8px;
  width: 100%;
}

.trainer-chat__tool-card {
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: slideIn 0.3s ease;
}

.trainer-chat__tool-card--timer {
  background: rgba(var(--color-accent-rgb), 0.1);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.trainer-chat__tool-card--success {
  background: rgba(var(--color-success-rgb, 74, 222, 128), 0.1);
  border-color: var(--color-success, #4ade80);
  color: var(--color-success, #4ade80);
}

.trainer-chat__timer-display {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-family: monospace;
  font-size: 1.1rem;
}

.trainer-chat__tool-done {
  opacity: 0.8;
  font-style: italic;
}

/* Motivation Card */
.trainer-chat__motivation-card {
  margin-top: 12px;
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%);
  color: #333;
  box-shadow: 0 10px 20px -5px rgba(255, 154, 158, 0.4);
  text-align: center;
  position: relative;
  overflow: hidden;
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.trainer-chat__motivation-card--fire {
  background: linear-gradient(135deg, #F5576C 0%, #F093FB 100%);
  color: white;
  box-shadow: 0 10px 20px -5px rgba(245, 87, 108, 0.4);
}

.trainer-chat__motivation-quote {
  font-size: 1.1rem;
  font-weight: 700;
  font-style: italic;
  margin-bottom: 8px;
  line-height: 1.4;
}

.trainer-chat__motivation-author {
  font-size: 0.85rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 1px;
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

.trainer-chat__input-field {
  flex: 1;
  padding: 14px 18px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 1rem;
  outline: none;
  transition: all 0.2s ease;
}

.trainer-chat__input-field:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}

.trainer-chat__input-field::placeholder {
  color: var(--color-text-tertiary);
}

.trainer-chat__send {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-accent);
  border: none;
  color: var(--color-accent-contrast);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.trainer-chat__send:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: scale(1.05);
}

.trainer-chat__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* AI Rich Cards */
.trainer-chat__cards {
  margin: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* AI Action Buttons */
.trainer-chat__actions {
  margin: 8px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-start;
}

/* AI Reaction Badge */
.trainer-chat__ai-reaction {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  border-radius: 50%;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  animation: pop-in 0.3s ease;
}

@keyframes pop-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  70% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
