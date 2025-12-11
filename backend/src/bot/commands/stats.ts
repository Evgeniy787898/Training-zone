/**
 * /stats Command Handler
 * Extracted from bot/runtime.ts as part of BOT-R02 decomposition
 *
 * Shows detailed statistics (Premium)
 */
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import type { DatabaseService } from '../../modules/integrations/supabase.js';
import { emoji } from '../helpers/index.js';

type StatsContext = Context & {
    state?: Record<string, any>;
};

interface StatsCommandDeps {
    db: DatabaseService;
    webAppUrl?: string;
}

export async function statsCommand(ctx: StatsContext, deps: StatsCommandDeps): Promise<void> {
    const profileId = ctx.state?.profileId;
    if (!profileId) {
        await ctx.replyWithHTML(`${emoji.warning} Не удалось определить профиль. Введи /start`);
        return;
    }

    await ctx.sendChatAction('typing');

    try {
        const [weekStats, monthStats, profile] = await Promise.all([
            deps.db.getRecentCompletionStats(profileId, { days: 7 }),
            deps.db.getRecentCompletionStats(profileId, { days: 30 }),
            deps.db.getProfileById(profileId),
        ]);

        const text =
            `${emoji.trophy} <b>Твои достижения</b>\n\n` +
            `${emoji.fire} <b>За 30 дней:</b>\n` +
            `• Тренировок: ${monthStats.completed || 0}\n` +
            `• Прогресс: ${monthStats.completed ? Math.round((monthStats.completed / 30) * 100) : 0}%\n\n` +
            `${emoji.muscle} <b>Текущий стрик:</b>\n` +
            `${weekStats.streak || 0} дней подряд\n\n` +
            `   ${emoji.calendar} Дней в системе: ${profile?.createdAt
                ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : '?'}\n\n` +
            `${emoji.rocket} <i>Продолжай в том же духе!</i>`;

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback(`${emoji.brain} AI-анализ`, 'stats_ai_analysis'),
                Markup.button.callback(`${emoji.fire} Мотивация`, 'cmd_motivate'),
            ],
            deps.webAppUrl ? [Markup.button.webApp(`${emoji.chart} Подробнее`, deps.webAppUrl)] : [],
        ].filter(row => row.length > 0));

        await ctx.replyWithHTML(text, keyboard);
    } catch (error) {
        console.error('[bot] /stats error:', error);
        await ctx.replyWithHTML(`${emoji.warning} Не удалось загрузить статистику.`);
    }
}

export default statsCommand;
