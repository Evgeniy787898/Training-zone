/**
 * AI Data Veracity Validator (QUAL-007)
 * Validates that data shown in AI cards matches real user data
 * Prevents AI from hallucinating fake statistics or exercises
 */

import type { AiCard } from './externalDataValidation.js';

export interface DataVeracityContext {
    // Known exercise names from user's history
    knownExercises: Set<string>;
    // Known training dates (ISO strings)
    trainingDates: Set<string>;
    // Valid value ranges for metrics
    metricRanges: {
        weight: { min: number; max: number };
        reps: { min: number; max: number };
        sets: { min: number; max: number };
        duration: { min: number; max: number }; // minutes
        workoutCount: { min: number; max: number };
    };
    // User profile data
    profileCreatedAt: Date | null;
    lastWorkoutDate: Date | null;
}

export interface VeracityCheckResult {
    isValid: boolean;
    invalidCards: number[];
    warnings: string[];
    suggestions: string[];
}

/**
 * Default realistic ranges for fitness data
 */
export const DEFAULT_METRIC_RANGES = {
    weight: { min: 0, max: 500 },      // kg
    reps: { min: 1, max: 500 },        // per set
    sets: { min: 1, max: 50 },         // per exercise
    duration: { min: 0, max: 480 },    // minutes (8 hours max)
    workoutCount: { min: 0, max: 365 }, // per period
};

/**
 * Check if a number is within realistic bounds
 */
function isRealisticValue(value: number, range: { min: number; max: number }): boolean {
    return value >= range.min && value <= range.max;
}

/**
 * Check if a date is plausible (not in future, not before profile creation)
 */
function isPlausibleDate(
    dateStr: string,
    profileCreatedAt: Date | null,
): boolean {
    const date = new Date(dateStr);
    const now = new Date();

    // Not in the future
    if (date > now) {
        return false;
    }

    // Not before user profile was created (if known)
    if (profileCreatedAt && date < profileCreatedAt) {
        return false;
    }

    // Not unrealistically old (before 2020 for fitness app)
    if (date < new Date('2020-01-01')) {
        return false;
    }

    return true;
}

/**
 * Validate stats card data
 */
function validateStatsCard(
    data: any,
    context: DataVeracityContext,
): string[] {
    const warnings: string[] = [];

    if (!data.stats || !Array.isArray(data.stats)) {
        return ['Некорректный формат stats карточки'];
    }

    for (const stat of data.stats) {
        const value = typeof stat.value === 'number' ? stat.value : parseFloat(stat.value);

        if (isNaN(value)) continue;

        // Check workout count isn't unrealistic
        if (
            stat.label?.toLowerCase().includes('тренировок') &&
            !isRealisticValue(value, context.metricRanges.workoutCount)
        ) {
            warnings.push(`Нереалистичное количество тренировок: ${value}`);
        }

        // Check weight values
        if (
            stat.label?.toLowerCase().includes('вес') &&
            !isRealisticValue(value, context.metricRanges.weight)
        ) {
            warnings.push(`Нереалистичный вес: ${value} кг`);
        }
    }

    return warnings;
}

/**
 * Validate chart card data
 */
function validateChartCard(
    data: any,
    context: DataVeracityContext,
): string[] {
    const warnings: string[] = [];

    if (!data.data || !Array.isArray(data.data)) {
        return ['Некорректный формат chart карточки'];
    }

    for (const point of data.data) {
        // Check for negative values in progress charts (should be positive)
        if (point.value < 0) {
            warnings.push(`Отрицательное значение в графике: ${point.value}`);
        }

        // Check for unrealistically large values
        if (point.value > 10000) {
            warnings.push(`Подозрительно большое значение: ${point.value}`);
        }
    }

    return warnings;
}

/**
 * Validate exercise card data
 */
