import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

import { AppError } from '../services/errors.js';
import { respondWithAppError } from '../utils/apiResponses.js';

const router = Router();

const resolveSpecPath = (): string => {
    const configured = process.env.OPENAPI_SPEC_PATH?.trim();
    const candidates = [
        configured ? path.resolve(configured) : null,
        path.resolve(process.cwd(), '../docs/api/openapi.yaml'),
        path.resolve(process.cwd(), '../docs/openapi.yaml'),
        path.resolve(process.cwd(), 'docs/openapi.yaml'),
    ].filter((value): value is string => Boolean(value));

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    // возвращаем путь по умолчанию — ошибка загрузки будет выброшена при чтении
    return candidates[candidates.length - 1];
};

const specPath = resolveSpecPath();
let cachedDocument: unknown | null = null;
let cachedMtime = 0;

const buildUnavailableError = () =>
    new AppError({
        code: 'service_unavailable',
        message: 'OpenAPI спецификация недоступна',
        statusCode: 503,
        category: 'dependencies',
    });

const loadDocument = () => {
    try {
        const stats = fs.statSync(specPath);
        if (!cachedDocument || cachedMtime !== stats.mtimeMs) {
            const raw = fs.readFileSync(specPath, 'utf8');
            cachedDocument = YAML.parse(raw);
            cachedMtime = stats.mtimeMs;
        }
        return cachedDocument;
    } catch (error) {
        console.error('[openapi] Unable to read spec', { error });
        throw buildUnavailableError();
    }
};

router.get('/openapi.json', (req, res) => {
    try {
        const document = loadDocument();
        res.setHeader('Cache-Control', 'no-store');
        return res.json(document);
    } catch (error) {
        const appError = error instanceof AppError ? error : buildUnavailableError();
        return respondWithAppError(res, appError, { traceId: req.traceId });
    }
});

router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(null, {
        swaggerUrl: '/api/openapi.json',
        customSiteTitle: 'TZONA API Docs',
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
        },
    }),
);

export default router;
