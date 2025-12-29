
import { Telegraf, Context } from 'telegraf';
import type { SafePrismaClient } from '../types/prisma.js';
import { DatabaseService } from '../modules/integrations/supabase.js';
import { config } from '../config/env.js';
import { logger } from '../services/logger.js';
import { microserviceClients } from '../config/constants.js';

import {
    authMiddleware,
    loggingMiddleware,
    errorMiddleware,
    dialogStateMiddleware,
} from './middleware/auth.js';

import { startCommand } from './commands/start.js';
import { helpCommand } from './commands/help.js';
import { todayCommand } from './commands/today.js';
import { settingsCommand } from './commands/settings.js';
import { statsCommand } from './commands/stats.js';
import { statusCommand } from './commands/status.js';

import {
    createNavigationHandlers,
    createMessageHandler,
} from './handlers/index.js';

import { saveWorkoutCompletion } from './services/workoutService.js';
import { NotificationService } from '../services/notificationService.js';

let bot: Telegraf<Context> | null = null;
let controller: { stop: () => Promise<void> } | null = null;

const resolveWebAppUrl = () => {
    if (config.app.webAppUrl) {
        return config.app.webAppUrl;
    }
    const frontendUrl = process.env.FRONTEND_URL || process.env.WEBAPP_URL;
    if (!frontendUrl) {
        return null;
    }
    const [first] = frontendUrl.split(',').map((item) => item.trim()).filter(Boolean);
    return first || null;
};

export async function startTelegramBot(prisma: SafePrismaClient | null): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        logger.warn('[bot] ⚠️ TELEGRAM_BOT_TOKEN is not configured. Bot will not start.');
        logger.warn('[bot] 👉 Add TELEGRAM_BOT_TOKEN to your .env file to enable the bot.');
        return;
    }

    // Log token status (masked for security)
    const maskedToken = token.length > 10 ? `${token.slice(0, 5)}...${token.slice(-5)}` : '***';
    logger.info(`[bot] Token configured: ${maskedToken}`);

    if (!prisma) {
        logger.warn('[bot] ⚠️ Prisma client is not available. Bot will not start.');
        return;
    }

    if (controller) {
        logger.info('[bot] Bot is already running.');
        return;
    }

    logger.info('[bot] 🚀 Initializing Telegram Bot (v7.0 Modular)...');

    const db = new DatabaseService(prisma);
    const webAppUrl = resolveWebAppUrl() || undefined;
    const aiAdvisorUrl = microserviceClients.aiAdvisor.baseUrl || 'http://localhost:3003';

    // Log Web App URL status
    if (webAppUrl) {
        logger.info(`[bot] ✅ Web App URL configured: ${webAppUrl}`);
    } else {
        logger.warn('[bot] ⚠️ Web App URL not configured. "Open TZONA" button will be hidden.');
    }

    // Initialize Telegraf
    bot = new Telegraf<Context>(token);

    // Middleware
    bot.use((ctx, next) => loggingMiddleware(ctx as any, db, next));
    bot.use((ctx, next) => errorMiddleware(ctx as any, db, next));
    bot.use((ctx, next) => authMiddleware(ctx as any, db, undefined, next));
    bot.use((ctx, next) => dialogStateMiddleware(ctx as any, db, next));

    // Commands
    bot.command('start', (ctx) => startCommand(ctx as any, { db, webAppUrl }));
    bot.command('help', (ctx) => helpCommand(ctx as any));
    bot.command('today', (ctx) => todayCommand(ctx as any, { db, webAppUrl }));
    bot.command('settings', (ctx) => settingsCommand(ctx as any, { webAppUrl }));
    bot.command('stats', (ctx) => statsCommand(ctx as any, { db, webAppUrl }));
    bot.command('status', (ctx) => statusCommand(ctx as any, { db, webAppUrl }));

    // Navigation and Actions
    const navHandlers = createNavigationHandlers({ db });

    // Wire Navigation Actions
    bot.action('go_home', navHandlers.goHome);
    bot.action('sec_training', navHandlers.secTraining);
    bot.action('sec_games', navHandlers.secGames);
    bot.action('sec_wellness', navHandlers.secWellness);
    bot.action('sec_ai', navHandlers.secAi);
    bot.action('sec_profile', navHandlers.secProfile);

    // Wire Reply Keyboard Actions (Main Menu)
    bot.hears('📅 Сегодня', (ctx) => todayCommand(ctx as any, { db, webAppUrl }));
    bot.hears('💪 Тренировка', navHandlers.secTraining);
    bot.hears('🧠 AI-коуч', navHandlers.secAi);
    bot.hears('📊 Прогресс', (ctx) => statsCommand(ctx as any, { db, webAppUrl }));

    // Additional button handling to ensure navigation consistency
    bot.hears('🎯 Игры', navHandlers.secGames);
    bot.hears('❤️ Wellness', navHandlers.secWellness);
    bot.hears('👤 Профиль', navHandlers.secProfile);

    // Message Handler (AI, Intents, Context)
    const messageHandler = await createMessageHandler({
        db,
        aiAdvisorUrl,
        aiApiToken: process.env.AI_ADVISOR_API_TOKEN,
        webAppUrl,
        saveWorkoutCompletion: (ctx, db, pid, state) => saveWorkoutCompletion(ctx, db, pid, state)
    });
    bot.on('message', messageHandler as any);

    // Initialize Notification Service
    const notificationService = new NotificationService(bot, prisma as any);

    // Start AI Scheduler (Cron Jobs)
    const { initAIScheduler } = await import('../jobs/aiScheduler.js');
    initAIScheduler(notificationService, prisma as any);

    // Start legacy scheduler for explicit user notification times if needed
    // notificationService.startScheduler(); 
    // We replace it with AI Scheduler for now as per plan
    notificationService.startScheduler(); // Keep existing one for 'workout:completed' subscription logic!


    // Launch
    await bot.launch(async () => {
        logger.info(`[bot] Telegram Bot ${bot?.botInfo?.username} started successfully.`);

        // Automatically update the Menu Button to point to the current Web App URL
        // This ensures that even if ngrok changes, the button works (after restart)
        if (webAppUrl) {
            try {
                await bot?.telegram.setChatMenuButton({
                    menuButton: {
                        type: 'web_app',
                        text: 'Open TZONA',
                        web_app: { url: webAppUrl }
                    }
                });
                logger.info(`[bot] ✅ Menu Button updated to: ${webAppUrl}`);
            } catch (err) {
                logger.warn(`[bot] ⚠️ Failed to update Menu Button: ${err}`);
            }
        }
    });

    // Controller for graceful stop
    controller = {
        stop: async () => {
            notificationService.stopScheduler();
            if (bot) {
                bot.stop('SIGTERM');
                bot = null;
                controller = null;
                logger.info('[bot] Bot stopped.');
            }
        }
    };
}

export async function stopTelegramBot(): Promise<void> {
    if (controller) {
        await controller.stop();
    }
}
