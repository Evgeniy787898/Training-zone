import type { PlanExercise, ProgramDay } from '@/types/today';
import { normalizeDayKey, resolveCycleIndexFromValue } from '@/utils/dayNormalization';

const normalizeExerciseImages = (exercise: any): string[] => {
    const pool: Array<string | undefined | null | string[]> = [
        exercise?.image,
        exercise?.imageUrl,
        exercise?.image_url,
        exercise?.preview,
        exercise?.media?.image,
        exercise?.media?.preview,
        exercise?.media?.images,
        exercise?.images,
        exercise?.photos,
    ];
    const images: string[] = [];
    const pushCandidate = (candidate: any) => {
        if (!candidate) return;
        if (Array.isArray(candidate)) {
            candidate.forEach(pushCandidate);
            return;
        }
        if (typeof candidate === 'string' && candidate.trim()) {
            images.push(candidate.trim());
        }
    };
    pool.forEach(pushCandidate);
    return images;
};

const resolveExerciseCollection = (item: any): any[] => {
    if (!item) return [];
    if (Array.isArray(item)) return item;
    if (typeof item !== 'object') return [];

    const candidates = [
        item.exercises,
        item.exercise,
        item.workouts,
        item.items,
        item.exercise_list,
        item.exerciseList,
        item.steps,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length) {
            return candidate;
        }
    }

    return [];
};

function coalesceNumber(...args: any[]): number | null {
    for (const arg of args) {
        if (typeof arg === 'number' && Number.isFinite(arg)) {
            return arg;
        }
        if (typeof arg === 'string' && arg.trim() !== '') {
            const num = Number(arg);
            if (Number.isFinite(num)) {
                return num;
            }
        }
    }
    return null;
}

const normalizeExercises = (collection: any[]): PlanExercise[] =>
    (Array.isArray(collection) ? collection : resolveExerciseCollection(collection))
        .map((exercise: any) => {
            const key = String(exercise?.key ?? exercise?.exerciseKey ?? exercise?.id ?? '').trim();
            if (!key) {
                return null;
            }
            const target = typeof exercise?.target === 'object' ? exercise.target : {};
            const sets = coalesceNumber(
                exercise?.sets,
                exercise?.approach,
                exercise?.qty_sets,
                target?.sets,
                target?.approach,
            );
            const reps = coalesceNumber(
                exercise?.reps,
                exercise?.qty_reps,
                exercise?.count,
                target?.reps,
                target?.count,
            );
            const levelValue =
                exercise?.level ??
                exercise?.level_code ??
                exercise?.levelCode ??
                target?.level ??
                target?.levelCode ??
                target?.level_code ??
                null;
            const levelName =
                exercise?.levelLabel ??
                exercise?.level_label ??
                exercise?.levelTitle ??
                target?.levelLabel ??
                target?.level_name ??
                null;
            return {
                key,
                name: exercise?.name ?? exercise?.title ?? exercise?.label ?? null,
                level: levelValue,
                levelLabel: levelName,
                sets,
                reps,
                images: normalizeExerciseImages(exercise),
            } as PlanExercise;
        })
        .filter((exercise: PlanExercise | null): exercise is PlanExercise => Boolean(exercise && exercise.key));

const resolveDayCandidate = (item: any): string | null => {
    if (!item || typeof item !== 'object') return null;
    return (
        item.day ??
        item.dayOfWeek ??
        item.day_of_week ??
        item.weekday ??
        item.title ??
        item.name ??
        item.label ??
        null
    );
};

const resolveSequenceIndex = (item: any, fallbackIndex: number): number => {
    const numericFields = [
        item?.sequence,
        item?.order,
        item?.orderIndex,
        item?.dayNumber,
        item?.day_number,
        item?.index,
        item?.dayIndex,
    ];
    for (const field of numericFields) {
        if (typeof field === 'number' && Number.isFinite(field)) {
            return Math.max(0, Math.round(field) - 1);
        }
    }
    const candidate = resolveDayCandidate(item);
    const fromValue = resolveCycleIndexFromValue(candidate);
    if (fromValue !== null) {
        return fromValue;
    }
    return fallbackIndex;
};

const collectPlanItems = (parsedData: any): any[] => {
    if (!parsedData) return [];
    if (Array.isArray(parsedData)) return parsedData;

    const directCandidates = [
        parsedData?.days,
        parsedData?.plan?.days,
        parsedData?.plan,
        parsedData?.program?.days,
        parsedData?.program?.plan,
        parsedData?.schedule,
        parsedData?.weekPlan,
        parsedData?.weeks,
        parsedData?.week,
        parsedData?.calendar,
    ];

    for (const candidate of directCandidates) {
        if (Array.isArray(candidate) && candidate.length) {
            return candidate;
        }
    }

    const aggregated: any[] = [];
    for (const candidate of directCandidates) {
        if (Array.isArray(candidate)) {
            aggregated.push(...candidate);
        } else if (candidate && typeof candidate === 'object' && Array.isArray(candidate.days)) {
            aggregated.push(...candidate.days);
        }
    }

    if (aggregated.length) {
        return aggregated;
    }

    if (parsedData && typeof parsedData === 'object') {
        for (const [key, value] of Object.entries(parsedData as Record<string, any>)) {
            if (Array.isArray(value)) {
                aggregated.push({ day: key, exercises: value });
            } else if (value && typeof value === 'object') {
                if (Array.isArray((value as any).days)) {
                    aggregated.push(...(value as any).days);
                }
                const exercises = resolveExerciseCollection(value);
                if (exercises.length) {
                    aggregated.push({
                        ...value,
                        day: value.day ?? value.dayOfWeek ?? value.day_of_week ?? key,
                        exercises,
                    });
                }
            }
        }
    }

    return aggregated;
};

export function extractProgramPlan(input: any): ProgramDay[] {
    if (!input) return [];
    let data = input;
    if (typeof input === 'string') {
        try {
            data = JSON.parse(input);
        } catch (err) {
            console.warn('Не удалось разобрать план программы', err);
            return [];
        }
    }

    const collection = collectPlanItems(data);

    return collection
        .map((item: any, index: number) => {
            if (!item) {
                return null;
            }
            const exercisesCollection = Array.isArray(item)
                ? normalizeExercises(item)
                : normalizeExercises(resolveExerciseCollection(item));

            const candidate = resolveDayCandidate(item) ?? (Array.isArray(item) ? null : (item as any).dayKey ?? null);
            const dayKey = normalizeDayKey(candidate);
            const cycleIndex = resolveCycleIndexFromValue(candidate) ?? resolveSequenceIndex(item, index);
            const explicitRest = Boolean(
                item?.rest ||
                item?.isRestDay ||
                item?.type === 'rest' ||
                (typeof candidate === 'string' && candidate.toLowerCase().includes('rest')),
            );
            const isRestDay = explicitRest || dayKey === 'rest' || !exercisesCollection.length;

            return {
                rawDay: candidate ? String(candidate) : null,
                dayKey,
                cycleIndex,
                label: item?.title ?? item?.name ?? null,
                isRestDay,
                exercises: isRestDay ? [] : exercisesCollection,
            } as ProgramDay;
        })
        .filter((day: ProgramDay | null): day is ProgramDay => Boolean(day && (day.isRestDay || day.exercises.length)));
}
