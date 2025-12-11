/**
 * Callback Query Handlers - Navigation and Menu Actions
 * Extracted from bot/runtime.ts as part of BOT-R03 decomposition
 *
 * Handles inline button callbacks for section navigation
 */
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import type { DatabaseService } from '../../modules/integrations/supabase.js';
import {
    emoji,
    decor,
    setSession,
    getSession,
    mainKeyboard,
} from '../helpers/index.js';

type CallbackContext = Context & {
    state?: Record<string, any>;
};

interface CallbackHandlerDeps {
    db: DatabaseService;
}

// ============================================
// MENU KEYBOARDS
// ============================================

const backToMenuRow = Markup.button.callback(`🏠 Меню`, 'go_home');

const compactMainMenu = Markup.inlineKeyboard([
    [
        Markup.button.callback(`${emoji.calendar} Сегодня`, 'sec_training'),
        Markup.button.callback(`${emoji.brain} AI`, 'sec_ai'),
    ],
    [
        Markup.button.callback(`${emoji.target} Игры`, 'sec_games'),
        Markup.button.callback(`${emoji.heart} Wellness`, 'sec_wellness'),
    ],
]);

const trainingMenu = Markup.inlineKeyboard([
    [
        Markup.button.callback(`📋 Программа`, 'cmd_today'),
        Markup.button.callback(`✅ Выполнено`, 'cmd_done'),
    ],
    [
        Markup.button.callback(`⏱️ Таймер`, 'cmd_timer'),
        Markup.button.callback(`🔥 Разминка`, 'cmd_warmup'),
    ],
    [backToMenuRow],
]);

const gamesMenu = Markup.inlineKeyboard([
    [
        Markup.button.callback(`🎯 Челлендж`, 'cmd_challenge'),
        Markup.button.callback(`⚡ Реакция`, 'cmd_reaction'),
    ],
    [Markup.button.callback(`🏆 Достижения`, 'cmd_achievements')],
    [backToMenuRow],
]);

const wellnessMenu = Markup.inlineKeyboard([
    [
        Markup.button.callback(`🧘 Растяжка`, 'cmd_stretch'),
        Markup.button.callback(`🌬️ Дыхание`, 'cmd_breathe'),
    ],
    [
        Markup.button.callback(`💧 Вода`, 'cmd_water'),
        Markup.button.callback(`😴 Отдых`, 'cmd_rest'),
    ],
    [backToMenuRow],
]);

const profileMenu = Markup.inlineKeyboard([
    [
        Markup.button.callback(`📊 Экспорт`, 'cmd_export'),
        Markup.button.callback(`🏆 Рейтинг`, 'cmd_leaderboard'),
    ],
    [Markup.button.callback(`📜 История`, 'cmd_history')],
    [backToMenuRow],
]);

// ============================================
// MESSAGE MANAGEMENT
// ============================================

const messageBuffer = new Map<string, number[]>();

export const trackMessage = (profileId: string, messageId: number): void => {
    const existing = messageBuffer.get(profileId) || [];
    existing.push(messageId);
    messageBuffer.set(profileId, existing.slice(-20)); // Keep last 20
};

export const clearSection = async (ctx: any, profileId: string, section: string): Promise<void> => {
    const session = getSession(profileId);
    if (session?.currentSection === section) {
        const messages = messageBuffer.get(profileId) || [];
        for (const msgId of messages.slice(-5)) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, msgId);
            } catch { /* ignore */ }
        }
    }
};

export const clearAllMessages = async (ctx: any, profileId: string): Promise<void> => {
    const messages = messageBuffer.get(profileId) || [];
    for (const msgId of messages) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, msgId);
        } catch { /* ignore */ }
    }
    messageBuffer.set(profileId, []);
};

// ============================================
// NAVIGATION HANDLERS
// ============================================

