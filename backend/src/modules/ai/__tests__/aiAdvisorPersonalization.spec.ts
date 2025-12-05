import { describe, expect, it, vi } from 'vitest';
import { loadAiAdvisorPersonalization } from '../aiAdvisorPersonalization.js';

const buildPrisma = () => ({
    profile: {
        findUnique: vi.fn(),
    },
    trainingSession: {
        count: vi.fn(),
        findFirst: vi.fn(),
    },
    achievement: {
        findFirst: vi.fn(),
        count: vi.fn(),
    },
    exerciseProgress: {
        findMany: vi.fn(),
    },
});

describe('loadAiAdvisorPersonalization', () => {
    it('returns null when profile is missing', async () => {
        const prisma = buildPrisma();
        prisma.profile.findUnique.mockResolvedValue(null);

        const result = await loadAiAdvisorPersonalization(prisma as any, 'profile-x');
        expect(result).toBeNull();
    });

    it('maps profile attributes and aggregates stats', async () => {
        const prisma = buildPrisma();
        prisma.profile.findUnique.mockResolvedValue({
            id: 'profile-x',
            firstName: '  Anna  ',
            lastName: 'Ivanova',
            timezone: 'Europe/Moscow',
            notificationTime: new Date('2024-01-01T07:30:00Z'),
            equipment: ['Kettlebell', '  Mat  '],
            goals: { description: 'Сделать 10 подтягиваний' },
            preferences: { language: 'ru', focusAreas: ['кор'], injuries: ['плечо'], aiTone: 'вдохновляющий' },
        });
        prisma.trainingSession.count
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce(9);
        prisma.trainingSession.findFirst.mockResolvedValue({
            status: 'done',
            plannedAt: new Date('2024-01-10T10:00:00Z'),
            discipline: { name: 'Выносливость' },
        });
        prisma.achievement.findFirst.mockResolvedValue({
            title: 'Первая неделя',
            awardedAt: new Date('2024-01-05T12:00:00Z'),
        });
        prisma.achievement.count.mockResolvedValue(5);
        prisma.exerciseProgress.findMany.mockResolvedValue([
            { rpe: 7.5 },
            { rpe: 8 },
        ]);

        const result = await loadAiAdvisorPersonalization(prisma as any, 'profile-x');
        expect(result).toMatchObject({
            profile: {
                firstName: 'Anna',
                lastName: 'Ivanova',
                timezone: 'Europe/Moscow',
                notificationTime: '07:30',
                preferredLanguage: 'ru',
            },
            goals: ['Сделать 10 подтягиваний'],
            equipment: ['Kettlebell', 'Mat'],
            focusAreas: ['кор'],
            injuries: ['плечо'],
            tone: 'вдохновляющий',
            stats: {
                completionRate30d: 75,
                plannedSessions30d: 12,
                completedSessions30d: 9,
                latestSessionStatus: 'done',
                latestSessionDiscipline: 'Выносливость',
            },
            achievements: {
                latestTitle: 'Первая неделя',
                totalCount: 5,
            },
            readiness: {
                avgRpe7d: 7.8,
            },
        });
    });
});
