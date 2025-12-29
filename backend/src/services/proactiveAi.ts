/**
 * Proactive AI Service (IDEA-013)
 * Generates proactive messages and reminders based on user activity patterns
 */

export interface ProactiveContext {
    profileId: string;
    lastWorkoutDate: Date | null;
    workoutStreak: number;
    missedWorkouts: number;
    scheduledToday: boolean;
    currentHour: number;
    dayOfWeek: number; // 0-6, 0 = Sunday
    userName?: string;
    preferredWorkoutTime?: number; // hour of day
    goals?: string[];
    injuries?: string[];
}

export interface ProactiveMessage {
    type: 'reminder' | 'motivation' | 'tip' | 'achievement' | 'check_in' | 'soft_push';
    priority: 'high' | 'medium' | 'low';
    message: string;
    reaction?: string;
    sendAt?: Date;
    triggerCondition: string;
}

// Time-based message templates
const MORNING_MESSAGES = [
    { msg: "Доброе утро! 🌅 Готов к тренировке сегодня?", reaction: "💪" },
    { msg: "Новый день — новые возможности! Что на плане? 🔥", reaction: "🔥" },
    { msg: "Утро начинается с движения! Как настрой? 💪", reaction: "💪" },
];

const AFTERNOON_MESSAGES = [
    { msg: "Как проходит день? Не забыл про тренировку? 🏃", reaction: "🏃" },
    { msg: "Середина дня — идеальное время для активности! 💪", reaction: "💪" },
];

const EVENING_MESSAGES = [
    { msg: "Вечер — отличное время для тренировки! Успеваешь? 🌙", reaction: "🌙" },
    { msg: "День почти прошёл. Тренировка ещё впереди? 💪", reaction: "💪" },
];

// Streak messages
const STREAK_MESSAGES: Record<number, string> = {
    3: "3 дня подряд! Отличный старт серии! 🔥",
    5: "5 дней! Ты формируешь привычку! 💪",
    7: "НЕДЕЛЯ БЕЗ ПРОПУСКОВ! 🏆 Легенда!",
    14: "2 недели подряд! Твоя дисциплина впечатляет! 🔥🔥",
    21: "21 день! Привычка сформирована! 🏆🏆",
    30: "МЕСЯЦ! 30 дней подряд! Ты — МАШИНА! 💪🔥🏆",
};

// Missed workout messages (soft push - NEW-014)
const MISSED_WORKOUT_MESSAGES = [
    { days: 1, msg: "Вчера пропустил тренировку? Ничего, сегодня наверстаем! 💪", priority: 'low' as const },
    { days: 2, msg: "2 дня без тренировок. Мышцы скучают! Может, лёгкая разминка? 🏃", priority: 'medium' as const },
    { days: 3, msg: "3 дня перерыва. Вернуться никогда не поздно! Начнём с малого? 💪", priority: 'medium' as const },
    { days: 5, msg: "Давно не виделись! Всё в порядке? Если что — я тут, готов помочь 🤝", priority: 'high' as const },
    { days: 7, msg: "Неделя прошла... Скучаю! Может, одна короткая тренировка? 15 минут всего 🙏", priority: 'high' as const },
];

// Random tips
const WORKOUT_TIPS = [
    "💡 Совет дня: Разминка 5 минут снижает риск травм на 50%!",
    "💡 Знаешь, что вода улучшает силовые на 10%? Пей больше!",
    "💡 Сон 7-8 часов = лучшее восстановление мышц 😴",
    "💡 Прогрессивная перегрузка — ключ к росту! Добавляй понемногу.",
    "💡 Белок после тренировки: 20-30г в течение часа 🥩",
    "💡 Растяжка после тренировки ускоряет восстановление!",
];

/**
 * Determine if it's a good time to send proactive message
 */
function isGoodTimeToMessage(hour: number, dayOfWeek: number): boolean {
    // Don't message late at night (22:00 - 07:00)
    if (hour >= 22 || hour < 7) {
        return false;
    }

    // Reduce frequency on weekends (let people rest)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Only morning on weekends
        return hour >= 9 && hour <= 11;
    }

    return true;
}

/**
 * Get time-appropriate greeting
 */
