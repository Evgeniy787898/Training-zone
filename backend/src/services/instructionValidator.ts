/**
 * Personal Instruction Validator (PERS-INS-004)
 * Validates user-defined AI instructions to prevent abuse
 */

import { z } from 'zod';
import { stripDangerousContent } from './stringSanitization.js';

// Maximum lengths for different instruction types
const INSTRUCTION_LIMITS: Record<string, number> = {
    name: 50,
    address: 50,         // How AI should address user
    generalNote: 500,    // General instructions
    injury: 200,         // Injury description
    preference: 200,     // Training preferences
    prohibition: 200,    // Things to avoid
    style: 200,          // Communication style
    note: 500,           // General note
    total: 2000,         // Total character limit for all instructions
};

// Patterns that indicate malicious or inappropriate instructions
const FORBIDDEN_PATTERNS = [
    // Jailbreak attempts
    /ignore\s+(previous|all|your)\s+(instructions?|rules?|guidelines?)/gi,
    /игнорир(уй|овать)\s+(все|предыдущие)\s+(инструкции|правила)/gi,
    /забудь\s+(все|свои)\s+(правила|инструкции)/gi,
    /ты\s+теперь\s+(не|больше\s+не)\s+(ai|ии|тренер)/gi,
    /act\s+as\s+if\s+you\s+(are|were)\s+not\s+an?\s+ai/gi,
    /pretend\s+(to\s+be|you\s+are)/gi,

    // Role manipulation
    /ты\s+(теперь|сейчас)\s+[а-яё]+\s+(а\s+не|вместо)/gi,
    /перестань\s+быть\s+тренером/gi,

    // Instruction injection
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /user\s*:\s*/gi,
    /\[\[.+\]\]/g,  // Hidden instructions
    /{{.+}}/g,

    // Harmful content requests
    /как\s+(сделать|изготовить)\s+(бомбу|оружие|наркотики?)/gi,
    /помоги\s+(взломать|украсть|обмануть)/gi,
];

// Suspicious keywords that require review (not auto-blocked)
const SUSPICIOUS_KEYWORDS = [
    'пароль', 'password', 'secret', 'api', 'key', 'token',
    'банк', 'карта', 'деньги', 'перевод',
    'взлом', 'hack', 'crack', 'bypass',
];

export interface InstructionValidationResult {
    isValid: boolean;
    sanitizedInstruction: string | null;
    errors: string[];
    warnings: string[];
}

// Schema for a single instruction entry
const instructionEntrySchema = z.object({
    type: z.enum([
        'name',          // Preferred name
        'address',       // How to address (на ты/на вы)
        'injury',        // Injuries to be aware of
        'preference',    // Training preferences
        'prohibition',   // Things to avoid
        'style',         // Communication style preference
        'note',          // General note
    ]),
    value: z.string().min(1).max(500),
    priority: z.number().int().min(1).max(10).optional(),
});

// Schema for the full personal instructions object
export const personalInstructionsSchema = z.object({
    instructions: z.array(instructionEntrySchema).max(20),
    updatedAt: z.string().datetime().optional(),
}).strict();

export type PersonalInstructionEntry = z.infer<typeof instructionEntrySchema>;
export type PersonalInstructions = z.infer<typeof personalInstructionsSchema>;

/**
 * Check if instruction contains forbidden patterns (jailbreak attempts)
 */
function containsForbiddenPatterns(text: string): string[] {
    const matched: string[] = [];

    for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) {
            matched.push(pattern.source);
        }
        pattern.lastIndex = 0;
    }

    return matched;
}

/**
 * Check for suspicious keywords (warning, not blocking)
 */
function containsSuspiciousKeywords(text: string): string[] {
    const textLower = text.toLowerCase();
    const found: string[] = [];

    for (const keyword of SUSPICIOUS_KEYWORDS) {
        if (textLower.includes(keyword.toLowerCase())) {
            found.push(keyword);
        }
    }

    return found;
}

/**
 * Validate and sanitize a single instruction string
 */
