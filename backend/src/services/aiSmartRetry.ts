/**
 * Smart AI Retry Service (QUAL-009)
 * Retries failed AI requests with modified prompts for better results
 */

export interface RetryConfig {
    maxRetries: number;
    strategies: RetryStrategy[];
}

export type RetryStrategy =
    | 'simplify_prompt'      // Shorten and simplify the prompt
    | 'add_examples'         // Add more examples
    | 'remove_context'       // Strip non-essential context
    | 'explicit_format'      // Add explicit format instructions
    | 'fallback_response';   // Return safe fallback

export interface RetryAttempt {
    strategy: RetryStrategy;
    success: boolean;
    attemptNumber: number;
    error?: string;
    latencyMs: number;
}

export interface RetryResult {
    success: boolean;
    response?: string;
    attempts: RetryAttempt[];
    finalStrategy?: RetryStrategy;
}

const DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    strategies: [
        'simplify_prompt',
        'explicit_format',
        'fallback_response',
    ],
};

/**
 * Simplify prompt by removing optional instructions
 */
function simplifyPrompt(prompt: string): string {
    // Remove example sections (они занимают много токенов)
    let simplified = prompt.replace(/### Пример \d+[\s\S]*?```\s*\n/g, '');

    // Remove Chain-of-Thought (can confuse some models)
    simplified = simplified.replace(/## 🧠 ПРОЦЕСС РАЗМЫШЛЕНИЯ[\s\S]*?(?=##|\n\n\n)/g, '');

    // Remove negative examples
    simplified = simplified.replace(/## ❌ ПРИМЕРЫ ПЛОХИХ ОТВЕТОВ[\s\S]*?(?=##|\n\n\n)/g, '');

    // Shorten length limits section
    simplified = simplified.replace(
        /## 📏 ОГРАНИЧЕНИЯ ДЛИНЫ:[\s\S]*?(?=##|\n\n\n)/g,
        '## 📏 Ответ: максимум 300 символов.\n\n'
    );

    return simplified.trim();
}

/**
 * Add explicit format instructions
 */
function addExplicitFormat(prompt: string): string {
    const formatInstructions = `
## ⚠️ КРИТИЧЕСКИ ВАЖНЫЙ ФОРМАТ ОТВЕТА:

ТЫ ДОЛЖЕН ОТВЕТИТЬ В ФОРМАТЕ JSON:
{
  "reply": "твой текстовый ответ здесь",
  "reaction": "💪"
}

НИКАКОГО ДРУГОГО ФОРМАТА. ТОЛЬКО JSON.
Если не можешь ответить — верни: {"reply": "Могу помочь с тренировками. Что конкретно интересует?", "reaction": "🤔"}
`;

    return prompt + '\n\n' + formatInstructions;
}

/**
 * Remove non-essential context
 */
function removeContext(prompt: string): string {
    // Remove detailed user context, keep only essential
    let stripped = prompt.replace(
        /## 👤 КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:[\s\S]*?(?=##|\n\n\n|$)/g,
        '## 👤 КОНТЕКСТ: Пользователь занимается фитнесом.\n\n'
    );

    // Remove database schema (not needed for simple responses)
    stripped = stripped.replace(
        /## 📊 СТРУКТУРА ДАННЫХ:[\s\S]*?(?=##|\n\n\n)/g,
        ''
    );

    return stripped.trim();
}

/**
 * Get fallback response when all retries fail
 */
function getFallbackResponse(userMessage: string): string {
    // Analyze message to give somewhat relevant fallback
    const lowerMsg = userMessage.toLowerCase();

    if (/план|сегодня|тренировк/i.test(lowerMsg)) {
        return JSON.stringify({
            reply: "Чтобы показать план, мне нужны данные о твоих тренировках. Расскажи, какие упражнения делаешь?",
            reaction: "🤔"
        });
    }

    if (/статистик|прогресс|результат/i.test(lowerMsg)) {
        return JSON.stringify({
            reply: "Для статистики нужны записанные тренировки. Запиши свою последнюю тренировку, и я покажу прогресс 📊",
            reaction: "📊"
        });
    }

    if (/мотивац|лень|устал/i.test(lowerMsg)) {
        return JSON.stringify({
            reply: "Каждая тренировка — это инвестиция в себя. Даже 15 минут лучше, чем ничего. Давай! 💪",
            reaction: "💪"
        });
    }

    if (/привет|здравствуй|хай/i.test(lowerMsg)) {
        return JSON.stringify({
            reply: "Привет! Я твой AI-тренер. Чем помочь? 💪",
            reaction: "💪"
        });
    }

    // Generic fallback
    return JSON.stringify({
        reply: "Я AI-тренер по фитнесу. Могу помочь с планом тренировок, показать прогресс или замотивировать. Что интересует?",
        reaction: "🤔"
    });
}

/**
 * Apply retry strategy to prompt
 */
export function applyRetryStrategy(
    originalPrompt: string,
    strategy: RetryStrategy,
    userMessage: string,
): string {
    switch (strategy) {
        case 'simplify_prompt':
            return simplifyPrompt(originalPrompt);

        case 'explicit_format':
            return addExplicitFormat(originalPrompt);

        case 'remove_context':
            return removeContext(originalPrompt);

        case 'add_examples':
            // Add more concrete examples
            return originalPrompt + `

## ПРИМЕР ОТВЕТА НА ТЕКУЩИЙ ВОПРОС:
Вопрос: "${userMessage.slice(0, 50)}"
Ответ: {"reply": "Ваш краткий ответ.", "reaction": "💪"}
`;

        case 'fallback_response':
            // This strategy returns immediately without AI call
            return getFallbackResponse(userMessage);

        default:
            return originalPrompt;
    }
}

/**
 * Execute retry logic with multiple strategies
 */
export async function executeWithRetry(
    aiCallFn: (prompt: string) => Promise<string>,
    originalPrompt: string,
    userMessage: string,
    config: Partial<RetryConfig> = {},
): Promise<RetryResult> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const attempts: RetryAttempt[] = [];

    // Try original prompt first
    try {
        const startTime = Date.now();
        const response = await aiCallFn(originalPrompt);
        attempts.push({
            strategy: 'simplify_prompt', // placeholder
            success: true,
            attemptNumber: 0,
            latencyMs: Date.now() - startTime,
        });
        return { success: true, response, attempts };
    } catch (originalError) {
        console.warn('[Smart Retry] Original prompt failed, starting retry sequence');
    }

    // Try each strategy
    for (let i = 0; i < Math.min(cfg.maxRetries, cfg.strategies.length); i++) {
        const strategy = cfg.strategies[i];
        const startTime = Date.now();

        try {
            // Special case: fallback doesn't need AI call
            if (strategy === 'fallback_response') {
                const fallback = getFallbackResponse(userMessage);
                attempts.push({
                    strategy,
                    success: true,
                    attemptNumber: i + 1,
                    latencyMs: Date.now() - startTime,
                });
                return { success: true, response: fallback, attempts, finalStrategy: strategy };
            }

            const modifiedPrompt = applyRetryStrategy(originalPrompt, strategy, userMessage);
            const response = await aiCallFn(modifiedPrompt);

            attempts.push({
                strategy,
                success: true,
                attemptNumber: i + 1,
                latencyMs: Date.now() - startTime,
            });

            console.log(`[Smart Retry] Strategy "${strategy}" succeeded on attempt ${i + 1}`);
            return { success: true, response, attempts, finalStrategy: strategy };

        } catch (error) {
            attempts.push({
                strategy,
                success: false,
                attemptNumber: i + 1,
                error: error instanceof Error ? error.message : 'Unknown error',
                latencyMs: Date.now() - startTime,
            });
            console.warn(`[Smart Retry] Strategy "${strategy}" failed:`, error);
        }
    }

    // All retries failed - use fallback
    const fallback = getFallbackResponse(userMessage);
    return {
        success: false,
        response: fallback,
        attempts,
        finalStrategy: 'fallback_response',
    };
}

/**
 * Analyze AI response and determine if retry is needed
 */
export function shouldRetry(response: string): { needsRetry: boolean; reason?: string } {
    // Empty response
    if (!response || response.trim().length === 0) {
        return { needsRetry: true, reason: 'Empty response' };
    }

    // Response too short
    if (response.length < 10) {
        return { needsRetry: true, reason: 'Response too short' };
    }

    // Response is error message
    if (/error|ошибка|не могу|не понимаю/i.test(response) && response.length < 50) {
        return { needsRetry: true, reason: 'Response appears to be error' };
    }

    // Response is off-topic (not about fitness)
    const fitnessKeywords = /тренировк|упражнен|вес|прогресс|мышц|фитнес|спорт|здоровь/i;
    if (!fitnessKeywords.test(response) && response.length > 100) {
        return { needsRetry: true, reason: 'Response may be off-topic' };
    }

    return { needsRetry: false };
}
