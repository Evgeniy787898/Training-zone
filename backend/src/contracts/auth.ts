import { z } from 'zod';

export const numericString = z
    .string()
    .trim()
    .regex(/^\d+$/);

export const verifyPinSchema = z
    .object({
        pin: z
            .string()
            .trim()
            .regex(/^\d{4}$/),
        telegram_id: z
            .union([
                numericString.transform((value) => Number(value)),
                z.number().int().nonnegative(),
            ])
            .optional(),
        initData: z.string().trim().optional(),
    })
    .strict();

export const telegramAuthSchema = z
    .object({
        initData: z.string().trim().min(1),
    })
    .strict();

export type VerifyPinPayload = z.infer<typeof verifyPinSchema>;
export type TelegramAuthPayload = z.infer<typeof telegramAuthSchema>;
