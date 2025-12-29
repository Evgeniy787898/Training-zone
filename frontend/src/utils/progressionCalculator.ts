/**
 * Smart Progression Calculator
 * 
 * Based on exercise physiology principles:
 * - Progressive overload
 * - Recovery management
 * - Volume tracking
 * - RPE-based adjustments
 */

export type ProgressionRecommendation =
    | 'stay'           // Stay at current level
    | 'advance_tier'   // Move to next tier (X.Y -> X.Y+1)
    | 'advance_level'  // Move to next level (X.4 -> X+1.1)
    | 'deload'         // Reduce volume temporarily
    | 'regress';       // Move back a tier

export interface ProgressionInput {
    currentLevel: number;      // e.g., 3
    currentTier: number;       // 1-4
    targetReps: number;
    actualReps: number;
    targetSets: number;
    actualSets: number;
    rpe?: number;             // 1-10, optional
    lastWorkoutDate?: Date;
    workoutHistory?: WorkoutHistoryItem[];
}

export interface WorkoutHistoryItem {
    date: Date;
    level: number;
    tier: number;
    volumePercent: number;   // actual/target * 100
    rpe?: number;
}

export interface ProgressionResult {
    recommendation: ProgressionRecommendation;
    confidence: number;      // 0-1
    reasoning: string;       // Human-readable explanation
    suggestedLevel?: number;
    suggestedTier?: number;
    isDeloadRecommended?: boolean;
}

// Tier volume multipliers
const TIER_VOLUME: Record<number, number> = {
    1: 0.50,  // Начальный (50%)
    2: 0.75,  // Продвинутый (75%)
    3: 1.00,  // Профессиональный (100%)
    4: 1.10,  // Элитный (110%, only for level 10)
};

// Factor weights for recommendation (for reference/documentation)
// const FACTOR_WEIGHTS = {
//   volumeCompletion: 0.30,
//   successStreak: 0.25,
//   recoveryTime: 0.20,
//   trend: 0.15,
//   rpeHistory: 0.10,
// };

/**
 * Calculate volume completion percentage
 */
function calculateVolumeCompletion(input: ProgressionInput): number {
    const targetVolume = input.targetReps * input.targetSets;
    const actualVolume = input.actualReps * input.actualSets;

    if (targetVolume === 0) return 0;
    return (actualVolume / targetVolume) * 100;
}

/**
 * Calculate success streak from history
 */
