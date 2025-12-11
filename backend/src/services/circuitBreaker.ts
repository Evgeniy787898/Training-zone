/**
 * Circuit Breaker - Fallback when external services unavailable
 * Implements BE-004: Circuit Breaker для AI/Analytics
 *
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 * - CLOSED: Normal operation, requests go through
 * - OPEN: Service failed, requests return fallback immediately
 * - HALF_OPEN: Testing if service recovered
 */

// ============================================
// TYPES
// ============================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
    /** Number of failures before opening circuit (default: 5) */
    failureThreshold?: number;
    /** Time in ms before attempting reset (default: 30000) */
    resetTimeoutMs?: number;
    /** Number of successes in HALF_OPEN to close circuit (default: 2) */
    successThreshold?: number;
    /** Callback when state changes */
    onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
    /** Fallback function when circuit is open */
    fallback?: () => unknown;
}

interface CircuitBreakerStats {
    failures: number;
    successes: number;
    lastFailureTime: number;
    state: CircuitState;
}

// ============================================
// CIRCUIT BREAKER CLASS
// ============================================

export class CircuitBreaker {
    private name: string;
    private stats: CircuitBreakerStats;
    private options: Required<CircuitBreakerOptions>;

    constructor(name: string, options: CircuitBreakerOptions = {}) {
        this.name = name;
        this.stats = {
            failures: 0,
            successes: 0,
            lastFailureTime: 0,
            state: 'CLOSED',
        };
        this.options = {
            failureThreshold: options.failureThreshold ?? 5,
            resetTimeoutMs: options.resetTimeoutMs ?? 30000,
            successThreshold: options.successThreshold ?? 2,
            onStateChange: options.onStateChange ?? (() => { }),
            fallback: options.fallback ?? (() => { throw new Error('Service unavailable'); }),
        };
    }

    /**
     * Get current state
     */
    get state(): CircuitState {
        return this.stats.state;
    }

    /**
     * Get stats
     */
    getStats(): Readonly<CircuitBreakerStats> {
        return { ...this.stats };
    }

    /**
     * Check if circuit should transition from OPEN to HALF_OPEN
     */
    private shouldAttemptReset(): boolean {
        if (this.stats.state !== 'OPEN') return false;
        const elapsed = Date.now() - this.stats.lastFailureTime;
        return elapsed >= this.options.resetTimeoutMs;
    }

    /**
     * Transition to a new state
     */
    private transition(newState: CircuitState): void {
        if (this.stats.state === newState) return;
        const oldState = this.stats.state;
        this.stats.state = newState;

        if (newState === 'CLOSED') {
            this.stats.failures = 0;
            this.stats.successes = 0;
        } else if (newState === 'HALF_OPEN') {
            this.stats.successes = 0;
        }

        console.log(`[CircuitBreaker:${this.name}] ${oldState} → ${newState}`);
        this.options.onStateChange(oldState, newState, this.name);
    }

    /**
     * Record a successful call
     */
    private recordSuccess(): void {
        this.stats.failures = 0;

        if (this.stats.state === 'HALF_OPEN') {
            this.stats.successes++;
            if (this.stats.successes >= this.options.successThreshold) {
                this.transition('CLOSED');
            }
        }
    }

    /**
     * Record a failed call
     */
    private recordFailure(): void {
        this.stats.failures++;
        this.stats.lastFailureTime = Date.now();

        if (this.stats.state === 'HALF_OPEN') {
            // Immediate transition back to OPEN on half-open failure
            this.transition('OPEN');
        } else if (this.stats.state === 'CLOSED') {
            if (this.stats.failures >= this.options.failureThreshold) {
                this.transition('OPEN');
            }
        }
    }

    /**
     * Execute a function through the circuit breaker
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Check if we should try to reset from OPEN
        if (this.shouldAttemptReset()) {
            this.transition('HALF_OPEN');
        }

        // If OPEN, return fallback immediately
        if (this.stats.state === 'OPEN') {
            console.log(`[CircuitBreaker:${this.name}] OPEN - returning fallback`);
            return this.options.fallback() as T;
        }

        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure();
            throw error;
        }
    }

    /**
     * Execute with fallback on error or when circuit is open
     */
    async executeWithFallback<T>(fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
        try {
            return await this.execute(fn);
        } catch {
            return fallback();
        }
    }

    /**
     * Manually reset the circuit to CLOSED
     */
    reset(): void {
        this.stats = {
            failures: 0,
            successes: 0,
            lastFailureTime: 0,
            state: 'CLOSED',
        };
        console.log(`[CircuitBreaker:${this.name}] Manually reset to CLOSED`);
    }

    /**
     * Manually open the circuit
     */
    trip(): void {
        this.transition('OPEN');
        this.stats.lastFailureTime = Date.now();
        console.log(`[CircuitBreaker:${this.name}] Manually tripped to OPEN`);
    }
}

// ============================================
// FACTORY FOR PRECONFIGURED BREAKERS
// ============================================

const circuitBreakerInstances = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(
    serviceName: string,
    options?: CircuitBreakerOptions
): CircuitBreaker {
    let breaker = circuitBreakerInstances.get(serviceName);
    if (!breaker) {
        breaker = new CircuitBreaker(serviceName, options);
        circuitBreakerInstances.set(serviceName, breaker);
    }
    return breaker;
}

/**
 * Preconfigured circuit breakers for TZONA services
 */
export const serviceBreakers = {
    aiAdvisor: () => getCircuitBreaker('AI_ADVISOR', {
        failureThreshold: 3,
        resetTimeoutMs: 60000, // 1 minute
        successThreshold: 2,
        fallback: () => ({
            advice: 'AI-советник временно недоступен. Попробуйте позже.',
            fallback: true,
        }),
    }),

    analytics: () => getCircuitBreaker('ANALYTICS', {
        failureThreshold: 5,
        resetTimeoutMs: 30000, // 30 seconds
        successThreshold: 2,
        fallback: () => ({
            data: null,
            fallback: true,
        }),
    }),

    imageProcessor: () => getCircuitBreaker('IMAGE_PROCESSOR', {
        failureThreshold: 3,
        resetTimeoutMs: 45000,
        successThreshold: 2,
        fallback: () => ({
            processed: false,
            fallback: true,
        }),
    }),
};

export default CircuitBreaker;
