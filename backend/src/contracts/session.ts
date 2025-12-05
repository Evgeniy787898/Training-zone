import { z } from 'zod';
import { TrainingSessionStatus } from '../types/sessions.js';

export const sessionStatusSchema = z.nativeEnum(TrainingSessionStatus);

export const updateSessionSchema = z
    .object({
        planned_at: z.string().trim().datetime({ offset: true }).optional(),
        status: sessionStatusSchema.optional(),
        notes: z.string().trim().max(10000).optional(),
    })
    .strict();

export const createSessionSchema = z
    .object({
        planned_at: z.string().trim().datetime({ offset: true }),
        status: sessionStatusSchema.optional(),
        notes: z.string().trim().max(10000).optional(),
    })
    .strict();

const optionalDateSchema = z
    .string()
    .trim()
    .refine((value) => {
        if (!value) {
            return false;
        }
        return !Number.isNaN(Date.parse(value));
    }, 'Некорректный формат даты')
    .optional();

export const sessionsDateQuerySchema = z
    .object({
        date: optionalDateSchema,
    })
    .strict();

export const sessionIdParamsSchema = z
    .object({
        id: z.string().trim().uuid(),
    })
    .strict();

export type SessionsDateQuery = z.infer<typeof sessionsDateQuerySchema>;
export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;
export type CreateSessionPayload = z.infer<typeof createSessionSchema>;
export type UpdateSessionPayload = z.infer<typeof updateSessionSchema>;
