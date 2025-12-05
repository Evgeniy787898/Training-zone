import type { OwnershipViolationDetails } from './accessControl.js';

export interface AccessDeniedErrorShape {
    name: 'AccessDeniedError';
    status: 403;
    code: 'forbidden';
    details: OwnershipViolationDetails;
}

export interface PathTraversalErrorShape {
    name: 'PathTraversalError';
    baseDir: string;
    attemptedPath: string;
}

export type KnownExceptionShape = AccessDeniedErrorShape | PathTraversalErrorShape;
