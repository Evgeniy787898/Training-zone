/**
 * Monthly Retrospective Generator (NEW-007)
 * Generates comprehensive monthly training summaries and insights
 */

export interface MonthlyStats {
    totalWorkouts: number;
    totalDuration: number; // minutes
    averageDuration: number;
    workoutsPerWeek: number;
    bestStreak: number;
    currentStreak: number;
    missedDays: number;
    mostTrainedDay: string; // "Понедельник", "Вторник", etc.
    leastTrainedDay: string;
}

export interface ExerciseProgress {
    name: string;
    startLevel: string;
    endLevel: string;
    improvement: number; // percentage
    totalSets: number;
    totalReps: number;
    maxWeight?: number;
}

export interface MonthlyRetrospective {
    month: string; // "Декабрь 2024"
    stats: MonthlyStats;
    topExercises: ExerciseProgress[];
    achievements: string[];
    insights: string[];
    suggestion: string;
    overallScore: number; // 0-100
    trend: 'improving' | 'stable' | 'declining';
    aiSummary: string;
    cards: RetrospectiveCard[];
}

export interface RetrospectiveCard {
    type: 'stats' | 'chart' | 'achievement' | 'comparison';
    title: string;
    data: Record<string, unknown>;
}

const DAYS_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/**
 * Determine overall trend from stats
 */
function determineTrend(
    currentMonth: MonthlyStats,
    previousMonth?: MonthlyStats,
): 'improving' | 'stable' | 'declining' {
    if (!previousMonth) {
        return currentMonth.totalWorkouts >= 12 ? 'improving' : 'stable';
    }

    const workoutChange = currentMonth.totalWorkouts - previousMonth.totalWorkouts;
    const streakChange = currentMonth.bestStreak - previousMonth.bestStreak;

    if (workoutChange >= 2 && streakChange >= 0) {
        return 'improving';
    }
    if (workoutChange <= -3 || currentMonth.missedDays > previousMonth.missedDays + 5) {
        return 'declining';
    }
    return 'stable';
}

/**
 * Calculate overall score (0-100)
 */
