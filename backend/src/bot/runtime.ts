import { Telegraf as OfficialTelegraf, Markup } from 'telegraf';
import type { SafePrismaClient } from '../types/prisma.js';
import { DatabaseService } from '../modules/integrations/supabase.js';
import { config } from '../config/env.js';
import {
    authMiddleware,
    dialogStateMiddleware,
    loggingMiddleware,
    errorMiddleware,
} from './middleware/auth.js';
import { startInactivityMonitor } from './services/inactivityMonitor.js';
import { Telegraf as LegacyTransport } from './telegrafBridge.js';

type BotController = {
    stop: () => Promise<void>;
};

let controller: BotController | null = null;

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
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.warn('[bot] TELEGRAM_BOT_TOKEN is not configured. Telegram bot will not be started.');
        return;
    }

    if (!prisma) {
        console.warn('[bot] Prisma client is not available. Telegram bot will not be started.');
        return;
    }

    if (controller) {
        return;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN.trim();
    const telegraf = new OfficialTelegraf(botToken, {
        handlerTimeout: Number(process.env.TELEGRAM_BOT_HANDLER_TIMEOUT_MS ?? '45000'),
    });

    const db = new DatabaseService(prisma);
    const allowedUserIds = config.telegram.allowedUserIds;
    const webAppUrl = resolveWebAppUrl();

    telegraf.use(async (ctx, next) => authMiddleware(ctx as any, db, allowedUserIds, next));
    telegraf.use(async (ctx, next) => dialogStateMiddleware(ctx as any, db, next));
    telegraf.use(async (ctx, next) => loggingMiddleware(ctx as any, db, next));
    telegraf.catch((err, ctx) => {
        console.error('[bot] handler error:', err);
        return errorMiddleware(ctx as any, db);
    });

    const sendWelcome = async (ctx: any) => {
        const text =
            'Привет! Я тренировочный ассистент TZONA.\n\n' +
            'Открой мини‑приложение, чтобы посмотреть план и статистику, или воспользуйся командами:\n' +
            '• /menu — открыть главное меню\n' +
            '• /help — подсказка по функциям\n';

        const replyMarkup = webAppUrl
            ? Markup.inlineKeyboard([[Markup.button.webApp('Открыть TZONA', webAppUrl)]])
            : undefined;

        await ctx.reply(text, replyMarkup);
    };

    telegraf.start(sendWelcome);
    telegraf.command('menu', sendWelcome);
    telegraf.command('help', async (ctx) => {
        await ctx.reply(
            'Доступные команды:\n' +
            '• /menu — открыть главное меню\n' +
            '• /help — показать подсказку\n' +
            '• /plan — показать ближайшую тренировку\n' +
            '• /week — прогресс за неделю\n' +
            '• /report — отчёт за период\n' +
            '\n' +
            'Основной функционал доступен в мини‑приложении Telegram.',
        );
    });

    telegraf.command('plan', async (ctx) => {
        const profileId = (ctx as any).state?.profileId;
        if (!profileId) {
            await ctx.reply('Не удалось определить профиль. Введите /start и попробуйте снова.');
            return;
        }
        const latest = await db.getLatestSessionSummary(profileId);
        if (!latest) {
            await ctx.reply('У тебя пока нет запланированных тренировок. Загляни в приложение и создай первую!');
            return;
        }

        const statusMap: Record<string, string> = {
            planned: 'запланирована',
            in_progress: 'в процессе',
            done: 'завершена',
            skipped: 'пропущена',
        };
        await ctx.reply(
            `Следующая тренировка ${new Date(latest.plannedAt).toLocaleString('ru-RU')} (${statusMap[latest.status] ?? latest.status})`,
        );
    });

    telegraf.on('text', async (ctx) => {
        if (webAppUrl) {
            await ctx.reply('Открой мини‑приложение TZONA, чтобы продолжить.', Markup.inlineKeyboard([
                Markup.button.webApp('Открыть TZONA', webAppUrl),
            ]));
        } else {
            await ctx.reply('Скоро здесь появятся дополнительные команды. Пока воспользуйся приложением TZONA.');
        }
    });

    try {
        await telegraf.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('[bot] Cleared existing Telegram webhook (using long polling).');
    } catch (error) {
        console.warn('[bot] Failed to delete existing webhook (continuing with polling):', error);
    }

    await telegraf.launch();
    console.log('[bot] Telegram bot started successfully (long polling).');

    let disposeInactivity: (() => void) | null = null;
    try {
        const legacyTransport = new LegacyTransport(botToken);
        disposeInactivity = startInactivityMonitor(legacyTransport as any, db);
    } catch (error) {
        console.warn('[bot] Failed to start inactivity monitor:', error);
    }

    controller = {
        stop: async () => {
            try {
                await telegraf.stop('SIGTERM');
            } catch (error) {
                console.error('[bot] Failed to stop telegraf:', error);
            }
            if (disposeInactivity) {
                disposeInactivity();
            }
            controller = null;
            console.log('[bot] Telegram bot stopped.');
        },
    };
}

export async function stopTelegramBot(): Promise<void> {
    if (controller) {
        await controller.stop();
    }
}

