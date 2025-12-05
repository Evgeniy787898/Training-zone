/**
 * Утилиты для парсинга переменных окружения
 * Централизованные функции для избежания дублирования кода (DRY принцип)
 */

/**
 * Парсит значение в положительное целое число (строго больше 0)
 * @param value - значение для парсинга (string, number, null, undefined)
 * @returns положительное целое число или null, если значение невалидно
 */
export const parsePositiveNumber = (value?: string | number | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
};

/**
 * Парсит значение в положительное целое число с fallback значением
 * @param value - значение для парсинга
 * @param fallback - значение по умолчанию, если парсинг не удался
 * @returns положительное целое число или fallback
 */
export const parsePositiveNumberWithFallback = (
  value?: string | number | null,
  fallback = 3600,
): number => {
  const parsed = parsePositiveNumber(value);
  return parsed ?? fallback;
};

/**
 * Парсит значение в неотрицательное число (>= 0)
 * @param value - значение для парсинга
 * @returns неотрицательное число или null, если значение невалидно
 */
export const parseNonNegativeNumber = (value?: string | number | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

/**
 * Парсит значение в число в диапазоне [0, 1] (для коэффициентов и соотношений)
 * @param value - значение для парсинга
 * @returns число от 0 до 1 или null, если значение невалидно
 */
export const parseRatioNumber = (value?: string | number | null): number | null => {
  const parsed = parseNonNegativeNumber(value);
  if (parsed === null) {
    return null;
  }
  return Math.min(1, parsed);
};

/**
 * Парсит значение в boolean
 * @param value - значение для парсинга
 * @param defaultValue - значение по умолчанию, если значение не распознано
 * @returns boolean значение
 */
export const parseBoolean = (value: string | undefined | null, defaultValue: boolean): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

/**
 * Парсит значение в целое число (может быть отрицательным)
 * @param value - значение для парсинга
 * @returns целое число или null, если значение невалидно
 */
export const parseInteger = (value?: string | number | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor(parsed);
};


