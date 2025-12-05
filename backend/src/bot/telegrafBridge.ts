import type {
    ChatId,
    ReplyMarkup,
    TelegramContext,
    TelegramMessage,
    TelegramSendOptions,
    TelegramTransportContract,
} from '../types/telegram.js';
import { withCircuitBreaker } from '../modules/infrastructure/circuitBreaker.js';
import { parseTelegramMessageResponse } from '../services/externalDataValidation.js';

const TELEGRAM_CIRCUIT = 'telegram_api';

class TelegramTransport implements TelegramTransportContract {
    constructor(private token: string) { }

    private get apiBase() {
        if (!this.token) {
            throw new Error('Telegram bot token is not configured');
        }
        return `https://api.telegram.org/bot${this.token}`;
    }

    async sendMessage(chatId: ChatId, text: string, options: TelegramSendOptions = {}): Promise<TelegramMessage> {
        if (!this.token) {
            console.warn('[telegram] sendMessage skipped: missing TELEGRAM_BOT_TOKEN');
            return { message_id: Date.now(), chat: { id: chatId } };
        }

        const payload = {
            chat_id: chatId,
            text,
            ...options,
        };

        return withCircuitBreaker(TELEGRAM_CIRCUIT, async () => {
            const response = await fetch(`${this.apiBase}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Telegram sendMessage failed: ${errorText}`);
            }

            const data = await response.json();
            return parseTelegramMessageResponse(data);
        });
    }

    async deleteMessage(chatId: ChatId, messageId: number): Promise<void> {
        if (!this.token) {
            console.warn('[telegram] deleteMessage skipped: missing TELEGRAM_BOT_TOKEN');
            return;
        }

        const payload = {
            chat_id: chatId,
            message_id: messageId,
        };

        await withCircuitBreaker(TELEGRAM_CIRCUIT, async () => {
            const response = await fetch(`${this.apiBase}/deleteMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Telegram deleteMessage failed: ${errorText}`);
            }
        });
    }
}

export class Telegraf {
    public telegram: TelegramTransportContract;

    constructor(private token: string) {
        this.telegram = new TelegramTransport(token);
    }

    // Telegraf-compatible API placeholders
    use() { /* noop */ }
    start() { /* noop */ }
    launch() { /* noop */ }
    stop() { /* noop */ }
}

export type Context = TelegramContext;

export type { TelegramMessage };

type ButtonFactory = {
    text: (label: string) => any;
    callback: (label: string, data: string) => any;
    webApp: (label: string, url: string) => any;
};

function createButtonFactory(): ButtonFactory {
    return {
        text: (label: string) => ({ text: label }),
        callback: (label: string, data: string) => ({ text: label, callback_data: data }),
        webApp: (label: string, url: string) => ({ text: label, web_app: { url } }),
    };
}

function createKeyboardBuilder() {
    return {
        button: createButtonFactory(),
        keyboard(rows: any[][]) {
            const markup: ReplyMarkup = {
                keyboard: rows,
                resize_keyboard: false,
                is_persistent: false,
            };
            const api: any = {
                reply_markup: markup,
                resize() {
                    markup.resize_keyboard = true;
                    return api;
                },
                persistent() {
                    markup.is_persistent = true;
                    return api;
                },
                placeholder(text: string) {
                    markup.input_field_placeholder = text;
                    return api;
                },
                build() {
                    return { reply_markup: markup };
                },
            };
            return api;
        },
        inlineKeyboard(rows: any[][]) {
            const markup: ReplyMarkup = {
                inline_keyboard: rows,
            };
            const api: any = {
                reply_markup: markup,
                build() {
                    return { reply_markup: markup };
                },
            };
            return api;
        },
    };
}

export const Markup: any = createKeyboardBuilder();

export default {
    Telegraf,
    Markup,
};