function calculateSuccessStreak(history: WorkoutHistoryItem[]): number {
    let streak = 0;

    for (const item of [...history].reverse()) {
        if (item.volumePercent >= 90) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Calculate recovery score based on days since last workout
 */
function calculateRecoveryScore(lastWorkout?: Date): number {
    if (!lastWorkout) return 1.0; // No previous workout

    const daysSince = Math.floor((Date.now() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));

    // Optimal recovery: 2-4 days
    if (daysSince >= 2 && daysSince <= 4) return 1.0;
    if (daysSince === 1) return 0.7; // Too soon
    if (daysSince === 5) return 0.9;
    if (daysSince > 7) return 0.6; // Too long

    return 0.8;
}

/**
 * Analyze trend from recent workouts
 */
function analyzeTrend(history: WorkoutHistoryItem[]): 'improving' | 'stable' | 'declining' {
    if (history.length < 3) return 'stable';

    const recent = history.slice(-3);
    const volumes = recent.map(h => h.volumePercent);

    const avgFirst = volumes[0];
    const avgLast = volumes[volumes.length - 1];
    const diff = avgLast - avgFirst;

    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
}

/**
 * Check if deload is recommended
 */
function shouldDeload(history: WorkoutHistoryItem[], rpe?: number): boolean {
    // High RPE for 3+ consecutive workouts
    if (history.length >= 3) {
        const recentRpe = history.slice(-3).filter(h => h.rpe && h.rpe >= 8);
        if (recentRpe.length >= 3) return true;
    }

    // Current RPE very high
    if (rpe && rpe >= 9) return true;

    // Declining performance
    if (analyzeTrend(history) === 'declining') return true;

    return false;
}

/**
 * Main progression calculation
 */
export function calculateSmartProgression(input: ProgressionInput): ProgressionResult {
    const volumePercent = calculateVolumeCompletion(input);
    const history = input.workoutHistory ?? [];
    const successStreak = calculateSuccessStreak(history);
    const recoveryScore = calculateRecoveryScore(input.lastWorkoutDate);
    const trend = analyzeTrend(history);
    const deloadRecommended = shouldDeload(history, input.rpe);

    // Check for deload first
    if (deloadRecommended) {
        return {
            recommendation: 'deload',
            confidence: 0.8,
            reasoning: 'Рекомендуется разгрузочная неделя: высокая нагрузка или снижение результатов.',
            isDeloadRecommended: true,
        };
    }

    // Check for regression
    if (volumePercent < 60) {
        const prevTier = input.currentTier > 1 ? input.currentTier - 1 : input.currentTier;
        return {
            recommendation: 'regress',
            confidence: 0.7,
            reasoning: `Выполнено ${Math.round(volumePercent)}% объёма. Рекомендуется вернуться на предыдущий тир.`,
            suggestedLevel: input.currentLevel,
            suggestedTier: prevTier,
        };
    }

    // Advance tier logic
    if (volumePercent >= 100 && successStreak >= 2 && recoveryScore >= 0.8) {
        // Check if can advance tier
        const maxTier = input.currentLevel === 10 ? 4 : 3;

        if (input.currentTier < maxTier) {
            return {
                recommendation: 'advance_tier',
                confidence: calculateConfidence(volumePercent, successStreak, recoveryScore, trend),
                reasoning: `Отлично! ${Math.round(volumePercent)}% объёма выполнено ${successStreak} раз подряд. Готов к следующему тиру!`,
                suggestedLevel: input.currentLevel,
                suggestedTier: input.currentTier + 1,
            };
        }

        // Advance to next level
        if (input.currentLevel < 10) {
            return {
                recommendation: 'advance_level',
                confidence: calculateConfidence(volumePercent, successStreak, recoveryScore, trend),
                reasoning: `Превосходно! Уровень ${input.currentLevel} освоен. Переход на уровень ${input.currentLevel + 1}!`,
                suggestedLevel: input.currentLevel + 1,
                suggestedTier: 1,
            };
        }
    }

    // Low RPE with high completion - maybe jump 2 tiers
    if (input.rpe && input.rpe <= 4 && volumePercent >= 110 && successStreak >= 3) {
        const jumpTier = Math.min(input.currentTier + 2, input.currentLevel === 10 ? 4 : 3);
        if (jumpTier > input.currentTier) {
            return {
                recommendation: 'advance_tier',
                confidence: 0.9,
                reasoning: `Очень легко! RPE ${input.rpe}/10 при ${Math.round(volumePercent)}% объёма. Можно пропустить тир!`,
                suggestedLevel: input.currentLevel,
                suggestedTier: jumpTier,
            };
        }
    }

    // Stay at current level
    return {
        recommendation: 'stay',
        confidence: 0.75,
        reasoning: getStayReason(volumePercent, successStreak, trend),
        suggestedLevel: input.currentLevel,
        suggestedTier: input.currentTier,
    };
}

function calculateConfidence(
    volumePercent: number,
    successStreak: number,
    recoveryScore: number,
    trend: 'improving' | 'stable' | 'declining'
): number {
    let confidence = 0.5;

    // Volume factor
    if (volumePercent >= 110) confidence += 0.2;
    else if (volumePercent >= 100) confidence += 0.15;
    else if (volumePercent >= 90) confidence += 0.1;

    // Streak factor
    if (successStreak >= 3) confidence += 0.15;
    else if (successStreak >= 2) confidence += 0.1;

    // Recovery factor
    confidence += (recoveryScore - 0.5) * 0.2;

    // Trend factor
    if (trend === 'improving') confidence += 0.1;
    if (trend === 'declining') confidence -= 0.1;

    return Math.min(1, Math.max(0, confidence));
}

function getStayReason(volumePercent: number, streak: number, trend: string): string {
    if (volumePercent < 90) {
        return `Выполнено ${Math.round(volumePercent)}%. Закрепляем текущий уровень.`;
    }

    if (streak < 2) {
        return `Хороший результат! Ещё ${2 - streak} успешных тренировок для перехода.`;
    }

    if (trend === 'declining') {
        return 'Результаты немного снизились. Закрепляем текущий уровень.';
    }

    return 'Продолжаем работать на текущем уровне.';
}

/**
 * Format level as X.Y string
 */
export function formatLevel(level: number, tier: number): string {
    return `${level}.${tier}`;
}

/**
 * Parse X.Y string to level and tier
 */
export function parseLevel(levelString: string): { level: number; tier: number } {
    const parts = levelString.split('.');
    return {
        level: parseInt(parts[0], 10) || 1,
        tier: parseInt(parts[1], 10) || 1,
    };
}

/**
 * Get tier name in Russian
 */
export function getTierName(tier: number): string {
    const names: Record<number, string> = {
        1: 'Начальный',
        2: 'Продвинутый',
        3: 'Профессиональный',
        4: 'Элитный',
    };
    return names[tier] || '';
}

/**
 * Get volume multiplier for tier
 */
export function getTierVolume(tier: number): number {
    return TIER_VOLUME[tier] ?? 1.0;
}
