import type { MonitoringSeverity } from '../types/monitoring.js';

export const parseMonitoringSeverity = (value?: string | null): MonitoringSeverity | null => {
    if (!value) {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'info' || normalized === 'warning' || normalized === 'critical') {
        return normalized;
    }
    return null;
};
