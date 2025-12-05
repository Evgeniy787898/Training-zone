import express from 'express';
import dotenv from 'dotenv';
import './utils/bigintSerializer.js'; // Global BigInt JSON serialization
import { logger } from './services/logger.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { closeCache } from './modules/infrastructure/cache.js';
import { closeHttpClient, configureHttpClient } from './modules/integrations/httpClient.js';
import { validateEnvironment } from './config/env.js';
import { getConfig } from './config/configService.js';
import { recordConfigUsage } from './services/configUsage.js';
import { startTelegramBot, stopTelegramBot } from './bot/runtime.js';
import { bodySizeLimits, describeBodySize } from './modules/security/bodySizeLimits.js';

// Setup modules
import { parseEnvironmentConfig } from './setup/envConfig.js';
import { setupPrisma } from './setup/prismaSetup.js';
import { setupMiddleware } from './setup/middlewareSetup.js';
import { setupRoutes } from './setup/routesSetup.js';
import healthRouter from './routes/health.js';

// Direct imports for configuration
import { configureDatabaseAvailability } from './modules/database/databaseAvailability.js';
import { configureDatabaseRetry } from './modules/database/databaseRetry.js';
import { configureCircuitBreaker } from './modules/infrastructure/circuitBreaker.js';
import { configurePerformanceMetrics } from './modules/analytics/performanceMetrics.js';
import { configureResourceMetrics } from './modules/analytics/resourceMetrics.js';
import { configureBusinessMetrics } from './modules/analytics/businessMetrics.js';
import { configureMetricsDashboard } from './services/metricsDashboard.js';
import { configureHealthSnapshot } from './modules/infrastructure/health.js';

// Environment initialization
// Use override: false to preserve env vars set by start-with-ngrok.sh (e.g., DATABASE_URL with port 6543)
dotenv.config({ override: false });
validateEnvironment();
configureHttpClient();

const dbUrl = process.env.DATABASE_URL || '';
const maskedUrl = dbUrl.replace(/:[^:@]*@/, ':****@');
logger.info(`[DEBUG] DATABASE_URL: ${maskedUrl}`);

const appConfig = getConfig().app;
recordConfigUsage(undefined, 'startup').catch((error) => {
  logger.error({ err: error }, '[config] Failed to record configuration snapshot');
});

// Parse all environment configuration
const envConfig = parseEnvironmentConfig();

// Configure all services with env overrides
if (Object.keys(envConfig.databaseAvailability).length > 0) {
  configureDatabaseAvailability(envConfig.databaseAvailability);
}
if (Object.keys(envConfig.databaseRetry).length > 0) {
  configureDatabaseRetry(envConfig.databaseRetry);
}
if (Object.keys(envConfig.circuitBreaker).length > 0) {
  configureCircuitBreaker(envConfig.circuitBreaker);
}
if (Object.keys(envConfig.performanceMetrics).length > 0) {
  configurePerformanceMetrics(envConfig.performanceMetrics);
}
configureResourceMetrics(envConfig.resourceMetrics);
if (Object.keys(envConfig.businessMetrics).length > 0) {
  configureBusinessMetrics(envConfig.businessMetrics);
}
configureMetricsDashboard(envConfig.metricsDashboard);
configureHealthSnapshot(envConfig.health);

// Initialize Express app
const app = express();
app.set('trust proxy', 1); // Trust first proxy (ngrok)

// Setup Prisma with all middleware and monitoring
const { prisma, cacheWarmingHandle } = await setupPrisma(envConfig);

// Setup services
import { setupServices } from './setup/servicesSetup.js';
const services = setupServices(prisma);

// Setup all middleware
setupMiddleware(app, envConfig, prisma);

// Setup health endpoints (before other routes)
app.use(healthRouter);

// Setup all application routes
setupRoutes(app, prisma, services);

// Error handler (must be last)
app.use(
  createErrorHandler({
    defaultBodyLimit: bodySizeLimits.default,
    describeBodySize,
  }),
);

// Start server
const PORT = appConfig.port;
app.listen(PORT, appConfig.host, () => {
  logger.info(`🚀 TZONA V2 Backend running on port ${PORT}`);
  logger.info(`📊 Health check: http://${appConfig.host}:${PORT}/health`);
  logger.info(`📚 API Docs: http://${appConfig.host}:${PORT}/api`);
});

// Start Telegram bot
startTelegramBot(prisma).catch((error) => {
  logger.error({ err: error }, '[bot] Failed to start Telegram bot');
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  await stopTelegramBot();
  await prisma.$disconnect();
  await closeCache();
  cacheWarmingHandle?.dispose();
  await closeHttpClient();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
