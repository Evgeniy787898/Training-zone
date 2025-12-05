import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestAiAdvice } from '../aiAdvisorGateway.js';
import { AppError } from '../errors.js';
import type { AssistantAdviceResponse } from '../../types/apiResponses.js';

type RememberFactory<T> = () => Promise<T> | T;

const rememberCachedResource = vi.fn(
    async <T,>(
        _scope: string,
        _key: unknown,
        factory: RememberFactory<T>,
    ): Promise<T> => factory(),
);

const callMicroservice = vi.fn();
const parseAiAdvisorResponse = vi.fn((payload: AssistantAdviceResponse) => payload);
const recordMonitoringEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('../cacheStrategy.js', () => ({ rememberCachedResource }));
vi.mock('../microserviceGateway.js', () => ({ callMicroservice }));
vi.mock('../externalDataValidation.js', () => ({ parseAiAdvisorResponse }));
vi.mock('../../config/constants.js', () => ({
    aiAdvisorContextConfig: { maxEntries: 8, maxCharacters: 900, ttlMs: 604_800_000 },
    aiAdvisorMonitoringConfig: {
        latency: { warnMs: 3000, criticalMs: 6000 },
        cost: { warnUsd: 0.05, criticalUsd: 0.2 },
    },
}));
vi.mock('../monitoring.js', () => ({ recordMonitoringEvent }));

const basePayload = {
    exerciseKey: 'push_up',
    currentLevel: 'level_2',
    performance: { reps: '12' },
    goals: ['Больше повторений'],
    profileId: 'profile-1',
    context: [],
};

describe('requestAiAdvice', () => {
    beforeEach(() => {
        rememberCachedResource.mockClear();
        callMicroservice.mockReset();
        parseAiAdvisorResponse.mockClear();
        recordMonitoringEvent.mockClear();
    });

    it('returns upstream advice when the microservice succeeds', async () => {
        const upstream: AssistantAdviceResponse = {
            advice: 'Держите корпус ровно.',
            nextSteps: ['Закончите подход'],
            tips: ['Контролируйте дыхание'],
            metadata: {
                status: 'ok',
                provider: 'openai',
                latencyMs: 1200,
                usage: { promptTokens: 200, completionTokens: 150, totalTokens: 350 },
                cost: { totalUsd: 0.02 },
            },
        };
        callMicroservice.mockResolvedValueOnce(upstream);

        const response = await requestAiAdvice(basePayload, { traceId: 'trace-1' });

        expect(response).toEqual(upstream);
        expect(callMicroservice).toHaveBeenCalledTimes(1);
        expect(parseAiAdvisorResponse).toHaveBeenCalledTimes(1);
        expect(recordMonitoringEvent).toHaveBeenCalledTimes(1);
        expect(recordMonitoringEvent).toHaveBeenCalledWith(undefined, expect.objectContaining({
            category: 'ai_advisor',
            message: 'ai_advice_generated',
            severity: 'info',
        }));
    });

    it('returns a fallback response when the microservice is unavailable', async () => {
        callMicroservice.mockRejectedValueOnce(
            new AppError({
                code: 'microservice_unavailable',
                message: 'offline',
                statusCode: 503,
                category: 'dependencies',
            }),
        );

        const response = await requestAiAdvice(basePayload, { traceId: 'trace-2' });

        expect(response.metadata.status).toBe('fallback');
        expect(response.metadata.reason).toBe('microservice_unavailable');
        expect(response.advice).toContain('push_up');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(recordMonitoringEvent).toHaveBeenCalledWith(undefined, expect.objectContaining({
            message: 'ai_advice_fallback',
            severity: 'critical',
        }));
    });

    it('truncates context payload when the combined character budget is exceeded', async () => {
        const upstream: AssistantAdviceResponse = {
            advice: 'Работайте медленнее.',
            nextSteps: ['Сфокусируйтесь на технике'],
            tips: ['Дышите ровно'],
            metadata: { status: 'ok' },
        };
        callMicroservice.mockResolvedValueOnce(upstream);

        const longAdvice = 'Очень длинное описание прогресса '.repeat(40);
        const contextEntries = Array.from({ length: 3 }, (_, index) => ({
            exerciseKey: `exercise_${index}`,
            currentLevel: 'level_x',
            advice: `${longAdvice}${index}`,
            goals: ['Стабильность'],
            nextSteps: ['Держать корпус'],
            tips: ['Не забывайте про дыхание'],
            performance: { reps: '12', tempo: 'медленно' },
            createdAt: new Date().toISOString(),
        }));

        await requestAiAdvice({ ...basePayload, context: contextEntries }, { traceId: 'trace-ctx' });

        expect(callMicroservice).toHaveBeenCalledTimes(1);
        const [, requestPayload] = callMicroservice.mock.calls[0];
        expect(requestPayload.body?.context).toBeDefined();
        expect(requestPayload.body?.context?.length).toBeLessThan(contextEntries.length);
    });
});
