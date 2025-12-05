import { ZodError } from 'zod';
import { AppError } from './errors.js';
import type { ErrorCode } from '../types/errors.js';
import type {
    RequestValidationOptions,
    RequestValidationPart,
    RequestValidationPayloads,
    RequestValidationResult,
    RequestValidationSchemas,
} from '../types/validation.js';

const DEFAULT_ERROR: { error: ErrorCode; message: string } = {
    error: 'validation_failed',
    message: 'Некорректные данные запроса',
};

const partLabels: Record<RequestValidationPart, string> = {
    body: 'тела запроса',
    query: 'параметров запроса',
    params: 'параметров маршрута',
    headers: 'заголовков',
};

export class RequestValidationService {
    static validate(
        schemas: RequestValidationSchemas,
        payloads: RequestValidationPayloads,
        options: RequestValidationOptions = {},
    ): RequestValidationResult {
        const validated: RequestValidationPayloads = {};

        for (const key of Object.keys(schemas) as RequestValidationPart[]) {
            const schema = schemas[key];
            if (!schema) {
                continue;
            }

            try {
                const parsed = schema.parse(payloads[key] ?? {});
                validated[key] = parsed;
            } catch (error) {
                if (error instanceof ZodError) {
                    const override = options.messages?.[key];
                    const validationError = new AppError({
                        message: override?.message ?? `${DEFAULT_ERROR.message}: ${partLabels[key]}`,
                        code: override?.error ?? DEFAULT_ERROR.error,
                        statusCode: 422,
                        category: 'validation',
                        details: {
                            part: key,
                            issues: error.issues,
                        },
                        exposeDetails: true,
                        cause: error,
                    });

                    return {
                        success: false,
                        error: validationError,
                        details: {
                            part: key,
                            issues: error.issues,
                        },
                    };
                }

                throw error;
            }
        }

        return {
            success: true,
            data: validated,
        };
    }
}
