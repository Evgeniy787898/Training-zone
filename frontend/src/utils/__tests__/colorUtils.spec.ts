import { describe, it, expect } from 'vitest';
import { lightenColor, mixColors, getDisciplineColor, getProgramColor, getExerciseColor } from '../colorUtils';

describe('colorUtils', () => {
    describe('lightenColor', () => {
        it('lightens a dark color', () => {
            // Black #000000 -> amount=0.5 -> Should be gray
            const result = lightenColor('#000000', 0.5);
            // r = 0 + (255-0)*0.5 = 127.5 ~ 128 (80 hex)
            expect(result).toBe('#808080');
        });

        it('handles white correctly (cannot go lighter)', () => {
            const result = lightenColor('#FFFFFF', 0.1);
            expect(result).toBe('#FFFFFF');
        });

        it('handles hex without hash', () => {
            const result = lightenColor('000000', 0.5);
            expect(result).toBe('#808080');
        });
    });

    describe('mixColors', () => {
        it('mixes two colors 50/50', () => {
            // Black and White -> Gray
            const result = mixColors('#000000', '#FFFFFF', 50);
            expect(result).toBe('#808080');
        });

        it('mixes with 0% takes second color', () => {
            const result = mixColors('#FF0000', '#0000FF', 0);
            expect(result).toBe('#0000FF');
        });

        it('mixes with 100% takes first color', () => {
            const result = mixColors('#FF0000', '#0000FF', 100);
            expect(result).toBe('#FF0000');
        });
    });

    describe('deterministic generation', () => {
        it('returns consistent discipline color for same id/name', () => {
            const color1 = getDisciplineColor('1', 'Test');
            const color2 = getDisciplineColor('1', 'Test');
            expect(color1).toBe(color2);
        });

        it('returns different color for different input (likely)', () => {
            const color1 = getDisciplineColor('1', 'Test');
            const color2 = getDisciplineColor('2', 'Other');
            expect(color1).not.toBe(color2);
        });

        it('returns consistent exercise color', () => {
            const color1 = getExerciseColor('pushup', '#FF0000');
            const color2 = getExerciseColor('pushup', '#FF0000');
            expect(color1).toBe(color2);
        });
    });

    describe('program color derivation', () => {
        it('generates a valid hex color from discipline color', () => {
            const discColor = '#10A37F';
            const progColor = getProgramColor(discColor);
            expect(progColor).toMatch(/^#[0-9A-F]{6}$/);
            expect(progColor).not.toBe(discColor);
        });
    });
});
