/**
 * /settings Command Handler
 * Extracted from bot/runtime.ts as part of BOT-R02 decomposition
 *
 * Redirects user to WebApp settings
 */
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import { emoji } from '../helpers/index.js';

// Using any for state as it's set by middleware
type SettingsCommandContext = Context & {
    state?: Record<string, any>;
};

interface SettingsCommandDeps {
    webAppUrl?: string;
}

/**
 * Settings command handler - opens WebApp settings
 */
export async function settingsCommand(ctx: SettingsCommandContext, deps: SettingsCommandDeps): Promise<void> {
    const text =
        `${emoji.gear} <b>Настройки</b>\n\n` +
        `Настройки уведомлений и другие параметры доступны в приложении.\n\n` +
        `${emoji.info} <i>Открой TZONA → Настройки</i>`;

    const keyboard = deps.webAppUrl
        ? Markup.inlineKeyboard([[Markup.button.webApp(`${emoji.gear} Открыть настройки`, deps.webAppUrl)]])
        : undefined;

    await ctx.replyWithHTML(text, keyboard);
}

export default settingsCommand;
