/**
 * /start Command Handler
 * Extracted from bot/runtime.ts as part of BOT-R02 decomposition
 *
 * Premium Design v7.0 - Welcome with animation
 */
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import type { DatabaseService } from '../../modules/integrations/supabase.js';
import {
    emoji,
    decor,
    spoiler,
    createProgressBar,
    setMessageReaction,
    setSession,
    mainKeyboard,
} from '../helpers/index.js';

// Using intersection type as state is set by middleware
type StartCommandContext = Context & {
    state?: Record<string, any>;
};

interface StartCommandDeps {
    db: DatabaseService;
    webAppUrl?: string;
}

/**
 * Main menu inline keyboard
 */
const createMainMenuKeyboard = (webAppUrl?: string) => {
    type ButtonType = ReturnType<typeof Markup.button.callback> | ReturnType<typeof Markup.button.webApp>;
    const buttons: ButtonType[][] = [
        [
            Markup.button.callback(`${emoji.calendar} Сегодня`, 'sec_training'),
            Markup.button.callback(`${emoji.brain} AI`, 'sec_ai'),
        ],
        [
            Markup.button.callback(`${emoji.target} Игры`, 'sec_games'),
            Markup.button.callback(`${emoji.sparkles} Demo`, 'demo_menu'),
        ],
    ];

    // Add Web App button if URL is available
    if (webAppUrl) {
        buttons.unshift([
            Markup.button.webApp(`${emoji.rocket} Открыть TZONA`, webAppUrl),
        ]);
    }

    return Markup.inlineKeyboard(buttons);
};

/**
 * Start command handler
 */
export async function startCommand(ctx: StartCommandContext, deps: StartCommandDeps): Promise<void> {
    const firstName = ctx.from?.first_name || 'Атлет';
    const profileId = ctx.state?.profileId;

    // React to user's /start
    if (ctx.message) {
        await setMessageReaction(ctx, ctx.message.message_id, '👋');
    }

    // Send welcome animation
    const welcomeMsg = await ctx.replyWithHTML('✨');

    // Animate welcome
    const welcomeFrames = ['✨', '✨👋', '✨👋🏋️', '✨👋🏋️💪', '✨👋🏋️💪🔥'];
    for (const frame of welcomeFrames) {
        try {
            await ctx.telegram.editMessageText(ctx.chat!.id, welcomeMsg.message_id, undefined, frame);
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 150));
    }

    // Get user stats for personalized greeting
    let quickStats = '';
    if (profileId) {
        try {
            const stats = await deps.db.getRecentCompletionStats(profileId, { days: 30 });
            const weekStats = await deps.db.getRecentCompletionStats(profileId, { days: 7 });

            if (stats.completed > 0 || stats.streak > 0) {
                const streakBar = createProgressBar(Math.min(stats.streak || 0, 30), 30, 'fire', 6);
                quickStats = `\n${emoji.fire} <b>Streak:</b> ${streakBar}\n` +
                    `${emoji.muscle} За неделю: ${weekStats.completed || 0} тренировок`;
            }

            // Initialize session
            setSession(profileId, { currentSection: 'main' });
        } catch { /* ignore */ }
    }

    const text =
        `${emoji.crown} <b>TZONA</b> ${emoji.gem}\n` +
        `${decor.divider}\n\n` +
        `${emoji.wave} Привет, <b>${firstName}</b>!\n` +
        `${quickStats}\n\n` +
        `${spoiler('🎁 Твой секрет: Ты уже чемпион!')}\n\n` +
        `${decor.divider}\n` +
        `${emoji.rocket} <i>Выбери раздел внизу</i>`;

    // Delete animation message
    try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, welcomeMsg.message_id);
    } catch { /* ignore */ }

    // Create keyboard with Web App button if URL available
    const menuKeyboard = createMainMenuKeyboard(deps.webAppUrl);

    // Send main message with Reply Keyboard
    await ctx.replyWithHTML(text, {
        ...mainKeyboard,
        ...menuKeyboard,
    });
}

export default startCommand;
