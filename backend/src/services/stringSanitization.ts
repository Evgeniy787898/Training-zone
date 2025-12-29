import { PrismaClient } from '@prisma/client';
import { isPlainObject } from '../utils/object.js';

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g;

// XSS Protection patterns
const SCRIPT_TAG_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_PATTERN = /\s*on\w+\s*=\s*["'][^"']*["']/gi;
const JAVASCRIPT_URL_PATTERN = /javascript\s*:/gi;
const DATA_URL_PATTERN = /data\s*:\s*text\/html/gi;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const STYLE_TAG_PATTERN = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi;
const IFRAME_TAG_PATTERN = /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi;
const OBJECT_TAG_PATTERN = /<object\b[^>]*>[\s\S]*?<\/object>/gi;
const EMBED_TAG_PATTERN = /<embed\b[^>]*>/gi;

// HTML entities for escaping
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

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

/**
 * Escape HTML special characters to prevent XSS
 */
export const escapeHtml = (text: string): string => {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
};

/**
 * Strip dangerous HTML/script content for XSS protection
 */
export const stripDangerousContent = (value: string): string => {
  let cleaned = value;

  // Remove script tags and content
  cleaned = cleaned.replace(SCRIPT_TAG_PATTERN, '');

  // Remove style tags
  cleaned = cleaned.replace(STYLE_TAG_PATTERN, '');

  // Remove iframe, object, embed
  cleaned = cleaned.replace(IFRAME_TAG_PATTERN, '');
  cleaned = cleaned.replace(OBJECT_TAG_PATTERN, '');
  cleaned = cleaned.replace(EMBED_TAG_PATTERN, '');

  // Remove HTML comments (can hide malicious code)
  cleaned = cleaned.replace(HTML_COMMENT_PATTERN, '');

  // Remove event handlers (onclick, onerror, etc.)
  cleaned = cleaned.replace(EVENT_HANDLER_PATTERN, '');

  // Remove javascript: URLs
  cleaned = cleaned.replace(JAVASCRIPT_URL_PATTERN, '');

  // Remove data:text/html URLs (can contain scripts)
  cleaned = cleaned.replace(DATA_URL_PATTERN, '');

  return cleaned;
};

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

  // XSS Protection: strip dangerous HTML content
  sanitized = stripDangerousContent(sanitized);

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

