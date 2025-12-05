import { cachedApiClient as apiClient } from './cachedApi';
import performanceMonitor from './performance';
import { NetworkError, ServerError } from './errorHandler';

export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: number;
    checks: {
        api: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            responseTime?: number;
            error?: string;
        };
        cache: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            size: number;
            error?: string;
        };
        performance: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            metrics: {
                avgApiResponseTime: number;
                avgRenderTime: number;
                memoryUsage?: number;
            };
            error?: string;
        };
        auth: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            authenticated: boolean;
            error?: string;
        };
    };
    recommendations: string[];
}

export class ApplicationHealthCheck {
    private static instance: ApplicationHealthCheck;

    private constructor() {
        // Private constructor for singleton pattern
    }

    static getInstance(): ApplicationHealthCheck {
        if (!ApplicationHealthCheck.instance) {
            ApplicationHealthCheck.instance = new ApplicationHealthCheck();
        }
        return ApplicationHealthCheck.instance;
    }

    async runHealthCheck(): Promise<HealthCheckResult> {
        const result: HealthCheckResult = {
            status: 'healthy',
            timestamp: Date.now(),
            checks: {
                api: { status: 'healthy' },
                cache: { status: 'healthy', size: 0 },
                performance: { status: 'healthy', metrics: { avgApiResponseTime: 0, avgRenderTime: 0 } },
                auth: { status: 'healthy', authenticated: false }
            },
            recommendations: []
        };

        // Run all checks in parallel
        await Promise.allSettled([
            this.checkApiConnectivity(result),
            this.checkCacheStatus(result),
            this.checkPerformanceMetrics(result),
            this.checkAuthenticationStatus(result)
        ]);

        // Determine overall status
        this.determineOverallStatus(result);

        // Generate recommendations
        this.generateRecommendations(result);

        return result;
    }

    private async checkApiConnectivity(result: HealthCheckResult): Promise<void> {
        try {
            const start = performance.now();
            await apiClient.getProfileSummary();
            const end = performance.now();
            const responseTime = end - start;

            result.checks.api.status = 'healthy';
            result.checks.api.responseTime = responseTime;

            // If response time is too slow, mark as degraded
            if (responseTime > 2000) {
                result.checks.api.status = 'degraded';
            }
        } catch (error) {
            if (error instanceof NetworkError) {
                result.checks.api.status = 'unhealthy';
                result.checks.api.error = 'Нет подключения к сети';
            } else if (error instanceof ServerError) {
                result.checks.api.status = 'degraded';
                result.checks.api.error = 'Сервер работает медленно';
            } else {
                result.checks.api.status = 'unhealthy';
                result.checks.api.error = 'Неизвестная ошибка API';
            }
        }
    }

    private async checkCacheStatus(result: HealthCheckResult): Promise<void> {
        try {
            // This is a simplified check - in a real implementation, 
            // you would check the actual cache size and status
            const cacheSize = 0; // Placeholder

            result.checks.cache.size = cacheSize;
            result.checks.cache.status = 'healthy';

            // If cache is too large, mark as degraded
            if (cacheSize > 1000) {
                result.checks.cache.status = 'degraded';
            }
        } catch (error) {
            result.checks.cache.status = 'unhealthy';
            result.checks.cache.error = 'Ошибка кэша';
        }
    }

