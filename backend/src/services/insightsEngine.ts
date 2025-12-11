/**
 * AI Insights Engine (DB-V02)
 * 
 * Calculates training insights from workout data:
 * - Strength potential
 * - Recovery rate
 * - Optimal training load
 * - Consistency scores
 */

// Insight types
export interface TrainingInsight {
    type: 'strength' | 'recovery' | 'consistency' | 'volume' | 'recommendation';
    title: string;
    value: string | number;
    change?: number; // Percentage change from previous period
    trend: 'up' | 'down' | 'stable';
    description: string;
    confidence: number; // 0-1
}

// Workout data interface (from database)
export interface WorkoutData {
    id: string;
    date: Date;
    duration: number; // minutes
    exercises: Array<{
        exerciseKey: string;
        sets: number;
        reps: number;
        weight?: number;
        rpe?: number; // Rate of Perceived Exertion (1-10)
    }>;
    notes?: string;
}

// Calculate total volume (sets * reps * weight)
export const calculateVolume = (workout: WorkoutData): number => {
    return workout.exercises.reduce((total, ex) => {
        const weight = ex.weight || 1;
        return total + (ex.sets * ex.reps * weight);
    }, 0);
};

// Calculate average RPE
export const calculateAvgRPE = (workout: WorkoutData): number => {
    const rpes = workout.exercises
        .filter(ex => ex.rpe !== undefined)
        .map(ex => ex.rpe!);
    if (rpes.length === 0) return 0;
    return rpes.reduce((sum, rpe) => sum + rpe, 0) / rpes.length;
};

// Calculate recovery score (based on rest days and RPE trends)
export const calculateRecoveryScore = (
    workouts: WorkoutData[],
    dayWindow: number = 7
): number => {
    if (workouts.length < 2) return 100;

    const now = new Date();
    const recentWorkouts = workouts.filter(w => {
        const daysDiff = Math.floor((now.getTime() - new Date(w.date).getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= dayWindow;
    });

    // Factor 1: Average rest days between workouts
    const avgRestDays = recentWorkouts.length > 1
        ? dayWindow / (recentWorkouts.length - 1)
        : dayWindow;
    const restScore = Math.min(100, avgRestDays * 30); // 3+ rest days = 100%

    // Factor 2: Decreasing RPE trend is good
    const avgRPE = recentWorkouts.reduce((sum, w) => sum + calculateAvgRPE(w), 0) / (recentWorkouts.length || 1);
    const rpeScore = Math.max(0, 100 - (avgRPE - 5) * 15); // RPE 5 = 100%, RPE 10 = 25%

    return Math.round((restScore + rpeScore) / 2);
};

// Calculate consistency score (% of planned workouts completed)
export const calculateConsistencyScore = (
    completedWorkouts: number,
    plannedWorkouts: number
): number => {
    if (plannedWorkouts === 0) return 0;
    return Math.min(100, Math.round((completedWorkouts / plannedWorkouts) * 100));
};

// Calculate strength potential (based on progressive overload)
export const calculateStrengthPotential = (
    workouts: WorkoutData[],
    exerciseKey: string
): number => {
    const exerciseWorkouts = workouts
        .map(w => w.exercises.find(ex => ex.exerciseKey === exerciseKey))
        .filter(Boolean);

    if (exerciseWorkouts.length < 3) return 50; // Not enough data

    // Check for progressive overload
    let progressCount = 0;
    for (let i = 1; i < exerciseWorkouts.length; i++) {
        const prev = exerciseWorkouts[i - 1]!;
        const curr = exerciseWorkouts[i]!;

        const prevVolume = (prev.weight || 1) * prev.reps * prev.sets;
        const currVolume = (curr.weight || 1) * curr.reps * curr.sets;

        if (currVolume > prevVolume) progressCount++;
    }

    const progressRate = progressCount / (exerciseWorkouts.length - 1);
    return Math.round(progressRate * 100);
};

// Determine trend from two values
export const determineTrend = (
    current: number,
    previous: number
): 'up' | 'down' | 'stable' => {
    const change = ((current - previous) / (previous || 1)) * 100;
    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
};

// Generate all insights for a user
export const generateInsights = (
    workouts: WorkoutData[],
    previousWorkouts: WorkoutData[], // Previous period for comparison
    plannedPerWeek: number = 3
): TrainingInsight[] => {
    const insights: TrainingInsight[] = [];

    // 1. Weekly volume
    const weekVolume = workouts.reduce((sum, w) => sum + calculateVolume(w), 0);
    const prevWeekVolume = previousWorkouts.reduce((sum, w) => sum + calculateVolume(w), 0);

    insights.push({
        type: 'volume',
        title: 'Недельный объём',
        value: weekVolume.toLocaleString(),
        change: prevWeekVolume ? Math.round((weekVolume - prevWeekVolume) / prevWeekVolume * 100) : 0,
        trend: determineTrend(weekVolume, prevWeekVolume),
        description: 'Суммарный объём (подходы × повторы × вес)',
        confidence: 0.9,
    });

    // 2. Recovery score
    const recoveryScore = calculateRecoveryScore(workouts);
    const prevRecovery = calculateRecoveryScore(previousWorkouts);

    insights.push({
        type: 'recovery',
        title: 'Восстановление',
        value: `${recoveryScore}%`,
        change: recoveryScore - prevRecovery,
        trend: determineTrend(recoveryScore, prevRecovery),
        description: recoveryScore >= 70 ? 'Хорошее восстановление' : 'Рекомендуется отдых',
        confidence: 0.75,
    });

    // 3. Consistency
    const thisWeekCount = workouts.length;
    const consistencyScore = calculateConsistencyScore(thisWeekCount, plannedPerWeek);
    const prevConsistency = calculateConsistencyScore(previousWorkouts.length, plannedPerWeek);

    insights.push({
        type: 'consistency',
        title: 'Регулярность',
        value: `${thisWeekCount}/${plannedPerWeek}`,
        change: consistencyScore - prevConsistency,
        trend: determineTrend(consistencyScore, prevConsistency),
        description: consistencyScore >= 80 ? 'Отличная регулярность!' : 'Можно лучше',
        confidence: 1.0,
    });

    // 4. Recommendation
    let recommendation = '';
    if (recoveryScore < 50) {
        recommendation = 'Добавьте день отдыха для лучшего восстановления';
    } else if (consistencyScore < 50) {
        recommendation = 'Попробуйте добавить ещё одну тренировку на неделе';
    } else if (weekVolume > prevWeekVolume * 1.2) {
        recommendation = 'Отличный прогресс! Следите за восстановлением';
    } else {
        recommendation = 'Всё идёт хорошо, продолжайте в том же духе!';
    }

    insights.push({
        type: 'recommendation',
        title: '💡 Рекомендация',
        value: recommendation,
        trend: 'stable',
        description: 'На основе ваших данных',
        confidence: 0.7,
    });

    return insights;
};

export default {
    calculateVolume,
    calculateAvgRPE,
    calculateRecoveryScore,
    calculateConsistencyScore,
    calculateStrengthPotential,
    generateInsights,
};
