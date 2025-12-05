import { RequestHandler } from 'express';
import { RequestValidationService } from '../services/requestValidation.js';
import type {
    RequestValidationOptions,
    RequestValidationSchemas,
} from '../types/validation.js';
import { respondWithAppError } from '../utils/apiResponses.js';

export const validateRequest = (
    schemas: RequestValidationSchemas,
    options: RequestValidationOptions = {},
): RequestHandler => {
    return (req, res, next) => {
        const result = RequestValidationService.validate(schemas, {
            body: req.body,
            query: req.query,
            params: req.params,
            headers: req.headers,
        }, options);

        if (!result.success) {
            return respondWithAppError(
                res,
                result.error,
                {
                    traceId: req.traceId,
                    resource: req.path,
                    details: result.details,
                },
            );
        }

        req.body = result.data.body ?? req.body;
        req.query = (result.data.query as any) ?? req.query;
        req.params = (result.data.params as any) ?? req.params;
        if (result.data.headers) {
            Object.assign(req.headers, result.data.headers);
        }

        req.validated = result.data;
        return next();
    };
};
