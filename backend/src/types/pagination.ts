import { z } from 'zod';
import { paginationConfig } from '../config/constants.js';

const createOptionalIntSchema = (min: number, max?: number) => {
    const numberSchema = max !== undefined
        ? z.number().int().min(min).max(max)
        : z.number().int().min(min);

    const stringSchema = z
        .string()
        .trim()
        .regex(/^\d+$/)
        .transform((value) => Number(value))
        .refine((value) => value >= min && (max === undefined || value <= max), {
            message: max
                ? `Значение должно быть в диапазоне от ${min} до ${max}`
                : `Значение должно быть не меньше ${min}`,
        });

    return z.union([numberSchema, stringSchema]).optional();
};

export const paginationQuerySchema = z
    .object({
        page: createOptionalIntSchema(1),
        page_size: createOptionalIntSchema(1, paginationConfig.maxPageSize),
    })
    .strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type PaginationMeta = {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_more: boolean;
};
