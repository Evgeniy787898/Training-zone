// Profile AI Summary Service
// Generates and maintains compressed but COMPLETE user context for AI
// All data is preserved, only the format is compact (short keys, no redundancy)

import type { SafePrismaClient } from '../../types/prisma.js';

/**
 * Compressed but FULL profile summary for AI context.
 * Short keys to save tokens, but ALL data is included.
 */
export interface ProfileAiSummary {
    v: number;  // version
    u: string;  // updatedAt ISO

    // Profile (полный)
    n?: string;      // name (firstName + lastName)
    tz?: string;     // timezone
    g?: string[];    // goals (все)
    eq?: string[];   // equipment (всё)

    // Program (полный)
    prg?: {
        n?: string;  // program name
        d?: string;  // discipline name
        id?: string; // program id
        lvl?: Record<string, string>; // ВСЕ текущие уровни {pullup: "2.1", pushup: "3.2", ...}
    };

    // Sessions (полная статистика за всё время)
    ses?: {
        t: number;   // total
        c: number;   // completed (done)
        s: number;   // skipped
        p: number;   // planned
        ip: number;  // in_progress
        last?: {     // последняя сессия
            d: string;   // date
            st: string;  // status
        };
        streak?: number; // текущая серия подряд
    };

    // Exercise Progress (ВСЕ упражнения)
    prog?: Array<{
        k: string;   // exercise key
        l: string;   // current level
        s: number;   // streak success
        rpe?: number; // last RPE
        dt: string;  // last date
    }>;

    // Achievements (ВСЕ)
    ach?: Array<{
        t: string;   // title
        d: string;   // date awarded
    }>;

    // Metrics (ВСЕ последние по каждому типу)
    met?: Array<{
        tp: string;  // type
        v: number;   // value
        u: string;   // unit
        d: string;   // date
    }>;

    // Progress Photos (count + последние даты)
    ph?: {
        c: number;   // count
        last?: string; // last photo date
    };

    // Favorites (все)
    fav?: string[]; // favorite exercise keys

    // Body Scans
    bs?: {
        c: number;   // count
        last?: string; // last scan date
    };
}

const SUMMARY_VERSION = 1;

/**
 * Generate COMPLETE compressed profile summary for AI.
 * All data is included, just in compact JSON format.
 */
