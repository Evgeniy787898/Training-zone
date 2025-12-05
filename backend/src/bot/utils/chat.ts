// TZONA V2 - Bot Chat Utilities
// Ported from V1 bot/utils/chat.js
import type { Context } from '../telegrafBridge.js';
import { DatabaseService } from '../../modules/integrations/supabase.js';
import { botMessageBufferConfig } from '../../config/constants.js';

const BUFFER_STATE_KEY = 'ui_message_buffer';
const BUFFER_TTL_MS = botMessageBufferConfig.ttlMs;

export async function beginChatResponse(ctx: Context, db: DatabaseService) {
    const profileId = (ctx as any).state?.profileId;

    if (!profileId || !ctx.chat) {
        return;
    }

    try {
        const state = await db.getDialogState(profileId, BUFFER_STATE_KEY);
        const messageIds = (state?.statePayload as any)?.message_ids || [];

        for (const messageId of messageIds) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat!.id, messageId);
            } catch (error: any) {
                if (error?.response?.error_code !== 400) {
                    console.warn('Failed to delete message', {
                        chatId: ctx.chat!.id,
                        messageId,
                        error: error.message,
                    });
                }
            }
        }

        await db.saveDialogState(
            profileId,
            BUFFER_STATE_KEY,
            { message_ids: [] },
            new Date(Date.now() + BUFFER_TTL_MS)
        );
    } catch (error) {
        console.error('Failed to prepare chat cleanup:', error);
    }
}

export async function replyWithTracking(ctx: Context, text: string, options: any = {}, db: DatabaseService) {
    const message = await ctx.reply(text, options);
    await trackBotMessage(ctx, message, text, db);
    return message;
}

async function trackBotMessage(ctx: Context, message: any, text: string, db: DatabaseService) {
    const profileId = (ctx as any).state?.profileId;

    if (!profileId) {
        return;
    }

    try {
        const state = await db.getDialogState(profileId, BUFFER_STATE_KEY);
        const previousIds = (state?.statePayload as any)?.message_ids || [];
        const updatedIds = [...previousIds, message.message_id].slice(-10);

        await db.saveDialogState(
            profileId,
            BUFFER_STATE_KEY,
            { message_ids: updatedIds },
            new Date(Date.now() + BUFFER_TTL_MS)
        );
    } catch (error) {
        console.error('Failed to update message buffer:', error);
    }

    try {
        await db.logEvent(
            profileId,
            'bot_message',
            'info',
            {
                direction: 'out',
                message_id: message.message_id,
                chat_id: message.chat.id,
                text,
                timestamp: new Date().toISOString(),
            }
        );
        await db.logDialogEvent(
            profileId,
            'bot_message',
            {
                message_id: message.message_id,
                chat_id: message.chat.id,
                text,
            }
        );
    } catch (error) {
        console.error('Failed to log bot message:', error);
    }
}

export async function recordUserMessage(profileId: string, payload: any, db: DatabaseService) {
    if (!profileId) {
        return;
    }

    try {
        await db.logEvent(profileId, 'user_message', 'info', payload);
    } catch (error) {
        console.error('Failed to log user message:', error);
    }

    try {
        await db.logDialogEvent(
            profileId,
            payload.type === 'callback' ? 'user_callback' : 'user_text',
            payload
        );
    } catch (error) {
        console.error('Failed to log dialog event for user message:', error);
    }
}

export default {
    beginChatResponse,
    replyWithTracking,
    recordUserMessage,
};

