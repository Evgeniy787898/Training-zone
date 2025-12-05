// TZONA V2 - Inactivity Monitor Service
// Ported from V1 bot/services/inactivityMonitor.js
import type { Telegraf } from '../telegrafBridge.js';
import { performance } from 'node:perf_hooks';
import { DatabaseService } from '../../modules/integrations/supabase.js';
import { botInactivityDefaults } from '../../config/constants.js';
import { createRecurringTask } from '../../patterns/recurringTask.js';

const DEFAULT_INTERVAL_MS = botInactivityDefaults.intervalMs;
const DEFAULT_THRESHOLD_MINUTES = botInactivityDefaults.thresholdMinutes;
const DEFAULT_BATCH_LIMIT = botInactivityDefaults.batchLimit;

function shortenSnippet(
    text: string | null | undefined,
    limit = botInactivityDefaults.snippetPreviewChars,
): string {
    if (!text) {
        return '';
    }
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= limit) {
        return normalized;
    }
    return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

export function startInactivityMonitor(bot: Telegraf, db: DatabaseService, {
    thresholdMinutes = DEFAULT_THRESHOLD_MINUTES,
    intervalMs = DEFAULT_INTERVAL_MS,
    batchLimit = DEFAULT_BATCH_LIMIT,
} = {}) {
    async function tick() {
        try {
            const sweepStart = performance.now();
            let scanned = 0;
            let closed = 0;
            let notificationsSent = 0;
            let errorCount = 0;
            const errorSamples: string[] = [];

            const inactiveChats = await db.findInactiveAssistantChats({
                thresholdMinutes,
                limit: batchLimit,
            });

            scanned = inactiveChats.length;

            for (const chat of inactiveChats) {
                const payloadRaw = (chat as any)?.state_payload ?? {};
                const payload = typeof payloadRaw === 'object' && payloadRaw !== null ? payloadRaw as any : {};
                if (payload.session_status === 'closed') {
                    continue;
                }

                const profileId = chat.profile_id;

                let profile = null;
                try {
                    profile = await db.getProfileById(profileId);
                } catch (error) {
                    console.error('Failed to load profile for inactivity monitor:', error);
                    continue;
                }

                if (!profile?.telegramId) {
                    continue;
                }

                const messages = Array.isArray(payload.messages) ? payload.messages : [];
                const lastUserMessage = [...messages].reverse().find((item: any) => item.role === 'user');
                const lastAssistantMessage = [...messages].reverse().find((item: any) => item.role === 'assistant');

                const lastLine = lastUserMessage
                    ? `Последний запрос был: «${shortenSnippet(lastUserMessage.content)}».`
                    : lastAssistantMessage
                        ? `Последнее, что я отправил: «${shortenSnippet(lastAssistantMessage.content)}».`
                        : null;

                const closingMessage = [
                    '⏱️ Больше часа не было активности, очищаю сессию, чтобы начать с чистого листа.',
                    lastLine,
                    'Когда захочешь продолжить, просто напиши — подстроюсь под новый запрос.',
                ].filter(Boolean).join('\n\n');

                try {
                    await bot.telegram.sendMessage(
                        profile.telegramId,
                        closingMessage,
                        { disable_notification: true },
                    );
                    notificationsSent += 1;
                } catch (error) {
                    console.error('Failed to send inactivity notification:', error);
                    errorCount += 1;
                    if (errorSamples.length < 3) {
                        errorSamples.push(`notify:${(error as Error)?.name || 'unknown'}`);
                    }
                }

                try {
                    await db.markAssistantSessionClosed(profileId, {
                        reason: 'inactivity',
                        summary: lastUserMessage
                            ? {
                                last_user_message: lastUserMessage.content,
                                closed_within_minutes: thresholdMinutes,
                            }
                            : null,
                    });
                    closed += 1;
                } catch (error) {
                    console.error('Failed to mark assistant session closed:', error);
                    errorCount += 1;
                    if (errorSamples.length < 3) {
                        errorSamples.push(`close:${(error as Error)?.name || 'unknown'}`);
                    }
                }

                // Событие фиксируется в markAssistantSessionClosed
            }

            try {
                const durationMs = Math.round(performance.now() - sweepStart);
                await db.logEvent(null, 'assistant_inactivity_sweep', 'info', {
                    threshold_minutes: thresholdMinutes,
                    batch_limit: batchLimit,
                    scanned,
                    closed,
                    notifications_sent: notificationsSent,
                    error_count: errorCount,
                    error_samples: errorSamples,
                    duration_ms: durationMs,
                });
            } catch (error) {
                console.error('Failed to log inactivity sweep metrics:', error);
            }
        } catch (error) {
            console.error('Inactivity monitor tick failed:', error);
        }
    }

    const sweepTask = createRecurringTask({
        name: 'assistant-inactivity-sweep',
        intervalMs,
        skipIfRunning: true,
        run: tick,
    });

    return () => {
        sweepTask.dispose();
    };
}

export default {
    startInactivityMonitor,
};

