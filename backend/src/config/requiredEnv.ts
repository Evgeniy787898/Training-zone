export type RequiredEnvField = {
  key: string;
  reason: string;
  when?: (env: NodeJS.ProcessEnv) => boolean;
};

const BASE_REQUIRED_ENV: RequiredEnvField[] = [
  { key: 'SUPABASE_URL', reason: 'Supabase project URL for auth/storage' },
  { key: 'SUPABASE_ANON_KEY', reason: 'Supabase anon key for public API access' },
  { key: 'SUPABASE_SERVICE_KEY', reason: 'Supabase service key for backend operations' },
  { key: 'TELEGRAM_BOT_TOKEN', reason: 'Telegram bot token for authentication' },
  { key: 'TELEGRAM_WEBAPP_SECRET', reason: 'Telegram WebApp signature verification secret' },
  { key: 'ENCRYPTION_SECRET', reason: 'Secret used for sensitive data encryption' },
  { key: 'CSRF_SECRET', reason: 'CSRF token signing secret' },
];

const CONDITIONAL_ENV: RequiredEnvField[] = [
  {
    key: 'AI_ADVISOR_API_TOKEN',
    reason: 'API token for AI Advisor microservice',
    when: (env) => env.AI_ADVISOR_ENABLED !== 'false',
  },
  {
    key: 'AI_ADVISOR_BASE_URL',
    reason: 'Base URL for AI Advisor microservice',
    when: (env) => env.AI_ADVISOR_ENABLED !== 'false',
  },
  {
    key: 'ANALYTICS_BASE_URL',
    reason: 'Base URL for analytics microservice',
    when: (env) => env.ANALYTICS_ENABLED !== 'false',
  },
  {
    key: 'CACHE_REDIS_URL',
    reason: 'Redis connection string for distributed cache',
    when: (env) => env.CACHE_REDIS_DISABLED !== 'true',
  },
];

export type MissingRequiredEnv = {
  key: string;
  reason: string;
};

export const findMissingRequiredEnv = (env: NodeJS.ProcessEnv): MissingRequiredEnv[] => {
  const required = [...BASE_REQUIRED_ENV, ...CONDITIONAL_ENV.filter((entry) => !entry.when || entry.when(env))];

  return required
    .filter((entry) => {
      const value = env[entry.key];
      if (typeof value !== 'string') return true;
      return value.trim().length === 0;
    })
    .map(({ key, reason }) => ({ key, reason }));
};
