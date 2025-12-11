import dotenv from 'dotenv';
import '../utils/bigintSerializer.js'; // Global BigInt JSON serialization
import { logger } from '../services/logger.js';
import { validateEnvironment } from '../config/env.js';
import { startTelegramBot, stopTelegramBot } from './runtime.js';
import { setupPrisma } from '../setup/prismaSetup.js';
import { parseEnvironmentConfig } from '../setup/envConfig.js';
import { configureDatabaseAvailability } from '../modules/database/databaseAvailability.js';
import { configureDatabaseRetry } from '../modules/database/databaseRetry.js';

// Environment initialization
dotenv.config({ override: false });
validateEnvironment();

const startBot = async () => {
    logger.info('🤖 Starting TZONA V2 Telegram Bot Service...');

    // Parse configuration
    const envConfig = parseEnvironmentConfig();

    // Configure database resilience
    if (Object.keys(envConfig.databaseAvailability).length > 0) {
        configureDatabaseAvailability(envConfig.databaseAvailability);
    }
    if (Object.keys(envConfig.databaseRetry).length > 0) {
        configureDatabaseRetry(envConfig.databaseRetry);
    }

    // Setup Prisma (only needed for DB access, no HTTP server)
    const { prisma } = await setupPrisma(envConfig);

    // Start Bot Runtime
    await startTelegramBot(prisma);

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down bot...`);
        await stopTelegramBot();
        await prisma.$disconnect();
        logger.info('Bot service stopped.');
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
};

startBot().catch((error) => {
    logger.error({ err: error }, 'Fatal error starting bot service');
    process.exit(1);
});