export function validateInstruction(
    instruction: string,
    type: PersonalInstructionEntry['type'],
): InstructionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!instruction || typeof instruction !== 'string') {
        return {
            isValid: false,
            sanitizedInstruction: null,
            errors: ['Инструкция должна быть непустой строкой'],
            warnings: [],
        };
    }

    // Get limit for this type
    const limit = INSTRUCTION_LIMITS[type] || INSTRUCTION_LIMITS.generalNote;

    // Check length
    if (instruction.length > limit) {
        errors.push(`Превышена максимальная длина (${limit} символов)`);
    }

    // Check for forbidden patterns (jailbreak attempts)
    const forbidden = containsForbiddenPatterns(instruction);
    if (forbidden.length > 0) {
        errors.push('Обнаружена попытка манипуляции AI-инструкциями');
        console.warn('[Instruction Validator] Jailbreak attempt detected:', forbidden);
    }

    // Check for suspicious keywords
    const suspicious = containsSuspiciousKeywords(instruction);
    if (suspicious.length > 0) {
        warnings.push(`Подозрительные ключевые слова: ${suspicious.join(', ')}`);
    }

    // Sanitize XSS and dangerous content
    const sanitized = stripDangerousContent(instruction.trim());

    // Check if sanitization changed the content significantly
    if (sanitized.length < instruction.length * 0.5 && instruction.length > 20) {
        warnings.push('Удалена значительная часть потенциально опасного контента');
    }

    return {
        isValid: errors.length === 0,
        sanitizedInstruction: errors.length === 0 ? sanitized : null,
        errors,
        warnings,
    };
}

/**
 * Validate an array of personal instructions
 */
export function validatePersonalInstructions(
    instructions: PersonalInstructionEntry[],
): InstructionValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const sanitizedInstructions: PersonalInstructionEntry[] = [];

    // Check total count
    if (instructions.length > 20) {
        allErrors.push('Максимальное количество инструкций: 20');
    }

    // Calculate total length
    let totalLength = 0;

    for (let i = 0; i < instructions.length; i++) {
        const entry = instructions[i];
        const result = validateInstruction(entry.value, entry.type);

        if (!result.isValid) {
            allErrors.push(`[Инструкция ${i + 1}] ${result.errors.join(', ')}`);
        } else {
            sanitizedInstructions.push({
                ...entry,
                value: result.sanitizedInstruction!,
            });
            totalLength += result.sanitizedInstruction!.length;
        }

        allWarnings.push(...result.warnings.map(w => `[${i + 1}] ${w}`));
    }

    // Check total length
    if (totalLength > INSTRUCTION_LIMITS.total) {
        allErrors.push(`Общая длина инструкций превышает ${INSTRUCTION_LIMITS.total} символов`);
    }

    return {
        isValid: allErrors.length === 0,
        sanitizedInstruction: allErrors.length === 0
            ? JSON.stringify(sanitizedInstructions)
            : null,
        errors: allErrors,
        warnings: allWarnings,
    };
}

/**
 * Build system prompt addition from validated personal instructions
 */
export function buildInstructionPrompt(instructions: PersonalInstructionEntry[]): string {
    if (!instructions || instructions.length === 0) {
        return '';
    }

    const sections: Record<string, string[]> = {
        name: [],
        address: [],
        injury: [],
        preference: [],
        prohibition: [],
        style: [],
        note: [],
    };

    for (const entry of instructions) {
        if (sections[entry.type]) {
            sections[entry.type].push(entry.value);
        }
    }

    const parts: string[] = ['## ПЕРСОНАЛЬНЫЕ НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ:'];

    if (sections.name.length > 0) {
        parts.push(`**Имя:** ${sections.name[0]}`);
    }

    if (sections.address.length > 0) {
        parts.push(`**Обращение:** ${sections.address[0]}`);
    }

    if (sections.injury.length > 0) {
        parts.push(`**Травмы/ограничения:** ${sections.injury.join('; ')}`);
    }

    if (sections.preference.length > 0) {
        parts.push(`**Предпочтения:** ${sections.preference.join('; ')}`);
    }

    if (sections.prohibition.length > 0) {
        parts.push(`**НЕ рекомендовать:** ${sections.prohibition.join('; ')}`);
    }

    if (sections.style.length > 0) {
        parts.push(`**Стиль общения:** ${sections.style[0]}`);
    }

    if (sections.note.length > 0) {
        parts.push(`**Заметки:** ${sections.note.join('; ')}`);
    }

    return parts.join('\n');
}
