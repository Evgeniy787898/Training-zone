// TZONA V2 - Bot Menu Utilities
// Ported from V1 bot/utils/menu.js
import { Markup } from '../telegrafBridge.js';

const MAIN_MENU_BUTTON_ID = 'main_menu';

export function buildMainMenuKeyboard(webAppUrl?: string) {
    const rows = [];

    if (webAppUrl) {
        rows.push([
            Markup.button.webApp('🚀 Открыть панель', webAppUrl),
        ]);
    }

    rows.push([
        Markup.button.text('📅 План на сегодня'),
        Markup.button.text('📊 Мой прогресс'),
    ]);

    rows.push([
        Markup.button.text('📝 Отчёт о тренировке'),
        Markup.button.text('⚙️ Настройки'),
    ]);

    rows.push([
        Markup.button.text('❓ Помощь'),
    ]);

    return Markup.keyboard(rows)
        .resize()
        .persistent()
        .placeholder('Открой WebApp или выбери действие');
}

export function withMainMenuButton(rows: any[] = [], webAppUrl?: string) {
    const keyboardRows = Array.isArray(rows)
        ? rows.map(row => [...row])
        : [];

    if (webAppUrl) {
        keyboardRows.unshift([
            Markup.button.webApp('🚀 Открыть WebApp', webAppUrl),
        ]);
    }

    keyboardRows.push([
        Markup.button.callback('↩️ Главное меню', MAIN_MENU_BUTTON_ID),
    ]);

    return Markup.inlineKeyboard(keyboardRows);
}

export function mainMenuCallbackId() {
    return MAIN_MENU_BUTTON_ID;
}

export default {
    buildMainMenuKeyboard,
    withMainMenuButton,
    mainMenuCallbackId,
};

