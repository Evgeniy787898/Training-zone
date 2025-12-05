import { PrismaClient } from '@prisma/client';
import { isPlainObject } from '../../utils/object.js';

const WRITE_ACTIONS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert']);

const TAG_PATTERN = /<\/?\s*(script|iframe|object|embed|link|meta|style|svg|math|form|input|button|textarea|select)[^>]*>/i;
const EVENT_HANDLER_PATTERN = /\son[a-z]+\s*=\s*("|').*?\1/gi;
const JS_PROTOCOL_PATTERN = /(javascript:|data:text\/html|vbscript:)/i;

const AMPERSAND_NEEDS_ENCODING = /&(?![a-z0-9#]+;)/gi;
const HTML_ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
    '/': '&#47;',
};

const escapeHtml = (value: string): string =>
    value
        .replace(AMPERSAND_NEEDS_ENCODING, '&amp;')
        .replace(/[<>"]|['`/]/g, (char) => HTML_ESCAPE_MAP[char] ?? char);

const containsDangerousMarkup = (value: string): boolean => {
    if (!value) {
        return false;
    }

    if (TAG_PATTERN.test(value)) {
        return true;
    }

    if (JS_PROTOCOL_PATTERN.test(value)) {
        return true;
    }

    EVENT_HANDLER_PATTERN.lastIndex = 0;
    return EVENT_HANDLER_PATTERN.test(value);
};

const guardAndEscapeValue = (value: any): any => {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'string') {
        if (containsDangerousMarkup(value)) {
            throw Object.assign(new Error('Потенциальная XSS-инъекция обнаружена'), {
                status: 400,
                code: 'xss_detected',
            });
        }
        if (!/[&<>"'`/]/.test(value)) {
            return value;
        }
        return escapeHtml(value);
    }

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            value[index] = guardAndEscapeValue(value[index]);
        }
        return value;
    }

    if (!isPlainObject(value)) {
        return value;
    }

    for (const [key, nested] of Object.entries(value)) {
        value[key] = guardAndEscapeValue(nested);
    }

    return value;
};

export const applyXssProtection = (prisma: PrismaClient) => {
    prisma.$use(async (params, next) => {
        if (!WRITE_ACTIONS.has(params.action)) {
            return next(params);
        }

        const args = params.args ?? {};

        if (args.data) {
            guardAndEscapeValue(args.data);
        }

        if (params.action === 'upsert') {
            if (args.create) {
                guardAndEscapeValue(args.create);
            }
            if (args.update) {
                guardAndEscapeValue(args.update);
            }
        }

        return next(params);
    });
};

