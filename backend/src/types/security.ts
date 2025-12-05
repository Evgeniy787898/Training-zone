import type { JwtPayload } from 'jsonwebtoken';

export type DirectiveMap = Record<string, string[]>;

export type CsrfProtectionOptions = {
    ignoredPaths?: Array<string | RegExp>;
    headerNames?: string[];
};

export type CsrfTokenDetails = {
    token: string;
    issuedAt: number;
    expiresAt: number;
    contextHash: string;
    version: string;
};

export type VerifyCsrfOptions = {
    profileId?: string | null;
};

export type VerifyCsrfResult =
    | { valid: true; details: CsrfTokenDetails }
    | { valid: false; reason: 'missing' | 'expired' | 'mismatch' | 'invalid' | 'tampered' };

export type VerifiedAuthTokenPayload = JwtPayload & {
    jti: string;
    profileId: string;
    telegramId?: string | number | null;
};

export type TokenValidationFailureReason = 'missing' | 'invalid' | 'expired' | 'revoked';

export type TokenValidationResult =
    | { valid: true; payload: VerifiedAuthTokenPayload; token: string }
    | { valid: false; reason: TokenValidationFailureReason; error?: Error; token?: string };

export type IssueAuthTokenClaims = {
    profileId: string;
    telegramId?: string | number | bigint | null;
} & Record<string, unknown>;