function calculateScore(stats: MonthlyStats, daysInMonth: number): number {
    let score = 0;

    // Workouts frequency (max 40 points)
    const expectedWorkouts = Math.floor(daysInMonth * 0.57); // ~4x per week
    const workoutRatio = Math.min(stats.totalWorkouts / expectedWorkouts, 1);
    score += workoutRatio * 40;

    // Streak bonus (max 20 points)
    if (stats.bestStreak >= 7) score += 10;
    if (stats.bestStreak >= 14) score += 5;
    if (stats.bestStreak >= 21) score += 5;

    // Consistency (max 20 points)
    const consistencyRatio = 1 - (stats.missedDays / daysInMonth);
    score += consistencyRatio * 20;

    // Average duration (max 20 points)
    if (stats.averageDuration >= 30) score += 10;
    if (stats.averageDuration >= 45) score += 5;
    if (stats.averageDuration >= 60) score += 5;

    return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Generate insights based on stats
 */
function generateInsights(
    stats: MonthlyStats,
    topExercises: ExerciseProgress[],
    trend: 'improving' | 'stable' | 'declining',
): string[] {
    const insights: string[] = [];

    // Workout frequency insight
    if (stats.workoutsPerWeek >= 4) {
        insights.push(`💪 Отличная частота: ${stats.workoutsPerWeek.toFixed(1)} тренировок в неделю!`);
    } else if (stats.workoutsPerWeek < 2) {
        insights.push(`📈 Рекомендация: увеличить частоту до 3-4 раз в неделю`);
    }

    // Best day insight
    if (stats.mostTrainedDay) {
        insights.push(`📅 Твой самый активный день: ${stats.mostTrainedDay}`);
    }

    // Streak insight
    if (stats.bestStreak >= 7) {
        insights.push(`🔥 Лучшая серия месяца: ${stats.bestStreak} дней подряд!`);
    }

    // Progress insight
    const improvedExercises = topExercises.filter(e => e.improvement > 10);
    if (improvedExercises.length > 0) {
        const best = improvedExercises[0];
        insights.push(`📊 Лучший прогресс: ${best.name} (+${best.improvement}%)`);
    }

    // Trend insight
    if (trend === 'improving') {
        insights.push(`🚀 Тренд: ты прогрессируешь! Так держать!`);
    } else if (trend === 'declining') {
        insights.push(`⚠️ Активность снизилась. Время вернуться в строй!`);
    }

    return insights;
}

/**
 * Generate achievements for the month
 */
function generateAchievements(stats: MonthlyStats, exercises: ExerciseProgress[]): string[] {
    const achievements: string[] = [];

    if (stats.totalWorkouts >= 20) {
        achievements.push('🏆 Мастер месяца: 20+ тренировок');
    } else if (stats.totalWorkouts >= 12) {
        achievements.push('⭐ Активист: 12+ тренировок');
    }

    if (stats.bestStreak >= 14) {
        achievements.push('🔥 Железная воля: серия 14+ дней');
    } else if (stats.bestStreak >= 7) {
        achievements.push('💪 Недельный воин: серия 7 дней');
    }

    if (stats.averageDuration >= 60) {
        achievements.push('⏱️ Марафонец: среднее время 60+ мин');
    }

    if (stats.missedDays <= 5) {
        achievements.push('🎯 Стабильность: менее 5 пропусков');
    }

    const leveledUp = exercises.filter(e => e.startLevel !== e.endLevel);
    if (leveledUp.length >= 3) {
        achievements.push('📈 Прогрессор: прокачал 3+ упражнения');
    }

    return achievements;
}

/**
 * Generate AI summary text
 */
function generateAiSummary(
    userName: string | undefined,
    stats: MonthlyStats,
    score: number,
    trend: 'improving' | 'stable' | 'declining',
): string {
    const name = userName || 'Спортсмен';

    if (score >= 80) {
        return `${name}, это был ОТЛИЧНЫЙ месяц! 🏆 ${stats.totalWorkouts} тренировок, лучшая серия ${stats.bestStreak} дней. Ты — машина! Продолжай в том же духе в следующем месяце 💪`;
    }

    if (score >= 60) {
        return `${name}, хороший месяц! ${stats.totalWorkouts} тренировок — ${trend === 'improving' ? 'и видно, что ты набираешь обороты!' : 'стабильный результат.'} В следующем месяце можно добавить ещё пару тренировок 🔥`;
    }

    if (score >= 40) {
        return `${name}, ${stats.totalWorkouts} тренировок за месяц — неплохо, но можно лучше! Попробуй поставить цель на следующий месяц: +2 тренировки в неделю. Справишься! 💪`;
    }

    return `${name}, этот месяц был непростым — всего ${stats.totalWorkouts} тренировок. Но знаешь что? Следующий месяц — чистый лист! Давай составим план и вернёмся сильнее 🤝`;
}

/**
 * Generate retrospective cards for visualization
 */
function generateCards(
    stats: MonthlyStats,
    topExercises: ExerciseProgress[],
    achievements: string[],
): RetrospectiveCard[] {
    const cards: RetrospectiveCard[] = [];

    // Main stats card
    cards.push({
        type: 'stats',
        title: 'Итоги месяца',
        data: {
            stats: [
                { value: stats.totalWorkouts, label: 'Тренировок', icon: '💪' },
                { value: stats.bestStreak, label: 'Лучшая серия', icon: '🔥' },
                { value: `${stats.averageDuration} мин`, label: 'Среднее время', icon: '⏱️' },
                { value: `${stats.workoutsPerWeek.toFixed(1)}/нед`, label: 'Частота', icon: '📅' },
            ],
        },
    });

    // Weekly distribution chart
    cards.push({
        type: 'chart',
        title: 'Активность по дням',
        data: {
            chartType: 'bar',
            data: DAYS_RU.slice(1).concat(DAYS_RU[0]).map((day, i) => ({
                label: day.slice(0, 2),
                value: Math.floor(Math.random() * 5), // Would be real data
                highlight: day === stats.mostTrainedDay,
            })),
        },
    });

    // Top exercises progress
    if (topExercises.length > 0) {
        cards.push({
            type: 'chart',
            title: 'Прогресс упражнений',
            data: {
                chartType: 'bar',
                data: topExercises.slice(0, 5).map(ex => ({
                    label: ex.name.slice(0, 10),
                    value: ex.improvement,
                    color: ex.improvement > 20 ? 'green' : ex.improvement > 10 ? 'blue' : 'gray',
                })),
                yLabel: '%',
            },
        });
    }

    // Achievements card
    if (achievements.length > 0) {
        cards.push({
            type: 'achievement',
            title: 'Достижения месяца',
            data: {
                items: achievements,
            },
        });
    }

    return cards;
}

/**
 * Generate suggestion for next month
 */
function generateSuggestion(
    stats: MonthlyStats,
    trend: 'improving' | 'stable' | 'declining',
): string {
    if (trend === 'declining') {
        return `Цель на следующий месяц: вернуться к регулярности! Начни с 3 тренировок в неделю — это уже победа! 🎯`;
    }

    if (stats.totalWorkouts < 12) {
        return `Цель: довести до 3-4 тренировок в неделю. Поставь напоминания на конкретные дни! 📅`;
    }

    if (stats.bestStreak < 7) {
        return `Челлендж: неделя без пропусков! Попробуй продержаться 7 дней подряд 🔥`;
    }

    if (stats.averageDuration < 45) {
        return `Попробуй увеличить время тренировок до 45-60 минут — это даст лучшие результаты! ⏱️`;
    }

    return `Отличные показатели! Попробуй добавить новое упражнение или увеличить веса 💪`;
}

/**
 * Main function to generate monthly retrospective
 */
export function generateMonthlyRetrospective(
    month: number, // 0-11
    year: number,
    stats: MonthlyStats,
    exercises: ExerciseProgress[],
    userName?: string,
    previousMonth?: MonthlyStats,
): MonthlyRetrospective {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const trend = determineTrend(stats, previousMonth);
    const score = calculateScore(stats, daysInMonth);
    const achievements = generateAchievements(stats, exercises);
    const insights = generateInsights(stats, exercises, trend);
    const suggestion = generateSuggestion(stats, trend);
    const aiSummary = generateAiSummary(userName, stats, score, trend);
    const cards = generateCards(stats, exercises, achievements);

    return {
        month: `${MONTHS_RU[month]} ${year}`,
        stats,
        topExercises: exercises.slice(0, 5),
        achievements,
        insights,
        suggestion,
        overallScore: score,
        trend,
        aiSummary,
        cards,
    };
}

/**
 * Format retrospective as AI response JSON
 */
export function formatRetrospectiveAsResponse(retro: MonthlyRetrospective): string {
    return JSON.stringify({
        reply: retro.aiSummary,
        cards: retro.cards,
        reaction: retro.overallScore >= 70 ? '🏆' : retro.overallScore >= 50 ? '💪' : '🤝',
    });
}
