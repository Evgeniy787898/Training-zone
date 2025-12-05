// TZONA V2 - Bot Authentication Middleware
// Ported from V1 bot/middleware/auth.js
import type { Context } from '../telegrafBridge.js';
import { DatabaseService } from '../../modules/integrations/supabase.js';
import { recordUserMessage } from '../utils/chat.js';

export async function authMiddleware(ctx: Context, db: DatabaseService, allowedUserIds?: string[], next?: () => Promise<void>) {
    try {
        const telegramId = (ctx as any).from?.id;

        if (!telegramId) {
            console.error('No telegram ID in context');
            return;
        }

        if (allowedUserIds?.length && !allowedUserIds.includes(String(telegramId))) {
            console.warn(`Rejected unauthorized Telegram ID ${telegramId}`);
            await ctx.reply('Доступ к этому боту ограничен. Если нужен доступ — свяжись с разработчиком.');
            return;
        }

        let profile = await db.getProfileByTelegramId(BigInt(telegramId));

        if (!profile) {
            console.log(`Creating new profile for telegram_id: ${telegramId}`);

            profile = await db.createProfile(BigInt(telegramId), {
                goals: {},
                equipment: [],
                preferences: {
                    language: (ctx as any).from?.language_code || 'ru',
                    username: (ctx as any).from?.username,
                    first_name: (ctx as any).from?.first_name,
                },
            });

            await db.logEvent(
                profile.id,
                'user_registration',
                'info',
                {
                    telegram_username: (ctx as any).from?.username,
                    first_name: (ctx as any).from?.first_name,
                    language_code: (ctx as any).from?.language_code,
                }
            );
        }

        (ctx as any).state = (ctx as any).state || {};
        (ctx as any).state.profile = profile;
        (ctx as any).state.profileId = profile.id;

        await db.logOperation(
            profile.id,
            (ctx as any).updateType || 'message',
            'success'
        );

        if (next) {
            await next();
        }
    } catch (error: any) {
        console.error('Auth middleware error:', error);

        if ((ctx as any).state?.profileId) {
            await db.logEvent(
                (ctx as any).state.profileId,
                'auth_error',
                'critical',
                { error: error.message }
            );
        }

        await ctx.reply('Произошла ошибка при аутентификации. Попробуйте позже.');
    }
}

export async function loggingMiddleware(ctx: Context, db: DatabaseService, next?: () => Promise<void>) {
    const start = Date.now();

    try {
        if (next) {
            await next();
        }
    } finally {
        const duration = Date.now() - start;

        console.log({
            type: (ctx as any).updateType,
            userId: (ctx as any).from?.id,
            username: (ctx as any).from?.username,
            text: (ctx as any).message?.text?.substring(0, 100),
            duration: `${duration}ms`,
        });

        const profileId = (ctx as any).state?.profileId;
        if (profileId) {
            await db.logEvent(
                profileId,
                'user_action',
                'info',
                {
                    action_type: (ctx as any).updateType,
                    duration_ms: duration,
                    command: (ctx as any).message?.text?.split(' ')[0],
                }
            );

            if ((ctx as any).updateType === 'message' && (ctx as any).message?.text) {
                await recordUserMessage(profileId, {
                    direction: 'in',
                    message_id: (ctx as any).message.message_id,
                    chat_id: ctx.chat?.id,
                    text: (ctx as any).message.text,
                    timestamp: new Date().toISOString(),
                }, db);
            } else if ((ctx as any).updateType === 'callback_query' && (ctx as any).callbackQuery?.data) {
                await recordUserMessage(profileId, {
                    direction: 'in',
                    type: 'callback',
                    data: (ctx as any).callbackQuery.data,
                    message_id: (ctx as any).callbackQuery.message?.message_id,
                    chat_id: ctx.chat?.id,
                    timestamp: new Date().toISOString(),
                }, db);
            }
        }
    }
}

export async function errorMiddleware(ctx: Context, db: DatabaseService, next?: () => Promise<void>) {
    try {
        if (next) {
            await next();
        }
    } catch (error: any) {
        console.error('Bot error:', error);

        const profileId = (ctx as any).state?.profileId;
        if (profileId) {
            await db.logEvent(
                profileId,
                'bot_error',
                'critical',
                {
                    error: error.message,
                    stack: error.stack,
                    update_type: (ctx as any).updateType,
                }
            );
        }

        const errorMessage =
            '😔 Произошла ошибка при обработке запроса.\n\n' +
            'Попробуйте повторить позже или воспользуйтесь командой /help для справки.';

        try {
            await ctx.reply(errorMessage);
        } catch (replyError) {
            console.error('Failed to send error message:', replyError);
        }
    }
}

export async function dialogStateMiddleware(ctx: Context, db: DatabaseService, next?: () => Promise<void>) {
    const profileId = (ctx as any).state?.profileId;
    if (!profileId) {
        if (next) {
            return next();
        }
        return;
    }

    try {
        const activeState = await db.getDialogState(profileId, 'active');

        if (activeState && activeState.expiresAt) {
            const expiresAt = new Date(activeState.expiresAt);
            const now = new Date();

            if (expiresAt < now) {
                await db.clearDialogState(profileId, 'active');
            } else {
                (ctx as any).state.dialogState = activeState.statePayload;
            }
        }
    } catch (error) {
        console.error('Dialog state middleware error:', error);
    }

    if (next) {
        return next();
    }
}

export default {
    authMiddleware,
    loggingMiddleware,
    errorMiddleware,
    dialogStateMiddleware,
};

