import { Prisma, PrismaClient } from '@prisma/client';
import type { SafePrismaClient } from '../../types/prisma.js';
import { materializedViewConfig } from '../../config/constants.js';

type MaterializedViewKey = keyof typeof materializedViewConfig;

type SessionVolumeRow = {
    session_id: string;
    session_date: Date | null;
    status: string | null;
    total_volume: bigint | number | null;
};

type RpeDistributionRow = {
    bucket_key: string;
    bucket_count: bigint | number | null;
};

type ProfileSummaryRow = {
    profile_id: string;
    total_sessions_30d: bigint | number | null;
    completed_sessions_30d: bigint | number | null;
};

type RefreshState = {
    lastRefreshedAt: number;
    inflight?: Promise<void>;
};

const refreshState = new Map<MaterializedViewKey, RefreshState>();

const getOrCreateState = (key: MaterializedViewKey): RefreshState => {
    const existing = refreshState.get(key);
    if (existing) {
        return existing;
    }
    // Initialize to current time so first request after server start skips refresh.
    // The views already have data from previous refreshes; no need to block first request.
    // This prevents 9+ second timeout on first request to remote Supabase.
    const initial: RefreshState = { lastRefreshedAt: Date.now() };
    refreshState.set(key, initial);
    return initial;
};

const asRawClient = (client: SafePrismaClient): PrismaClient => client as unknown as PrismaClient;

const refreshMaterializedView = async (prisma: SafePrismaClient, key: MaterializedViewKey): Promise<void> => {
    const config = materializedViewConfig[key];
    const state = getOrCreateState(key);
    const now = Date.now();
    if (state.inflight) {
        return state.inflight;
    }
    if (config.refreshIntervalMs > 0 && now - state.lastRefreshedAt < config.refreshIntervalMs) {
        return;
    }

    const refreshPromise = asRawClient(prisma)
        .$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${config.viewName}`)
        .then(() => {
            state.lastRefreshedAt = Date.now();
        })
        .catch((error: unknown) => {
            console.warn(
                JSON.stringify({
                    level: 'warn',
                    event: 'materialized_view_refresh_failed',
                    view: config.viewName,
                    error: error instanceof Error ? error.message : 'unknown_error',
                }),
            );
            throw error;
        })
        .finally(() => {
            state.inflight = undefined;
        });

    state.inflight = refreshPromise;
    return refreshPromise;
};

export type SessionVolumeSummary = {
    sessionId: string;
    sessionDate: Date;
    status: string | null;
    totalVolume: number;
};

export const fetchSessionVolumeSummaries = async (
    prisma: SafePrismaClient,
    profileId: string,
    startDate: Date,
): Promise<SessionVolumeSummary[]> => {
    await refreshMaterializedView(prisma, 'sessionVolume');
    const rows = await asRawClient(prisma).$queryRaw<SessionVolumeRow[]>(Prisma.sql`
        SELECT session_id, session_date, status, total_volume
        FROM session_volume_mv
        WHERE profile_id = ${profileId}::uuid
          AND session_date >= ${startDate}
        ORDER BY session_date ASC
    `);
    return rows.map((row: SessionVolumeRow) => ({
        sessionId: row.session_id,
        sessionDate: row.session_date ?? new Date(),
        status: row.status,
        totalVolume: Number(row.total_volume ?? 0),
    }));
};

export type RpeBucketKey = 'light' | 'moderate' | 'heavy' | 'max';

export type RpeBucketSummary = {
    bucket: RpeBucketKey;
    count: number;
};

const BUCKET_KEYS: RpeBucketKey[] = ['light', 'moderate', 'heavy', 'max'];

export const fetchRpeDistributionBuckets = async (
    prisma: SafePrismaClient,
    profileId: string,
    startDate: Date,
): Promise<Map<RpeBucketKey, number>> => {
    await refreshMaterializedView(prisma, 'rpeDistribution');
    const rows = await asRawClient(prisma).$queryRaw<RpeDistributionRow[]>(Prisma.sql`
        SELECT bucket_key, SUM(entry_count)::bigint AS bucket_count
        FROM profile_rpe_distribution_mv
        WHERE profile_id = ${profileId}::uuid
          AND entry_date >= ${startDate}
        GROUP BY bucket_key
    `);

    const result = new Map<RpeBucketKey, number>();
    for (const row of rows as RpeDistributionRow[]) {
        if (BUCKET_KEYS.includes(row.bucket_key as RpeBucketKey)) {
            result.set(row.bucket_key as RpeBucketKey, Number(row.bucket_count ?? 0));
        }
    }
    return result;
};

export type ProfileAdherenceSummary = {
    totalSessions30d: number;
    completedSessions30d: number;
};

export const fetchProfileAdherenceSummary = async (
    prisma: SafePrismaClient,
    profileId: string,
): Promise<ProfileAdherenceSummary> => {
    await refreshMaterializedView(prisma, 'profileSummary');
    const rows = await asRawClient(prisma).$queryRaw<ProfileSummaryRow[]>(Prisma.sql`
        SELECT total_sessions_30d, completed_sessions_30d
        FROM profile_summary_mv
        WHERE profile_id = ${profileId}::uuid
        LIMIT 1
    `);

    const row = rows[0];
    return {
        totalSessions30d: Number(row?.total_sessions_30d ?? 0),
        completedSessions30d: Number(row?.completed_sessions_30d ?? 0),
    };
};
