import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

import { findMissingRequiredEnv } from './requiredEnv.js';

// Load .env from project root (parent directory of backend/)
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const baseUrlString = z
  .string()
  .trim()
  .min(1, { message: 'URL value is required' })
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return Boolean(parsed.protocol && parsed.hostname);
    } catch {
      return false;
    }
  }, { message: 'Value must be a valid URL with a protocol (e.g. https://example.com)' });

const httpUrlString = baseUrlString.refine((value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}, { message: 'Value must be an HTTP or HTTPS URL' });

const optionalFromString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }, schema.optional());

const optionalHttpUrlString = optionalFromString(httpUrlString);
const optionalConnectionString = optionalFromString(baseUrlString);
const optionalDelimitedString = optionalFromString(z.string().trim());

const SECRET_ENV_VARS = [
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBAPP_SECRET',
  'ENCRYPTION_SECRET',
  'ENCRYPTION_SECRET_PREVIOUS',
  'JWT_SECRET_KEYS',
  'JWT_SECRET',
  'CSRF_SECRET',
  'CSRF_SECRET_PREVIOUS',
  'AI_ADVISOR_API_TOKEN',
  'GEMINI_API_KEY',
];

const readSecretValue = (name: string): string | undefined => {
  const fileEnvName = `${name}_FILE`;
  const secretFilePath = process.env[fileEnvName];

  if (secretFilePath) {
    try {
      const normalized = path.resolve(secretFilePath);
      const contents = fs.readFileSync(normalized, 'utf8').trim();
      if (contents.length > 0) {
        return contents;
      }
    } catch (error) {
      console.error(`⚠️ Unable to read secret file for ${name}:`, error);
    }
  }

  const directValue = process.env[name];
  return typeof directValue === 'string' ? directValue : undefined;
};

