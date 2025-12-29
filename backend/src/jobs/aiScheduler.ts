import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../services/notificationService.js';
import { logger } from '../services/logger.js';
import { AISummaryService } from '../services/aiSummary.service.js';

/**
 * Initialize AI Trainer Scheduler
 * Handles timed notifications (reminders, tips, motivation)
 */
export const initAIScheduler = (
    notificationService: NotificationService,
    prisma: PrismaClient
) => {
    logger.info('[Scheduler] Initializing AI Trainer jobs...');

    const summaryService = new AISummaryService(prisma);

    // 1. Training Reminders (10:00, 14:00, 18:00)
    // Checks for planned sessions today that aren't completed
    cron.schedule('0 10,14,18 * * *', async () => {
        try {
            logger.info('[Scheduler] Running training reminder check...');
            const now = new Date();
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);

            // Find sessions planned for today that are NOT done
            const plannedSessions = await prisma.trainingSession.findMany({
                where: {
                    plannedAt: { gte: startOfDay, lte: endOfDay },
                    status: 'planned'
                },
                include: {
                    profile: {
                        select: { id: true, firstName: true, telegramId: true, notificationsPaused: true }
                    },
                    discipline: { select: { name: true } }
                }
            });

            for (const session of plannedSessions) {
                if (!session.profile || session.profile.notificationsPaused) continue;

                // Simple check: don't annoy if training is right now (allow 1 hour buffer)
                const hoursDiff = Math.abs(session.plannedAt.getHours() - now.getHours());
                if (hoursDiff > 2) continue; // Only remind 2 hours around the planned time? 
                // Actually, improved logic: remind if it's nearing time or time passed but not done

                const discipline = session.discipline?.name || 'Тренировка';

                await notificationService.sendTrainerNotification(session.profileId, 'training_reminder', {
                    title: '💪 Время стать сильнее!',
                    message: `У тебя запланировано: ${discipline}. Всё готово?`,
                    data: { sessionId: session.id }
                });
            }
        } catch (err) {
            logger.error({ err }, '[Scheduler] Error in training reminder job');
        }
    });

    // 2. Motivation Check (Daily at 12:00)
    // Finds users inactive for 3+ days
    cron.schedule('0 12 * * *', async () => {
        try {
            logger.info('[Scheduler] Running motivation check...');
            await notificationService.checkInactiveProfiles(3);
        } catch (err) {
            logger.error({ err }, '[Scheduler] Error in motivation job');
        }
    });

    // 3. Daily Tip (Random time between 9:00 - 20:00)
    // Logic: Ran once a day at 9:00, schedules a timeout for random dispatch
    cron.schedule('0 9 * * *', async () => {
        try {
            logger.info('[Scheduler] Scheduling daily tips...');

            // Get generic active profiles (those with at least 1 workout in last 14 days)
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

            const activeProfiles = await prisma.profile.findMany({
                where: {
                    notificationsPaused: false,
                    sessions: {
                        some: {
                            updatedAt: { gte: twoWeeksAgo }
                        }
                    }
                },
                select: { id: true }
            });

            // Send to a subset (e.g. 20%) to avoid spamming everyone every day, or send to all?
            // Let's send to all but with random delay
            for (const p of activeProfiles) {
                // 30% chance to receive a tip to avoid fatigue
                if (Math.random() > 0.3) continue;

                const delayMs = Math.floor(Math.random() * 11 * 60 * 60 * 1000); // 0-11 hours delay

                setTimeout(async () => {
                    try {
                        const tips = [
                            'Не забывай про разминку! Она снижает риск травм на 50%.',
                            'Вода — твой лучший друг. Пей 2-3 литра в день.',
                            'Сон — это когда растут мышцы. Спи не менее 7-8 часов.',
                            'Техника важнее веса. Лучше меньше, но чище.',
                            'Попробуй холодный душ после тренировки для восстановления.',
                            'Белок нужен не только качкам. Добавь орехи в рацион.',
                        ];
                        const randomTip = tips[Math.floor(Math.random() * tips.length)];

                        await notificationService.sendTrainerNotification(p.id, 'daily_tip', {
                            title: '💡 Совет от Тренера',
                            message: randomTip
                        });
                    } catch (e) {
                        logger.error({ err: e }, `Failed to send tip to ${p.id}`);
                    }
                }, delayMs);
            }
        } catch (err) {
            logger.error({ err }, '[Scheduler] Error in daily tip job');
        }
    });

    // 4. AI Self-Learning Maintenance (Weekly at 03:00 Sunday)
    // Applies confidence decay and triggers instruction generation
    cron.schedule('0 3 * * 0', async () => {
        try {
            logger.info('[Scheduler] Running AI Self-Learning maintenance...');

            // Get all profiles with learning data
            const profiles = await prisma.aIUserLearningProfile.findMany({
                select: { profileId: true }
            });

            if (profiles.length === 0) {
                logger.info('[Scheduler] No learning profiles found, skipping maintenance');
                return;
            }

            const { createSelfLearningEngine } = await import('../services/aiSelfLearning.js');

            let totalDecayed = 0;
            let totalDeprecated = 0;
            let totalGenerated = 0;

            for (const { profileId } of profiles) {
                try {
                    const engine = createSelfLearningEngine(prisma as any, profileId);

                    // 1. Apply confidence decay to stale instructions
                    const decay = await engine.applyConfidenceDecay();
                    totalDecayed += decay.decayed;
                    totalDeprecated += decay.deprecated;

                    // 2. Trigger new instruction generation from recent positive feedback
                    try {
                        await engine.runInstructionGeneration();
                        totalGenerated++;
                    } catch {
                        // May fail if not enough positive interactions
                    }
                } catch (err) {
                    logger.warn({ profileId, err }, '[Scheduler] Self-learning maintenance failed for profile');
                }
            }

            logger.info(
                { totalDecayed, totalDeprecated, totalGenerated },
                '[Scheduler] AI Self-Learning maintenance complete'
            );
        } catch (err) {
            logger.error({ err }, '[Scheduler] Error in AI Self-Learning maintenance');
        }
    });

    // 5. AI Learning Metrics Collection (Daily at 04:00)
    // Collects stats for monitoring learning effectiveness
    cron.schedule('0 4 * * *', async () => {
        try {
            logger.info('[Scheduler] Collecting AI learning metrics...');

            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);

            // Count interactions by rating
            const [positiveCount, negativeCount, totalCount] = await Promise.all([
                prisma.$queryRaw`SELECT COUNT(*) as count FROM ai_interactions WHERE rating = 'positive' AND created_at >= ${yesterday}`,
                prisma.$queryRaw`SELECT COUNT(*) as count FROM ai_interactions WHERE rating = 'negative' AND created_at >= ${yesterday}`,
                prisma.$queryRaw`SELECT COUNT(*) as count FROM ai_interactions WHERE created_at >= ${yesterday}`,
            ]).catch(() => [{ count: 0 }, { count: 0 }, { count: 0 }]) as any;

            // Count active instructions
            const activeInstructions = await prisma.aILearnedInstruction.count({
                where: { isActive: true }
            }).catch(() => 0);

            logger.info({
                date: yesterday.toISOString().split('T')[0],
                positive: positiveCount[0]?.count || 0,
                negative: negativeCount[0]?.count || 0,
                total: totalCount[0]?.count || 0,
                activeInstructions,
            }, '[Scheduler] AI Learning metrics collected');
        } catch (err) {
            logger.error({ err }, '[Scheduler] Error collecting AI learning metrics');
        }
    });

    logger.info('[Scheduler] AI Trainer jobs initialized: reminders, motivation, tips, self-learning');
};
