export const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export const DAY_NAME_ALIASES: Record<string, string> = {
    sun: 'sunday',
    sunday: 'sunday',
    вс: 'sunday',
    воскресенье: 'sunday',
    mon: 'monday',
    monday: 'monday',
    пн: 'monday',
    понедельник: 'monday',
    tue: 'tuesday',
    tuesday: 'tuesday',
    вт: 'tuesday',
    вторник: 'tuesday',
    wed: 'wednesday',
    wednesday: 'wednesday',
    ср: 'wednesday',
    среда: 'wednesday',
    thu: 'thursday',
    thursday: 'thursday',
    чт: 'thursday',
    четверг: 'thursday',
    fri: 'friday',
    friday: 'friday',
    пт: 'friday',
    пятница: 'friday',
    sat: 'saturday',
    saturday: 'saturday',
    сб: 'saturday',
    суббота: 'saturday',
    rest: 'rest',
    отдых: 'rest',
    'rest day': 'rest',
    выходной: 'rest',
};

export const weekDayOrder = WEEKDAY_KEYS;

export function sanitizeDayValue(value: string): string {
    return value.replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function resolveCycleIndexFromValue(value: string | null | undefined): number | null {
    if (!value) return null;
    const match = String(value).match(/(\d+)/);
    if (!match) return null;
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.round(parsed) - 1);
}

export function normalizeDayKey(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.toString().trim().toLowerCase();
    if (!trimmed) return null;
    if (DAY_NAME_ALIASES[trimmed]) {
        return DAY_NAME_ALIASES[trimmed];
    }
    const sanitized = sanitizeDayValue(trimmed);
    if (DAY_NAME_ALIASES[sanitized]) {
        return DAY_NAME_ALIASES[sanitized];
    }
    const cycleIndex = resolveCycleIndexFromValue(sanitized);
    if (cycleIndex !== null) {
        return `day_${cycleIndex + 1}`;
    }
    return sanitized;
}
