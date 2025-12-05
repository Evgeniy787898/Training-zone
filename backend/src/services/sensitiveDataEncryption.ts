import { PrismaClient } from '@prisma/client';
import { decryptFromBase64, encryptToBase64 } from '../modules/security/encryption.js';
import { isPlainObject } from '../utils/object.js';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];
const ENCRYPTED_STRING_PREFIX = 'enc.v1:';
const JSON_ENVELOPE_KEY = '__tzn_enc__';
const JSON_ENVELOPE_VERSION = 'v1';
const JSON_ENVELOPE_PAYLOAD = 'payload';

const sensitiveConfig: Record<string, { string?: readonly string[]; json?: readonly string[] }> = {
    Profile: {
        string: ['firstName', 'lastName'],
        json: ['goals', 'preferences'],
    },
    TrainingSession: {
        string: ['notes', 'comment'],
    },
    ExerciseProgress: {
        string: ['notes', 'decision'],
    },
    AssistantNote: {
        string: ['title', 'content'],
        json: ['metadata'],
    },
    DialogState: {
        json: ['statePayload'],
    },
    DialogEvent: {
        json: ['payload'],
    },
    UserTrainingProgram: {
        json: ['initialLevels', 'currentLevels'],
    },
};

type JsonEnvelope = {
    [JSON_ENVELOPE_KEY]: typeof JSON_ENVELOPE_VERSION;
    [JSON_ENVELOPE_PAYLOAD]: string;
};

const isPrismaNullValue = (value: unknown): boolean => {
    if (value === null || value === undefined) {
        return value === null;
    }
    if (typeof value !== 'object') {
        return false;
    }
    const ctorName = (value as any)?.constructor?.name;
    return ctorName === 'JsonNull' || ctorName === 'DbNull' || ctorName === 'AnyNull';
};

const ensureEncryptedString = (value: string): string => {
    if (typeof value !== 'string') {
        return value;
    }
    if (!value.length) {
        // Still encrypt empty strings to avoid leaking state
        return `${ENCRYPTED_STRING_PREFIX}${encryptToBase64(value)}`;
    }
    if (value.startsWith(ENCRYPTED_STRING_PREFIX)) {
        return value;
    }
    return `${ENCRYPTED_STRING_PREFIX}${encryptToBase64(value)}`;
};

const encryptStringField = (input: any): any => {
    if (input === null || input === undefined) {
        return input;
    }
    if (typeof input === 'string') {
        return ensureEncryptedString(input);
    }
    if (isPlainObject(input) && 'set' in input) {
        return { set: encryptStringField((input as any).set) };
    }
    return input;
};

const isEnvelope = (value: unknown): value is JsonEnvelope => {
    return (
        isPlainObject(value) &&
        JSON_ENVELOPE_KEY in value &&
        value[JSON_ENVELOPE_KEY] === JSON_ENVELOPE_VERSION &&
        typeof value[JSON_ENVELOPE_PAYLOAD] === 'string'
    );
};

const wrapEncryptedJson = (value: JsonValue): JsonValue => {
    if (isPrismaNullValue(value)) {
        return value;
    }
    if (isEnvelope(value)) {
        return value;
    }

    const serialized = JSON.stringify(value);
    return {
        [JSON_ENVELOPE_KEY]: JSON_ENVELOPE_VERSION,
        [JSON_ENVELOPE_PAYLOAD]: encryptToBase64(serialized),
    } satisfies JsonEnvelope;
};

const encryptJsonField = (input: any): any => {
    if (input === undefined) {
        return input;
    }
    if (isPrismaNullValue(input)) {
        return input;
    }
    if (isPlainObject(input) && 'set' in input) {
        return { set: encryptJsonField((input as any).set) };
    }
    return wrapEncryptedJson(input as JsonValue);
};

const decryptStringField = (value: string): string => {
    if (typeof value !== 'string') {
        return value;
    }
    if (!value.startsWith(ENCRYPTED_STRING_PREFIX)) {
        return value;
    }
    const payload = value.slice(ENCRYPTED_STRING_PREFIX.length);
    if (!payload) {
        return '';
    }
    try {
        return decryptFromBase64(payload);
    } catch (error) {
        console.error('[security] Failed to decrypt string field:', error);
        return value;
    }
};

const decryptJsonField = (value: any): any => {
    if (!isEnvelope(value)) {
        return value;
    }
    try {
        const decrypted = decryptFromBase64(value[JSON_ENVELOPE_PAYLOAD]);
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('[security] Failed to decrypt JSON field:', error);
        return null;
    }
};

const applyEncryptionToData = (model: string, data: any) => {
    const config = sensitiveConfig[model];
    if (!config || !data) {
        return;
    }

    const processRecord = (record: any) => {
        if (!record || typeof record !== 'object') {
            return;
        }

        if (Array.isArray(record)) {
            record.forEach(processRecord);
            return;
        }

        if (config.string) {
            for (const field of config.string) {
                if (field in record) {
                    record[field] = encryptStringField(record[field]);
                }
            }
        }

        if (config.json) {
            for (const field of config.json) {
                if (field in record) {
                    record[field] = encryptJsonField(record[field]);
                }
            }
        }
    };

    if (Array.isArray(data)) {
        data.forEach(processRecord);
    } else {
        processRecord(data);
    }
};

const decryptDeep = (value: any): any => {
    if (Array.isArray(value)) {
        return value.map((item) => decryptDeep(item));
    }
    if (!value || typeof value !== 'object') {
        if (typeof value === 'string') {
            return decryptStringField(value);
        }
        return value;
    }
    if (value instanceof Date || Buffer.isBuffer(value)) {
        return value;
    }
    if (isEnvelope(value)) {
        return decryptJsonField(value);
    }

    for (const key of Object.keys(value)) {
        const fieldValue = value[key];
        if (typeof fieldValue === 'string') {
            value[key] = decryptStringField(fieldValue);
        } else if (isEnvelope(fieldValue)) {
            value[key] = decryptJsonField(fieldValue);
        } else if (Array.isArray(fieldValue) || (fieldValue && typeof fieldValue === 'object')) {
            value[key] = decryptDeep(fieldValue);
        }
    }

    return value;
};

export const applySensitiveDataEncryption = (prisma: PrismaClient) => {
    prisma.$use(async (params, next) => {
        const model = params.model as string | undefined;
        if (model && sensitiveConfig[model]) {
            switch (params.action) {
                case 'create':
                case 'update':
                case 'updateMany':
                case 'createMany':
                case 'upsert':
                    if (params.args?.data) {
                        applyEncryptionToData(model, params.args.data);
                    }
                    if (params.action === 'upsert') {
                        if (params.args?.create) {
                            applyEncryptionToData(model, params.args.create);
                        }
                        if (params.args?.update) {
                            applyEncryptionToData(model, params.args.update);
                        }
                    }
                    break;
                default:
                    break;
            }
        }

        const result = await next(params);
        return decryptDeep(result);
    });
};

