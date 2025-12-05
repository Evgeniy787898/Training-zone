export type ChatId = number | string | bigint;

export type TelegramSendOptions = Record<string, unknown> | undefined;

export type ReplyMarkup = {
    keyboard?: any[];
    inline_keyboard?: any[];
    is_persistent?: boolean;
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
    input_field_placeholder?: string;
} | undefined;

export interface TelegramMessage {
    message_id: number;
    chat: { id: ChatId };
}

export interface TelegramWebAppUser {
    id: number | string | bigint;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
}

export interface TelegramTransportContract {
    sendMessage(
        chatId: ChatId,
        text: string,
        options?: TelegramSendOptions,
    ): Promise<TelegramMessage>;
    deleteMessage(chatId: ChatId, messageId: number): Promise<void>;
}

export interface TelegramContext {
    chat?: { id: ChatId };
    from?: { id: ChatId; username?: string; first_name?: string; language_code?: string };
    message?: { text?: string; message_id?: number };
    callbackQuery?: { data?: string; message?: { message_id?: number } };
    updateType?: string;
    state?: Record<string, unknown>;
    telegram: TelegramTransportContract;
    reply(
        text: string,
        options?: TelegramSendOptions & { reply_markup?: ReplyMarkup },
    ): Promise<TelegramMessage>;
}
