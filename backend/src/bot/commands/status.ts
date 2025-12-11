/**
 * /status Command Handler
 * Shows current workout status or last workout info
 * Part of TODAY-B01
 */
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import type { DatabaseService } from '../../modules/integrations/supabase.js';
import {
    emoji,
    decor,
    createProgressBar,
    setMessageReaction,
} from '../helpers/index.js';

// Using intersection type as state is set by middleware
type StatusCommandContext = Context & {
    state?: Record<string, any>;
};

interface StatusCommandDeps {
    db: DatabaseService;
    webAppUrl?: string;
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${seconds} сек`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
        return `${minutes} мин`;
    }
    return `${minutes} мин ${remainingSeconds} сек`;
}

/**
 * /status command handler - shows current workout status
 */
export async function statusCommand(ctx: StatusCommandContext, deps: StatusCommandDeps): Promise<void> {
    const profileId = ctx.state?.profileId;
    if (!profileId) {
        await ctx.replyWithHTML(`${emoji.warning} Введи /start`);
        return;
    }

    // React to command
    if (ctx.message) {
        await setMessageReaction(ctx, ctx.message.message_id, '📊');
    }

    try {
        // Get current or recent sessions
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const sessions = await deps.db.getTrainingSessions(profileId, {
            startDate: weekAgo,
            endDate: today,
            limit: 10,
        });

        // Find in-progress session
        const inProgress = sessions?.find(s => s.status === 'in_progress');

        // Get stats
        const stats = await deps.db.getRecentCompletionStats(profileId, { days: 7 });

        let text = `${emoji.chart} <b>Статус</b>\n${decor.divider}\n\n`;

        // In-progress workout
        if (inProgress) {
            const name = inProgress.discipline?.name || inProgress.name || 'Тренировка';
            const startTime = inProgress.createdAt
                ? new Date(inProgress.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                : '';

            text += `${emoji.fire} <b>Сейчас:</b> ${name}`;
            if (startTime) text += ` (начата в ${startTime})`;
            text += `\n\n`;

            if (inProgress.exercises && inProgress.exercises.length > 0) {
                const total = inProgress.exercises.length;
                const done = inProgress.exercises.filter((e: any) => e.status === 'done').length;
                text += `${emoji.muscle} Прогресс: ${done}/${total} упражнений\n`;
                text += `${createProgressBar(done, total, 'blocks', 10)}\n\n`;
            }
        } else {
            // Last completed workout
            const lastDone = sessions?.find(s => s.status === 'done');
            if (lastDone) {
                const name = lastDone.discipline?.name || lastDone.name || 'Тренировка';
                const completedAt = lastDone.completedAt
                    ? new Date(lastDone.completedAt)
                    : null;

                text += `${emoji.check} <b>Последняя:</b> ${name}\n`;
                if (completedAt) {
                    const isToday = completedAt.toDateString() === today.toDateString();
                    const timeStr = completedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    const dateStr = isToday ? 'Сегодня' : completedAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                    text += `   └ ${dateStr} в ${timeStr}\n`;
                }
                text += `\n`;
            } else {
                text += `${emoji.sparkles} Нет активных тренировок\n\n`;
            }
        }

        // Weekly stats
        text += `${decor.line}\n`;
        text += `${emoji.fire} <b>Неделя:</b>\n`;
        text += `   • Тренировок: ${stats.completed || 0}\n`;
        text += `   • Streak: ${stats.streak || 0} дн.\n`;

        if (stats.streak && stats.streak > 0) {
            text += `\n${createProgressBar(Math.min(stats.streak, 7), 7, 'fire', 7)}`;
        }

        // Keyboard
        const buttons = [];
        if (inProgress && deps.webAppUrl) {
            buttons.push([Markup.button.webApp(`${emoji.rocket} Продолжить`, deps.webAppUrl)]);
        } else if (deps.webAppUrl) {
            buttons.push([Markup.button.webApp(`${emoji.fire} Начать тренировку`, deps.webAppUrl)]);
        }
        buttons.push([Markup.button.callback(`${emoji.calendar} План на сегодня`, 'cmd_today')]);

        const keyboard = Markup.inlineKeyboard(buttons);

        await ctx.replyWithHTML(text, keyboard);
    } catch (error) {
        console.error('[bot] /status error:', error);
        await ctx.replyWithHTML(`${emoji.warning} Не удалось загрузить статус. Попробуй позже.`);
    }
}

export default statusCommand;
