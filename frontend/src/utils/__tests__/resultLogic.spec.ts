import { describe, it, expect } from 'vitest';
import { evaluateResultStatus } from '../resultLogic';

describe('resultLogic', () => {
    describe('evaluateResultStatus', () => {
        it('returns pending for zero or null actual result', () => {
            const card = { reps: 10 } as any;
            expect(evaluateResultStatus(card, 0)).toBe('pending');
        });

        it('returns success when actual >= target', () => {
            const card = { reps: 10 } as any;
            expect(evaluateResultStatus(card, 10)).toBe('success');
            expect(evaluateResultStatus(card, 12)).toBe('success');
        });

        it('returns danger when actual < target', () => {
            const card = { reps: 10 } as any;
            expect(evaluateResultStatus(card, 9)).toBe('danger');
            expect(evaluateResultStatus(card, 5)).toBe('danger');
        });

        it('handles missing target (defaults to 0)', () => {
            const card = {} as any; // reps undefined
            // actual 1 >= 0 -> success
            expect(evaluateResultStatus(card, 1)).toBe('success');
        });
    });
});
