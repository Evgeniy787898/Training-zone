/**
 * Message Handler - Text Message Processing (FULL VERSION)
 * Extracted from bot/runtime.ts as part of BOT-R03 decomposition
 *
 * Handles free-text messages for AI dialog and workout notes
 * BOT-007: Free AI dialog with context
 * BOT-008: Natural language intent detection
 */
import type { Context, NarrowedContext } from 'telegraf';
import type { Message, Update } from 'telegraf/types';
import type { DatabaseService } from '../../modules/integrations/supabase.js';
import { emoji } from '../helpers/index.js';

type TextContext = NarrowedContext<Context<Update>, Update.MessageUpdate<Message.TextMessage>>;

interface WorkoutDialogState {
    step: string;
    sessionId?: string;
    sessionName?: string;
    rpe?: number;
    notes?: string;
}

interface MessageHandlerDeps {
    db: DatabaseService;
    aiAdvisorUrl: string;
    aiApiToken?: string;
    webAppUrl?: string;
    saveWorkoutCompletion: (ctx: any, db: DatabaseService, profileId: string, dialogState: WorkoutDialogState) => Promise<void>;
}

// ============================================
// RATE LIMITING (BOT-007)
// ============================================
const AI_RATE_LIMIT = 30; // requests per hour
const aiRequestCounts = new Map<string, { count: number; resetAt: number }>();

export const checkAiRateLimit = (profileId: string): boolean => {
    const now = Date.now();
    const record = aiRequestCounts.get(profileId);

    if (!record || now > record.resetAt) {
        aiRequestCounts.set(profileId, { count: 1, resetAt: now + 3600000 });
        return true;
    }

    if (record.count >= AI_RATE_LIMIT) {
        return false;
    }

    record.count++;
    return true;
};

// ============================================
// CONVERSATION CONTEXT (BOT-007)
// ============================================
interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const conversationHistory = new Map<string, ConversationMessage[]>();
export const MAX_CONTEXT_MESSAGES = 10;

export const getConversationContext = (profileId: string): ConversationMessage[] => {
    return conversationHistory.get(profileId) || [];
};

export const addToConversation = (profileId: string, role: 'user' | 'assistant', content: string): void => {
    const history = conversationHistory.get(profileId) || [];
    history.push({ role, content, timestamp: Date.now() });

    // Keep only recent messages
    if (history.length > MAX_CONTEXT_MESSAGES) {
        history.shift();
    }

    conversationHistory.set(profileId, history);
};

export const clearConversationHistory = (profileId: string): void => {
    conversationHistory.delete(profileId);
};

// ============================================
// NATURAL LANGUAGE INTENT DETECTION (BOT-008)
// ============================================
interface Intent {
    command: string;
    label: string;
}

// Intent patterns for natural language → command mapping
const INTENT_PATTERNS: { pattern: RegExp; command: string; label: string }[] = [
    { pattern: /что\s*(у меня\s*)?(сегодня|на сегодня)/i, command: 'today', label: 'Тренировка сегодня' },
    { pattern: /(покажи|мой|мои)\s*профил/i, command: 'profile', label: 'Профиль' },
    { pattern: /(статистик|прогресс|как\s*(я\s*)?потренил)/i, command: 'stats', label: 'Статистика' },
    { pattern: /(мотива|вдохнов|давай|поехали)/i, command: 'motivate', label: 'Мотивация' },
    { pattern: /(разминк|разогре)/i, command: 'warmup', label: 'Разминка' },
    { pattern: /(заминк|остыть|cooldown)/i, command: 'cooldown', label: 'Заминка' },
    { pattern: /(растяжк|stretch)/i, command: 'stretch', label: 'Растяжка' },
    { pattern: /(совет|подскаж|помоги|tip)/i, command: 'tip', label: 'Совет' },
    { pattern: /(помощь|help|что умееш)/i, command: 'help', label: 'Помощь' },
    { pattern: /(начать|start|главн)/i, command: 'start', label: 'Главное меню' },
];

export const detectIntent = (text: string): Intent | null => {
    const normalized = text.toLowerCase().trim();
    for (const { pattern, command, label } of INTENT_PATTERNS) {
        if (pattern.test(normalized)) {
            return { command, label };
        }
    }
    return null;
};

// ============================================
// MAIN MESSAGE HANDLER (BOT-007, BOT-008)
// ============================================