const resolveEnvWithSecrets = (): NodeJS.ProcessEnv => {
  const resolved: NodeJS.ProcessEnv = { ...process.env };
  for (const key of SECRET_ENV_VARS) {
    const value = readSecretValue(key);
    if (typeof value === 'string') {
      resolved[key] = value;
    }
  }
  return resolved;
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    DATABASE_URL: optionalConnectionString,
    DATABASE_POOL_URL: optionalConnectionString,
    DATABASE_DIRECT_URL: optionalConnectionString,
    DIRECT_URL: optionalConnectionString,
    PRISMA_POOL_URL: optionalConnectionString,
    PRISMA_DIRECT_URL: optionalConnectionString,
    PRISMA_RUNTIME_URL: optionalConnectionString,
    SUPABASE_URL: httpUrlString,
    SUPABASE_ANON_KEY: z
      .string()
      .trim()
      .min(10, { message: 'SUPABASE_ANON_KEY must be provided (get it from Supabase settings)' }),
    SUPABASE_SERVICE_KEY: z
      .string()
      .trim()
      .min(10, { message: 'SUPABASE_SERVICE_KEY must be provided (service role key from Supabase)' }),
    TELEGRAM_BOT_TOKEN: z
      .string()
      .trim()
      .regex(/^[0-9]+:[A-Za-z0-9_-]{20,}$/u, {
        message: 'TELEGRAM_BOT_TOKEN must match the "<bot-id>:<token>" pattern',
      }),
    TELEGRAM_WEBAPP_SECRET: z
      .string()
      .trim()
      .min(32, { message: 'TELEGRAM_WEBAPP_SECRET must contain at least 32 characters' }),
    TELEGRAM_ALLOWED_IDS: optionalDelimitedString,
    TELEGRAM_WEBHOOK_URL: optionalHttpUrlString,
    ENCRYPTION_SECRET: z
      .string()
      .trim()
      .min(16, { message: 'ENCRYPTION_SECRET must contain at least 16 characters' }),
    ENCRYPTION_SECRET_PREVIOUS: z
      .string()
      .trim()
      .min(16, { message: 'ENCRYPTION_SECRET_PREVIOUS must contain at least 16 characters' })
      .optional(),
    JWT_SECRET_KEYS: z.string().trim().optional(),
    JWT_SECRET_ACTIVE_ID: z.string().trim().optional(),
    JWT_SECRET_LEGACY_ID: z.string().trim().optional(),
    JWT_SECRET: z.string().trim().optional(),
    CSRF_SECRET: z.string().trim().min(32, { message: 'CSRF_SECRET must contain at least 32 characters' }),
    CSRF_SECRET_PREVIOUS: z
      .string()
      .trim()
      .min(32, { message: 'CSRF_SECRET_PREVIOUS must contain at least 32 characters' })
      .optional(),
    FRONTEND_URL: optionalDelimitedString,
    WEBAPP_URL: optionalHttpUrlString,
    MEDIA_BASE_URL: optionalHttpUrlString,
    MEDIA_CDN_BASE_URL: optionalHttpUrlString,
    GEMINI_API_KEY: z.string().min(1, { message: 'GEMINI_API_KEY is required' }),
  })
  .passthrough()
  .superRefine((env, ctx) => {
    const hasDatabaseConnection = [
      env.DATABASE_URL,
      env.PRISMA_POOL_URL,
      env.PRISMA_RUNTIME_URL,
      env.DATABASE_POOL_URL,
      env.DIRECT_URL,
      env.PRISMA_DIRECT_URL,
      env.DATABASE_DIRECT_URL,
    ].some((value) => typeof value === 'string' && value.length > 0);

    if (!hasDatabaseConnection) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'At least one database connection string (DATABASE_URL / PRISMA_POOL_URL / DIRECT_URL) must be configured',
      });
    }

    const hasJwtRegistry = Boolean(env.JWT_SECRET_KEYS && env.JWT_SECRET_KEYS.length > 0);
    const hasLegacySecret = Boolean(env.JWT_SECRET && env.JWT_SECRET.length > 0);

    let parsedSecretIds: Set<string> | null = null;

    if (!hasJwtRegistry && !hasLegacySecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET_KEYS'],
        message: 'Configure JWT secrets via JWT_SECRET_KEYS or provide a fallback JWT_SECRET',
      });
    }

    if (hasJwtRegistry && env.JWT_SECRET_KEYS) {
      const entries = env.JWT_SECRET_KEYS.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

      if (!entries.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET_KEYS'],
          message: 'JWT_SECRET_KEYS must include at least one "id:secret" pair',
        });
      } else {
        parsedSecretIds = new Set<string>();
        for (const entry of entries) {
          const separatorIndex = entry.indexOf(':');
          if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['JWT_SECRET_KEYS'],
              message: `Invalid JWT secret entry "${entry}". Use the "id:secret" format.`,
            });
            continue;
          }

          const id = entry.slice(0, separatorIndex).trim();
          const secret = entry.slice(separatorIndex + 1).trim();
          if (!id) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['JWT_SECRET_KEYS'],
              message: `Invalid JWT secret entry "${entry}" (missing identifier)`,
            });
          }
          if (secret.length < 16) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['JWT_SECRET_KEYS'],
              message: `JWT secret "${id || entry}" must contain at least 16 characters`,
            });
          }
          if (id) {
            parsedSecretIds.add(id);
          }
        }

        if (parsedSecretIds.size === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET_KEYS'],
            message: 'JWT_SECRET_KEYS must contain at least one valid entry',
          });
        }
      }
    }

    if (env.JWT_SECRET_ACTIVE_ID && parsedSecretIds && !parsedSecretIds.has(env.JWT_SECRET_ACTIVE_ID)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET_ACTIVE_ID'],
        message: `JWT_SECRET_ACTIVE_ID "${env.JWT_SECRET_ACTIVE_ID}" does not exist in JWT_SECRET_KEYS`,
      });
    }

    if (env.JWT_SECRET_LEGACY_ID && parsedSecretIds && !parsedSecretIds.has(env.JWT_SECRET_LEGACY_ID)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET_LEGACY_ID'],
        message: `JWT_SECRET_LEGACY_ID "${env.JWT_SECRET_LEGACY_ID}" does not exist in JWT_SECRET_KEYS`,
      });
    }

    if (env.FRONTEND_URL) {
      const origins = env.FRONTEND_URL.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

      for (const origin of origins) {
        try {
          const parsed = new URL(origin);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Origin must use http(s)');
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['FRONTEND_URL'],
            message: `Invalid FRONTEND_URL origin "${origin}". Provide comma-separated http(s) origins.`,
          });
          break;
        }
      }
    }

    if (env.TELEGRAM_ALLOWED_IDS) {
      const invalidId = env.TELEGRAM_ALLOWED_IDS.split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .find((value) => !/^\d+$/u.test(value));

      if (invalidId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['TELEGRAM_ALLOWED_IDS'],
          message: `TELEGRAM_ALLOWED_IDS must contain numeric ids only, invalid value: ${invalidId}`,
        });
      }
    }
  });

