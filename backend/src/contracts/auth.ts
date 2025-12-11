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

// SETT-F01: Change PIN schema - requires old PIN for verification
export const changePinSchema = z
    .object({
        oldPin: z
            .string()
            .trim()
            .regex(/^\d{4}$/, 'PIN должен состоять из 4 цифр'),
        newPin: z
            .string()
            .trim()
            .regex(/^\d{4}$/, 'PIN должен состоять из 4 цифр'),
    })
    .strict()
    .refine((data) => data.oldPin !== data.newPin, {
        message: 'Новый PIN должен отличаться от старого',
        path: ['newPin'],
    });

export type VerifyPinPayload = z.infer<typeof verifyPinSchema>;
export type TelegramAuthPayload = z.infer<typeof telegramAuthSchema>;
export type ChangePinPayload = z.infer<typeof changePinSchema>;

