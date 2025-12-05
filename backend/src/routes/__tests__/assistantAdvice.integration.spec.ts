import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import type { Response as SuperAgentResponse } from 'superagent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import assistantRouter from '../../routes/assistant.js';
import type { SafePrismaClient } from '../../types/prisma.js';

const requestAiAdviceMock = vi.fn();
const loadContextMock = vi.fn();
const recordInteractionMock = vi.fn();

vi.mock('../../services/aiAdvisorGateway.js', () => ({
    requestAiAdvice: (...args: any[]) => requestAiAdviceMock(...args),
}));

vi.mock('../../services/aiAdvisorContext.js', () => ({
    AiAdvisorContextService: vi.fn().mockImplementation(() => ({
        loadContext: (...args: any[]) => loadContextMock(...args),
        recordInteraction: (...args: any[]) => recordInteractionMock(...args),
    })),
}));

const prismaStub = {
    $on: () => undefined,
    $use: () => undefined,
} as unknown as SafePrismaClient;

const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
        req.traceId = 'assistant-stream-trace';
        req.profileId = 'profile-stream';
        req.profile = { id: 'profile-stream' } as any;
        req.prisma = prismaStub;
        next();
    });
    app.use('/api/assistant', assistantRouter);
    return app;
};

const bufferSseResponse = (testRequest: request.Test) =>
    testRequest
        .buffer()
        .parse((res: SuperAgentResponse, callback: (err: Error | null, body?: string) => void) => {
            let data = '';
            res.on('data', (chunk: Buffer) => {
                data += chunk.toString('utf8');
            });
            res.on('end', () => callback(null, data));
        });

describe('Assistant advice streaming API', () => {
    beforeEach(() => {
        requestAiAdviceMock.mockReset();
        loadContextMock.mockReset();
        recordInteractionMock.mockReset();
    });

    it('streams advice events with progress markers', async () => {
        loadContextMock.mockResolvedValueOnce([{ exerciseKey: 'sq', currentLevel: 'L1', advice: 'prev', createdAt: new Date().toISOString() }]);
        requestAiAdviceMock.mockResolvedValueOnce({
            advice: 'Сконцентрируйтесь на контроле',
            nextSteps: ['Запишите прогресс'],
            tips: ['Дышите ровно'],
            metadata: { status: 'ok' },
        });
        recordInteractionMock.mockResolvedValueOnce(undefined);

        const app = createTestApp();
        const response = await bufferSseResponse(
            request(app)
                .post('/api/assistant/ai-advice/stream')
                .send({ exerciseKey: 'pushup', currentLevel: 'L1' }),
        );

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/event-stream');
        expect(response.text).toContain('event: progress');
        expect(response.text).toContain('"stage":"context_loaded"');
        expect(response.text).toContain('event: advice');
        expect(response.text).toContain('"advice":"Сконцентрируйтесь на контроле"');
        expect(response.text).toContain('event: complete');
    });

    it('emits error events when context loading fails', async () => {
        loadContextMock.mockRejectedValueOnce(new Error('context failure'));
        const app = createTestApp();

        const response = await bufferSseResponse(
            request(app)
                .post('/api/assistant/ai-advice/stream')
                .send({ exerciseKey: 'row', currentLevel: 'L2' }),
        );

        expect(response.status).toBe(200);
        expect(response.text).toContain('event: error');
        expect(response.text).toContain('"stage":"failed"');
    });
});
