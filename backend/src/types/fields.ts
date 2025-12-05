import { z } from 'zod';
import { fieldSelectionConfig } from '../config/constants.js';

const fieldNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(fieldSelectionConfig.maxFieldNameLength)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Недопустимое имя поля');

const fieldSelectionArraySchema = z
    .array(fieldNameSchema)
    .min(1)
    .max(fieldSelectionConfig.maxFields)
    .transform((values) => {
        const unique: string[] = [];
        for (const value of values) {
            if (!unique.includes(value)) {
                unique.push(value);
            }
        }
        return unique;
    });

export const fieldSelectionParamSchema = z
    .preprocess((input) => {
        if (input === undefined) {
            return undefined;
        }
        const rawValues = Array.isArray(input) ? input : [input];
        return rawValues
            .flatMap((entry) => String(entry).split(','))
            .map((token) => token.trim())
            .filter(Boolean)
            .slice(0, fieldSelectionConfig.maxFields);
    }, fieldSelectionArraySchema)
    .optional();

export type FieldSelectionParam = z.infer<typeof fieldSelectionParamSchema>;

export interface FieldSelectionOptions<T extends string> {
    requested?: readonly string[];
    allowed: readonly T[];
    defaults?: readonly T[];
}

export interface FieldSelectionResult<T extends string> {
    fields: readonly T[];
    requested?: readonly string[];
}
