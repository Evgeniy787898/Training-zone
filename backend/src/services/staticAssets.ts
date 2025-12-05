import crypto from 'node:crypto';
import { parsePositiveNumberWithFallback } from '../utils/envParsers.js';

type ExerciseLevelImageSlot = 1 | 2 | 3;

const MEDIA_BASE_PATH = '/api/media';

const normalizeBaseUrl = (value?: string | null): string | null => {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed.replace(/\/+$/u, '');
};

const cdnBaseUrl = normalizeBaseUrl(process.env.MEDIA_CDN_BASE_URL);
const fallbackBaseUrl = normalizeBaseUrl(process.env.MEDIA_BASE_URL);
const signingSecret = (process.env.MEDIA_CDN_SIGNING_SECRET || '').trim();
const signatureParam = (process.env.MEDIA_CDN_SIGNING_PARAM || 'token').trim() || 'token';
const signatureExpiryParam = (process.env.MEDIA_CDN_EXPIRES_PARAM || 'expires').trim() || 'expires';
const signatureTtlSeconds = parsePositiveNumberWithFallback(process.env.MEDIA_CDN_SIGNATURE_TTL_SECONDS, 3600);
const versionParam = (process.env.MEDIA_CDN_VERSION_PARAM || 'v').trim() || 'v';

const absoluteUrlPattern = /^(https?:)?\/\//i;

const applyBaseUrl = (path: string): string => {
    const base = cdnBaseUrl || fallbackBaseUrl;
    if (!base) {
        return path;
    }
    return `${base}${path}`;
};

const appendQueryParam = (url: string, key: string, value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
};

const signUrlIfNeeded = (url: string): string => {
    if (!signingSecret) {
        return url;
    }
    const expires = Math.floor(Date.now() / 1000) + signatureTtlSeconds;
    const payload = `${url}|${expires}`;
    const signature = crypto.createHmac('sha256', signingSecret).update(payload).digest('hex');
    const withExpiry = appendQueryParam(url, signatureExpiryParam, expires);
    return appendQueryParam(withExpiry, signatureParam, signature);
};

const normalizeVersionValue = (value: unknown): number | null => {
    if (value instanceof Date) {
        return value.getTime();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.floor(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const numeric = Number(trimmed);
        if (Number.isFinite(numeric)) {
            return Math.floor(numeric);
        }
        const parsed = Date.parse(trimmed);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return null;
};

type ExerciseLevelImageOptions = {
    exerciseKey: string;
    levelCode: string;
    slot: ExerciseLevelImageSlot;
    updatedAt?: Date | string | number | null;
};

export const buildExerciseLevelImageUrl = ({
    exerciseKey,
    levelCode,
    slot,
    updatedAt,
}: ExerciseLevelImageOptions): string | null => {
    if (!exerciseKey || !levelCode) {
        return null;
    }
    const normalizedSlot = Number(slot);
    if (![1, 2, 3].includes(normalizedSlot)) {
        return null;
    }

    const encodedKey = encodeURIComponent(exerciseKey.trim());
    const encodedLevel = encodeURIComponent(levelCode.trim());
    const basePath = `${MEDIA_BASE_PATH}/exercise-levels/${encodedKey}/${encodedLevel}/${normalizedSlot}`;
    const version = normalizeVersionValue(updatedAt);

    let url = applyBaseUrl(basePath);
    url = appendQueryParam(url, versionParam, version);
    return signUrlIfNeeded(url);
};

export const rewriteStoredAssetReference = (value: unknown): string | null => {
    if (!value || typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed.startsWith('data:') || absoluteUrlPattern.test(trimmed) || trimmed.startsWith('blob:')) {
        return trimmed;
    }
    if (trimmed.startsWith('/')) {
        return applyBaseUrl(trimmed);
    }
    return applyBaseUrl(`/${trimmed}`);
};

export const mediaAssetConfig = Object.freeze({
    basePath: MEDIA_BASE_PATH,
    cdnBaseUrl,
    fallbackBaseUrl,
    versionParam,
    signatureParam: signingSecret ? signatureParam : null,
    signatureExpiryParam: signingSecret ? signatureExpiryParam : null,
});
