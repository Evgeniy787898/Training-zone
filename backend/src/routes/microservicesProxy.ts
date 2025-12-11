import { Router, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { microserviceClients } from '../config/constants.js';

const microservicesProxy = Router();

const PROXY_TIMEOUT_MS = Number.isFinite(Number(process.env.MICROSERVICE_PROXY_TIMEOUT_MS))
    ? Math.floor(Number(process.env.MICROSERVICE_PROXY_TIMEOUT_MS))
    : 10000;

/**
 * Dynamic Proxy Middleware
 * Routes requests based on the service name in the path to either:
 * 1. A dynamically registered service (via ServiceRegistry)
 * 2. A statically configured service (via constants.ts)
 */
const dynamicProxy = createProxyMiddleware({
    target: 'http://localhost:3000', // Default target, overridden by router
    changeOrigin: true,
    timeout: PROXY_TIMEOUT_MS,
    proxyTimeout: PROXY_TIMEOUT_MS,
    pathRewrite: (path, req) => {
        // Extract service name: /api/internal/{serviceName}/...
        const match = path.match(/^\/api\/internal\/([^/]+)(.*)/);
        if (match) {
            return match[2] || '/'; // Strip prefix
        }
        return path;
    },
    router: async (req) => {
        const path = req.url || '';
        const match = path.match(/^\/api\/internal\/([^/]+)/);
        if (!match) {
            return undefined;
        }

        const serviceName = match[1];

        // 1. Try dynamic registry
        const dynamicUrl = await serviceRegistry.getServiceUrl(serviceName);
        if (dynamicUrl) {
            console.debug(`[Proxy] Routing ${serviceName} to dynamic: ${dynamicUrl}`);
            return dynamicUrl;
        }

        // 2. Try static config
        // Mapping from URL path keys to config keys
        const staticMap: Record<string, string | null> = {
            'image-processor': microserviceClients.imageProcessor.baseUrl || `http://localhost:${process.env.IMAGE_PROCESSOR_PORT || 3002}`,
            'ai-advisor': microserviceClients.aiAdvisor.baseUrl || `http://localhost:${process.env.AI_ADVISOR_PORT || 3003}`,
            'analytics': microserviceClients.analytics.baseUrl || `http://localhost:${process.env.ANALYTICS_PORT || 3004}`,
        };

        const staticUrl = staticMap[serviceName];
        if (staticUrl) {
            // console.debug(`[Proxy] Routing ${serviceName} to static: ${staticUrl}`);
            return staticUrl;
        }

        console.warn(`[Proxy] No route found for service: ${serviceName}`);
        // If undefined is returned, it falls back to 'target', which is localhost:3000 -> 404 likely
        return 'http://localhost:3000';
    },
    onError: (err: Error, req: any, res: any) => {
        console.error(`[Proxy] Error:`, err.message);
        if (!res.headersSent) {
            (res as Response).status(503).json({
                error: 'service_unavailable',
                message: `Service is not available`,
                code: 'microservice_unavailable',
            });
        }
    },
    onProxyReq: (proxyReq: any, req: any) => {
        const headersToForward = ['x-trace-id', 'authorization', 'x-profile-id', 'x-csrf-token'];
        headersToForward.forEach((headerName) => {
            const headerValue = (req as Request).headers[headerName];
            if (headerValue) {
                proxyReq.setHeader(headerName, headerValue as string);
            }
        });
    },
    onProxyRes: (proxyRes: any, req: any, res: any) => {
        // Optional: Log proxy response
        // console.debug(`[Proxy] Response status: ${proxyRes.statusCode}`);
    },
});

// Mount the dynamic proxy for all internal routes
microservicesProxy.use('/api/internal/*', dynamicProxy);

export default microservicesProxy;
