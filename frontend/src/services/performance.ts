export interface PerformanceMetric {
    name: string;
    value: number;
    timestamp: number;
    context?: Record<string, any>;
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: PerformanceMetric[] = [];
    private observers: MutationObserver[] = [];

    private constructor() {
        // Private constructor for singleton pattern
    }

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    // Measure component render time
    measureRenderTime(componentName: string, callback: () => void): number {
        const start = performance.now();
        callback();
        const end = performance.now();
        const duration = end - start;

        this.recordMetric({
            name: `render_${componentName}`,
            value: duration,
            timestamp: Date.now(),
            context: { component: componentName }
        });

        return duration;
    }

    // Measure API call duration
    async measureApiCall<T>(apiName: string, call: () => Promise<T>): Promise<T> {
        const start = performance.now();
        try {
            const result = await call();
            const end = performance.now();
            const duration = end - start;

            this.recordMetric({
                name: `api_${apiName}`,
                value: duration,
                timestamp: Date.now(),
                context: { api: apiName }
            });

            return result;
        } catch (error) {
            const end = performance.now();
            const duration = end - start;

            this.recordMetric({
                name: `api_${apiName}_error`,
                value: duration,
                timestamp: Date.now(),
                context: { api: apiName, error: (error as Error).message }
            });

            throw error;
        }
    }

    // Measure user interaction delay
    measureInteraction(interactionName: string, callback: () => void): number {
        const start = performance.now();
        callback();
        const end = performance.now();
        const duration = end - start;

        this.recordMetric({
            name: `interaction_${interactionName}`,
            value: duration,
            timestamp: Date.now(),
            context: { interaction: interactionName }
        });

        return duration;
    }

    // Record a custom metric
    recordMetric(metric: PerformanceMetric): void {
        this.metrics.push(metric);

        // Keep only last 1000 metrics to prevent memory issues
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-1000);
        }

        // Log to console in development
        if ((import.meta as any).env.DEV) {
            console.log(`[Performance] ${metric.name}: ${metric.value.toFixed(2)}ms`, metric.context);
        }
    }

    // Get all metrics
    getMetrics(): PerformanceMetric[] {
        return [...this.metrics];
    }

    // Get metrics for a specific time range
    getMetricsSince(timestamp: number): PerformanceMetric[] {
        return this.metrics.filter(metric => metric.timestamp >= timestamp);
    }

    // Clear all metrics
    clearMetrics(): void {
        this.metrics = [];
    }

    // Get average metric value
    getAverageMetric(name: string): number {
        const metrics = this.metrics.filter(m => m.name === name);
        if (metrics.length === 0) return 0;

        const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
        return sum / metrics.length;
    }

    // Get percentile for a metric
    getPercentile(name: string, percentile: number): number {
        const metrics = this.metrics
            .filter(m => m.name === name)
            .map(m => m.value)
            .sort((a, b) => a - b);

        if (metrics.length === 0) return 0;

        const index = Math.floor((percentile / 100) * (metrics.length - 1));
        return metrics[index];
    }

    // Monitor DOM changes
    monitorDomChanges(callback: (mutations: MutationRecord[]) => void): void {
        const observer = new MutationObserver(callback);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });

        this.observers.push(observer);
    }

    // Stop monitoring DOM changes
    stopMonitoring(): void {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }

    // Report metrics to analytics service (placeholder)
    reportToAnalytics(): void {
        // In a real implementation, this would send metrics to an analytics service
        if ((import.meta as any).env.DEV) {
            console.log('[Analytics] Reporting performance metrics:', this.getMetrics());
        }
    }
}

// Export singleton instance
const performanceMonitor = PerformanceMonitor.getInstance();
export default performanceMonitor;