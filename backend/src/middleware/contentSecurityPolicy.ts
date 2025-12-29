import { Request, Response, NextFunction } from 'express';
import type { DirectiveMap } from '../types/security.js';

type Mode = 'append' | 'override';

interface ContentSecurityPolicyOptions {
  directives?: DirectiveMap;
  reportOnly?: boolean;
  mode?: Mode;
}

const TELEGRAM_DOMAINS = [
  'https://web.telegram.org',
  'https://webk.telegram.org',
  'https://webz.telegram.org',
  'https://telegram.org',
  'https://*.telegram.org',
  'https://tg.dev',
];

const SUPABASE_DOMAINS = [
  'https://*.supabase.co',
];

const NGROK_DOMAINS = [
  'https://*.ngrok-free.dev',
  'https://*.ngrok.io',
  'wss://*.ngrok-free.dev',
  'wss://*.ngrok.io',
];

const DEFAULT_DIRECTIVES: DirectiveMap = {
  'default-src': ["'self'", ...NGROK_DOMAINS],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'self'", ...TELEGRAM_DOMAINS, ...NGROK_DOMAINS],
  'frame-src': ["'self'", ...TELEGRAM_DOMAINS, ...NGROK_DOMAINS],
  'connect-src': ["'self'", ...TELEGRAM_DOMAINS, ...SUPABASE_DOMAINS, ...NGROK_DOMAINS],
  'script-src': ["'self'", "'unsafe-inline'", ...TELEGRAM_DOMAINS, ...NGROK_DOMAINS],
  'style-src': ["'self'", "'unsafe-inline'", ...TELEGRAM_DOMAINS, ...NGROK_DOMAINS],
  'img-src': ["'self'", 'data:', 'blob:', ...TELEGRAM_DOMAINS, ...SUPABASE_DOMAINS, ...NGROK_DOMAINS],
  'font-src': ["'self'", 'https:', 'data:', ...NGROK_DOMAINS],
  'manifest-src': ["'self'", ...NGROK_DOMAINS],
  'worker-src': ["'self'", 'blob:', ...NGROK_DOMAINS],
  'media-src': ["'self'", 'blob:', ...TELEGRAM_DOMAINS, ...NGROK_DOMAINS],
  'form-action': ["'self'", ...NGROK_DOMAINS],
  'upgrade-insecure-requests': [],
};

const parseDirectiveValues = (segment: string): [string, string[]] | null => {
  const trimmed = segment.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  if (!parts.length) {
    return null;
  }

  const [directive, ...values] = parts;
  return [directive, values];
};

const parseDirectivesFromEnv = (raw: string | undefined): DirectiveMap => {
  if (!raw) {
    return {};
  }

  const result: DirectiveMap = {};
  const normalized = raw
    .split(/;|\n/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of normalized) {
    const parsed = parseDirectiveValues(segment);
    if (!parsed) {
      continue;
    }
    const [directive, values] = parsed;
    result[directive] = values;
  }

  return result;
};

const mergeDirectives = (base: DirectiveMap, overrides: DirectiveMap, mode: Mode): DirectiveMap => {
  if (mode === 'override') {
    return { ...overrides };
  }

  const merged: DirectiveMap = {};
  const allKeys = new Set([...Object.keys(base), ...Object.keys(overrides)]);
  for (const key of allKeys) {
    const baseValues = base[key] ?? [];
    const overrideValues = overrides[key];
    if (!overrideValues) {
      merged[key] = baseValues;
      continue;
    }

    if (!overrideValues.length) {
      merged[key] = [];
      continue;
    }

    const unique = new Set([...baseValues, ...overrideValues]);
    merged[key] = Array.from(unique);
  }

  return merged;
};

const buildHeaderValue = (directives: DirectiveMap): string => {
  return Object.entries(directives)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([directive, values]) => {
      if (!values || values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
};

export const createContentSecurityPolicyMiddleware = (
  options: ContentSecurityPolicyOptions = {},
) => {
  const envDirectives = parseDirectivesFromEnv(process.env.CSP_DIRECTIVES);
  const mode: Mode = (process.env.CSP_MODE as Mode) || options.mode || 'append';
  const reportOnly =
    typeof options.reportOnly === 'boolean'
      ? options.reportOnly
      : process.env.CSP_REPORT_ONLY === 'true';

  const directives = mergeDirectives(
    options.directives ?? DEFAULT_DIRECTIVES,
    envDirectives,
    mode,
  );

  const headerValue = buildHeaderValue(directives);
  const headerName = reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader(headerName, headerValue);
    next();
  };
};

