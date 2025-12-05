import { describe, expect, it } from 'vitest';
import { AiAdvisorContextService } from '../aiAdvisorContext.js';
import type { DatabaseService } from '../../integrations/supabase.js';
import { aiAdvisorContextConfig } from '../../../config/constants.js';

const CONTEXT_KEY = 'ai_advisor_context';

type FakeState = Record<string, any>;

const createFakeDb = () => {
    const store = new Map<string, FakeState>();
    return {
        async getDialogState(profileId: string, stateType: string) {
            const payload = store.get(`${profileId}:${stateType}`);
            if (!payload) {
                return null;
            }
            return { statePayload: payload } as any;
        },
        async saveDialogState(profileId: string, stateType: string, payload: any) {
            store.set(`${profileId}:${stateType}`, payload);
            return payload;
        },
        snapshot() {
            return store.get(`profile:${CONTEXT_KEY}`);
        },
        rawStore: store,
    } satisfies Partial<DatabaseService> & { rawStore: Map<string, FakeState> };
};

describe('AiAdvisorContextService', () => {
    it('appends entries and enforces the configured limit', async () => {
        const db = createFakeDb();
        const service = new AiAdvisorContextService(db as unknown as DatabaseService);
        const profileId = 'profile';

        for (let index = 0; index < aiAdvisorContextConfig.maxEntries + 2; index += 1) {
            await service.recordInteraction(profileId, {
                exerciseKey: `push_up_${index}`,
                currentLevel: 'level_1',
                advice: `Advice ${index}`,
                nextSteps: [`Do ${index} reps`],
                tips: ['Focus on form'],
            });
        }

        const state = db.rawStore.get(`${profileId}:${CONTEXT_KEY}`);
        expect(state.entries).toHaveLength(aiAdvisorContextConfig.maxEntries);
        expect(state.entries[0].exerciseKey).toBe('push_up_2');
        expect(state.entries.at(-1)?.exerciseKey).toBe(`push_up_${aiAdvisorContextConfig.maxEntries + 1}`);
    });

    it('sanitizes lists and performance payloads', async () => {
        const db = createFakeDb();
        const service = new AiAdvisorContextService(db as unknown as DatabaseService);
        const profileId = 'profile';

        await service.recordInteraction(profileId, {
            exerciseKey: '  squat  ',
            currentLevel: '  gold ',
            advice: '  Try tempo squats   ',
            goals: [' first ', ' second ', ' third ', ' fourth ', 'fifth'],
            performance: {
                reps: 8,
                weight: '60kg',
                tempo: ['3s down', '1s up'],
                details: { depth: 'parallel', stability: 'needs work' },
            },
            nextSteps: [' increase tempo ', 'focus on bracing'],
            tips: [' use mirrors ', ' record videos '],
        });

        const entries = await service.loadContext(profileId);
        expect(entries).toHaveLength(1);
        expect(entries[0].exerciseKey).toBe('squat');
        expect(entries[0].goals.length).toBeGreaterThan(0);
        expect(Object.keys(entries[0].performance)).toContain('reps');
        expect(entries[0].nextSteps[0]).toBe('increase tempo');
    });
});
