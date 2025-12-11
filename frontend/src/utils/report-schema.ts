/**
 * Zod validation schemas for workout report forms
 * Task: REP-C02 - Type-safe form validation
 */
import { z } from 'zod';

// Session status options
export const SessionStatusSchema = z.enum(['done', 'skipped', 'partial'], {
    errorMap: () => ({ message: 'Выберите статус тренировки' }),
});

// RPE (Rate of Perceived Exertion) - scale 1-10
export const RpeSchema = z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .pipe(
        z.number({
            required_error: 'Укажите RPE',
            invalid_type_error: 'RPE должно быть числом',
        })
            .min(1, 'RPE минимум 1')
            .max(10, 'RPE максимум 10')
    );

// Exercise result schema
export const ExerciseResultSchema = z.object({
    sets: z
        .union([z.string(), z.number()])
        .transform((val) => (val === '' ? 0 : typeof val === 'string' ? parseInt(val, 10) : val))
        .pipe(
            z.number()
                .min(0, 'Подходы не могут быть отрицательными')
                .max(100, 'Слишком много подходов')
        ),
    reps: z
        .union([z.string(), z.number()])
        .transform((val) => (val === '' ? 0 : typeof val === 'string' ? parseInt(val, 10) : val))
        .pipe(
            z.number()
                .min(0, 'Повторения не могут быть отрицательными')
                .max(1000, 'Слишком много повторений')
        ),
    weight: z
        .union([z.string(), z.number()])
        .optional()
        .transform((val) => {
            if (val === undefined || val === '') return undefined;
            return typeof val === 'string' ? parseFloat(val) : val;
        })
        .pipe(
            z.number()
                .min(0, 'Вес не может быть отрицательным')
                .max(1000, 'Слишком большой вес')
                .optional()
        ),
    rpe: z
        .union([z.string(), z.number()])
        .optional()
        .transform((val) => {
            if (val === undefined || val === '') return undefined;
            return typeof val === 'string' ? parseInt(val, 10) : val;
        })
        .pipe(
            z.number()
                .min(1, 'RPE минимум 1')
                .max(10, 'RPE максимум 10')
                .optional()
        ),
    notes: z
        .string()
        .max(500, 'Заметка слишком длинная')
        .optional()
        .default(''),
});

// Full report form schema
export const ReportFormSchema = z.object({
    status: SessionStatusSchema,
    rpe: RpeSchema,
    notes: z
        .string()
        .max(1000, 'Заметки слишком длинные')
        .default(''),
    exercises: z.record(z.string(), ExerciseResultSchema),
});

// Infer TypeScript types from schemas
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type ExerciseResult = z.infer<typeof ExerciseResultSchema>;
export type ReportForm = z.infer<typeof ReportFormSchema>;

// Validation helper with formatted errors
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: Record<string, string>;
}

export function validateReportForm(data: unknown): ValidationResult<ReportForm> {
    const result = ReportFormSchema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    // Format Zod errors into field-based error map
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) {
            errors[path] = issue.message;
        }
    });

    return { success: false, errors };
}

// Validate single exercise
export function validateExerciseResult(data: unknown): ValidationResult<ExerciseResult> {
    const result = ExerciseResultSchema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
        const path = issue.path.join('.') || 'value';
        if (!errors[path]) {
            errors[path] = issue.message;
        }
    });

    return { success: false, errors };
}
