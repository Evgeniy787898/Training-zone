import type { IncomingHttpHeaders } from 'node:http';

export interface VerifyPinLogPayload {
    pin?: unknown;
    telegram_id?: unknown;
    initData?: unknown;
}

const STRING_HEADERS = [
    'authorization',
    'x-telegram-id',
    'x-telegram-init-data',
    'x-profile-id',
] as const;

export type VerifyPinHeaderSnapshot = Pick<IncomingHttpHeaders, (typeof STRING_HEADERS)[number]>;

const hasStringValue = (value: unknown): boolean =>
    typeof value === 'string' && value.trim().length > 0;

export const summarizeVerifyPinPayload = (payload?: VerifyPinLogPayload) => {
    if (!payload) {
        return {
            hasPin: false,
            hasInitData: false,
            hasTelegramId: false,
        };
    }

    const pin = typeof payload.pin === 'string' ? payload.pin : null;
    const initData = typeof payload.initData === 'string' ? payload.initData : null;
    const telegramId = payload.telegram_id;

    return {
        hasPin: hasStringValue(pin),
        pinLength: pin?.length,
        hasInitData: hasStringValue(initData),
        initDataLength: initData?.length,
        hasTelegramId: telegramId !== undefined && telegramId !== null,
    };
};

export const summarizeVerifyPinHeaders = (headers?: VerifyPinHeaderSnapshot | null) => {
    if (!headers) {
        return {
            hasAuthorization: false,
            hasTelegramIdHeader: false,
            hasInitDataHeader: false,
            hasProfileIdHeader: false,
        };
    }

    return {
        hasAuthorization: hasStringValue(headers.authorization),
        hasTelegramIdHeader: hasStringValue(headers['x-telegram-id']),
        hasInitDataHeader: hasStringValue(headers['x-telegram-init-data']),
        hasProfileIdHeader: hasStringValue(headers['x-profile-id']),
    };
};

const resolveBruteForceKeyType = (key: string | null | undefined) => {
    if (!key) {
        return 'unknown';
    }
    if (key.startsWith('telegram:')) {
        return 'telegram_id';
    }
    if (key.startsWith('profile:')) {
        return 'profile_id';
    }
    if (key.startsWith('initData:')) {
        return 'init_data';
    }
    if (key.startsWith('ip:')) {
        return 'ip';
    }
    return 'unknown';
};

export const describeBruteForceKey = (key: string | null | undefined) => ({
    keyType: resolveBruteForceKeyType(key),
});

