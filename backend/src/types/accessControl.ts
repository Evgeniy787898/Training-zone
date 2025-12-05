import type { Request } from 'express';

export type RequestSnapshot = {
    method?: string;
    path?: string;
    ip?: string;
    userAgent?: string;
};

export type OwnershipCheckContext = {
    resource: string;
    resourceId?: string;
    action?: string;
    traceId?: string;
    request?: Request | RequestSnapshot | null;
    message?: string;
};

export type OwnershipViolationDetails = OwnershipCheckContext & {
    expectedProfileId: string;
    ownerProfileId: string | null;
    normalizedOwnerProfileId: string | null;
};

export type OwnershipAssertionOptions = OwnershipCheckContext;
