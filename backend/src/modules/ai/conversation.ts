// TZONA V2 - Conversation Service
// Ported from V1 conversation.js
import { detectIntent } from './nlu.js';
import localResponder from './localResponder.js';
import {
    generateTrainerReply,
    generateGeneralReply,
    buildMotivationMessage,
} from './internalAssistantEngine.js';
import { callMicroservice } from '../../services/microserviceGateway.js';
import { expandSummaryForAi } from './profileSummaryService.js';
import {
    buildSystemPrompt,
    determinePersonalityMode,
    getPersonalityPrompt,
    INTENT_INSTRUCTIONS
} from './aiInstructions.js';
import { getSchemaForPrompt, getDataRequirements } from './databaseSchema.js';

const TRAINER_PREFIXES = ['тренер', 'trainer', 'coach', 'босс', 'boss'];
const TRAINER_INTENTS = new Set([
    'plan.today',
    'plan.week',
    'plan.setup',
    'report.start',
    'stats.show',
    'settings.open',
    'schedule.reschedule',
    'recovery.mode',
    'remind.later',
    'motivation',
]);

// Chat response from ai-advisor
interface ChatResponse {
    reply: string;
    metadata?: Record<string, unknown>;
}

export class ConversationService {
    async generateReply({ profile, message, history = [], mode = 'chat' }: {
        profile?: any;
        message?: string;
        history?: any[];
        mode?: string;
    }) {
        if (!message) {
            return null;
        }

        // 1. Detect Intent
        const { intent } = detectIntent(message);

        // 2. Determine Personality & specific instructions
        const personalityMode = determinePersonalityMode({
            missedWorkouts: profile?.stats?.missed || 0,
            streak: profile?.stats?.streak || 0,
            lastWorkoutDaysAgo: 1, // Mock for now, should calculate from profile
            mode: 'friendly' // default
        });

        // 3. Determine Context Level
        const contextLevel = this.determineContextLevel(intent);

        // 4. Build User Context (Dynamic)
        // Check if we have the new JSON summary, otherwise fall back to text or raw
        let userContext = '';
        if (profile?.aiSummary) {
            userContext = expandSummaryForAi(profile.aiSummary, contextLevel);
        } else if (profile?.aiSummaryText) {
            userContext = profile.aiSummaryText;
        } else {
            // Fallback to legacy context builder if no summary
            const legacyCtx = this.buildUserContext(profile);
            userContext = JSON.stringify(legacyCtx, null, 2);
        }

        // 5. Build System Prompt
        const baseSystemPrompt = buildSystemPrompt(personalityMode);
        const schemaDocs = getSchemaForPrompt();
        const intentSpecificInstr = INTENT_INSTRUCTIONS[intent] || '';

        // 6. Get Self-Learning additions (learned instructions + exemplars)
        let selfLearningPrompt = '';
        try {
            const { createSelfLearningEngine } = await import('../../services/aiSelfLearning.js');

            // Use _prisma from profile if passed, otherwise skip
            const prisma = (profile as any)?._prisma;
            if (profile?.id && prisma) {
                const learningEngine = createSelfLearningEngine(prisma, profile.id);

                // Get auto-generated learned instructions
                const learnedInstructions = await learningEngine.getInstructionsForPrompt();
                if (learnedInstructions) {
                    selfLearningPrompt += learnedInstructions;
                }

                // Get exemplar interactions for few-shot learning
                const exemplars = await learningEngine.getExemplars(intent, 2);
                if (exemplars.length > 0) {
                    selfLearningPrompt += '\n\n## ПРИМЕРЫ УСПЕШНЫХ ОТВЕТОВ (Few-shot)\n';
                    exemplars.forEach((ex, i) => {
                        selfLearningPrompt += `\n### Пример ${i + 1}:\n`;
                        selfLearningPrompt += `**Пользователь:** ${ex.userMessage.slice(0, 200)}\n`;
                        selfLearningPrompt += `**Ты (успешный ответ):** ${ex.aiResponse.slice(0, 400)}\n`;
                    });
                }

                // ADAPT-003: Get response length preference
                const lengthHint = await learningEngine.getResponseLengthHint();
                if (lengthHint) {
                    selfLearningPrompt += `\n\n## ПРЕДПОЧТЕНИЯ ПО ДЛИНЕ\n${lengthHint}`;
                }

                // ADAPT-005: Get emotional support hint
                if (message) {
                    const emotionalHint = await learningEngine.getEmotionalSupportHint(message);
                    if (emotionalHint) {
                        selfLearningPrompt += `\n\n## ЭМОЦИОНАЛЬНЫЙ КОНТЕКСТ\n${emotionalHint}`;
                    }
                }

                // ADAPT-002: Track topics for future personalization (async, don't await)
                learningEngine.trackTopicInterests(message || '', intent).catch(() => { });

                // ADAPT-004: Track activity time for pattern learning (async, don't await)
                learningEngine.trackActivityTime().catch(() => { });
            }
        } catch (err) {
            // Self-learning may not be available - that's OK
            console.debug('[ConversationService] Self-learning not available:', (err as Error).message);
        }

        const fullSystemPrompt = `
${baseSystemPrompt}

${schemaDocs}

${intentSpecificInstr ? `## СПЕЦИФИКА ЗАПРОСА (${intent}):\n${intentSpecificInstr}` : ''}

## КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
${userContext}
${selfLearningPrompt}
`;

        const trainerTone = this.shouldUseTrainerMode({ message, mode, intent });

        // For local trainer logic (scripted)
        if (trainerTone && this.canHandleLocally(intent)) {
            // Fallback to local logic for some specific intents if needed
            // But ideally we send everything to AI with the new prompt
        }

        // Call AI Microservice
        try {
            const chatResponse = await callMicroservice<ChatResponse>('aiAdvisor', {
                method: 'POST',
                path: '/api/chat',
                body: {
                    message,
                    profileId: profile?.id || null,
                    systemPrompt: fullSystemPrompt, // Pass custom prompt
                    // Legacy fields - kept for compatibility if microservice needs them
                    context: { summaryText: userContext },
                    history: history.slice(-10).map(h => ({
                        role: typeof h === 'string' ? 'user' : (h.role || 'user'),
                        content: typeof h === 'string' ? h : (h.content || h.message || String(h)),
                    })),
                },
            });

            if (chatResponse?.reply) {
                return chatResponse.reply;
            }
        } catch (error) {
            console.warn('[ConversationService] AI chat failed, using fallback:', error);
        }

        // Fallback to local responder if AI fails
        return this.buildFallbackReply({ profile, message, history, mode, trainerTone, intent });
    }

    private determineContextLevel(intent: string): 'minimal' | 'standard' | 'full' {
        if (['stats.show', 'report.start', 'progress'].includes(intent)) return 'full';
        if (['help', 'motivation', 'greeting'].includes(intent)) return 'minimal';
        return 'standard';
    }

    // Check if intent should be handled locally without AI (e.g. simple commands)
    private canHandleLocally(intent: string): boolean {
        return false; // For now, try to use AI for everything. Logic can be added here.
    }

    // Legacy method - kept for fallback scenarios
    private buildUserContext(profile: any): any {
        if (!profile) return null;
        if (profile.firstName) return { firstName: profile.firstName };
        return {};
    }

    shouldUseTrainerMode({ message, mode, intent }: { message?: string; mode?: string; intent?: string }): boolean {
        if (mode === 'command') return true;

        if (intent && TRAINER_INTENTS.has(intent)) return true;

        const normalized = (message || '').trim().toLowerCase();
        if (!normalized) return false;

        if (TRAINER_PREFIXES.some(prefix => normalized.startsWith(prefix))) return true;

        // Auto-detect intent if not provided
        if (!intent) {
            const detected = detectIntent(normalized);
            return TRAINER_INTENTS.has(detected.intent);
        }

        return false;
    }

    async buildFallbackReply({ profile, message, mode, trainerTone, history, intent }: {
        profile?: any;
        message?: string;
        mode?: string;
        trainerTone?: boolean;
        history?: any[];
        intent?: string;
    } = {}) {
        if (!message) {
            return trainerTone
                ? this.buildGenericFallback(profile)
                : this.buildGeneralFallback(null, profile);
        }

        const effectiveIntent = intent || detectIntent(message).intent;
        const treatAsTrainer = trainerTone || TRAINER_INTENTS.has(effectiveIntent);

        if (!treatAsTrainer && mode !== 'command') {
            return localResponder.buildLocalReply({ message, profile, history })
                || this.buildGeneralFallback(message, profile);
        }

        switch (effectiveIntent) {
            case 'plan.today':
            case 'plan.week':
                return this.buildPlanFallback(profile);
            case 'report.start':
                return this.buildReportFallback();
            case 'motivation':
                return buildMotivationMessage(profile);
            case 'help':
                return this.buildHelpFallback();
            case 'settings.open':
                return this.buildSettingsFallback();
            default:
                return this.buildGenericFallback(profile);
        }
    }

    buildPlanFallback(profile: any) {
        const frequency = profile?.preferences?.training_frequency || 4;
        const goal = profile?.goals?.description
            || profile?.preferences?.training_goal
            || profile?.profile?.goals?.description
            || 'поддерживать прогресс';

        return [
            'Пока не вижу актуального плана в базе.',
            `Открой раздел «Программы» в WebApp и обнови расписание — цель: ${goal}.`,
            `Текущая частота по профилю — ${frequency} раз(а) в неделю.`,
            'После синхронизации дай команду ещё раз — соберу план из реальных сессий.',
        ].join(' ');
    }

    buildReportFallback() {
        return [
            '📝 Готов принять отчёт о тренировке и обновить прогрессию.',
            '**Цель:** Зафиксировать объём, RPE и самочувствие, чтобы скорректировать план.',
            '**Разминка:** Напомни, нужна ли была адаптация перед основной частью.',
            '**Основная часть:** Перечисли упражнения с подходами и повторами, добавь ощущения.',
            '**Заминка:** Расскажи, как восстановился — были ли растяжка, дыхание, сон.',
            '**Следующий шаг:** После отчёта предложу рекомендации и обновлю план в WebApp.',
        ].join('\n');
    }

    buildGenericFallback(profile: any) {
        const frequency = profile?.preferences?.training_frequency
            || profile?.training_frequency
            || profile?.profile?.preferences?.training_frequency
            || 4;
        const goal = profile?.goals?.description
            || profile?.preferences?.training_goal
            || profile?.profile?.goals?.description
            || 'укрепить базовые движения';

        return [
            'Продолжаем держать курс на прогресс.',
            `Сейчас ориентируемся на цель: ${goal}.`,
            `Частота тренировок — ${frequency} раз(а) в неделю, можно корректировать при необходимости.`,
            'Если нужна помощь с планом, отчётом или восстановлением — просто сформулируй запрос.',
        ].join(' ');
    }

    buildGeneralFallback(message: string | null, profile: any) {
        return localResponder.buildLocalReply({ message, profile })
            || 'Я здесь, чтобы поддержать тренировки, восстановление и планирование. Подскажи, что хочешь сделать.';
    }

    buildHelpFallback() {
        return [
            '🤝 Вот чем я могу помочь прямо в чате:',
            '• Составить план на день или неделю и адаптировать его под цели.',
            '• Принять отчёт, оценить RPE и предложить следующий шаг.',
            '• Напомнить о тренировке, поделиться статистикой и мотивацией.',
            '• Открыть WebApp командой «Открой приложение».',
            'С чего начнём?',
        ].join('\n');
    }

    buildSettingsFallback() {
        return [
            '⚙️ Настройки доступны в WebApp.',
            'Там можно изменить время уведомлений, включить паузу и обновить частоту тренировок.',
            'Скажи «Открой приложение», и я отправлю кнопку для перехода.',
        ].join('\n');
    }
}

export function formatStructuredReply(text: string | null) {
    if (!text) {
        return null;
    }

    let formatted = text.replace(/\n{3,}/g, '\n\n').trim();

    if (!formatted.includes('**Цель:**')) {
        const lines = formatted.split('\n').filter(Boolean);
        const [summary, ...rest] = lines;
        const blocks = rest.length ? rest.join('\n') : null;
        return [summary, blocks].filter(Boolean).join('\n');
    }

    return formatted;
}

export default new ConversationService();

