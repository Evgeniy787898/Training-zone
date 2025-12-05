import type { AppConfig } from './configService.js';

export type EnvironmentStage = 'development' | 'staging' | 'production';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
  ? DeepPartial<T[K]>
  : T[K];
};

const buildNamespace = (base: string, stage: EnvironmentStage): string => {
  if (!base) {
    return base;
  }

  if (stage === 'production') {
    return base;
  }

  return `${base}-${stage}`;
};

const buildOverrides = (stage: EnvironmentStage, config: AppConfig): any => {
  switch (stage) {
    case 'development':
      return {
        cache: {
          strategy: {
            namespace: buildNamespace(config.cache.strategy.namespace, stage),
          },
        },
        logging: {
          level: 'debug',
          echoToConsole: true,
          alertOnError: false,
        },
        monitoring: {
          minSeverityForAlerts: 'critical',
        },
      };
    case 'staging':
      return {
        cache: {
          strategy: {
            namespace: buildNamespace(config.cache.strategy.namespace, stage),
            defaultTtlMs: (config.cache.strategy as any).defaultTtlMs * 0.75,
          },
        },
        monitoring: {
          minSeverityForAlerts: 'warning',
        },
        logging: {
          alertOnError: true,
        },
        rateLimits: {
          global: {
            defaultMax: Math.max(1, Math.round(config.rateLimits.global.defaultMax * 0.5)),
          },
        },
      } as any;
    case 'production':
    default:
      return {};
  }
};

const mergeConfig = <T>(base: T, overrides: DeepPartial<T>): T => {
  if (!overrides || typeof overrides !== 'object') {
    return base;
  }

  const result: Record<string, unknown> = Array.isArray(base) ? [...(base as any[])] : { ...(base as any) };

  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const current = (result as Record<string, unknown>)[key];
      (result as Record<string, unknown>)[key] = mergeConfig(
        current ?? {},
        value as Record<string, unknown>,
      );
    } else {
      (result as Record<string, unknown>)[key] = value as unknown;
    }
  }

  return result as T;
};

export const applyEnvironmentProfile = (stage: EnvironmentStage, config: AppConfig): AppConfig => {
  const overrides = buildOverrides(stage, config);
  return mergeConfig(config, overrides);
};
