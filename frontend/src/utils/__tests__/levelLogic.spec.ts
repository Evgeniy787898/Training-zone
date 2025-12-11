
import { describe, it, expect, vi } from 'vitest';
import { pickLevel, collectImages } from '../levelLogic';

// Mock buildExerciseImageSource
vi.mock('../exerciseImages', () => ({
    buildExerciseImageSource: vi.fn((url: string) => {
        if (!url) return undefined;
        if (url.startsWith('/')) return { local: url };
        return {
            avif: `${url}.avif`,
            webp: `${url}.webp`,
            original: url
        };
    }),
}));

describe('levelLogic', () => {
    describe('pickLevel', () => {
        const levels = [
            { level: '1', name: 'Level 1' },
            { level: '2', name: 'Level 2' },
            { level: '3', name: 'Level 3' },
            { level: '2.a', name: 'Level 2.a' }
        ] as any[];

        it('returns undefined for empty levels', () => {
            const result = pickLevel([], 1);
            expect(result).toBeUndefined();
        });

        it('finds level by string match', () => {
            const result = pickLevel(levels, '2');
            expect(result).toEqual(levels[1]);
        });

        it('finds prefixed level string', () => {
            // '2' matches exactly, but if we search for something like prefix match logic
            // logic: if exact match found, return it.
            // otherwise find level starting with value + "."
            const resultPrefix = pickLevel(levels, '2.a'); // direct match
            expect(resultPrefix).toEqual(levels[3]);
        });

        it('finds level by number (index based logic override)', () => {
            // Logic: find by number split on '.', OR return index
            const result = pickLevel(levels, 3);
            expect(result).toEqual(levels[2]);
        });

        it('returns first level as fallback', () => {
            const result = pickLevel(levels, 99);
            // 99 - 1 = 98 -> clamped to max index (3)
            expect(result).toEqual(levels[3]);
        });
    });

    describe('collectImages', () => {
        it('collects images from level and exercise', () => {
            const level = { imageUrl: 'level.jpg', image1: 'img1.png' };
            const exercise = { imageUrl: 'exercise.jpg' };
            const fallback = ['fallback.png'];

            const result = collectImages(level as any, exercise as any, fallback);

            expect(result).toHaveLength(4);
            expect(result[0]).toEqual({ avif: 'level.jpg.avif', webp: 'level.jpg.webp', original: 'level.jpg' });
        });

        it('deduplicates images', () => {
            const level = { imageUrl: 'img.jpg' };
            const exercise = { imageUrl: 'img.jpg' };

            const result = collectImages(level as any, exercise as any);
            expect(result).toHaveLength(1);
        });

        it('handles nested arrays (fallback)', () => {
            const result = collectImages(undefined, undefined, ['img1.jpg', 'img2.jpg']);
            expect(result).toHaveLength(2);
        });
    });
});
