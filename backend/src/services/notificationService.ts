import { Telegraf } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { logger } from '../services/logger.js';
import { eventBus } from '../services/eventBus.js';

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

export class NotificationService {
    private bot: Telegraf;
    private db: PrismaClient;
    private checkInterval: NodeJS.Timeout | null = null;
    private workoutCompletedUnsubscribe: (() => void) | null = null;

    constructor(bot: Telegraf, db: PrismaClient) {
        this.bot = bot;
        this.db = db;
    }

    public startScheduler() {
        // Subscribe to workout:completed events
        this.subscribeToWorkoutCompletion();

        // Legacy time-based scheduler is replaced by AI Scheduler (node-cron)
        // We keep this method for subscription initialization only
        logger.info('Notification Service initialized (AI Scheduler taking over cron jobs)');
    }

    public stopScheduler() {
        // Unsubscribe from events
        if (this.workoutCompletedUnsubscribe) {
            this.workoutCompletedUnsubscribe();
            this.workoutCompletedUnsubscribe = null;
        }
    }

    /**
     * Subscribe to workout:completed events to send congratulations
     */
    private subscribeToWorkoutCompletion() {
        this.workoutCompletedUnsubscribe = eventBus.on('workout:completed', async (payload) => {
            try {
                await this.sendWorkoutCompletionNotification(
                    payload.profileId,
                    payload.duration,
                    payload.exerciseCount
                );

                // Check if this was the last scheduled workout of the week
                await this.checkForWeeklyReport(payload.profileId);
            } catch (error) {
                logger.error({ err: error }, 'Error sending workout completion notification');
            }
        });
        logger.info('Subscribed to workout:completed events');
    }

