import type { ExerciseLevel, ProgramExercise } from '@/types';
import { buildExerciseImageSource, type ExerciseImageSource } from '@/utils/exerciseImages';

export const pickLevel = (levels: ExerciseLevel[], value: string | number | undefined): ExerciseLevel | undefined => {
    if (!levels.length) return undefined;
    if (typeof value === 'string') {
        const direct = levels.find((level) => level.level === value);
        if (direct) return direct;
        const prefixed = levels.find((level) => level.level?.startsWith(`${value}.`));
        if (prefixed) return prefixed;
    }
    if (typeof value === 'number') {
        const byNumber = levels.find((level) => Number(level.level?.split('.')[0]) === value);
        if (byNumber) return byNumber;
        const index = Math.max(0, Math.min(value - 1, levels.length - 1));
        return levels[index];
    }
    return levels[0];
};

export const collectImages = (
    level?: ExerciseLevel,
    exercise?: ProgramExercise,
    fallback: string[] = []
): ExerciseImageSource[] => {
    const candidates = [
        (level as any)?.imageUrl,
        (level as any)?.imageUrl2,
        (level as any)?.image1,
        (level as any)?.image2,
        (level as any)?.image3,
        (exercise as any)?.imageUrl,
        ...(Array.isArray(fallback) ? fallback : []),
    ];

    const sources: ExerciseImageSource[] = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
        if (candidate && typeof candidate === 'string' && candidate.trim() && !seen.has(candidate)) {
            const src = buildExerciseImageSource(candidate);
            if (src) {
                sources.push(src);
                seen.add(candidate);
            }
        } else if (Array.isArray(candidate)) {
            for (const sub of candidate) {
                if (sub && typeof sub === 'string' && sub.trim() && !seen.has(sub)) {
                    const src = buildExerciseImageSource(sub);
                    if (src) {
                        sources.push(src);
                        seen.add(sub);
                    }
                }
            }
        }
    }

    return sources;
};
