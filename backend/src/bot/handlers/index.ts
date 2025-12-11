/**
 * Bot Handlers - Barrel exports
 * Part of bot/runtime.ts decomposition (BOT-R01 - BOT-R03)
 */

// Handler exports:
export {
    createNavigationHandlers,
    trackMessage,
    clearSection,
    clearAllMessages,
    backToMenuRow,
    compactMainMenu,
    trainingMenu,
    gamesMenu,
    wellnessMenu,
    profileMenu,
} from './callbackQuery.js';

export {
    createMessageHandler,
    checkAiRateLimit,
    getConversationContext,
    addToConversation,
    clearConversationHistory,
    detectIntent,
    MAX_CONTEXT_MESSAGES,
} from './message.js';
