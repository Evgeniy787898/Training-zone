import { PrismaClient } from '@prisma/client';
import { isPlainObject } from '../utils/object.js';

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g;

const CONTROL_KEYS = new Set([
  'where',
  'select',
  'include',
  'orderBy',
  'cursor',
  'take',
  'skip',
  'distinct',
  'groupBy',
  'having',
  'search',
]);

const ALWAYS_SANITIZE_KEYS = new Set([
  'data',
  'create',
  'update',
  'upsert',
  'createMany',
  'updateMany',
  'connectOrCreate',
  'set',
  'push',
]);

export const sanitizeStringValue = (value: string): string => {
  if (typeof value !== 'string') {
    return value;
  }

  let sanitized = value;

  try {
    sanitized = sanitized.normalize('NFKC');
  } catch {
    // If normalization fails we keep the original sequence
  }

  sanitized = sanitized.replace(/\r\n?/g, '\n');
  sanitized = sanitized.replace(CONTROL_CHARACTERS, '');
  sanitized = sanitized.replace(ZERO_WIDTH_CHARACTERS, '');

  const trimmed = sanitized.trim();
  return trimmed;
};

const sanitizeWriteValue = (value: any, allowStrings: boolean): any => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return allowStrings ? sanitizeStringValue(value) : value;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = sanitizeWriteValue(value[index], allowStrings);
    }
    return value;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  for (const [key, nested] of Object.entries(value)) {
    const shouldAllowStrings =
      ALWAYS_SANITIZE_KEYS.has(key) || (allowStrings && !CONTROL_KEYS.has(key));
    value[key] = sanitizeWriteValue(nested, shouldAllowStrings);
  }

  return value;
};

const WRITE_ACTIONS = new Set(['create', 'update', 'updateMany', 'createMany', 'upsert']);

export const applyStringSanitization = (prisma: PrismaClient) => {
  prisma.$use(async (params, next) => {
    if (!WRITE_ACTIONS.has(params.action)) {
      return next(params);
    }

    const args = params.args ?? {};

    if (args.data) {
      sanitizeWriteValue(args.data, true);
    }

    if (params.action === 'upsert') {
      if (args.create) {
        sanitizeWriteValue(args.create, true);
      }
      if (args.update) {
        sanitizeWriteValue(args.update, true);
      }
    }

    return next(params);
  });
};

