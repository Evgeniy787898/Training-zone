/**
 * /today Command Handler
 * Extracted from bot/runtime.ts as part of BOT-R02 decomposition
 *
 * Shows today's training plan with sessions and exercises
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
} from '../helpers/index.js';

// Using intersection type as state is set by middleware
type TodayCommandContext = Context & {
    state?: Record<string, any>;
};

interface TodayCommandDeps {
    db: DatabaseService;
    webAppUrl?: string;
}

/**
 * Typing indicator with delay
 */
const typingWithDelay = async (ctx: any, delayMs: number = 1500): Promise<void> => {
    await ctx.sendChatAction('typing');
    await new Promise(resolve => setTimeout(resolve, delayMs));
};

/**
 * Today command handler - shows training plan for today
 */
export async function todayCommand(ctx: TodayCommandContext, deps: TodayCommandDeps): Promise<void> {
    const profileId = ctx.state?.profileId;
    if (!profileId) {
        await ctx.replyWithHTML(`${emoji.warning} Введи /start`);
        return;
    }

    // React to command
    if (ctx.message) {
        await setMessageReaction(ctx, ctx.message.message_id, '📅');
    }

    // Show loading with animation
    const loadingMsg = await ctx.replyWithHTML('📅 Загружаю...');
    await typingWithDelay(ctx, 500);

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const sessions = await deps.db.getTrainingSessions(profileId, {
            startDate: today,
            endDate: tomorrow,
            limit: 5,
        });

        // Delete loading message
        try {
            await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
        } catch { /* ignore */ }

        if (!sessions || sessions.length === 0) {
            const text =
                `${emoji.calendar} <b>План на сегодня</b>\n` +
                `${decor.divider}\n\n` +
                `${emoji.sparkles} Свободный день!\n\n` +
                `${spoiler('💡 Совет: Добавь тренировку!')}\n\n` +
                createProgressBar(0, 1, 'hearts', 8);

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback(`${emoji.fire} Добавить`, 'sec_training')],
                [Markup.button.callback(`🧘 Растяжка`, 'cmd_stretch')],
            ]);

            await ctx.replyWithHTML(text, keyboard);
            return;
        }

        const statusEmoji: Record<string, string> = {
            planned: emoji.calendar,
            in_progress: emoji.fire,
            done: emoji.check,
            skipped: emoji.cross,
        };

        const statusText: Record<string, string> = {
            planned: 'запланирована',
            in_progress: 'в процессе',
            done: 'завершена',
            skipped: 'пропущена',
        };

        let text = `${emoji.calendar} <b>План на сегодня</b>\n\n`;

        for (const session of sessions) {
            const status = session.status || 'planned';
            const time = session.plannedAt
                ? new Date(session.plannedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                : '';
            const name = session.discipline?.name || session.name || 'Тренировка';

            text += `${statusEmoji[status] || emoji.calendar} <b>${name}</b>`;
            if (time) text += ` (${time})`;
            text += ` — ${statusText[status] || status}\n`;

            if (session.exercises && session.exercises.length > 0) {
                const exerciseCount = session.exercises.length;
                text += `   └ ${exerciseCount} упражнений\n`;
            }
        }

        text += `\n${emoji.muscle} <i>Вперёд к новым победам!</i>`;

        const keyboard = deps.webAppUrl
            ? Markup.inlineKeyboard([
                [Markup.button.webApp(`${emoji.rocket} Начать тренировку`, deps.webAppUrl)],
                [Markup.button.callback(`${emoji.brain} Получить AI-совет`, 'cmd_advice')],
            ])
            : undefined;

        await ctx.replyWithHTML(text, keyboard);
    } catch (error) {
        console.error('[bot] /today error:', error);
        await ctx.replyWithHTML(`${emoji.warning} Не удалось загрузить план. Попробуй позже.`);
    }
}

export default todayCommand;