    /**
     * Check if this completes the weekly workouts and send report
     */
    private async checkForWeeklyReport(profileId: string) {
        try {
            // Get this week's scheduled sessions
            const now = new Date();
            const dayOfWeek = now.getDay(); // 0 = Sunday
            const daysUntilEndOfWeek = 7 - dayOfWeek;

            // If it's Friday, Saturday or Sunday, check for weekly report
            if (dayOfWeek >= 5 || dayOfWeek === 0) {
                // Count completed sessions this week
                const weekStart = new Date();
                weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
                weekStart.setHours(0, 0, 0, 0);

                const completedThisWeek = await this.db.trainingSession.count({
                    where: {
                        profileId,
                        status: 'done',
                        updatedAt: { gte: weekStart }
                    }
                });

                // Check if there are any remaining scheduled sessions this week
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 7);

                const remainingPlanned = await this.db.trainingSession.count({
                    where: {
                        profileId,
                        status: 'planned',
                        plannedAt: { gte: now, lt: weekEnd }
                    }
                });

                // If no more planned sessions and at least 1 completed, send report
                if (remainingPlanned === 0 && completedThisWeek >= 1) {
                    await this.sendWeeklyReport(profileId);
                }
            }
        } catch (error) {
            logger.error({ err: error }, '[AI Trainer] Error checking for weekly report');
        }
    }

    /**
     * Send workout completion notification via Telegram
     */
    private async sendWorkoutCompletionNotification(
        profileId: string,
        durationSeconds: number,
        exerciseCount: number
    ) {
        try {
            // Get profile with telegramId
            const profile = await this.db.profile.findUnique({
                where: { id: profileId },
                select: {
                    telegramId: true,
                    firstName: true,
                    notificationsPaused: true,
                }
            });

            if (!profile?.telegramId) {
                logger.debug(`No telegramId for profile ${profileId}, skipping completion notification`);
                return;
            }

            // Don't send if notifications are paused
            if (profile.notificationsPaused) {
                logger.debug(`Notifications paused for profile ${profileId}, skipping`);
                return;
            }

            const firstName = profile.firstName || 'Атлет';
            const durationText = formatDuration(durationSeconds);
            const exerciseText = exerciseCount === 1 ? 'упражнение' :
                exerciseCount < 5 ? 'упражнения' : 'упражнений';

            const message =
                `🎉 <b>Поздравляем, ${firstName}!</b>\n\n` +
                `Ты завершил тренировку! 💪\n\n` +
                `⏱ Время: <b>${durationText}</b>\n` +
                `🏋️ Упражнений: <b>${exerciseCount} ${exerciseText}</b>\n\n` +
                `Отличная работа! Продолжай в том же духе! 🔥`;

            await this.bot.telegram.sendMessage(Number(profile.telegramId), message, {
                parse_mode: 'HTML'
            });

            logger.info(`Workout completion notification sent to profile ${profileId}`);
        } catch (error) {
            logger.error({ err: error }, `Failed to send workout completion notification for ${profileId}`);
        }
    }

    private async runCheck() {
        try {
            logger.debug('Running notification check...');
            // Fetch all users with notifications enabled and a set time
            // In a real high-load system, we would index by time and query only relevant users.
            // For now, fetching active profiles is acceptable given the scale.
            // Optimization: Filter by notificationsPaused = false
            const profiles = await this.db.profile.findMany({
                where: {
                    notificationsPaused: false,
                    notificationTime: { not: null }
                },
                select: {
                    id: true,
                    telegramId: true,
                    firstName: true,
                    timezone: true,
                    notificationTime: true
                }
            });

            const now = new Date(); // Server time

            for (const profile of profiles) {
                if (!profile.notificationTime || !profile.telegramId) continue;

                try {
                    // Convert server time to user's timezone
                    // profile.timezone e.g. "Europe/Moscow"
                    const userTimeStr = now.toLocaleTimeString('en-US', {
                        timeZone: profile.timezone,
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    // profile.notificationTime is a Date object (1970-01-01T10:00:00.000Z) or whatever DB stored
                    // We need to extract HH:mm from it in UTC (since it's typically stored as UTC time of day)
                    // OR, if it was stored with timezone awareness, we need to be careful.
                    // Assuming standard behavior: input was "10:00", stored as "1970-01-01T10:00:00Z"

                    // Actually, Prisma/Postgres `Time` type often returns a Date object. 
                    // Let's assume the Date object represents the time in UTC.
                    // But wait, the Frontend sends "10:00" string. 
                    // If the backend API `updateProfile` handled via Prisma `DateTime` for a `Time` column, 
                    // it usually normalizes the date part.

                    // Let's rely on extracting UTC hours/minutes from the stored object
                    // and comparing with the User's Local Time.

                    // CRITICAL: How was it saved? 
                    // If user sent "10:00", and backend did `new Date('1970-01-01T10:00:00')` (local) or UTC?
                    // Let's fetch using introspection if unsure, but standardizing on HH:mm string comparison is safest.

                    const targetTime = profile.notificationTime.toISOString().split('T')[1].substring(0, 5); // "10:00" from "1970-01-01T10:00:00.000Z"
                    // Warning: The above assumes the stored DB value is exactly the desired time in UTC or consistent offset.
                    // If `notificationTime` is stored as "time without time zone", Prisma returns it as Date object on 1970-01-01 in UTC.
                    // So `toISOString` gives the correct HH:mm.

                    if (userTimeStr === targetTime) {
                        await this.sendNotification(profile.telegramId, profile.firstName);
                    }
                } catch (err) {
                    logger.error({ err }, `Error processing notification for profile ${profile.id}`);
                }
            }

        } catch (error) {
            logger.error({ err: error }, 'Error in notification scheduler cycle');
        }
    }

    private async sendNotification(telegramId: bigint, firstName: string | null) {
        try {
            const message = `👋 Привет${firstName ? ', ' + firstName : ''}! Время тренировки! 🏋️‍♂️\n\nНе забудь заглянуть в дневник и стать лучше сегодня.`;

            await this.bot.telegram.sendMessage(Number(telegramId), message);
            logger.info(`Notification sent to ${telegramId}`);
        } catch (error) {
            logger.error({ err: error }, `Failed to send notification to ${telegramId}`);
        }
    }

    // ====== AI TRAINER NOTIFICATIONS ======

    /**
     * Send AI Trainer notification via Telegram
     * Types: training_reminder, motivation, achievement, weekly_report, daily_tip
     */
    public async sendTrainerNotification(
        profileId: string,
        type: 'training_reminder' | 'motivation' | 'achievement' | 'weekly_report' | 'daily_tip',
        params: { title: string; message: string; data?: any }
    ) {
        try {
            const profile = await this.db.profile.findUnique({
                where: { id: profileId },
                select: { telegramId: true, notificationsPaused: true, firstName: true }
            });

            if (!profile?.telegramId || profile.notificationsPaused) {
                return;
            }

            // Check daily notification limit (max 5)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todayCount = await this.db.notification.count({
                where: {
                    profileId,
                    createdAt: { gte: today }
                }
            });

            if (todayCount >= 5) {
                logger.debug(`Daily notification limit reached for ${profileId}`);
                return;
            }

            // Save to DB
            await this.db.notification.create({
                data: {
                    profileId,
                    type,
                    title: params.title,
                    message: params.message,
                    data: params.data || {},
                }
            });

            const fullMessage =
                `${params.title}\n\n${params.message}`;

            await this.bot.telegram.sendMessage(Number(profile.telegramId), fullMessage, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📱 Открыть приложение', url: process.env.WEBAPP_URL || 'https://t.me/TrainingZoneBot' }
                    ]]
                }
            });

            logger.info(`[AI Trainer] Sent ${type} notification to profile ${profileId}`);
        } catch (error) {
            logger.error({ err: error }, `[AI Trainer] Failed to send ${type} notification`);
        }
    }

    /**
     * Check for inactive profiles and send motivation
     * Called daily or on schedule
     */
    public async checkInactiveProfiles(daysThreshold: number = 2) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

            // Find profiles with no recent completed sessions
            const inactiveProfiles = await this.db.profile.findMany({
                where: {
                    notificationsPaused: false,
                    sessions: {
                        none: {
                            status: 'done',
                            updatedAt: { gte: cutoffDate }
                        }
                    }
                },
                select: { id: true, firstName: true, telegramId: true }
            });

            for (const profile of inactiveProfiles) {
                if (!profile.telegramId) continue;

                const messages = [
                    `Эй, ${profile.firstName || 'чемпион'}! Уже ${daysThreshold} дня без тренировки. Давай хотя бы разомнёмся? 🏃`,
                    `${profile.firstName || 'Друг'}, диван — это хорошо, но мышцы скучают! 💪 Когда вернёшься?`,
                    `Я тут один грустить за тебя тренируюсь... ${profile.firstName || ''}, где ты? 😏`,
                ];
                const randomMessage = messages[Math.floor(Math.random() * messages.length)];

                await this.sendTrainerNotification(profile.id, 'motivation', {
                    title: '🏃 Скучаю по тебе!',
                    message: randomMessage,
                });
            }

            logger.info(`[AI Trainer] Checked ${inactiveProfiles.length} inactive profiles`);
        } catch (error) {
            logger.error({ err: error }, '[AI Trainer] Error checking inactive profiles');
        }
    }

    /**
     * Send weekly report after last workout of the week
     */
    public async sendWeeklyReport(profileId: string) {
        try {
            const profile = await this.db.profile.findUnique({
                where: { id: profileId },
                select: { telegramId: true, notificationsPaused: true, firstName: true }
            });

            if (!profile?.telegramId || profile.notificationsPaused) return;

            // Calculate weekly stats
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - 7);

            const sessions = await this.db.trainingSession.findMany({
                where: {
                    profileId,
                    updatedAt: { gte: weekStart },
                    status: 'done'
                },
                select: {
                    createdAt: true,
                    updatedAt: true,
                }
            });

            const workoutCount = sessions.length;
            // Estimate duration from createdAt to updatedAt
            const totalDuration = sessions.reduce((sum: number, s) => {
                if (s.createdAt && s.updatedAt) {
                    const duration = (s.updatedAt.getTime() - s.createdAt.getTime()) / 1000;
                    // Cap at 3 hours max per session to avoid outliers
                    return sum + Math.min(duration, 3 * 60 * 60);
                }
                return sum;
            }, 0);

            const durationText = formatDuration(Math.round(totalDuration));

            const message =
                `📊 <b>Твоя неделя завершена!</b>\n\n` +
                `💪 Тренировок: <b>${workoutCount}</b>\n` +
                `⏱ Общее время: <b>${durationText}</b>\n\n` +
                (workoutCount >= 3
                    ? `Отличный результат! Так держать! 🔥`
                    : `Можешь лучше! На следующей неделе жду больше 💪`);

            await this.sendTrainerNotification(profileId, 'weekly_report', {
                title: '📊 Еженедельный отчёт',
                message,
                data: { workoutCount, totalDuration }
            });

        } catch (error) {
            logger.error({ err: error }, '[AI Trainer] Error sending weekly report');
        }
    }
}
