import { RequestHandler } from 'express';
import { urlValidationLimits } from '../config/constants.js';
import { isPlainObject } from '../utils/object.js';

const MAX_SEGMENT_LENGTH = urlValidationLimits.maxParamLength;
const MAX_QUERY_VALUE_LENGTH = urlValidationLimits.maxQueryValueLength;

const SAFE_SEGMENT_REGEX = /^[\p{L}\p{N}\-._~:@$!*',();/]+$/u;
const SAFE_QUERY_REGEX = /^[\p{L}\p{N}\s\-._~:@$!*',();/?&=+%#\[\]]+$/u;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g;

const sanitizeStringValue = (value: string): string => {
    let sanitized = value;
    try {
        sanitized = sanitized.normalize('NFKC');
    } catch {
        // ignore normalization errors
    }

    sanitized = sanitized.replace(/\r\n?/g, '\n');
    sanitized = sanitized.replace(CONTROL_CHARACTERS, '');
    sanitized = sanitized.replace(ZERO_WIDTH_CHARACTERS, '');

    return sanitized.trim();
};

const validateString = (value: string, context: 'param' | 'query', path: string): string => {
    const sanitized = sanitizeStringValue(value);
    const lengthLimit = context === 'param' ? MAX_SEGMENT_LENGTH : MAX_QUERY_VALUE_LENGTH;

    if (sanitized.length > lengthLimit) {
        throw new Error(`value_too_long:${path}`);
    }

    const regex = context === 'param' ? SAFE_SEGMENT_REGEX : SAFE_QUERY_REGEX;
    if (!regex.test(sanitized)) {
        throw new Error(`value_contains_forbidden_symbols:${path}`);
    }

    return sanitized;
};

const normalizeValue = (value: unknown, context: 'param' | 'query', path: string): unknown => {
    if (typeof value === 'string') {
        return validateString(value, context, path);
    }

    if (Array.isArray(value)) {
        return value.map((entry, index) => normalizeValue(entry, context, `${path}[${index}]`));
    }

    if (isPlainObject(value)) {
        const result: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(value)) {
            result[key] = normalizeValue(nested, context, `${path}.${key}`);
        }
        return result;
    }

    return value;
};

export const createUrlInputValidationMiddleware = (): RequestHandler => {
    return (req, res, next) => {
        try {
            if (req.params && Object.keys(req.params).length > 0) {
                req.params = normalizeValue(req.params, 'param', 'params') as any;
            }
            if (req.query && Object.keys(req.query).length > 0) {
                req.query = normalizeValue(req.query, 'query', 'query') as any;
            }
            return next();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'invalid_url_input';
            const [code, path] = message.includes(':') ? message.split(':') : [message, 'unknown'];

            console.warn('[security] Blocked request due to invalid URL input', {
                path,
                code,
                url: req.originalUrl,
                method: req.method,
                traceId: (req as any).traceId ?? null,
            });

            return res.status(400).json({
                error: 'invalid_url_input',
                message: 'Некорректные параметры пути или строки запроса',
                details: { path, code },
            });
        }
    };
};
