import { Router, Request, Response } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';

const microservicesProxy = Router();

// Порты из переменных окружения или значения по умолчанию
const IMAGE_PROCESSOR_PORT = process.env.IMAGE_PROCESSOR_PORT || '3002';
const AI_ADVISOR_PORT = process.env.AI_ADVISOR_PORT || '3003';
const ANALYTICS_PORT = process.env.ANALYTICS_PORT || '3004';
const PROXY_TIMEOUT_MS = Number.isFinite(Number(process.env.MICROSERVICE_PROXY_TIMEOUT_MS))
    ? Math.floor(Number(process.env.MICROSERVICE_PROXY_TIMEOUT_MS))
    : 10000;

/**
 * Общая конфигурация для всех микросервисов
 */
const createMicroserviceProxy = (serviceName: string, target: string, pathPrefix: string): any => ({
    target,
    changeOrigin: true,
    timeout: PROXY_TIMEOUT_MS,
    proxyTimeout: PROXY_TIMEOUT_MS,
    pathRewrite: {
        [`^${pathPrefix}`]: '', // Убираем префикс
    },
    onError: (err: Error, req: any, res: any) => {
        console.error(`[proxy] ${serviceName} error:`, err.message);
        if (!res.headersSent) {
            (res as Response).status(503).json({
                error: 'service_unavailable',
                message: `${serviceName} service is not available`,
                code: 'microservice_unavailable',
            });
        }
    },
    onProxyReq: (proxyReq: any, req: any) => {
        // Пробрасываем важные заголовки
        const headersToForward = ['x-trace-id', 'authorization', 'x-profile-id', 'x-csrf-token'];

        headersToForward.forEach((headerName) => {
            const headerValue = (req as Request).headers[headerName];
            if (headerValue) {
                proxyReq.setHeader(headerName, headerValue as string);
            }
        });

        // Логируем проксируемый запрос для отладки
        console.log(`[proxy] ${serviceName} ${(req as Request).method} ${(req as Request).url}`);
    },
    onProxyRes: (proxyRes: any, req: any, res: any) => {
        // Логируем ответ микросервиса
        console.log(`[proxy] ${serviceName} responded with status ${proxyRes.statusCode}`);
    },
});

// Прокси для image-processor (порт 3002)
const imageProcessorProxy = createProxyMiddleware(
    createMicroserviceProxy(
        'Image Processor',
        `http://localhost:${IMAGE_PROCESSOR_PORT}`,
        '/api/internal/image-processor'
    )
);

// Прокси для ai-advisor (порт 3003)
const aiAdvisorProxy = createProxyMiddleware(
    createMicroserviceProxy(
        'AI Advisor',
        `http://localhost:${AI_ADVISOR_PORT}`,
        '/api/internal/ai-advisor'
    )
);

// Прокси для analytics (порт 3004)
const analyticsProxy = createProxyMiddleware(
    createMicroserviceProxy(
        'Analytics',
        `http://localhost:${ANALYTICS_PORT}`,
        '/api/internal/analytics'
    )
);

// Регистрируем прокси-маршруты
microservicesProxy.use('/api/internal/image-processor', imageProcessorProxy);
microservicesProxy.use('/api/internal/ai-advisor', aiAdvisorProxy);
microservicesProxy.use('/api/internal/analytics', analyticsProxy);

export default microservicesProxy;
