/**
 * Bot Helpers - Shared utilities for commands and handlers
 * Extracted from bot/runtime.ts as part of decomposition
 */
import { Markup } from 'telegraf';

// ============================================
// EMOJI CONSTANTS
// ============================================
export const emoji = {
    // Core
    fire: '🔥',
    muscle: '💪',
    trophy: '🏆',
    calendar: '📅',
    chart: '📊',
    star: '⭐',
    rocket: '🚀',
    brain: '🧠',
    heart: '❤️',
    sparkles: '✨',
    check: '✅',
    cross: '❌',
    clock: '⏰',
    target: '🎯',
    lightning: '⚡',
    wave: '👋',
    robot: '🤖',
    gear: '⚙️',
    info: 'ℹ️',
    warning: '⚠️',
    // Premium additions
    medal: '🏅',
    crown: '👑',
    gem: '💎',
    bolt: '⚡️',
    barbell: '🏋️',
    running: '🏃',
    timer: '⏱️',
    graph: '📈',
    notes: '📝',
    idea: '💡',
    celebration: '🎉',
    flexed: '💪🏻',
    ribbon: '🎗️',
    hundred: '💯',
    stopwatch: '⏱',
    calendar2: '🗓️',
    pin: '📌',
    book: '📖',
    zap: '⚡',
    sun: '☀️',
    moon: '🌙',
    coffee: '☕',
    water: '💧',
    apple: '🍎',
    sleep: '😴',
    strong: '🦾',
    eye: '👁️',
    thumbUp: '👍',
    clap: '👏',
    pray: '🙏',
    handshake: '🤝',
    food: '🍽️',
    video: '🎬',
    user: '👤',
} as const;

// ============================================
// TEXT DECORATORS
// ============================================
export const decor = {
    divider: '━━━━━━━━━━━━━━━━',
    line: '───────────────',
    bullet: '▸',
    arrow: '→',
    dot: '•',
    diamond: '◆',
    star: '★',
    circle: '○',
    filled: '●',
} as const;

// ============================================
// PROGRESS BARS
// ============================================
const PROGRESS_STYLES = {
    blocks: { empty: '⬜', filled: '🟩', complete: '✅' },
    circles: { empty: '⚪', filled: '🟢', complete: '✅' },
    fire: { empty: '▫️', filled: '🔥', complete: '💪' },
    stars: { empty: '☆', filled: '★', complete: '🌟' },
    hearts: { empty: '🤍', filled: '❤️', complete: '💖' },
} as const;

type ProgressStyle = keyof typeof PROGRESS_STYLES;

export const createProgressBar = (
    current: number,
    total: number,
    style: ProgressStyle = 'blocks',
    length: number = 10
): string => {
    const s = PROGRESS_STYLES[style];
    const filled = Math.round((current / total) * length);
    const isComplete = current >= total;

    if (isComplete) {
        return s.complete + ' ' + s.filled.repeat(length) + ' 100%';
    }

    const percent = Math.round((current / total) * 100);
    return s.filled.repeat(filled) + s.empty.repeat(length - filled) + ` ${percent}%`;
};

// ============================================
// TEXT HELPERS
// ============================================
export const spoiler = (text: string): string => `<tg-spoiler>${text}</tg-spoiler>`;

// ============================================
// MESSAGE REACTIONS
// ============================================
export const setMessageReaction = async (ctx: any, messageId: number, reaction: string): Promise<void> => {
    try {
        await ctx.telegram.setMessageReaction(ctx.chat.id, messageId, [
            { type: 'emoji', emoji: reaction }
        ]);
    } catch { /* Reactions not supported or failed */ }
};

// ============================================
// SESSION MANAGEMENT
// ============================================
interface SessionData {
    currentSection?: string;
    persistChat?: boolean;
}

const sessionStore = new Map<string, SessionData>();

export const setSession = (profileId: string, data: SessionData): void => {
    sessionStore.set(profileId, { ...sessionStore.get(profileId), ...data });
};

export const getSession = (profileId: string): SessionData | undefined => {
    return sessionStore.get(profileId);
};

export const clearSession = (profileId: string): void => {
    sessionStore.delete(profileId);
};

// ============================================
// MAIN KEYBOARD (Reply Keyboard)
// ============================================
export const mainKeyboard = Markup.keyboard([
    ['📅 Сегодня', '💪 Тренировка'],
    ['🧠 AI-коуч', '📊 Прогресс'],
]).resize();

// ============================================
// MESSAGE EFFECTS (Bot API 7.1+)
// ============================================
export const MESSAGE_EFFECTS = {
    fire: '5104841245755180586', // 🔥
    thumbsUp: '5107584321108051014', // 👍
    heart: '5044134455711629726', // ❤️
    party: '5046509860385120464', // 🎉
} as const;

export const sendWithEffect = async (
    ctx: any,
    text: string,
    effectId?: string,
    keyboard?: any
): Promise<void> => {
    try {
        await ctx.telegram.sendMessage(ctx.chat.id, text, {
            parse_mode: 'HTML',
            message_effect_id: effectId,
            ...keyboard,
        });
    } catch {
        // Fallback to regular message
        await ctx.replyWithHTML(text, keyboard);
    }
};

// ============================================
// EXPORT ALL
// ============================================
export default {
    emoji,
    decor,
    createProgressBar,
    spoiler,
    setMessageReaction,
    setSession,
    getSession,
    clearSession,
    mainKeyboard,
    MESSAGE_EFFECTS,
    sendWithEffect,
};