export async function generateProfileSummary(
    prisma: SafePrismaClient,
    profileId: string
): Promise<ProfileAiSummary> {
    const now = new Date().toISOString();

    // Load ALL data in one query
    const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        include: {
            trainingPrograms: {
                where: { isActive: true },
                take: 1,
                include: {
                    discipline: { select: { name: true } },
                    program: { select: { name: true } },
                },
            },
            sessions: {
                orderBy: { plannedAt: 'desc' },
                select: {
                    id: true,
                    plannedAt: true,
                    status: true,
                },
            },
            exerciseProgress: {
                orderBy: { createdAt: 'desc' },
                select: {
                    exerciseKey: true,
                    levelTarget: true,
                    levelResult: true,
                    rpe: true,
                    streakSuccess: true,
                    createdAt: true,
                },
            },
            achievements: {
                orderBy: { awardedAt: 'desc' },
                select: {
                    title: true,
                    awardedAt: true,
                },
            },
            metrics: {
                orderBy: { recordedAt: 'desc' },
                select: {
                    metricType: true,
                    value: true,
                    unit: true,
                    recordedAt: true,
                },
            },
            progressPhotos: {
                orderBy: { capturedAt: 'desc' },
                take: 1,
                select: {
                    capturedAt: true,
                },
            },
            favoriteExercises: {
                select: { exerciseKey: true },
            },
            bodyScanSessions: {
                orderBy: { scannedAt: 'desc' },
                take: 1,
                select: { scannedAt: true },
            },
        },
    });

    if (!profile) {
        return { v: SUMMARY_VERSION, u: now };
    }

    const summary: ProfileAiSummary = {
        v: SUMMARY_VERSION,
        u: now,
    };

    // === PROFILE ===
    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
    if (fullName) summary.n = fullName;
    if (profile.timezone) summary.tz = profile.timezone;

    const goals = profile.goals as string[] | null;
    if (goals && Array.isArray(goals) && goals.length > 0) {
        summary.g = goals;
    }
    if (profile.equipment && profile.equipment.length > 0) {
        summary.eq = profile.equipment;
    }

    // === PROGRAM ===
    if (profile.trainingPrograms && profile.trainingPrograms.length > 0) {
        const prg = profile.trainingPrograms[0];
        summary.prg = {};
        if (prg.program?.name) summary.prg.n = prg.program.name;
        if (prg.discipline?.name) summary.prg.d = prg.discipline.name;
        if (prg.programId) summary.prg.id = prg.programId;
        if (prg.currentLevels && typeof prg.currentLevels === 'object') {
            summary.prg.lvl = prg.currentLevels as Record<string, string>;
        }
    }

    // === SESSIONS ===
    if (profile.sessions && profile.sessions.length > 0) {
        const sessions = profile.sessions;
        const done = sessions.filter(s => s.status === 'done').length;
        const skipped = sessions.filter(s => s.status === 'skipped').length;
        const planned = sessions.filter(s => s.status === 'planned').length;
        const inProgress = sessions.filter(s => s.status === 'in_progress').length;

        summary.ses = {
            t: sessions.length,
            c: done,
            s: skipped,
            p: planned,
            ip: inProgress,
        };

        // Last session
        const lastSession = sessions[0];
        if (lastSession) {
            summary.ses.last = {
                d: new Date(lastSession.plannedAt).toISOString().split('T')[0],
                st: lastSession.status,
            };
        }

        // Calculate streak (consecutive done sessions)
        let streak = 0;
        for (const s of sessions) {
            if (s.status === 'done') {
                streak++;
            } else if (s.status === 'skipped') {
                break;
            }
        }
        if (streak > 0) summary.ses.streak = streak;
    }

    // === EXERCISE PROGRESS (all unique exercises) ===
    if (profile.exerciseProgress && profile.exerciseProgress.length > 0) {
        const progressByExercise = new Map<string, typeof profile.exerciseProgress[0]>();
        for (const p of profile.exerciseProgress) {
            if (!progressByExercise.has(p.exerciseKey)) {
                progressByExercise.set(p.exerciseKey, p);
            }
        }

        summary.prog = Array.from(progressByExercise.values()).map(p => ({
            k: p.exerciseKey,
            l: (p.levelResult || p.levelTarget || 'unknown') as string,
            s: p.streakSuccess || 0,
            rpe: p.rpe ? Number(p.rpe) : undefined,
            dt: new Date(p.createdAt).toISOString().split('T')[0],
        }));
    }

    // === ACHIEVEMENTS (all) ===
    if (profile.achievements && profile.achievements.length > 0) {
        summary.ach = profile.achievements.map(a => ({
            t: a.title,
            d: new Date(a.awardedAt).toISOString().split('T')[0],
        }));
    }

    // === METRICS (latest of each type) ===
    if (profile.metrics && profile.metrics.length > 0) {
        const metricsByType = new Map<string, typeof profile.metrics[0]>();
        for (const m of profile.metrics) {
            if (!metricsByType.has(m.metricType)) {
                metricsByType.set(m.metricType, m);
            }
        }

        summary.met = Array.from(metricsByType.values()).map(m => ({
            tp: m.metricType,
            v: Number(m.value),
            u: m.unit || (m.metricType === 'weight' ? 'kg' : 'cm'),
            d: new Date(m.recordedAt).toISOString().split('T')[0],
        }));
    }

    // === PHOTOS ===
    const photosCount = (profile as any)._count?.progressPhotos ?? profile.progressPhotos?.length ?? 0;
    if (photosCount > 0 || profile.progressPhotos?.length) {
        summary.ph = {
            c: photosCount || profile.progressPhotos.length,
        };
        if (profile.progressPhotos[0]) {
            summary.ph.last = new Date(profile.progressPhotos[0].capturedAt).toISOString().split('T')[0];
        }
    }

    // === FAVORITES ===
    if (profile.favoriteExercises && profile.favoriteExercises.length > 0) {
        summary.fav = profile.favoriteExercises.map(f => f.exerciseKey);
    }

    // === BODY SCANS ===
    if (profile.bodyScanSessions && profile.bodyScanSessions.length > 0) {
        summary.bs = {
            c: profile.bodyScanSessions.length,
            last: new Date(profile.bodyScanSessions[0].scannedAt).toISOString().split('T')[0],
        };
    }

    return summary;
}

