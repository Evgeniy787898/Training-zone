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
