import { Prisma, PrismaClient } from '@prisma/client';

const warmupQuery = Prisma.sql`SELECT 1`;

/**
 * Auto-transform Supabase Session Pooler URL to Transaction Pooler
 * Session pooler (port 5432 on pooler.supabase.com) holds connections and causes MaxClientsInSessionMode
 * Transaction pooler (port 6543) releases connections immediately - much better for development
 */
const transformToTransactionPooler = (url: string | null | undefined): string | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    // Check if this is a Supabase pooler URL using Session mode (port 5432)
    const isSupabasePooler = parsed.hostname.includes('pooler.supabase.com');
    const isSessionPooler = parsed.port === '5432' || parsed.port === '';

    if (isSupabasePooler && isSessionPooler) {
      // Transform to Transaction Pooler (port 6543)
      parsed.port = '6543';

      // Add required pgbouncer params if not present
      if (!parsed.searchParams.has('pgbouncer')) {
        parsed.searchParams.set('pgbouncer', 'true');
      }
      if (!parsed.searchParams.has('connection_limit')) {
        parsed.searchParams.set('connection_limit', '6');
      }

      const newUrl = parsed.toString();
      console.log('[Prisma] Auto-transformed Session Pooler (5432) to Transaction Pooler (6543)');
      return newUrl;
    }

    return url;
  } catch {
    return url;
  }
};

const runWarmupQuery = async (client: PrismaClient, timeoutMs: number) => {
  if (timeoutMs <= 0) {
    await client.$queryRaw(warmupQuery);
    return;
  }

  let timer: NodeJS.Timeout | null = null;
  try {
    await Promise.race([
      client.$queryRaw(warmupQuery),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timer = null;
          reject(new Error('prisma_pool_warmup_timeout'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const parseConnectionLimit = (url?: string | null) => {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const limitParam = parsed.searchParams.get('connection_limit');
    if (limitParam) {
      const limit = Number(limitParam);
      return Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : null;
    }
    return null;
  } catch {
    return null;
  }
};

export const describeDatasource = (url?: string | null) => {
  if (!url) {
    return 'unknown';
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname || 'localhost';
    const port = parsed.port ? `:${parsed.port}` : '';
    const db = parsed.pathname?.replace(/^\//, '') || '';
    return `${host}${port}${db ? `/${db}` : ''}`;
  } catch {
    return 'custom-url';
  }
};

export interface PrismaConnectionOptions {
  poolUrl?: string | null;
  directUrl?: string | null;
  preferPool?: boolean;
  fallbackOnFailure?: boolean;
  warmupTimeoutMs?: number;
  connectionHeadroom?: number;
  requestedConcurrency?: number | null;
  queueWarnSize?: number | null;
  logLevels?: ('info' | 'warn' | 'error')[];
}

export interface PrismaConnectionResult {
  client: PrismaClient;
  mode: 'pool' | 'direct';
  runtimeUrl: string;
  connectionLimit: number | null;
  concurrencyLimit: number;
  queueWarnSize: number;
  usedFallback: boolean;
}

export const createPrismaClientWithPooling = async (
  options: PrismaConnectionOptions,
): Promise<PrismaConnectionResult> => {
  const {
    poolUrl,
    directUrl,
    preferPool = true,
    fallbackOnFailure = true,
    warmupTimeoutMs = 5000,
    connectionHeadroom = 1,
    requestedConcurrency,
    queueWarnSize,
    logLevels,
  } = options;

  if (!poolUrl && !directUrl) {
    throw new Error('DATABASE_URL или DIRECT_URL должны быть заданы для подключения к БД');
  }

  const fallbackLevels: Prisma.LogLevel[] = ['error'];
  const prismaLogLevels: Prisma.LogLevel[] =
    (logLevels && logLevels.length > 0 ? logLevels : fallbackLevels) as Prisma.LogLevel[];
  const logDefinitions: Prisma.LogDefinition[] = [
    { emit: 'event' as const, level: 'query' },
    ...prismaLogLevels.map((level) => ({ emit: 'stdout' as const, level })),
  ];

  let mode: 'pool' | 'direct';
  let runtimeUrl: string;

  // Auto-transform Session Pooler to Transaction Pooler for Supabase
  const transformedPoolUrl = transformToTransactionPooler(poolUrl);

  if (preferPool && transformedPoolUrl) {
    runtimeUrl = transformedPoolUrl;
    mode = 'pool';
  } else if (directUrl) {
    runtimeUrl = directUrl;
    mode = 'direct';
  } else {
    runtimeUrl = transformedPoolUrl || poolUrl!;
    mode = 'pool';
  }

  let client = new PrismaClient({
    log: logDefinitions,
    datasources: {
      db: {
        url: runtimeUrl,
      },
    },
  });

  let usedFallback = false;

  const warmup = async () => {
    const maxRetries = 3;
    const baseDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await runWarmupQuery(client, warmupTimeoutMs);
        return; // Success
      } catch (error) {
        const isPoolExhausted = error instanceof Error &&
          error.message.includes('MaxClientsInSessionMode');

        if (attempt < maxRetries && isPoolExhausted) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`[Prisma] Pool exhausted, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Try fallback to direct connection
        if (mode === 'pool' && fallbackOnFailure && directUrl) {
          usedFallback = true;
          await client.$disconnect().catch(() => undefined);
          client = new PrismaClient({
            log: logDefinitions,
            datasources: {
              db: { url: directUrl },
            },
          });
          runtimeUrl = directUrl;
          mode = 'direct';
          await runWarmupQuery(client, warmupTimeoutMs);
          return;
        }

        throw error;
      }
    }
  };

  await warmup();

  const connectionLimit =
    parseConnectionLimit(runtimeUrl) || parseConnectionLimit(poolUrl) || parseConnectionLimit(directUrl);

  const normalizedHeadroom = connectionHeadroom < 0 ? 0 : Math.floor(connectionHeadroom);

  const concurrencyLimit =
    requestedConcurrency && requestedConcurrency > 0
      ? Math.floor(requestedConcurrency)
      : connectionLimit
        ? Math.max(1, connectionLimit - normalizedHeadroom)
        : 4;

  const normalizedQueueWarn = queueWarnSize && queueWarnSize > 0 ? Math.floor(queueWarnSize) : 25;

  return {
    client,
    mode,
    runtimeUrl,
    connectionLimit,
    concurrencyLimit,
    queueWarnSize: normalizedQueueWarn,
    usedFallback,
  };
};