export async function createMessageHandler(deps: MessageHandlerDeps) {
    return async function messageHandler(
        ctx: TextContext & { state?: Record<string, any> }
    ): Promise<void> {
        const profileId = ctx.state?.profileId;
        const dialogState = ctx.state?.dialogState as WorkoutDialogState | undefined;

        // Priority 1: Check if we're in awaiting_notes state (BOT-006 dialog)
        if (dialogState && dialogState.step === 'awaiting_notes' && dialogState.sessionId) {
            const notes = ctx.message.text.trim().substring(0, 500); // Limit notes
            dialogState.notes = notes;
            await deps.saveWorkoutCompletion(ctx, deps.db, profileId!, dialogState);
            return;
        }

        // Priority 2: Skip if it's a command
        const text = ctx.message.text.trim();
        if (text.startsWith('/')) {
            return; // Let command handlers handle it
        }

        // Priority 2.5: Natural language intent detection (BOT-008)
        const intent = detectIntent(text);
        if (intent) {
            console.log(`[bot] Intent detected: "${text}" → /${intent.command}`);
            await ctx.replyWithHTML(
                `${emoji.brain} Понял! Выполняю <b>${intent.label}</b>...`
            );
            // Emit command via URL (Telegraf workaround for programmatic command execution)
            try {
                // Simulate the command by calling the appropriate handler
                (ctx as any).message.text = `/${intent.command}`;
                // Continue to let other handlers process
            } catch (e) {
                console.error('[bot] Intent redirect error:', e);
            }
            return;
        }

        // Priority 3: Free AI dialog with context (BOT-007)
        if (!profileId) {
            await ctx.replyWithHTML(`${emoji.warning} Введи /start чтобы начать.`);
            return;
        }

        // Check rate limit
        if (!checkAiRateLimit(profileId)) {
            await ctx.replyWithHTML(
                `${emoji.clock} <b>Лимит AI-запросов исчерпан</b>\n\n` +
                `Ты использовал ${AI_RATE_LIMIT} запросов за час.\n` +
                `Попробуй позже или открой приложение!`
            );
            return;
        }

        // Check for too long question
        if (text.length > 1000) {
            await ctx.replyWithHTML(
                `${emoji.warning} Сообщение слишком длинное (${text.length}/1000 символов).\n\n` +
                `Попробуй сформулировать короче.`
            );
            return;
        }

        // Show typing indicator
        await ctx.sendChatAction('typing');

        // Get conversation context
        const context = getConversationContext(profileId);

        // Build context string for AI
        let contextPrompt = '';
        if (context.length > 0) {
            contextPrompt = 'Предыдущий контекст диалога:\n';
            for (const msg of context) {
                contextPrompt += `${msg.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${msg.content}\n`;
            }
            contextPrompt += '\nТекущий вопрос:\n';
        }

        // Add user message to history
        addToConversation(profileId, 'user', text);

        try {
            // Call AI with context
            const response = await fetch(`${deps.aiAdvisorUrl}/api/advice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${deps.aiApiToken || ''}`,
                },
                body: JSON.stringify({
                    exerciseKey: 'general',
                    currentLevel: 'intermediate',
                    performance: {},
                    goals: [],
                    personalization: {
                        profile: { id: profileId },
                        tone: 'friendly',
                        customPrompt: contextPrompt + text,
                    },
                }),
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                throw new Error(`AI error: ${response.status}`);
            }

            const data = await response.json() as { advice?: string };
            const answer = data.advice || 'Не удалось получить ответ.';

            // Add assistant response to history
            addToConversation(profileId, 'assistant', answer);

            const contextCount = getConversationContext(profileId).length;
            const contextHint = contextCount >= MAX_CONTEXT_MESSAGES
                ? `\n\n${emoji.warning} <i>Контекст заполнен (${contextCount}/${MAX_CONTEXT_MESSAGES}). Используй /reset для очистки.</i>`
                : `\n\n${emoji.sparkles} <i>Контекст: ${contextCount}/${MAX_CONTEXT_MESSAGES}</i>`;

            await ctx.replyWithHTML(
                `${emoji.brain} ${answer}${contextHint}`
            );
        } catch (error) {
            console.error('[bot] AI dialog error:', error);

            // Remove failed user message from history
            const history = conversationHistory.get(profileId) || [];
            if (history.length > 0 && history[history.length - 1].role === 'user') {
                history.pop();
                conversationHistory.set(profileId, history);
            }

            await ctx.replyWithHTML(
                `${emoji.warning} <b>AI временно недоступен</b>\n\n` +
                `Попробуй позже или используй команды:\n` +
                `/today — план на сегодня\n` +
                `/advice — получить совет`
            );
        }
    };
}

export default createMessageHandler;
