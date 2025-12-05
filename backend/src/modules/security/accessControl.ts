import type { Request } from 'express';
import type {
    OwnershipAssertionOptions,
    OwnershipCheckContext,
    OwnershipViolationDetails,
    RequestSnapshot,
} from '../../types/accessControl.js';
import type { AccessDeniedErrorShape } from '../../types/exceptions.js';

export class AccessDeniedError extends Error implements AccessDeniedErrorShape {
    override name: 'AccessDeniedError';
    readonly status: 403 = 403;
    readonly code: 'forbidden' = 'forbidden';
    readonly details: OwnershipViolationDetails;

    constructor(message: string, details: OwnershipViolationDetails) {
        super(message);
        this.name = 'AccessDeniedError';
        this.details = details;
    }
}

const snapshotRequest = (request?: Request | RequestSnapshot | null): RequestSnapshot | undefined => {
    if (!request) {
        return undefined;
    }

    if ('get' in request && typeof (request as any).get === 'function') {
        const expressRequest = request as Request;
        const originalUrl = (expressRequest as any).originalUrl;
        return {
            method: expressRequest.method,
            path: typeof originalUrl === 'string' ? originalUrl : expressRequest.path,
            ip: expressRequest.ip,
            userAgent: expressRequest.get('user-agent') || undefined,
        };
    }

    const snapshot: RequestSnapshot = {};
    if (request.method) snapshot.method = request.method;
    if (request.path) snapshot.path = request.path;
    if (request.ip) snapshot.ip = request.ip;
    if ('userAgent' in request && request.userAgent) {
        snapshot.userAgent = request.userAgent;
    }
    return snapshot;
};

const normalizeProfileId = (value: string | null | undefined): string | null => {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const logOwnershipViolation = (details: OwnershipViolationDetails) => {
    const { resource, resourceId, action, traceId, request, expectedProfileId, normalizedOwnerProfileId } = details;
    const snapshot = snapshotRequest(request);
    console.warn('[security] Access denied: resource ownership mismatch', {
        resource,
        resourceId,
        action: action || 'access',
        traceId,
        expectedProfileId,
        ownerProfileId: normalizedOwnerProfileId,
        request: snapshot,
    });
};

export function assertProfileOwnership(
    ownerProfileId: string | null | undefined,
    profileId: string,
    options: OwnershipAssertionOptions,
): void {
    const normalizedOwnerProfileId = normalizeProfileId(ownerProfileId);
    const normalizedProfileId = normalizeProfileId(profileId);

    const violationDetails: OwnershipViolationDetails = {
        ...options,
        expectedProfileId: normalizedProfileId || profileId,
        ownerProfileId: ownerProfileId ?? null,
        normalizedOwnerProfileId,
    };

    if (!normalizedProfileId) {
        logOwnershipViolation(violationDetails);
        throw new AccessDeniedError(options.message || 'Профиль пользователя не распознан', violationDetails);
    }

    if (!normalizedOwnerProfileId) {
        logOwnershipViolation(violationDetails);
        throw new AccessDeniedError(options.message || 'Ресурс не связан с профилем пользователя', violationDetails);
    }

    if (normalizedOwnerProfileId !== normalizedProfileId) {
        logOwnershipViolation(violationDetails);
        throw new AccessDeniedError(options.message || 'Ресурс принадлежит другому профилю', violationDetails);
    }
}

export function ensureOwnedByProfile<T extends { profileId?: string | null }>(
    record: T,
    profileId: string,
    options: OwnershipAssertionOptions,
): T {
    assertProfileOwnership(record?.profileId ?? null, profileId, options);
    return record;
}

export const isAccessDeniedError = (error: unknown): error is AccessDeniedError => error instanceof AccessDeniedError;

