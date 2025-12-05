import type { SafePrismaClient } from '../../types/prisma.js';
import { fetchProfileAdherenceSummary } from '../infrastructure/materializedViews.js';

export type ProfileSummaryPayload = {
    profile: {
        id: string;
        notification_time: string | null;
        timezone: string | null;
        preferences: unknown;
        notifications_paused: boolean | null;
    };
    adherence: {
        window: '30d';
        total_sessions: number;
        completed_sessions: number;
        adherence_percent: number;
    };
    metrics: unknown[];
    cached: boolean;
};

export async function loadProfileSummary(
    prisma: SafePrismaClient,
    profileId: string,
): Promise<ProfileSummaryPayload | null> {
    const profile = await prisma.profile.findUnique({
        where: { id: profileId },
    });

    if (!profile) {
        return null;
    }

    const { totalSessions30d, completedSessions30d } = await fetchProfileAdherenceSummary(prisma, profileId);
    const adherencePercent = totalSessions30d === 0
        ? 0
        : Math.round((completedSessions30d / totalSessions30d) * 100);

    const latestMetrics = await prisma.metric.findMany({
        where: { profileId },
        orderBy: { recordedAt: 'desc' },
        take: 10,
    });

    return {
        profile: {
            id: profile.id,
            notification_time: profile.notificationTime ? profile.notificationTime.toISOString() : null,
            timezone: profile.timezone,
            preferences: profile.preferences,
            notifications_paused: profile.notificationsPaused,
        },
        adherence: {
            window: '30d',
            total_sessions: totalSessions30d,
            completed_sessions: completedSessions30d,
            adherence_percent: adherencePercent,
        },
        metrics: latestMetrics,
        cached: false,
    };
}