export type EnvironmentConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvironmentConfig | null = null;

const applyEnvFallbacks = (config: EnvironmentConfig): EnvironmentConfig => {
  const normalized: EnvironmentConfig = { ...config };

  const primaryFrontend = normalized.FRONTEND_URL
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)[0];

  if (!normalized.FRONTEND_URL && normalized.WEBAPP_URL) {
    normalized.FRONTEND_URL = normalized.WEBAPP_URL;
  }

  if (!normalized.WEBAPP_URL && primaryFrontend) {
    normalized.WEBAPP_URL = primaryFrontend;
  }

  if (!normalized.MEDIA_BASE_URL) {
    normalized.MEDIA_BASE_URL = normalized.MEDIA_CDN_BASE_URL || normalized.WEBAPP_URL || primaryFrontend;
  }

  if (!normalized.MEDIA_CDN_BASE_URL && normalized.MEDIA_BASE_URL) {
    normalized.MEDIA_CDN_BASE_URL = normalized.MEDIA_BASE_URL;
  }

  return normalized;
};

export const validateEnvironment = (): EnvironmentConfig => {
  if (cachedEnv) {
    return cachedEnv;
  }

  const resolvedEnv = resolveEnvWithSecrets();
  const missingRequired = findMissingRequiredEnv(resolvedEnv);

  if (missingRequired.length) {
    const details = missingRequired.map((entry) => `• ${entry.key}: ${entry.reason}`).join('\n');
    console.error('❌ Required environment variables are missing or empty:\n' + details);
    throw new Error('Missing required environment variables');
  }

  const parsed = envSchema.safeParse(resolvedEnv);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `• ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    console.error('❌ Environment validation failed:\n' + details);
    throw new Error('Invalid environment configuration');
  }

  cachedEnv = applyEnvFallbacks(parsed.data);
  return cachedEnv;
};

export const env = validateEnvironment();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webappSecret: process.env.TELEGRAM_WEBAPP_SECRET,
    webhookUrl: env.TELEGRAM_WEBHOOK_URL,
    allowedUserIds: env.TELEGRAM_ALLOWED_IDS
      ? env.TELEGRAM_ALLOWED_IDS.split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      : [],
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY!,
  },
  assistant: {
    engineId: 'internal',
    successThreshold: parseInt(process.env.ASSISTANT_SUCCESS_THRESHOLD || '75', 10),
    slumpThreshold: parseInt(process.env.ASSISTANT_SLUMP_THRESHOLD || '45', 10),
  },
  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_KEY,
  },
  app: {
    nodeEnv: env.NODE_ENV,
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    webAppUrl: env.WEBAPP_URL || null,
  },
  security: {
    encryptionSecret: env.ENCRYPTION_SECRET,
    jwtSecret: env.JWT_SECRET || undefined,
  },
};

export default config;
