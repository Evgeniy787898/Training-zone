import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import assistantRouter from '../../routes/assistant.js';
import type { SafePrismaClient } from '../../types/prisma.js';

type AppOptions = {
    profileId?: string;
    profile?: Record<string, unknown>;
};

const prismaStub = {
    $on: () => undefined,
    $use: () => undefined,
} as unknown as SafePrismaClient;

const createTestApp = (options: AppOptions = {}) => {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
        req.traceId = 'assistant-integration-trace';
        if (options.profileId !== undefined) {
            req.profileId = options.profileId;
        }
        req.profile = options.profile ?? (options.profileId ? { id: options.profileId } : null);
        req.prisma = prismaStub;
        next();
    });

    app.use('/api/assistant', assistantRouter);
    app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = error?.statusCode ?? 500;
        res.status(status).json({
            success: false,
            error: {
                error: error?.code ?? 'internal_error',
                classification: error?.category ?? 'internal',
            },
        });
    });

    return app;
};

describe('Assistant command interpretation API', () => {
    it('requires authentication', async () => {
        const app = createTestApp();

        const response = await request(app).post('/api/assistant/commands/interpret').send({
            message: 'План на сегодня',
        });

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({
            success: false,
            error: { error: 'auth_required', classification: 'authentication' },
        });
    });

    it('returns structured interpretation for trainer commands', async () => {
        const app = createTestApp({ profileId: 'profile-command', profile: { id: 'profile-command' } });

        const response = await request(app)
            .post('/api/assistant/commands/interpret')
            .send({ message: 'Сохрани заметку: цель на июль #idei', history: ['предыдущее сообщение'] });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            success: true,
            data: {
                intent: 'note_save',
                needs_clarification: false,
                history: expect.any(Array),
                candidates: expect.any(Array),
                slots: expect.objectContaining({
                    note: expect.objectContaining({ content: expect.stringContaining('цель на июль') }),
                }),
            },
            meta: { traceId: 'assistant-integration-trace' },
        });
    });

    it('validates payload and rejects empty messages', async () => {
        const app = createTestApp({ profileId: 'profile-validation' });

        const response = await request(app).post('/api/assistant/commands/interpret').send({ message: '' });

        expect(response.status).toBe(422);
        expect(response.body).toMatchObject({
            success: false,
            error: { error: 'validation_failed', classification: 'validation' },
        });
    });
});
