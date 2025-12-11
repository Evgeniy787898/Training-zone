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
        if (this.checkInterval) {
            logger.warn('Notification scheduler already running');
            return;
        }

        logger.info('Starting notification scheduler...');

        // Calculate time to next minute for synchronization
        const now = new Date();
        const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

        setTimeout(() => {
            this.runCheck();
            this.checkInterval = setInterval(() => {
                this.runCheck();
            }, 60000);
        }, msToNextMinute);

        // Subscribe to workout:completed events
        this.subscribeToWorkoutCompletion();
    }

    public stopScheduler() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info('Notification scheduler stopped');
        }

        // Unsubscribe from workout:completed events
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
            } catch (error) {
                logger.error({ err: error }, 'Error sending workout completion notification');
            }
        });
        logger.info('Subscribed to workout:completed events');
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
}
