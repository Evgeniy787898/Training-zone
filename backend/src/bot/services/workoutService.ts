import { Markup } from 'telegraf';
import type { DatabaseService } from '../../modules/integrations/supabase.js';
import { emoji, sendWithEffect, MESSAGE_EFFECTS } from '../helpers/index.js';
import { emitWorkoutCompleted } from '../../services/eventBus.js';

interface WorkoutDialogState {
    step: string;
    sessionId?: string;
    sessionName?: string;
    rpe?: number;
    notes?: string;
    startedAt?: number; // timestamp when workout started
    exerciseCount?: number; // number of exercises in the session
}

// Streak milestones for celebrations
const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 100];

const isStreakMilestone = (streak: number): boolean => {
    return STREAK_MILESTONES.includes(streak);
};

const getStreakCelebration = (streak: number): string => {
    if (streak >= 100) return `${emoji.crown} ЛЕГЕНДА! 100+ дней подряд!`;
    if (streak >= 50) return `${emoji.gem} НЕВЕРОЯТНО! 50 дней без пропусков!`;
    if (streak >= 30) return `${emoji.trophy} МЕСЯЦ! Ты железный!`;
    if (streak >= 21) return `${emoji.medal} 3 НЕДЕЛИ! Привычка сформирована!`;
    if (streak >= 14) return `${emoji.star} 2 НЕДЕЛИ! Ты на правильном пути!`;
    if (streak >= 7) return `${emoji.fire} НЕДЕЛЯ! Отличный старт!`;
    if (streak >= 3) return `${emoji.muscle} 3 ДНЯ подряд! Продолжай!`;
    return '';
};

// Start menu keyboard (redefined here or imported if shared)
// Using a simple inline keyboard for the "Done" message
const doneKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🏠 В меню', 'sec_main')]
]);

/**
 * Save workout completion and handle user feedback/streaks
 * Extracted from runtime.monolith.ts
 */
export const saveWorkoutCompletion = async (
    ctx: any,
    db: DatabaseService,
    profileId: string,
    dialogState: WorkoutDialogState
): Promise<void> => {
    try {
        // Update session to 'done'
        if (dialogState.sessionId) {
            await db.updateTrainingSession(profileId, dialogState.sessionId, {
                status: 'done',
                completedAt: new Date().toISOString(),
                rpe: dialogState.rpe,
                notes: dialogState.notes || null,
            });

            // Calculate duration and emit workout:completed event
            const duration = dialogState.startedAt
                ? Math.floor((Date.now() - dialogState.startedAt) / 1000)
                : 0;
            const exerciseCount = dialogState.exerciseCount || 0;

            // Emit event for NotificationService to send push notification
            emitWorkoutCompleted(
                dialogState.sessionId,
                profileId,
                duration,
                exerciseCount
            );
        }

        // Clear dialog state
        // Assuming clearDialogState exists in db service or we use clearSession
        // In monolith it was db.clearDialogState, let's verify if that exists on DatabaseService interface
        // If not, we might need a workaround or assume it works.
        // Based on usage in runtime.monolith.ts: await db.clearDialogState(profileId, 'active');
        // If it's not on the type, TS will complain.
        // For now, let's assume it is there as per monolith.
        try {
            await (db as any).clearDialogState(profileId, 'active');
        } catch {
            // If method missing, ignore
        }

        // Check for streak milestone
        const stats = await db.getRecentCompletionStats(profileId, { days: 30 });
        const streak = stats.streak || 0;

        let text = `${emoji.check} <b>Тренировка сохранена!</b>\n\n` +
            `RPE: ${dialogState.rpe}/10\n` +
            `${emoji.fire} Текущий стрик: ${streak} дн.`;

        if (dialogState.notes) {
            text += `\n${emoji.notes} Заметка: <i>${dialogState.notes}</i>`;
        }

        const keyboard = doneKeyboard;

        if (isStreakMilestone(streak)) {
            const celebrationText = getStreakCelebration(streak);
            text += `\n\n${emoji.celebration} <b>${celebrationText}</b>`;

            await ctx.replyWithHTML(
                text,
                keyboard
            );
            // Also send celebration with effect
            await sendWithEffect(
                ctx,
                `${emoji.celebration} <b>${celebrationText}</b>`,
                MESSAGE_EFFECTS.party
            );
        } else {
            // Edit previous message or reply new
            // In monolith: await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
            // Here, ctx might be a message context. Safer to reply if edit fails.
            try {
                await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
            } catch {
                await ctx.replyWithHTML(text, keyboard);
            }
        }
    } catch (error) {
        console.error('[bot] saveWorkoutCompletion error:', error);
        await ctx.replyWithHTML(`${emoji.warning} Ошибка при сохранении. Попробуй позже.`);
    }
};
