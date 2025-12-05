import { Prisma, PrismaClient } from '@prisma/client';
import type { SafePrismaClient, UnsafePrismaMethod } from '../../types/prisma.js';

const UNSAFE_METHODS: UnsafePrismaMethod[] = [
    '$executeRawUnsafe',
    '$queryRawUnsafe',
    '$executeRaw',
    '$queryRaw',
];

const SAFE_VIEW_REFRESH = [
    /^REFRESH MATERIALIZED VIEW(?: CONCURRENTLY)?\s+session_volume_mv$/i,
    /^REFRESH MATERIALIZED VIEW(?: CONCURRENTLY)?\s+profile_rpe_distribution_mv$/i,
    /^REFRESH MATERIALIZED VIEW(?: CONCURRENTLY)?\s+profile_summary_mv$/i,
];

const logBlockedAttempt = (method: UnsafePrismaMethod, args: unknown[]) => {
    try {
        const preview = typeof args[0] === 'string' ? args[0].slice(0, 120) : '';
        console.error(`[security] Blocked attempt to use Prisma.${method}(). Preview: ${preview}`);
    } catch {
        console.error(`[security] Blocked attempt to use Prisma.${method}()`);
    }
};

const isPrismaSql = (value: unknown): value is Prisma.Sql => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    return 'sql' in value && 'values' in value;
};

const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

const isAllowedUnsafeQuery = (args: unknown[]): boolean => {
    if (!args.length || typeof args[0] !== 'string') {
        return false;
    }
    const statement = normalizeSql(args[0]);
    return SAFE_VIEW_REFRESH.some((pattern) => pattern.test(statement));
};

export const hardenPrismaAgainstSqlInjection = <T extends PrismaClient>(client: T): SafePrismaClient => {
    for (const method of UNSAFE_METHODS) {
        const original = (client as any)[method];
        if (typeof original !== 'function') {
            continue;
        }

        Object.defineProperty(client, method, {
            value: (...args: unknown[]) => {
                const isSafeCall =
                    (method === '$executeRaw' || method === '$queryRaw')
                        ? isPrismaSql(args[0])
                        : isAllowedUnsafeQuery(args);

                if (isSafeCall) {
                    return original.apply(client, args);
                }

                logBlockedAttempt(method, args);
                throw new Error(`Prisma ${method} is disabled to prevent SQL injection`);
            },
            writable: false,
        });
    }

    return client as unknown as SafePrismaClient;
};
