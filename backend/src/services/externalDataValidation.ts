import { z } from 'zod';
import type { TelegramMessage } from '../types/telegram.js';

const chatIdSchema = z.union([z.number(), z.string(), z.bigint()]);

const telegramMessageSchema = z.object({
    message_id: z.number(),
    chat: z.object({ id: chatIdSchema }),
});

const telegramResponseSchema = z.object({
    ok: z.boolean(),
    result: telegramMessageSchema.optional(),
    description: z.string().optional(),
});

export const parseTelegramMessageResponse = (payload: unknown): TelegramMessage => {
    const parsed = telegramResponseSchema.safeParse(payload);
    if (!parsed.success || !parsed.data.ok || !parsed.data.result) {
        const reason = parsed.success ? parsed.data.description || 'Telegram API returned an error' : 'Invalid Telegram payload';
        throw new Error(reason);
    }
    return parsed.data.result;
};

const imageProcessorAdjustmentsSchema = z.object({
    grayscale: z.boolean().optional(),
    sharpen: z.boolean().optional(),
    stripMetadata: z.boolean().optional(),
});

const imageProcessorResponseSchema = z.object({
    processedImage: z.string().min(1),
    width: z.number().optional(),
    height: z.number().optional(),
    format: z.string().optional(),
    size: z.number().optional(),
    optimized: z.boolean().optional(),
    options: z
        .object({
            mode: z.string().optional(),
            quality: z.number().optional(),
            background: z.string().nullable().optional(),
            format: z.string().optional(),
            adjustments: imageProcessorAdjustmentsSchema.optional(),
        })
        .optional(),
});

export type ImageProcessorResponse = z.infer<typeof imageProcessorResponseSchema>;

export const parseImageProcessorResponse = (payload: unknown): ImageProcessorResponse => {
    const parsed = imageProcessorResponseSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error('image-processor returned malformed payload');
    }
    return parsed.data;
};

const aiAdvisorResponseSchema = z.object({
    advice: z.string().min(1),
    nextSteps: z.array(z.string().min(1)).default([]),
    tips: z.array(z.string().min(1)).default([]).optional(),
    metadata: z.record(z.unknown()).default({}).optional(),
});

export type AiAdvisorResponse = z.infer<typeof aiAdvisorResponseSchema>;

export const parseAiAdvisorResponse = (payload: unknown): AiAdvisorResponse => {
    const parsed = aiAdvisorResponseSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error('ai-advisor returned malformed payload');
    }
    return parsed.data;
};

// ===== AI CARD VALIDATION SCHEMAS (QUAL-006) =====

// Stats card: displays key metrics
const statsItemSchema = z.object({
    value: z.union([z.number(), z.string()]),
    label: z.string().min(1).max(100),
    icon: z.string().max(10).optional(),
    change: z.number().optional(),
    trend: z.enum(['up', 'down', 'neutral']).optional(),
});

const statsCardDataSchema = z.object({
    stats: z.array(statsItemSchema).min(1).max(10),
});

// Chart card: bar/line charts
const chartDataPointSchema = z.object({
    label: z.string().min(1).max(50),
    value: z.number(),
    color: z.string().optional(),
});

const chartCardDataSchema = z.object({
    chartType: z.enum(['bar', 'line', 'pie', 'area']),
    data: z.array(chartDataPointSchema).min(1).max(50),
    xLabel: z.string().max(50).optional(),
    yLabel: z.string().max(50).optional(),
});

// Table card: data tables
const tableRowSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));

const tableCardDataSchema = z.object({
    columns: z.array(z.object({
        key: z.string().min(1).max(50),
        label: z.string().min(1).max(100),
        align: z.enum(['left', 'center', 'right']).optional(),
    })).min(1).max(20),
    rows: z.array(tableRowSchema).min(1).max(100),
});

// Progress card: progress bars/circles
const progressCardDataSchema = z.object({
    current: z.number().min(0),
    target: z.number().min(0),
    unit: z.string().max(20).optional(),
    percentage: z.number().min(0).max(100).optional(),
    color: z.string().optional(),
});

// Exercise card: exercise details
const exerciseCardDataSchema = z.object({
    name: z.string().min(1).max(100),
    sets: z.number().int().min(1).max(100).optional(),
    reps: z.number().int().min(1).max(1000).optional(),
    weight: z.number().min(0).max(10000).optional(),
    duration: z.number().min(0).optional(),
    rest: z.number().min(0).optional(),
    notes: z.string().max(500).optional(),
    level: z.string().max(50).optional(),
});

// Union of all card data types
const cardDataSchema = z.union([
    statsCardDataSchema,
    chartCardDataSchema,
    tableCardDataSchema,
    progressCardDataSchema,
    exerciseCardDataSchema,
    z.record(z.unknown()), // Fallback for unknown card types
]);

// Individual card schema
const aiCardSchema = z.object({
    type: z.enum(['stats', 'chart', 'table', 'progress', 'exercise', 'info', 'action']),
    title: z.string().min(1).max(200).optional(),
    data: cardDataSchema,
    subtitle: z.string().max(300).optional(),
    icon: z.string().max(10).optional(),
});

// Full AI chat response with cards
const aiChatResponseSchema = z.object({
    reply: z.string().min(1).max(10000),
    cards: z.array(aiCardSchema).max(10).optional(),
    suggestions: z.array(z.string().min(1).max(200)).max(5).optional(),
    emotion: z.enum(['neutral', 'happy', 'encouraging', 'concerned', 'excited']).optional(),
});

export type AiCard = z.infer<typeof aiCardSchema>;
export type AiChatResponse = z.infer<typeof aiChatResponseSchema>;

/**
 * Parse and validate AI chat response with cards
 * Returns validated response or throws on invalid structure
 */
export const parseAiChatResponse = (payload: unknown): AiChatResponse => {
    const parsed = aiChatResponseSchema.safeParse(payload);
    if (!parsed.success) {
        console.warn('[AI Validation] Invalid AI response structure:', parsed.error.issues);
        throw new Error(`AI response validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}`);
    }
    return parsed.data;
};

/**
 * Safely validate AI response - returns null instead of throwing
 */
export const safeParseAiChatResponse = (payload: unknown): AiChatResponse | null => {
    try {
        return parseAiChatResponse(payload);
    } catch {
        return null;
    }
};

/**
 * Validate only the cards array from AI response
 */
export const validateAiCards = (cards: unknown[]): AiCard[] => {
    const validated: AiCard[] = [];
    for (const card of cards) {
        const result = aiCardSchema.safeParse(card);
        if (result.success) {
            validated.push(result.data);
        } else {
            console.warn('[AI Validation] Skipping invalid card:', result.error.issues);
        }
    }
    return validated;
};
