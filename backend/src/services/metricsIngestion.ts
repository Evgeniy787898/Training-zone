import type { MonitoringSeverity } from '../types/monitoring.js';
import type { WebVitalReport } from '../types/metrics.js';
import { recordMonitoringEvent } from '../modules/infrastructure/monitoring.js';
import { getTraceId } from './trace.js';
import { recordWebVitalMetric } from '../modules/analytics/webVitalsMetrics.js';

const severityFromRating = (rating: WebVitalReport['rating']): MonitoringSeverity => {
    if (rating === 'poor') return 'critical';
    if (rating === 'needs-improvement') return 'warning';
    return 'info';
};

export interface IngestWebVitalOptions {
    resource?: string;
    traceId?: string | null;
}

export const ingestWebVital = (report: WebVitalReport, options: IngestWebVitalOptions = {}) => {
    const traceId = options.traceId ?? getTraceId();
    const severity = severityFromRating(report.rating);

    recordWebVitalMetric(report);

    recordMonitoringEvent(undefined, {
        category: 'web_vitals',
        severity,
        message: `${report.metric}=${report.value.toFixed(2)}`,
        resource: options.resource,
        traceId,
        metadata: {
            metric: report.metric,
            value: report.value,
            rating: report.rating,
            navigationType: report.navigationType,
            sessionId: report.sessionId,
            timestamp: report.timestamp,
        },
    });
};
