import 'express-serve-static-core';
import type { PrismaProfile, SafePrismaClient } from '../types/prisma.js';
import type { VerifiedAuthTokenPayload } from '../types/security.js';
import type { DependencyContainer } from '../services/container.js';

declare module 'express-serve-static-core' {
    interface Request {
        validated?: {
            body?: unknown;
            query?: unknown;
            params?: unknown;
            headers?: unknown;
        };
        prisma?: SafePrismaClient;
        traceId?: string;
        profile?: PrismaProfile;
        profileId?: string;
        authTokenPayload?: VerifiedAuthTokenPayload;
        telegramId?: string | number;
        telegramUser?: unknown;
        container?: DependencyContainer;
        timeoutSignal?: AbortSignal;
        hasTimedOut?: boolean;
    }
}
