// TZONA V2 - History Service
// Ported from V1 history.js
import { DatabaseService } from '../integrations/supabase.js';
import { assistantHistoryConfig } from '../../config/constants.js';

export const CONVERSATION_STATE_KEY = 'ai_chat_history';
export const HISTORY_LIMIT = assistantHistoryConfig.maxMessages;
export const HISTORY_TTL_MS = assistantHistoryConfig.ttlMs;

export class HistoryService {
    constructor(private db: DatabaseService) { }

    async loadAssistantHistory(profileId: string) {
        if (!profileId) {
            return { messages: [], payload: {} };
        }

        try {
            const state = await this.db.getDialogState(profileId, CONVERSATION_STATE_KEY);
            const payload = (state?.statePayload as any) || {};
            const messages = Array.isArray(payload.messages) ? payload.messages : [];

            return {
                messages,
                payload,
            };
        } catch (error) {
            console.error('Failed to load assistant history:', error);
            return { messages: [], payload: {} };
        }
    }

    async persistAssistantTurn({
        profileId,
        previousState = { messages: [], payload: {} },
        userMessage,
        assistantMessage,
        intent,
        mode = 'chat',
        extraMeta = {},
    }: {
        profileId: string;
        previousState?: any;
        userMessage?: string;
        assistantMessage?: string;
        intent?: string;
        mode?: string;
        extraMeta?: any;
    }) {
        if (!profileId) {
            return;
        }

        try {
            const now = new Date().toISOString();
            const history = Array.isArray(previousState?.messages) ? [...previousState.messages] : [];
            const previousMeta = previousState?.payload || {};
            const extraPayload = extraMeta && typeof extraMeta === 'object' ? extraMeta : {};

            if (userMessage) {
                history.push({
                    role: 'user',
                    content: userMessage,
                    intent: intent || 'unknown',
                    at: now,
                });
            }

            if (assistantMessage) {
                history.push({
                    role: 'assistant',
                    content: assistantMessage,
                    intent: intent || 'unknown',
                    at: now,
                });
            }

            const trimmed = history.slice(-HISTORY_LIMIT);
            const expiresAt = new Date(Date.now() + HISTORY_TTL_MS);

            const userMessagesCount = (previousMeta.total_user_messages || 0) + (userMessage ? 1 : 0);
            const assistantMessagesCount = (previousMeta.total_assistant_messages || 0) + (assistantMessage ? 1 : 0);
            const totalTurns = assistantMessagesCount;

            const payload = {
                ...previousMeta,
                ...extraPayload,
                messages: trimmed,
                session_status: 'active',
                last_user_message_at: userMessage ? now : previousMeta.last_user_message_at || null,
                last_assistant_message_at: assistantMessage ? now : previousMeta.last_assistant_message_at || null,
                last_intent: intent || previousMeta.last_intent || null,
                last_mode: mode,
                last_updated_at: now,
                total_user_messages: userMessagesCount,
                total_assistant_messages: assistantMessagesCount,
                total_turns: totalTurns,
            };

            if (payload.closed_at) {
                delete payload.closed_at;
            }
            if (payload.closed_reason) {
                delete payload.closed_reason;
            }

            await this.db.saveDialogState(
                profileId,
                CONVERSATION_STATE_KEY,
                payload,
                expiresAt,
            );

            try {
                await this.db.mergeDialogState(profileId, 'assistant_session', (sessionState: any = {}) => {
                    const nextState = {
                        ...sessionState,
                        session_status: 'active',
                        last_user_message_at: userMessage ? now : sessionState?.last_user_message_at || null,
                        last_assistant_message_at: assistantMessage ? now : sessionState?.last_assistant_message_at || null,
                        last_intent: intent || sessionState?.last_intent || null,
                        last_mode: mode,
                        total_user_messages: userMessagesCount,
                        total_assistant_messages: assistantMessagesCount,
                        total_turns: totalTurns,
                        last_updated_at: now,
                    };

                    delete (nextState as any).messages;
                    delete (nextState as any).closed_at;
                    delete (nextState as any).closed_reason;
                    delete (nextState as any).closed_summary;

                    if (extraPayload && typeof extraPayload === 'object') {
                        if ('latency_stats' in extraPayload && typeof extraPayload.latency_stats === 'object') {
                            nextState.latency_stats = extraPayload.latency_stats;
                        }
                        if ('last_latency_ms' in extraPayload) {
                            nextState.last_latency_ms = extraPayload.last_latency_ms;
                        }
                        if ('slow_response' in extraPayload) {
                            nextState.slow_response = extraPayload.slow_response;
                        }
                        if ('latency_alert' in extraPayload && extraPayload.latency_alert) {
                            nextState.latency_alert = extraPayload.latency_alert;
                        }
                        if (
                            'latency_alert_history' in extraPayload
                            && Array.isArray(extraPayload.latency_alert_history)
                        ) {
                            nextState.latency_alert_history = extraPayload.latency_alert_history.slice(0, 10);
                        }
                    }

                    return nextState;
                });
            } catch (error) {
                console.error('Failed to update assistant session state:', error);
            }
        } catch (error) {
            console.error('Failed to persist assistant turn:', error);
        }
    }
}

export default HistoryService;
