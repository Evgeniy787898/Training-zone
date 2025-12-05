import { Request, Response } from 'express';

import { AppError } from '../services/errors.js';
import { respondWithAppError } from './apiResponses.js';

export const respondAuthRequired = (req: Request, res: Response, message = 'Profile required') =>
    respondWithAppError(
        res,
        new AppError({
            code: 'auth_required',
            message,
            statusCode: 401,
            category: 'authentication',
        }),
        req.traceId ? { traceId: req.traceId } : undefined,
    );
