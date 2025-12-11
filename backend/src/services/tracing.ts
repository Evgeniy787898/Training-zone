/**
 * Distributed Tracing (INT-V03)
 * 
 * Lightweight tracing implementation for microservices:
 * - Span tracking across services
 * - Request timeline visualization
 * - Performance metrics collection
 */

// Span status
export type SpanStatus = 'started' | 'completed' | 'error';

// Span definition
export interface Span {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    serviceName: string;
    status: SpanStatus;
    startTime: number;
    endTime?: number;
    durationMs?: number;
    tags: Record<string, string | number | boolean>;
    logs: Array<{ timestamp: number; message: string }>;
    error?: string;
}

// Trace (collection of spans)
export interface Trace {
    traceId: string;
    spans: Span[];
    startTime: number;
    endTime?: number;
    totalDurationMs?: number;
    rootService: string;
    status: 'in_progress' | 'completed' | 'error';
}

// Generate IDs
const generateTraceId = (): string =>
    `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const generateSpanId = (): string =>
    `sp-${Math.random().toString(36).slice(2, 10)}`;

// Trace storage (in-memory for now)
const traces: Map<string, Trace> = new Map();
const MAX_TRACES = 100;

/**
 * Tracer class for distributed tracing
 */
class Tracer {
    private serviceName: string;

    constructor(serviceName: string) {
        this.serviceName = serviceName;
    }

    /**
     * Start a new trace
     */
    startTrace(operationName: string): Span {
        const traceId = generateTraceId();
        const span = this.createSpan(traceId, operationName);

        // Create trace
        const trace: Trace = {
            traceId,
            spans: [span],
            startTime: span.startTime,
            rootService: this.serviceName,
            status: 'in_progress',
        };

        // Store trace (limit size)
        if (traces.size >= MAX_TRACES) {
            const oldestKey = traces.keys().next().value;
            if (oldestKey) traces.delete(oldestKey);
        }
        traces.set(traceId, trace);

        console.debug(`[tracing] Started trace ${traceId}: ${operationName}`);
        return span;
    }

    /**
     * Start a child span
     */
    startSpan(traceId: string, operationName: string, parentSpanId?: string): Span | null {
        const trace = traces.get(traceId);
        if (!trace) {
            console.warn(`[tracing] Trace ${traceId} not found`);
            return null;
        }

        const span = this.createSpan(traceId, operationName, parentSpanId);
        trace.spans.push(span);

        console.debug(`[tracing] Started span ${span.spanId}: ${operationName}`);
        return span;
    }

    /**
     * End a span
     */
    endSpan(span: Span, error?: string): void {
        span.endTime = Date.now();
        span.durationMs = span.endTime - span.startTime;
        span.status = error ? 'error' : 'completed';
        if (error) span.error = error;

        console.debug(`[tracing] Ended span ${span.spanId}: ${span.durationMs}ms`);

        // Check if trace is complete
        const trace = traces.get(span.traceId);
        if (trace) {
            const allCompleted = trace.spans.every(s => s.status !== 'started');
            if (allCompleted) {
                trace.status = trace.spans.some(s => s.status === 'error') ? 'error' : 'completed';
                trace.endTime = Math.max(...trace.spans.map(s => s.endTime || 0));
                trace.totalDurationMs = trace.endTime - trace.startTime;
            }
        }
    }

    /**
     * Add a log to span
     */
    logSpan(span: Span, message: string): void {
        span.logs.push({ timestamp: Date.now(), message });
    }

    /**
     * Add tags to span
     */
    tagSpan(span: Span, tags: Record<string, string | number | boolean>): void {
        Object.assign(span.tags, tags);
    }

    /**
     * Create span helper
     */
    private createSpan(traceId: string, operationName: string, parentSpanId?: string): Span {
        return {
            traceId,
            spanId: generateSpanId(),
            parentSpanId,
            operationName,
            serviceName: this.serviceName,
            status: 'started',
            startTime: Date.now(),
            tags: {},
            logs: [],
        };
    }

    /**
     * Get trace by ID
     */
    getTrace(traceId: string): Trace | undefined {
        return traces.get(traceId);
    }

    /**
     * Get all traces (for dashboard)
     */
    getAllTraces(limit: number = 50): Trace[] {
        const allTraces = Array.from(traces.values());
        return allTraces.slice(-limit).reverse();
    }

    /**
     * Get trace timeline (for visualization)
     */
    getTraceTimeline(traceId: string): Array<{
        spanId: string;
        operationName: string;
        serviceName: string;
        offsetMs: number;
        durationMs: number;
        status: SpanStatus;
        depth: number;
    }> | null {
        const trace = traces.get(traceId);
        if (!trace) return null;

        const timeline: Array<{
            spanId: string;
            operationName: string;
            serviceName: string;
            offsetMs: number;
            durationMs: number;
            status: SpanStatus;
            depth: number;
        }> = [];

        const getDepth = (spanId: string, visited = new Set<string>()): number => {
            if (visited.has(spanId)) return 0;
            visited.add(spanId);
            const span = trace.spans.find(s => s.spanId === spanId);
            if (!span || !span.parentSpanId) return 0;
            return 1 + getDepth(span.parentSpanId, visited);
        };

        for (const span of trace.spans) {
            timeline.push({
                spanId: span.spanId,
                operationName: span.operationName,
                serviceName: span.serviceName,
                offsetMs: span.startTime - trace.startTime,
                durationMs: span.durationMs || (Date.now() - span.startTime),
                status: span.status,
                depth: getDepth(span.spanId),
            });
        }

        return timeline.sort((a, b) => a.offsetMs - b.offsetMs);
    }

    /**
     * Clear old traces
     */
    clearOldTraces(maxAgeMs: number = 3600000): number {
        const cutoff = Date.now() - maxAgeMs;
        let cleared = 0;

        for (const [traceId, trace] of traces) {
            if (trace.startTime < cutoff) {
                traces.delete(traceId);
                cleared++;
            }
        }

        return cleared;
    }
}

// Service tracers
export const backendTracer = new Tracer('backend');
export const aiAdvisorTracer = new Tracer('ai-advisor');
export const botTracer = new Tracer('telegram-bot');

// Helper middleware for Express
export const tracingMiddleware = (serviceName: string) => {
    const tracer = new Tracer(serviceName);

    return (req: any, res: any, next: any) => {
        // Check for incoming trace context
        const parentTraceId = req.headers['x-trace-id'] as string;
        const parentSpanId = req.headers['x-span-id'] as string;

        let span: Span;
        if (parentTraceId) {
            span = tracer.startSpan(parentTraceId, `${req.method} ${req.path}`, parentSpanId) || tracer.startTrace(`${req.method} ${req.path}`);
        } else {
            span = tracer.startTrace(`${req.method} ${req.path}`);
        }

        // Add request tags
        tracer.tagSpan(span, {
            'http.method': req.method,
            'http.url': req.originalUrl,
        });

        // Attach to request
        req.traceSpan = span;
        req.tracer = tracer;

        // Set response headers
        res.setHeader('X-Trace-Id', span.traceId);
        res.setHeader('X-Span-Id', span.spanId);

        // End span on response
        res.on('finish', () => {
            tracer.tagSpan(span, { 'http.status_code': res.statusCode });
            tracer.endSpan(span, res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined);
        });

        next();
    };
};

export default {
    backendTracer,
    aiAdvisorTracer,
    botTracer,
    tracingMiddleware,
};
