import crypto from 'node:crypto';
import type { Request, Response } from 'express';

const jsonReplacer = (_key: string, value: unknown) => {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
};

const serializePayload = (payload: unknown): Buffer => {
    if (payload === undefined) {
        return Buffer.from('undefined');
    }
    if (payload === null) {
        return Buffer.from('null');
    }
    if (Buffer.isBuffer(payload)) {
        return payload;
    }
    if (typeof payload === 'string') {
        return Buffer.from(payload, 'utf8');
    }
    if (typeof payload === 'object') {
        return Buffer.from(JSON.stringify(payload, jsonReplacer), 'utf8');
    }
    return Buffer.from(String(payload), 'utf8');
};

export const generateEtag = (payload: unknown, options?: { weak?: boolean }): string => {
    const buffer = serializePayload(payload);
    const hash = crypto.createHash('sha256').update(buffer).digest('base64');
    const safeHash = hash.replace(/=+$/u, '').replace(/\+/gu, '-').replace(/\//gu, '_');
    const quoted = `"${safeHash}"`;
    return options?.weak === false ? quoted : `W/${quoted}`;
};

const normalizeEtagValue = (value: string): string => {
    let normalized = value.trim();
    if (normalized.startsWith('W/')) {
        normalized = normalized.slice(2).trim();
    }
    if (normalized.startsWith('"') && normalized.endsWith('"') && normalized.length >= 2) {
        normalized = normalized.slice(1, -1);
    }
    return normalized;
};

const parseIfNoneMatch = (headerValue: string): string[] =>
    headerValue
        .split(',')
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0)
        .map((candidate) => (candidate === '*' ? '*' : normalizeEtagValue(candidate)));

export const maybeRespondWithNotModified = (
    req: Request,
    res: Response,
    payload: unknown,
    options?: { weak?: boolean; etag?: string },
): boolean => {
    const etag = options?.etag ?? generateEtag(payload, { weak: options?.weak });
    res.setHeader('ETag', etag);

    const ifNoneMatchHeader = req.headers['if-none-match'];
    if (!ifNoneMatchHeader) {
        return false;
    }

    const normalizedTarget = normalizeEtagValue(etag);
    const candidates = parseIfNoneMatch(ifNoneMatchHeader);

    const matched = candidates.some((candidate) => candidate === '*' || candidate === normalizedTarget);
    if (matched) {
        res.status(304).end();
        return true;
    }

    return false;
};
