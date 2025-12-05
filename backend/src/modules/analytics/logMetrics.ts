import type { LogLevel } from '../../types/logging.js';

const counters: Record<LogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
};

const lastEventAt: Record<LogLevel, string | null> = {
    debug: null,
    info: null,
    warn: null,
    error: null,
};

export const recordLogMetric = (level: LogLevel) => {
    counters[level] += 1;
    lastEventAt[level] = new Date().toISOString();
};

export const getLogMetricsSnapshot = () => ({
    counts: { ...counters },
    lastEventAt: { ...lastEventAt },
    total: Object.values(counters).reduce((sum, value) => sum + value, 0),
});

export const resetLogMetrics = () => {
    (Object.keys(counters) as LogLevel[]).forEach((level) => {
        counters[level] = 0;
        lastEventAt[level] = null;
    });
};
