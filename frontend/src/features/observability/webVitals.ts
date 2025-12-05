import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

const endpoint = '/api/metrics/web-vitals';

async function postMetric(metric: Metric) {
    try {
    const entry = Array.isArray(metric.entries) && metric.entries.length > 0
        ? metric.entries[0]
        : undefined;
    const body = {
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        navigationType: metric.navigationType,
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
        sessionId: sessionStorage.getItem('tzona_session_id') ?? undefined,
        timestamp: entry?.startTime !== undefined
            ? Math.round(performance.timeOrigin + entry.startTime)
            : Date.now(),
    };

        await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            keepalive: true,
        });
    } catch (error) {
        console.debug('[web-vitals] failed to send metric', error);
    }
}

export function initWebVitals(): void {
    const sessionId = sessionStorage.getItem('tzona_session_id') ?? crypto.randomUUID();
    sessionStorage.setItem('tzona_session_id', sessionId);

    const handler = (metric: Metric) => {
        void postMetric(metric);
    };

    onCLS(handler);
    onFCP(handler);
    onINP(handler);
    onLCP(handler);
    onTTFB(handler);
}
