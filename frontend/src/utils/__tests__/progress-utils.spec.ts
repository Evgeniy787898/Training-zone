import { describe, it, expect } from 'vitest';
import { calculateProgressDelta, getProgressClass, type TrainingSessionExercise } from '../progress-utils';

describe('progress-utils', () => {
    describe('calculateProgressDelta', () => {
        it('returns null if previous section does not exist', () => {
            const current = { weight: 100, reps: 10, sets: 3 };
            const delta = calculateProgressDelta(current, null);
            expect(delta).toBeNull();
        });

        it('returns null if previous session has no actual or target data', () => {
            const current = { weight: 100, reps: 10, sets: 3 };
            const prev: TrainingSessionExercise = { exercise_key: 'test' };
            const delta = calculateProgressDelta(current, prev);
            expect(delta).toBeNull();
        });

        it('calculates positive weight delta correctly', () => {
            const current = { weight: 105, reps: 10, sets: 3 };
            const prev: TrainingSessionExercise = {
                exercise_key: 'test',
                actual: { weight: 100, reps: 10, sets: 3 }
            };
            const delta = calculateProgressDelta(current, prev);

            expect(delta).not.toBeNull();
            expect(delta!.weight).toBe(5);
            expect(delta!.hasChange).toBe(true);
            expect(delta!.label).toContain('+5кг');
        });

        it('calculates negative reps delta correctly', () => {
            const current = { weight: 100, reps: 8, sets: 3 };
            const prev: TrainingSessionExercise = {
                exercise_key: 'test',
                actual: { weight: 100, reps: 10, sets: 3 }
            };
            const delta = calculateProgressDelta(current, prev);

            expect(delta).not.toBeNull();
            expect(delta!.reps).toBe(-2);
            expect(delta!.hasChange).toBe(true);
            expect(delta!.label).toContain('-2 повт.');
        });

        it('uses target if actual is missing in previous session', () => {
            const current = { weight: 50, reps: 10, sets: 3 };
            const prev: TrainingSessionExercise = {
                exercise_key: 'test',
                target: { weight: 40, reps: 10, sets: 3 }
            };
            const delta = calculateProgressDelta(current, prev);

            expect(delta).not.toBeNull();
            expect(delta!.weight).toBe(10);
        });

        it('handles mixed inputs (strings/numbers)', () => {
            const current = { weight: "60", reps: 10, sets: 3 };
            const prev: TrainingSessionExercise = {
                exercise_key: 'test',
                actual: { weight: 50, reps: 10, sets: 3 }
            };
            const delta = calculateProgressDelta(current as any, prev); // as any to mock form input

            expect(delta).not.toBeNull();
            expect(delta!.weight).toBe(10);
        });

        it('returns null if no change in any metric (and logic says hasChange should be false/null?)', () => {
            // Based on implementation: hasChange = deltaSets !== 0 || deltaReps !== 0 || deltaWeight !== 0;
            // The function returns an object with hasChange: false, not null.
            // Wait, line 44 says "if curr 0... return null".
            // But if curr == prev != 0, it returns delta 0.
            const current = { weight: 100, reps: 10, sets: 3 };
            const prev: TrainingSessionExercise = {
                exercise_key: 'test',
                actual: { weight: 100, reps: 10, sets: 3 }
            };
            const delta = calculateProgressDelta(current, prev);

            expect(delta).not.toBeNull();
            expect(delta!.weight).toBe(0);
            expect(delta!.reps).toBe(0);
            expect(delta!.sets).toBe(0);
            expect(delta!.hasChange).toBe(false);
            expect(delta!.label).toBe('');
        });
    });

    describe('getProgressClass', () => {
        it('returns positive for weight increase', () => {
            const delta = { weight: 5, reps: 0, sets: 0, hasChange: true, label: '' };
            expect(getProgressClass(delta)).toBe('positive');
        });

        it('returns negative for weight decrease', () => {
            const delta = { weight: -5, reps: 0, sets: 0, hasChange: true, label: '' };
            expect(getProgressClass(delta)).toBe('negative');
        });

        it('prioritizes weight over reps', () => {
            // e.g. weight +5kg, reps -2
            const delta = { weight: 5, reps: -2, sets: 0, hasChange: true, label: '' };
            expect(getProgressClass(delta)).toBe('positive');
        });

        it('returns positive for reps increase if weight is stable', () => {
            const delta = { weight: 0, reps: 2, sets: 0, hasChange: true, label: '' };
            expect(getProgressClass(delta)).toBe('positive');
        });
    });
});
