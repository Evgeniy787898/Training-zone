import type { Pinia } from 'pinia';
import { useAppStore } from '@/stores/app';
import { configureClient } from '@/services/api';

export const initTelegramAuth = async (pinia: Pinia) => {
    if (typeof window === 'undefined') {
        return;
    }

    const appStore = useAppStore(pinia);
    const tg = window.Telegram?.WebApp;

    if (!tg) {
        appStore.demoMode = true;
        return;
    }

    tg.ready();
    tg.expand();

    const initData = tg.initData;
    const user = tg.initDataUnsafe?.user;

    if (user) {
        appStore.telegramUser = user;
        appStore.demoMode = false;
    } else if (initData) {
        appStore.demoMode = false;
    } else {
        appStore.demoMode = true;
    }

    try {
        await configureClient({
            telegramUser: user ?? undefined,
            initData: initData ?? undefined,
            skipAuth: true,
        });
    } catch (error) {
        console.debug('Telegram auth setup (non-blocking):', error);
    }
};