function getTimeBasedMessage(hour: number): { msg: string; reaction: string } {
    const messages = hour < 12
        ? MORNING_MESSAGES
        : hour < 17
            ? AFTERNOON_MESSAGES
            : EVENING_MESSAGES;

    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Calculate days since last workout
 */
function daysSinceLastWorkout(lastWorkoutDate: Date | null): number {
    if (!lastWorkoutDate) return 999;
    const now = new Date();
    const diffMs = now.getTime() - lastWorkoutDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Generate proactive messages based on context
 */
export function generateProactiveMessages(context: ProactiveContext): ProactiveMessage[] {
    const messages: ProactiveMessage[] = [];
    const daysSince = daysSinceLastWorkout(context.lastWorkoutDate);
    const name = context.userName || 'Спортсмен';

    // Check if good time to message
    if (!isGoodTimeToMessage(context.currentHour, context.dayOfWeek)) {
        return messages;
    }

    // 1. Streak celebration
    if (context.workoutStreak > 0 && STREAK_MESSAGES[context.workoutStreak]) {
        messages.push({
            type: 'achievement',
            priority: 'high',
            message: `${name}, ${STREAK_MESSAGES[context.workoutStreak]}`,
            reaction: '🏆',
            triggerCondition: `streak_${context.workoutStreak}`,
        });
    }

    // 2. Scheduled workout reminder
    if (context.scheduledToday) {
        const timeMsg = getTimeBasedMessage(context.currentHour);
        messages.push({
            type: 'reminder',
            priority: 'medium',
            message: `${name}, у тебя сегодня тренировка по плану! ${timeMsg.msg}`,
            reaction: timeMsg.reaction,
            triggerCondition: 'scheduled_today',
        });
    }

    // 3. Missed workout soft push (NEW-014)
    for (const missed of MISSED_WORKOUT_MESSAGES) {
        if (daysSince === missed.days) {
            messages.push({
                type: 'soft_push',
                priority: missed.priority,
                message: missed.msg.replace('{name}', name),
                reaction: '💪',
                triggerCondition: `missed_${missed.days}_days`,
            });
            break;
        }
    }

    // 4. Morning motivation (if preferred workout time is morning)
    if (
        context.currentHour >= 7 &&
        context.currentHour <= 9 &&
        context.preferredWorkoutTime &&
        context.preferredWorkoutTime < 12
    ) {
        const morning = MORNING_MESSAGES[Math.floor(Math.random() * MORNING_MESSAGES.length)];
        messages.push({
            type: 'motivation',
            priority: 'low',
            message: `${name}, ${morning.msg}`,
            reaction: morning.reaction,
            triggerCondition: 'morning_person',
        });
    }

    // 5. Random tip (low priority, once a day)
    if (context.currentHour === 12) { // Noon tip
        const tip = WORKOUT_TIPS[Math.floor(Math.random() * WORKOUT_TIPS.length)];
        messages.push({
            type: 'tip',
            priority: 'low',
            message: tip,
            reaction: '💡',
            triggerCondition: 'daily_tip',
        });
    }

    // 6. Check-in if been a while
    if (daysSince >= 14 && context.currentHour >= 10 && context.currentHour <= 18) {
        messages.push({
            type: 'check_in',
            priority: 'high',
            message: `${name}, давно не виделись! Всё в порядке? Если нужна помощь перезапустить тренировки — я готов помочь составить новый план 🤝`,
            reaction: '🤝',
            triggerCondition: 'long_absence',
        });
    }

    // Consider injuries in messages
    if (context.injuries && context.injuries.length > 0) {
        // Filter out messages that might suggest exercises harmful for injuries
        // This is a simplified version - in production would need more sophisticated filtering
        messages.forEach(msg => {
            if (msg.type === 'motivation' || msg.type === 'soft_push') {
                msg.message += ' (Помни о своих ограничениях — работаем безопасно!)';
            }
        });
    }

    // Sort by priority
    messages.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Return top 2 messages max
    return messages.slice(0, 2);
}

/**
 * Get single best proactive message for current context
 */
export function getBestProactiveMessage(context: ProactiveContext): ProactiveMessage | null {
    const messages = generateProactiveMessages(context);
    return messages.length > 0 ? messages[0] : null;
}

/**
 * Soft mode message modifier (NEW-014)
 * Makes messages gentler for users who prefer softer motivation
 */
export function applySoftMode(message: string): string {
    // Remove aggressive punctuation
    let soft = message.replace(/!/g, '.');

    // Soften caps
    soft = soft.replace(/[А-ЯЁ]{3,}/g, match =>
        match.charAt(0) + match.slice(1).toLowerCase()
    );

    // Replace aggressive emojis
    const emojiMap: Record<string, string> = {
        '🔥': '✨',
        '💪': '🌟',
        '🏆': '⭐',
        '😤': '🙂',
    };

    for (const [aggressive, soft_emoji] of Object.entries(emojiMap)) {
        soft = soft.replace(new RegExp(aggressive, 'g'), soft_emoji);
    }

    return soft;
}

/**
 * Schedule context-aware reminder (IDEA-014)
 */
export function getContextualReminder(context: ProactiveContext): ProactiveMessage | null {
    const { currentHour, scheduledToday, lastWorkoutDate, preferredWorkoutTime } = context;
    const daysSince = daysSinceLastWorkout(lastWorkoutDate);

    // No reminder needed if trained today
    if (daysSince === 0) {
        return null;
    }

    // Scheduled workout approaching
    if (scheduledToday && preferredWorkoutTime) {
        const hoursUntilWorkout = preferredWorkoutTime - currentHour;

        if (hoursUntilWorkout === 1) {
            return {
                type: 'reminder',
                priority: 'high',
                message: 'Тренировка через час! Пора готовиться 🎽',
                reaction: '⏰',
                triggerCondition: '1_hour_before',
            };
        }

        if (hoursUntilWorkout === 0) {
            return {
                type: 'reminder',
                priority: 'high',
                message: 'Время тренировки! Вперёд! 💪',
                reaction: '💪',
                triggerCondition: 'workout_time',
            };
        }
    }

    return null;
}
