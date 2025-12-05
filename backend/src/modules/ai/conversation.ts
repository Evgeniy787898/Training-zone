// TZONA V2 - Conversation Service
// Ported from V1 conversation.js
import { detectIntent } from './nlu.js';
import localResponder from './localResponder.js';
import {
    generateTrainerReply,
    generateGeneralReply,
    buildMotivationMessage,
} from './internalAssistantEngine.js';

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

        const trainerTone = this.shouldUseTrainerMode({ message, mode });

        if (trainerTone) {
            const reply = await generateTrainerReply({ profile, message, history });
            return reply || this.buildGenericFallback(profile);
        }

        const general = await generateGeneralReply({ profile, message, history });
        if (general) {
            return general;
        }

        return this.buildFallbackReply({ profile, message, history, mode, trainerTone });
    }

    shouldUseTrainerMode({ message, mode }: { message?: string; mode?: string }): boolean {
        if (mode === 'command') {
            return true;
        }

        const normalized = (message || '').trim().toLowerCase();
        if (!normalized) {
            return false;
        }

        if (TRAINER_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
            return true;
        }

        const detected = detectIntent(normalized);
        return TRAINER_INTENTS.has(detected.intent);
    }

    async buildFallbackReply({ profile, message, mode, trainerTone, history }: {
        profile?: any;
        message?: string;
        mode?: string;
        trainerTone?: boolean;
        history?: any[];
    } = {}) {
        if (!message) {
            return trainerTone
                ? this.buildGenericFallback(profile)
                : this.buildGeneralFallback(null, profile);
        }

        const { intent } = detectIntent(message);
        const treatAsTrainer = trainerTone || TRAINER_INTENTS.has(intent);

        if (!treatAsTrainer && mode !== 'command') {
            return localResponder.buildLocalReply({ message, profile, history })
                || this.buildGeneralFallback(message, profile);
        }

        switch (intent) {
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

