/**
 * AI Response Processing Pipeline
 * Combines validation, sanitization, and moderation into a single processing flow
 */

import {
    parseAiChatResponse,
    safeParseAiChatResponse,
    validateAiCards,
    type AiChatResponse,
    type AiCard,
} from './externalDataValidation.js';
import {
    moderateContent,
    sanitizeAiResponse,
    type ContentModerationResult,
} from './contentModeration.js';
import {
    validateAiCardData,
    buildVeracityContext,
    type VeracityCheckResult,
    type DataVeracityContext,
} from './aiDataVeracity.js';

export interface AiResponseProcessingResult {
    // Final processed response
    response: AiChatResponse | null;
    // Processing metadata
    metadata: {
        validated: boolean;
        moderated: boolean;
        cardDataVerified: boolean;
        processingTimeMs: number;
    };
    // Issues found during processing
    issues: {
        validationErrors: string[];
        moderationWarnings: string[];
        veracityWarnings: string[];
    };
    // Whether response is safe to show to user
    isSafe: boolean;
}

export interface ProcessingOptions {
    // Skip validation (use for trusted sources)
    skipValidation?: boolean;
    // Skip content moderation
    skipModeration?: boolean;
    // Skip data veracity check
    skipVeracityCheck?: boolean;
    // User context for veracity checking
    userContext?: Partial<DataVeracityContext>;
    // Strict mode: reject on any warning
    strictMode?: boolean;
}

/**
 * Process raw AI response through validation, moderation, and veracity checks
 * Returns a safe, validated response or null if unsafe
 */
export async function processAiResponse(
    rawResponse: unknown,
    options: ProcessingOptions = {},
): Promise<AiResponseProcessingResult> {
    const startTime = Date.now();
    const result: AiResponseProcessingResult = {
        response: null,
        metadata: {
            validated: false,
            moderated: false,
            cardDataVerified: false,
            processingTimeMs: 0,
        },
        issues: {
            validationErrors: [],
            moderationWarnings: [],
            veracityWarnings: [],
        },
        isSafe: false,
    };

    try {
        // Step 1: Validate JSON structure
        let parsedResponse: AiChatResponse | null = null;

        if (!options.skipValidation) {
            parsedResponse = safeParseAiChatResponse(rawResponse);

            if (!parsedResponse) {
                // Try to extract just the text if JSON parsing failed
                if (typeof rawResponse === 'string') {
                    parsedResponse = {
                        reply: rawResponse,
                        cards: undefined,
                    };
                } else if (typeof rawResponse === 'object' && rawResponse !== null) {
                    const obj = rawResponse as Record<string, unknown>;
                    if (typeof obj.reply === 'string' || typeof obj.text === 'string' || typeof obj.message === 'string') {
                        parsedResponse = {
                            reply: (obj.reply || obj.text || obj.message) as string,
                            cards: undefined,
                        };
                    }
                }

                if (!parsedResponse) {
                    result.issues.validationErrors.push('Не удалось распарсить ответ AI');
                    return result;
                }
            }

            result.metadata.validated = true;
        } else {
            parsedResponse = rawResponse as AiChatResponse;
            result.metadata.validated = true;
        }

        // Step 2: Content moderation
        if (!options.skipModeration) {
            const moderationResult: ContentModerationResult = moderateContent(parsedResponse.reply);

            if (!moderationResult.isClean) {
                result.issues.moderationWarnings.push(...moderationResult.warnings);

                // Apply sanitized content
                if (moderationResult.sanitizedContent) {
                    parsedResponse = {
                        ...parsedResponse,
                        reply: moderationResult.sanitizedContent,
                    };
                }

                // In strict mode, reject flagged content
                if (options.strictMode && moderationResult.flaggedCategories.length > 0) {
                    result.issues.validationErrors.push('Контент содержит недопустимые элементы');
                    return result;
                }
            }

            result.metadata.moderated = true;
        }

        // Step 3: Card validation and veracity check
        if (parsedResponse.cards && parsedResponse.cards.length > 0) {
            // Validate card structure
            const validatedCards = validateAiCards(parsedResponse.cards);

            // Check data veracity if context provided
            if (!options.skipVeracityCheck && options.userContext) {
                const veracityResult: VeracityCheckResult = validateAiCardData(
                    validatedCards,
                    options.userContext,
                );

                if (!veracityResult.isValid) {
                    result.issues.veracityWarnings.push(...veracityResult.warnings);

                    // In strict mode, reject unverified data
                    if (options.strictMode) {
                        result.issues.validationErrors.push('Данные карточек не прошли проверку');
                        return result;
                    }
                }

                result.metadata.cardDataVerified = true;
            }

            // Update response with validated cards
            parsedResponse = {
                ...parsedResponse,
                cards: validatedCards,
            };
        }

        // Final result
        result.response = parsedResponse;
        result.isSafe = result.issues.validationErrors.length === 0;

    } catch (error) {
        result.issues.validationErrors.push(
            error instanceof Error ? error.message : 'Неизвестная ошибка обработки'
        );
    } finally {
        result.metadata.processingTimeMs = Date.now() - startTime;
    }

    return result;
}

/**
 * Quick validation for AI response - returns boolean
 */
export function isAiResponseValid(rawResponse: unknown): boolean {
    return safeParseAiChatResponse(rawResponse) !== null;
}

/**
 * Sanitize AI text response without full processing
 */
export function sanitizeAiText(text: string): string {
    return sanitizeAiResponse(text);
}

/**
 * Create user context for veracity checking from profile data
 */
export function createVeracityContext(profileData: {
    exercises?: { name: string }[];
    sessions?: { date: string }[];
    createdAt?: string | Date;
    lastWorkout?: string | Date;
}): DataVeracityContext {
    return buildVeracityContext(profileData);
}
