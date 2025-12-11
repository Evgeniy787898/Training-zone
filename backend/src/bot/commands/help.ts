/**
 * /help Command Handler
 * Extracted from bot/runtime.ts as part of BOT-R02 decomposition
 *
 * Premium Design v7.0 - Help with command list
 */
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import {
    emoji,
    decor,
    spoiler,
    setMessageReaction,
} from '../helpers/index.js';

type HelpCommandContext = Context & {
    state?: {
        profileId?: string;
    };
};

/**
 * Help menu inline keyboard
 */
const helpMenuKeyboard = Markup.inlineKeyboard([
    [
        Markup.button.callback(`✨ Демо`, 'demo_menu'),
        Markup.button.callback(`📊 Статистика`, 'demo_stats'),
    ],
    [
        Markup.button.callback(`🎉 Праздник`, 'demo_celebrate'),
        Markup.button.callback(`🔥 Мотивация`, 'cmd_motivate'),
    ],
]);

/**
 * Help command handler
 */
export async function helpCommand(ctx: HelpCommandContext): Promise<void> {
    // React to help
    if (ctx.message) {
        await setMessageReaction(ctx, ctx.message.message_id, 'ℹ️');
    }

    const text =
        `${emoji.book} <b>TZONA v7.0 Помощь</b>\n` +
        `${decor.divider}\n\n` +
        `<code>┌─────────────────────┐</code>\n` +
        `<code>│ 📅 /today /done     │</code>\n` +
        `<code>│ 🔥 /warmup /cooldown│</code>\n` +
        `<code>│ 🧠 /brief /coach    │</code>\n` +
        `<code>│ 🎯 /challenge       │</code>\n` +
        `<code>│ ❤️ /stretch /breathe│</code>\n` +
        `<code>│ 📊 /stats /profile  │</code>\n` +
        `<code>│ ✨ /demo            │</code>\n` +
        `<code>└─────────────────────┘</code>\n\n` +
        `${spoiler('🎁 Секрет: /motivate для заряда!')}\n\n` +
        `${emoji.sparkles} @tzona_bot — inline поиск`;

    await ctx.replyWithHTML(text, helpMenuKeyboard);
}

export default helpCommand;