export const createNavigationHandlers = (deps: CallbackHandlerDeps) => ({
    // Go home - clears ALL and shows main menu
    goHome: async (ctx: CallbackContext) => {
        const profileId = ctx.state?.profileId;
        await ctx.answerCbQuery(`🏠`);

        if (profileId) {
            await clearAllMessages(ctx, profileId);
        }

        const text = `${emoji.crown} <b>TZONA</b>\n` +
            `${decor.divider}\n\n` +
            `Выбери раздел:`;

        const msg = await ctx.replyWithHTML(text, {
            ...mainKeyboard,
            ...compactMainMenu,
        });

        if (profileId) {
            trackMessage(profileId, msg.message_id);
            setSession(profileId, { currentSection: 'main' });
        }
    },

    // Training section
    secTraining: async (ctx: CallbackContext) => {
        const profileId = ctx.state?.profileId;
        await ctx.answerCbQuery(`📅`);

        try {
            await ctx.editMessageText(
                `${emoji.calendar} <b>ТРЕНИРОВКИ</b>\n${decor.divider}`,
                { parse_mode: 'HTML', ...trainingMenu }
            );
        } catch {
            const msg = await ctx.replyWithHTML(
                `${emoji.calendar} <b>ТРЕНИРОВКИ</b>\n${decor.divider}`,
                trainingMenu
            );
            if (profileId) {
                await clearSection(ctx, profileId, 'training');
                trackMessage(profileId, msg.message_id);
            }
        }

        if (profileId) {
            setSession(profileId, { currentSection: 'training' });
        }
    },

    // Games section
    secGames: async (ctx: CallbackContext) => {
        const profileId = ctx.state?.profileId;
        await ctx.answerCbQuery(`🎯`);

        try {
            await ctx.editMessageText(
                `${emoji.target} <b>ИГРЫ</b>\n${decor.divider}`,
                { parse_mode: 'HTML', ...gamesMenu }
            );
        } catch {
            const msg = await ctx.replyWithHTML(
                `${emoji.target} <b>ИГРЫ</b>\n${decor.divider}`,
                gamesMenu
            );
            if (profileId) {
                await clearSection(ctx, profileId, 'games');
                trackMessage(profileId, msg.message_id);
            }
        }

        if (profileId) {
            setSession(profileId, { currentSection: 'games' });
        }
    },

    // Wellness section
    secWellness: async (ctx: CallbackContext) => {
        const profileId = ctx.state?.profileId;
        await ctx.answerCbQuery(`❤️`);

        try {
            await ctx.editMessageText(
                `${emoji.heart} <b>WELLNESS</b>\n${decor.divider}`,
                { parse_mode: 'HTML', ...wellnessMenu }
            );
        } catch {
            const msg = await ctx.replyWithHTML(
                `${emoji.heart} <b>WELLNESS</b>\n${decor.divider}`,
                wellnessMenu
            );
            if (profileId) {
                await clearSection(ctx, profileId, 'wellness');
                trackMessage(profileId, msg.message_id);
            }
        }

        if (profileId) {
            setSession(profileId, { currentSection: 'wellness' });
        }
    },

    // AI Chat section
    secAi: async (ctx: CallbackContext) => {
        const profileId = ctx.state?.profileId;
        await ctx.answerCbQuery(`🧠`);

        try {
            await ctx.editMessageText(
                `${emoji.brain} <b>AI-КОУЧ</b>\n${decor.divider}\n\n` +
                `Напиши вопрос:`,
                { parse_mode: 'HTML', ...Markup.inlineKeyboard([[backToMenuRow]]) }
            );
        } catch {
            const msg = await ctx.replyWithHTML(
                `${emoji.brain} <b>AI-коуч готов!</b>\n\nНапиши вопрос.`,
                Markup.inlineKeyboard([[backToMenuRow]])
            );
            if (profileId) {
                trackMessage(profileId, msg.message_id);
            }
        }

        if (profileId) {
            setSession(profileId, { currentSection: 'ai_chat', persistChat: true });
        }
    },

    // Profile section
    secProfile: async (ctx: CallbackContext) => {
        const profileId = ctx.state?.profileId;
        await ctx.answerCbQuery(`👤`);

        try {
            await ctx.editMessageText(
                `${emoji.crown} <b>ПРОФИЛЬ</b>\n${decor.divider}`,
                { parse_mode: 'HTML', ...profileMenu }
            );
        } catch {
            const msg = await ctx.replyWithHTML(
                `${emoji.crown} <b>ПРОФИЛЬ</b>\n${decor.divider}`,
                profileMenu
            );
            if (profileId) {
                await clearSection(ctx, profileId, 'profile');
                trackMessage(profileId, msg.message_id);
            }
        }

        if (profileId) {
            setSession(profileId, { currentSection: 'profile' });
        }
    },
});

// ============================================
// EXPORT MENUS FOR USE IN COMMANDS
// ============================================
export {
    backToMenuRow,
    compactMainMenu,
    trainingMenu,
    gamesMenu,
    wellnessMenu,
    profileMenu,
};

export default createNavigationHandlers;
