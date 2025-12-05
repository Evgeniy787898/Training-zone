import type { StructuredNotes } from '../types/sessions.js';
import type { TelegramWebAppUser } from '../types/telegram.js';
import { isPlainObject } from './object.js';

export const isRecord = (value: unknown): value is Record<string, unknown> => isPlainObject(value);

export const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

export const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

export const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');

export const isStructuredNotes = (value: unknown): value is StructuredNotes => {
    if (!isRecord(value)) {
        return false;
    }

    const record = value as Record<string, unknown>;
    const { comment, program, timer, results } = record;

    if (comment !== undefined && typeof comment !== 'string') {
        return false;
    }

    if (program !== undefined && program !== null) {
        if (!isRecord(program)) {
            return false;
        }
        const allowedKeys = ['id', 'selectionId', 'disciplineId'] as const;
        for (const key of allowedKeys) {
            const value = (program as Record<string, unknown>)[key];
            if (value !== undefined && value !== null && typeof value !== 'string') {
                return false;
            }
        }
    }

    if (timer !== undefined && timer !== null && !isRecord(timer)) {
        return false;
    }

    if (results !== undefined) {
        if (!Array.isArray(results)) {
            return false;
        }
        if (!results.every((entry) => entry === null || isRecord(entry))) {
            return false;
        }
    }

    return true;
};

export const isTelegramWebAppUser = (value: unknown): value is TelegramWebAppUser => {
    if (!isRecord(value)) {
        return false;
    }
    const id = (value as Record<string, unknown>).id;
    const idIsValid =
        typeof id === 'string' || typeof id === 'number' || (typeof id === 'bigint' && Number.isFinite(Number(id)));
    if (!idIsValid) {
        return false;
    }
    const optionalStringKeys = ['first_name', 'last_name', 'username', 'language_code', 'photo_url'] as const;
    for (const key of optionalStringKeys) {
        const prop = (value as Record<string, unknown>)[key];
        if (prop !== undefined && prop !== null && typeof prop !== 'string') {
            return false;
        }
    }
    return true;
};

export const isCacheScopeEventPayload = <TName extends string = string>(
    value: unknown,
    isValidName?: (name: string) => name is TName,
): value is { name: TName; scopeKey: string; version: number } => {
    if (!isRecord(value)) {
        return false;
    }
    const record = value as Record<string, unknown>;
    if (!isNonEmptyString(record.name)) {
        return false;
    }
    if (isValidName && !isValidName(record.name)) {
        return false;
    }
    if (!isNonEmptyString(record.scopeKey)) {
        return false;
    }
    if (!isFiniteNumber(record.version) || record.version <= 0) {
        return false;
    }
    return true;
};

export const isPrismaError = (
    error: unknown,
): error is { code: string; meta?: { target?: string }; status?: number; message?: string } =>
    Boolean(isRecord(error) && typeof error.code === 'string' && error.code.startsWith('P'));

export const isValidationLibraryError = (
    error: unknown,
): error is { name: 'ValidationError' | 'YupError'; message?: string } =>
    Boolean(
        isRecord(error) &&
            typeof (error as { name?: unknown }).name === 'string' &&
            ((error as { name: string }).name === 'ValidationError' || (error as { name: string }).name === 'YupError'),
    );
