/**
 * Content Moderation Service (QUAL-008)
 * Filters harmful, inappropriate, or dangerous content from AI responses
 */

// Categories of harmful content to filter
export type ContentCategory =
    | 'medical_advice'      // Dangerous medical recommendations
    | 'financial_advice'    // Investment/financial advice
    | 'harmful_instructions' // Self-harm, dangerous activities
    | 'inappropriate'       // Profanity, adult content
    | 'personal_data'       // Credit cards, passwords, SSN
    | 'external_links'      // Links to external sites
    | 'spam';               // Repetitive/promotional content

export interface ContentModerationResult {
    isClean: boolean;
    flaggedCategories: ContentCategory[];
    sanitizedContent?: string;
    warnings: string[];
}

// Medical disclaimer patterns - AI should not give specific medical advice
const MEDICAL_PATTERNS = [
    /принимай?\s+(\d+\s*)?(мг|грамм|таблет)/gi,
    /диагноз\s*[:\-]?\s*\w+/gi,
    /выпей\s+(обезболивающее|лекарство|таблетку)/gi,
    /не\s+ходи\s+к\s+врачу/gi,
    /это\s+(не\s+)?опасно,?\s*можно\s+игнорировать/gi,
];

// Financial advice patterns
const FINANCIAL_PATTERNS = [
    /инвестируй\s+в/gi,
    /купи\s+(акции|крипто|биткоин)/gi,
    /гарантированн(ый|ая|ое)\s+доход/gi,
    /быстр(ый|ая|ое)\s+заработок/gi,
];

// Harmful/dangerous instructions
const HARMFUL_PATTERNS = [
    /как\s+(сделать|изготовить)\s+(бомбу|взрывчатку|оружие)/gi,
    /способы?\s+(самоповреждения|суицида)/gi,
    /как\s+взломать/gi,
    /обойти\s+защиту/gi,
];

// Personal data patterns (should not be in AI responses)
const PERSONAL_DATA_PATTERNS = [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,  // Credit card numbers
    /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g,              // SSN-like
    /password\s*[:=]\s*\S+/gi,
    /пароль\s*[:=]\s*\S+/gi,
    /api[_-]?key\s*[:=]\s*\S+/gi,
];

// External links (AI should keep users in-app)
const EXTERNAL_LINK_PATTERNS = [
    /https?:\/\/(?!localhost|127\.0\.0\.1)[^\s]+/gi,
    /www\.[^\s]+\.[a-z]{2,}/gi,
];

// Inappropriate content keywords (Russian and English)
const INAPPROPRIATE_KEYWORDS = new Set([
    // Add profanity and inappropriate terms here
    // Keeping minimal for now - can be extended
]);

/**
 * Check content against a specific category of patterns
 */
function checkPatterns(content: string, patterns: RegExp[]): boolean {
    for (const pattern of patterns) {
        if (pattern.test(content)) {
            return true;
        }
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
    }
    return false;
}

/**
 * Remove matched patterns from content
 */
function removePatterns(content: string, patterns: RegExp[]): string {
    let cleaned = content;
    for (const pattern of patterns) {
        cleaned = cleaned.replace(pattern, '[удалено]');
        pattern.lastIndex = 0;
    }
    return cleaned;
}

/**
 * Main content moderation function
 * Checks AI response for harmful content and sanitizes if needed
 */
export function moderateContent(content: string): ContentModerationResult {
    const flaggedCategories: ContentCategory[] = [];
    const warnings: string[] = [];
    let sanitizedContent = content;

    // Check medical advice
    if (checkPatterns(content, MEDICAL_PATTERNS)) {
        flaggedCategories.push('medical_advice');
        warnings.push('Содержит потенциально опасные медицинские рекомендации');
        sanitizedContent = removePatterns(sanitizedContent, MEDICAL_PATTERNS);
    }

    // Check financial advice
    if (checkPatterns(content, FINANCIAL_PATTERNS)) {
        flaggedCategories.push('financial_advice');
        warnings.push('Содержит финансовые советы');
        sanitizedContent = removePatterns(sanitizedContent, FINANCIAL_PATTERNS);
    }

    // Check harmful instructions
    if (checkPatterns(content, HARMFUL_PATTERNS)) {
        flaggedCategories.push('harmful_instructions');
        warnings.push('Содержит потенциально опасный контент');
        sanitizedContent = removePatterns(sanitizedContent, HARMFUL_PATTERNS);
    }

    // Check personal data leaks
    if (checkPatterns(content, PERSONAL_DATA_PATTERNS)) {
        flaggedCategories.push('personal_data');
        warnings.push('Содержит персональные данные');
        sanitizedContent = removePatterns(sanitizedContent, PERSONAL_DATA_PATTERNS);
    }

    // Check external links
    if (checkPatterns(content, EXTERNAL_LINK_PATTERNS)) {
        flaggedCategories.push('external_links');
        warnings.push('Содержит внешние ссылки');
        sanitizedContent = removePatterns(sanitizedContent, EXTERNAL_LINK_PATTERNS);
    }

    return {
        isClean: flaggedCategories.length === 0,
        flaggedCategories,
        sanitizedContent: flaggedCategories.length > 0 ? sanitizedContent : undefined,
        warnings,
    };
}

/**
 * Quick check if content is safe (no detailed report)
 */
export function isContentSafe(content: string): boolean {
    return moderateContent(content).isClean;
}

/**
 * Sanitize content and return clean version
 * Always returns a string (original or cleaned)
 */
export function sanitizeAiResponse(content: string): string {
    const result = moderateContent(content);
    return result.sanitizedContent || content;
}

/**
 * Add safety disclaimer to AI response if needed
 */
export function addSafetyDisclaimer(content: string, category: ContentCategory): string {
    const disclaimers: Record<ContentCategory, string> = {
        medical_advice: '\n\n⚠️ Для точных рекомендаций проконсультируйся с врачом.',
        financial_advice: '\n\n⚠️ Это не является финансовой рекомендацией.',
        harmful_instructions: '',
        inappropriate: '',
        personal_data: '',
        external_links: '',
        spam: '',
    };

    const disclaimer = disclaimers[category];
    return disclaimer ? content + disclaimer : content;
}