function validateExerciseCard(
    data: any,
    context: DataVeracityContext,
): string[] {
    const warnings: string[] = [];

    // Check if exercise is known
    if (data.name && context.knownExercises.size > 0) {
        const exerciseLower = data.name.toLowerCase();
        const isKnown = Array.from(context.knownExercises).some(
            e => e.toLowerCase().includes(exerciseLower) || exerciseLower.includes(e.toLowerCase())
        );
        if (!isKnown) {
            warnings.push(`Упражнение "${data.name}" не найдено в истории пользователя`);
        }
    }

    // Validate numeric ranges
    if (data.sets && !isRealisticValue(data.sets, context.metricRanges.sets)) {
        warnings.push(`Нереалистичное кол-во подходов: ${data.sets}`);
    }

    if (data.reps && !isRealisticValue(data.reps, context.metricRanges.reps)) {
        warnings.push(`Нереалистичное кол-во повторений: ${data.reps}`);
    }

    if (data.weight && !isRealisticValue(data.weight, context.metricRanges.weight)) {
        warnings.push(`Нереалистичный вес: ${data.weight} кг`);
    }

    return warnings;
}

/**
 * Validate progress card data
 */
function validateProgressCard(
    data: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: DataVeracityContext,
): string[] {
    const warnings: string[] = [];

    // Progress should not exceed target
    if (data.current > data.target * 2) {
        warnings.push(`Прогресс (${data.current}) значительно превышает цель (${data.target})`);
    }

    // Percentage should match actual values if provided
    if (data.percentage !== undefined && data.target > 0) {
        const expectedPercent = Math.round((data.current / data.target) * 100);
        if (Math.abs(data.percentage - expectedPercent) > 5) {
            warnings.push(`Несоответствие процента: указано ${data.percentage}%, ожидается ~${expectedPercent}%`);
        }
    }

    return warnings;
}

/**
 * Main validation function for AI response cards
 * Checks that data shown to user is realistic and consistent with their actual data
 */
export function validateAiCardData(
    cards: AiCard[],
    context: Partial<DataVeracityContext> = {},
): VeracityCheckResult {
    const fullContext: DataVeracityContext = {
        knownExercises: context.knownExercises || new Set(),
        trainingDates: context.trainingDates || new Set(),
        metricRanges: context.metricRanges || DEFAULT_METRIC_RANGES,
        profileCreatedAt: context.profileCreatedAt || null,
        lastWorkoutDate: context.lastWorkoutDate || null,
    };

    const invalidCards: number[] = [];
    const allWarnings: string[] = [];
    const suggestions: string[] = [];

    cards.forEach((card, index) => {
        let cardWarnings: string[] = [];

        switch (card.type) {
            case 'stats':
                cardWarnings = validateStatsCard(card.data, fullContext);
                break;
            case 'chart':
                cardWarnings = validateChartCard(card.data, fullContext);
                break;
            case 'exercise':
                cardWarnings = validateExerciseCard(card.data, fullContext);
                break;
            case 'progress':
                cardWarnings = validateProgressCard(card.data, fullContext);
                break;
            // Other card types pass through without validation
        }

        if (cardWarnings.length > 0) {
            invalidCards.push(index);
            allWarnings.push(...cardWarnings.map(w => `[Card ${index + 1}] ${w}`));
        }
    });

    // Add suggestions based on findings
    if (invalidCards.length > 0) {
        suggestions.push('Проверьте данные карточек на соответствие реальной статистике');
    }

    return {
        isValid: invalidCards.length === 0,
        invalidCards,
        warnings: allWarnings,
        suggestions,
    };
}

/**
 * Build context from user profile data
 */
export function buildVeracityContext(profileData: {
    exercises?: { name: string }[];
    sessions?: { date: string }[];
    createdAt?: string | Date;
    lastWorkout?: string | Date;
}): DataVeracityContext {
    return {
        knownExercises: new Set(profileData.exercises?.map(e => e.name) || []),
        trainingDates: new Set(profileData.sessions?.map(s => s.date) || []),
        metricRanges: DEFAULT_METRIC_RANGES,
        profileCreatedAt: profileData.createdAt
            ? new Date(profileData.createdAt)
            : null,
        lastWorkoutDate: profileData.lastWorkout
            ? new Date(profileData.lastWorkout)
            : null,
    };
}
