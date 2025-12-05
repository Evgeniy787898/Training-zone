import crypto from 'crypto';
import { getConfig } from '../../config/configService.js';

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION = 1;

type DerivedKeys = {
    primary: Buffer;
    fallback?: Buffer;
    secrets: { primary: string; fallback?: string | null };
};

let cachedKeys: DerivedKeys | null = null;

const deriveKey = (secret: string): Buffer => {
    if (!secret || typeof secret !== 'string') {
        throw new Error('ENCRYPTION_SECRET must be provided to handle sensitive data');
    }

    const trimmed = secret.trim();
    if (trimmed.length < 16) {
        throw new Error('ENCRYPTION_SECRET must be at least 16 characters long');
    }

    if (trimmed.length === KEY_LENGTH && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
        try {
            const decoded = Buffer.from(trimmed, 'base64');
            if (decoded.length === KEY_LENGTH) {
                return decoded;
            }
        } catch {
            // Fall through to hash-based derivation
        }
    }

    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === KEY_LENGTH * 2) {
        return Buffer.from(trimmed, 'hex');
    }

    return crypto.createHash('sha256').update(trimmed, 'utf8').digest();
};

const getKeys = (): DerivedKeys => {
    const { encryptionSecret, encryptionFallbackSecret } = getConfig().security;

    if (
        cachedKeys &&
        cachedKeys.secrets.primary === encryptionSecret &&
        cachedKeys.secrets.fallback === encryptionFallbackSecret
    ) {
        return cachedKeys;
    }

    if (!encryptionSecret) {
        throw new Error('ENCRYPTION_SECRET environment variable is required for sensitive data encryption');
    }

    cachedKeys = {
        primary: deriveKey(encryptionSecret),
        fallback: encryptionFallbackSecret ? deriveKey(encryptionFallbackSecret) : undefined,
        secrets: { primary: encryptionSecret, fallback: encryptionFallbackSecret },
    };

    return cachedKeys;
};

const buildPayload = (iv: Buffer, authTag: Buffer, ciphertext: Buffer): Buffer => {
    const version = Buffer.from([VERSION]);
    return Buffer.concat([version, iv, authTag, ciphertext]);
};

const parsePayload = (payload: Buffer) => {
    if (payload.length <= 1 + IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new Error('Encrypted payload is too short');
    }

    const version = payload[0];
    if (version !== VERSION) {
        throw new Error(`Unsupported encryption payload version: ${version}`);
    }

    const iv = payload.subarray(1, 1 + IV_LENGTH);
    const authTag = payload.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = payload.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH);

    return { iv, authTag, ciphertext };
};

export const encryptToBase64 = (plainText: string): string => {
    const { primary: key } = getKeys();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return buildPayload(iv, authTag, ciphertext).toString('base64');
};

export const decryptFromBase64 = (payload: string): string => {
    const buffer = Buffer.from(payload, 'base64');
    const { iv, authTag, ciphertext } = parsePayload(buffer);
    const { primary, fallback } = getKeys();

    const tryDecrypt = (key: Buffer) => {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decrypted.toString('utf8');
    };

    try {
        return tryDecrypt(primary);
    } catch (error) {
        if (!fallback) {
            throw error;
        }
        return tryDecrypt(fallback);
    }
};

export const ensureEncryptionConfigured = (): void => {
    getKeys();
};

export const isEncryptionConfigured = (): boolean => {
    try {
        ensureEncryptionConfigured();
        return true;
    } catch {
        return false;
    }
};

