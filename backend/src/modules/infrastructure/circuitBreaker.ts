import { circuitBreakerDefaults } from '../../config/constants.js';
import { AppError } from '../../services/errors.js';

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  openDurationMs: number;
  halfOpenMaxConcurrent: number;
}

export interface CircuitBreakerSnapshot {
  name: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  halfOpenActive: number;
  nextAttemptAt?: number;
  lastError?: { message?: string; at: number };
  config: CircuitBreakerConfig;
}

const clampPositiveInt = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

const normalizeConfig = (config: CircuitBreakerConfig): CircuitBreakerConfig => ({
  failureThreshold: clampPositiveInt(config.failureThreshold, circuitBreakerDefaults.failureThreshold),
  successThreshold: clampPositiveInt(config.successThreshold, circuitBreakerDefaults.successThreshold),
  openDurationMs: clampPositiveInt(config.openDurationMs, circuitBreakerDefaults.openStateDurationMs),
  halfOpenMaxConcurrent: clampPositiveInt(
    config.halfOpenMaxConcurrent,
    circuitBreakerDefaults.halfOpenMaxConcurrent,
  ),
});

let defaultConfig: CircuitBreakerConfig = normalizeConfig({
  failureThreshold: circuitBreakerDefaults.failureThreshold,
  successThreshold: circuitBreakerDefaults.successThreshold,
  openDurationMs: circuitBreakerDefaults.openStateDurationMs,
  halfOpenMaxConcurrent: circuitBreakerDefaults.halfOpenMaxConcurrent,
});

const registry = new Map<string, CircuitBreaker>();

const buildConfig = (overrides?: Partial<CircuitBreakerConfig>): CircuitBreakerConfig =>
  normalizeConfig({
    ...defaultConfig,
    ...(overrides ?? {}),
  });

const formatErrorValue = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'unknown error';
};

class CircuitBreaker {
  private config: CircuitBreakerConfig;

  private state: CircuitBreakerState = 'closed';

  private failureCount = 0;

  private successCount = 0;

  private halfOpenActive = 0;

  private nextAttemptAt = 0;

  private lastError?: { message?: string; at: number };

  private overrides?: Partial<CircuitBreakerConfig>;

  constructor(private readonly name: string, overrides?: Partial<CircuitBreakerConfig>) {
    this.overrides = overrides;
    this.config = buildConfig(overrides);
  }

  applyOverrides(overrides?: Partial<CircuitBreakerConfig>) {
    if (!overrides) {
      return;
    }
    this.overrides = { ...(this.overrides ?? {}), ...overrides };
    this.config = buildConfig(this.overrides);
  }

  rebuildConfig() {
    this.config = buildConfig(this.overrides);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const { acquiredHalfOpenSlot } = this.acquirePermission();
    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    } finally {
      if (acquiredHalfOpenSlot) {
        this.releaseHalfOpenSlot();
      }
    }
  }

  snapshot(): CircuitBreakerSnapshot {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      halfOpenActive: this.halfOpenActive,
      nextAttemptAt: this.nextAttemptAt || undefined,
      lastError: this.lastError,
      config: this.config,
    };
  }

  private acquirePermission(): { acquiredHalfOpenSlot: boolean } {
    this.transitionToHalfOpenIfReady();
    if (this.state === 'open') {
      throw this.createAvailabilityError('open');
    }
    if (this.state === 'half_open') {
      if (this.halfOpenActive >= this.config.halfOpenMaxConcurrent) {
        throw this.createAvailabilityError('half_open');
      }
      this.halfOpenActive += 1;
      return { acquiredHalfOpenSlot: true };
    }
    return { acquiredHalfOpenSlot: false };
  }

  private transitionToHalfOpenIfReady() {
    if (this.state === 'open' && Date.now() >= this.nextAttemptAt) {
      this.state = 'half_open';
      this.successCount = 0;
      this.failureCount = 0;
      this.halfOpenActive = 0;
    }
  }

  private releaseHalfOpenSlot() {
    this.halfOpenActive = Math.max(0, this.halfOpenActive - 1);
  }

  private recordSuccess() {
    if (this.state === 'half_open') {
      this.successCount += 1;
      if (this.successCount >= this.config.successThreshold) {
        this.close('stabilized');
      }
      return;
    }
    this.failureCount = 0;
  }

  private recordFailure(error: unknown) {
    if (this.state === 'half_open') {
      this.trip(error);
      return;
    }
    this.failureCount += 1;
    if (this.failureCount >= this.config.failureThreshold) {
      this.trip(error);
    }
  }

  private close(reason: string) {
    const wasOpen = this.state !== 'closed';
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenActive = 0;
    this.nextAttemptAt = 0;
    if (wasOpen) {
      console.info(`[circuit-breaker:${this.name}] Closed after ${reason}`);
    }
  }

  private trip(error: unknown) {
    this.state = 'open';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenActive = 0;
    this.nextAttemptAt = Date.now() + this.config.openDurationMs;
    this.lastError = { message: formatErrorValue(error), at: Date.now() };
    console.warn(
      `[circuit-breaker:${this.name}] Opened for ${this.config.openDurationMs}ms (reason: ${this.lastError.message ?? 'unknown'})`,
    );
  }

  private createAvailabilityError(reason: 'open' | 'half_open'): AppError {
    return new AppError({
      message: 'Внешний сервис временно недоступен, попробуйте позже.',
      code: reason === 'open' ? 'circuit_open' : 'circuit_half_open',
      statusCode: 503,
      category: 'dependencies',
      details: {
        service: this.name,
        state: this.state,
        retryAt: this.state === 'open' ? this.nextAttemptAt : Date.now() + this.config.openDurationMs,
        halfOpenActive: this.halfOpenActive,
      },
    });
  }
}

export const configureCircuitBreaker = (overrides?: Partial<CircuitBreakerConfig>) => {
  if (!overrides) {
    return;
  }
  defaultConfig = normalizeConfig({
    ...defaultConfig,
    ...overrides,
  });
  registry.forEach((breaker) => breaker.rebuildConfig());
};

const getOrCreateBreaker = (name: string, overrides?: Partial<CircuitBreakerConfig>) => {
  const key = name.toLowerCase();
  let breaker = registry.get(key);
  if (!breaker) {
    breaker = new CircuitBreaker(name, overrides);
    registry.set(key, breaker);
    return breaker;
  }
  breaker.applyOverrides(overrides);
  return breaker;
};

export const withCircuitBreaker = async <T>(
  name: string,
  operation: () => Promise<T>,
  overrides?: Partial<CircuitBreakerConfig>,
): Promise<T> => {
  const breaker = getOrCreateBreaker(name, overrides);
  return breaker.execute(operation);
};

export const getCircuitBreakerSnapshots = (): CircuitBreakerSnapshot[] =>
  Array.from(registry.values()).map((breaker) => breaker.snapshot());

export const getCircuitBreakerSnapshot = (name: string): CircuitBreakerSnapshot | undefined => {
  const breaker = registry.get(name.toLowerCase());
  return breaker?.snapshot();
};