    private async checkPerformanceMetrics(result: HealthCheckResult): Promise<void> {
        try {
            const metrics = performanceMonitor.getMetrics();

            // Calculate average API response time
            const apiMetrics = metrics.filter(m => m.name.startsWith('api_') && !m.name.includes('_error'));
            const avgApiResponseTime = apiMetrics.length > 0
                ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length
                : 0;

            // Calculate average render time
            const renderMetrics = metrics.filter(m => m.name.startsWith('render_'));
            const avgRenderTime = renderMetrics.length > 0
                ? renderMetrics.reduce((sum, m) => sum + m.value, 0) / renderMetrics.length
                : 0;

            result.checks.performance.metrics = {
                avgApiResponseTime,
                avgRenderTime
            };

            result.checks.performance.status = 'healthy';

            // Check for performance issues
            if (avgApiResponseTime > 2000 || avgRenderTime > 500) {
                result.checks.performance.status = 'degraded';
            }

            // Get memory usage if available
            if ('memory' in performance) {
                // @ts-ignore
                const memoryInfo = performance.memory;
                if (memoryInfo && typeof memoryInfo === 'object' && 'usedJSHeapSize' in memoryInfo) {
                    result.checks.performance.metrics.memoryUsage = (memoryInfo as any).usedJSHeapSize;
                }
            }
        } catch (error) {
            result.checks.performance.status = 'unhealthy';
            result.checks.performance.error = 'Ошибка мониторинга производительности';
        }
    }

    private async checkAuthenticationStatus(result: HealthCheckResult): Promise<void> {
        try {
            // Check if user is authenticated by trying to get profile summary
            await apiClient.getProfileSummary();
            result.checks.auth.authenticated = true;
            result.checks.auth.status = 'healthy';
        } catch (error) {
            result.checks.auth.authenticated = false;
            result.checks.auth.status = 'unhealthy';
            result.checks.auth.error = 'Пользователь не аутентифицирован';
        }
    }

    private determineOverallStatus(result: HealthCheckResult): void {
        const checkStatuses = [
            result.checks.api.status,
            result.checks.cache.status,
            result.checks.performance.status,
            result.checks.auth.status
        ];

        if (checkStatuses.includes('unhealthy')) {
            result.status = 'unhealthy';
        } else if (checkStatuses.includes('degraded')) {
            result.status = 'degraded';
        } else {
            result.status = 'healthy';
        }
    }

    private generateRecommendations(result: HealthCheckResult): void {
        result.recommendations = [];

        // API recommendations
        if (result.checks.api.status === 'degraded') {
            result.recommendations.push('Проверьте подключение к интернету и попробуйте обновить страницу');
        } else if (result.checks.api.status === 'unhealthy') {
            result.recommendations.push('Нет подключения к серверу. Проверьте интернет-соединение');
        }

        // Cache recommendations
        if (result.checks.cache.status === 'degraded') {
            result.recommendations.push('Кэш переполнен. Рекомендуется очистить кэш приложения');
        }

        // Performance recommendations
        if (result.checks.performance.status === 'degraded') {
            if (result.checks.performance.metrics.avgApiResponseTime > 2000) {
                result.recommendations.push('Сервер отвечает медленно. Попробуйте использовать приложение позже');
            }
            if (result.checks.performance.metrics.avgRenderTime > 500) {
                result.recommendations.push('Приложение работает медленно. Рекомендуется перезапустить приложение');
            }
        }

        // Auth recommendations
        if (result.checks.auth.status === 'unhealthy') {
            result.recommendations.push('Вы не вошли в систему. Пожалуйста, авторизуйтесь для продолжения');
        }

        // General recommendations for healthy status
        if (result.status === 'healthy') {
            result.recommendations.push('Все системы работают нормально');
        }
    }

    // Run a quick health check (for frequent checks)
    async runQuickCheck(): Promise<Omit<HealthCheckResult, 'recommendations'>> {
        const result: Omit<HealthCheckResult, 'recommendations'> = {
            status: 'healthy',
            timestamp: Date.now(),
            checks: {
                api: { status: 'healthy' },
                cache: { status: 'healthy', size: 0 },
                performance: { status: 'healthy', metrics: { avgApiResponseTime: 0, avgRenderTime: 0 } },
                auth: { status: 'healthy', authenticated: false }
            }
        };

        // Run only critical checks
        await Promise.allSettled([
            this.checkApiConnectivity(result as HealthCheckResult),
            this.checkAuthenticationStatus(result as HealthCheckResult)
        ]);

        this.determineOverallStatus(result as HealthCheckResult);

        return result;
    }
}

// Export singleton instance
const healthCheck = ApplicationHealthCheck.getInstance();
export default healthCheck;