/**
 * Update profile's AI summary in database.
 * Call this after significant changes (session complete, achievement, etc).
 */
export async function updateProfileSummary(
    prisma: SafePrismaClient,
    profileId: string
): Promise<void> {
    try {
        const summary = await generateProfileSummary(prisma, profileId);

        await prisma.profile.update({
            where: { id: profileId },
            data: {
                aiSummary: summary as any,
                aiSummaryUpdatedAt: new Date(),
            },
        });

        console.log(`[ProfileSummary] Updated AI summary for profile ${profileId}`);
    } catch (error) {
        console.error(`[ProfileSummary] Failed to update summary for ${profileId}:`, error);
    }
}

/**
 * Check if summary needs refresh (older than 5 minutes).
 */
export function needsSummaryRefresh(updatedAt: Date | null | undefined): boolean {
    if (!updatedAt) return true;
    const ageMs = Date.now() - updatedAt.getTime();
    return ageMs > 5 * 60 * 1000; // 5 minutes
}

/**
 * Expand summary back to readable format for AI system prompt.
 * Supports levels: 'minimal' | 'standard' | 'full'
 */
export function expandSummaryForAi(summary: ProfileAiSummary, level: 'minimal' | 'standard' | 'full' = 'standard'): string {
    const lines: string[] = [];

    // === MINIMAL (Always included) ===
    if (summary.n) lines.push(`Имя: ${summary.n}`);
    if (summary.tz) lines.push(`Часовой пояс: ${summary.tz}`);
    if (summary.prg) {
        const parts = [];
        if (summary.prg.n) parts.push(summary.prg.n);
        if (summary.prg.d) parts.push(summary.prg.d);
        if (parts.length) lines.push(`Программа: ${parts.join(', ')}`);
    }
    if (summary.ses?.streak) lines.push(`Серия: ${summary.ses.streak} дней подряд`);

    if (level === 'minimal') return lines.join('\n');

    // === STANDARD (Default context) ===
    if (summary.g?.length) lines.push(`Цели: ${summary.g.join(', ')}`);
    if (summary.eq?.length) lines.push(`Оборудование: ${summary.eq.join(', ')}`);

    if (summary.prg?.lvl) {
        const levels = Object.entries(summary.prg.lvl)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ');
        lines.push(`Уровни: ${levels}`);
    }

    if (summary.ses) {
        lines.push(`Тренировок: ${summary.ses.t} (вып: ${summary.ses.c}, проп: ${summary.ses.s})`);
        if (summary.ses.last) {
            lines.push(`Последняя: ${summary.ses.last.d} (${summary.ses.last.st})`);
        }
    }

    if (summary.prog?.length) {
        // In standard mode, show only top 5 recent exercises
        const progress = summary.prog
            .slice(0, 5)
            .map(p => `${p.k}:${p.l}`)
            .join(', ');
        lines.push(`Прогресс (недавний): ${progress}`);
    }

    if (level === 'standard') return lines.join('\n');

    // === FULL (Stats, Report, Analysis) ===
    if (summary.prog?.length && summary.prog.length > 5) {
        // Show remaining exercises
        const progress = summary.prog
            .slice(5)
            .map(p => `${p.k}:${p.l}${p.s > 0 ? `(серия ${p.s})` : ''}`)
            .join(', ');
        lines.push(`Остальной прогресс: ${progress}`);
    }

    if (summary.ach?.length) {
        lines.push(`Достижений: ${summary.ach.length}`);
        const recent = summary.ach.slice(0, 5).map(a => a.t).join(', ');
        lines.push(`Последние: ${recent}`);
    }

    if (summary.met?.length) {
        const metrics = summary.met.map(m => `${m.tp}: ${m.v} ${m.u}`).join(', ');
        lines.push(`Измерения: ${metrics}`);
    }

    if (summary.ph?.c) {
        lines.push(`Фото прогресса: ${summary.ph.c}${summary.ph.last ? ` (последнее: ${summary.ph.last})` : ''}`);
    }

    if (summary.fav?.length) {
        lines.push(`Избранные: ${summary.fav.join(', ')}`);
    }

    if (summary.bs?.c) {
        lines.push(`Сканирований тела: ${summary.bs.c} (последнее: ${summary.bs.last})`);
    }

    return lines.join('\n');
}
