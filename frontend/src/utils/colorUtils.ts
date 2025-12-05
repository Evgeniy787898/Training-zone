/**
 * Утилиты для работы с цветами
 */

/**
 * Осветляет HEX цвет на указанную величину (0-1)
 * @param hex - HEX цвет (например, '#10A37F')
 * @param amount - Коэффициент осветления (0-1), по умолчанию 0.35
 * @returns Осветленный HEX цвет
 */
export function lightenColor(hex: string, amount = 0.35): string {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return hex;

  const num = parseInt(sanitized, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;

  const lighten = (channel: number) =>
    Math.round(channel + (255 - channel) * Math.min(Math.max(amount, 0), 1));

  r = lighten(r);
  g = lighten(g);
  b = lighten(b);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Смешивает два HEX цвета с указанным процентом первого цвета
 * @param color1 - Первый HEX цвет (например, '#FFFFFF')
 * @param color2 - Второй HEX цвет (например, '#10A37F')
 * @param percentage - Процент первого цвета (0-100), по умолчанию 50
 * @returns Смешанный HEX цвет
 */
export function mixColors(color1: string, color2: string, percentage: number): string {
  const sanitize = (hex: string) => hex.replace('#', '').padStart(6, '0');
  
  const hex1 = sanitize(color1);
  const hex2 = sanitize(color2);
  
  if (hex1.length !== 6 || hex2.length !== 6) return color1;
  
  const num1 = parseInt(hex1, 16);
  const num2 = parseInt(hex2, 16);
  
  const r1 = (num1 >> 16) & 0xff;
  const g1 = (num1 >> 8) & 0xff;
  const b1 = num1 & 0xff;
  
  const r2 = (num2 >> 16) & 0xff;
  const g2 = (num2 >> 8) & 0xff;
  const b2 = num2 & 0xff;
  
  const p = Math.min(Math.max(percentage, 0), 100) / 100;
  const q = 1 - p;
  
  const r = Math.round(r1 * p + r2 * q);
  const g = Math.round(g1 * p + g2 * q);
  const b = Math.round(b1 * p + b2 * q);
  
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Генерирует hash из строки для детерминированной генерации цветов
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Минималистичная палитра цветов для дисциплин (разнообразные, но гармоничные)
 */
const disciplinePalette = [
  '#10A37F', // ChatGPT Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#A855F7', // Violet
  '#0EA5E9', // Sky
];

/**
 * Генерирует уникальный цвет для дисциплины (детерминировано)
 * @param id - ID дисциплины
 * @param name - Название дисциплины
 * @returns HEX цвет
 */
export function getDisciplineColor(id: string, name: string): string {
  const key = `${id}_${name}`;
  const hash = hashString(key);
  const index = hash % disciplinePalette.length;
  return disciplinePalette[index];
}

/**
 * Генерирует минималистичный градиент для дисциплины
 * @param primaryColor - Основной цвет дисциплины
 * @returns Объект с цветами градиента
 */
export function generateDisciplineGradient(primaryColor: string): {
  primary: string;
  light: string;
  soft: string;
} {
  return {
    primary: primaryColor,
    light: lightenColor(primaryColor, 0.88),
    soft: lightenColor(primaryColor, 0.92),
  };
}

/**
 * Генерирует отличающийся оттенок для программы тренировок на основе цвета направления
 * Создает нейтральный оттенок, связанный с направлением, но отличающийся
 * @param disciplineColor - Цвет направления
 * @returns HEX цвет для программы (более нейтральный оттенок)
 */
export function getProgramColor(disciplineColor: string): string {
  // Конвертируем цвет направления в HSL
  const hex = disciplineColor.replace('#', '');
  const num = parseInt(hex, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  
  // Простая конвертация RGB в HSL (приближенная)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2 / 255;
  const s = max === min ? 0 : (max - min) / (255 - Math.abs(2 * l * 255 - 255));
  
  // Вычисляем hue (приближенно)
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / (max - min) + 2) / 6;
    else h = ((r - g) / (max - min) + 4) / 6;
  }
  
  // Создаем нейтральный оттенок: слегка смещаем hue, уменьшаем насыщенность, немного меняем яркость
  const newHue = (h * 360 + 30) % 360; // Смещение на 30 градусов
  const newSaturation = Math.min(s * 100 * 0.4, 45); // Уменьшаем насыщенность до 40% от исходной, но не более 45%
  const newLightness = Math.max(Math.min(l * 100 - 5, 55), 35); // Немного уменьшаем яркость
  
  // Конвертируем HSL обратно в RGB
  const h_norm = newHue / 360;
  const s_norm = newSaturation / 100;
  const l_norm = newLightness / 100;
  
  const c = (1 - Math.abs(2 * l_norm - 1)) * s_norm;
  const x = c * (1 - Math.abs((h_norm * 6) % 2 - 1));
  const m = l_norm - c / 2;
  
  let r_new = 0, g_new = 0, b_new = 0;
  
  if (h_norm >= 0 && h_norm < 1/6) {
    r_new = c; g_new = x; b_new = 0;
  } else if (h_norm >= 1/6 && h_norm < 2/6) {
    r_new = x; g_new = c; b_new = 0;
  } else if (h_norm >= 2/6 && h_norm < 3/6) {
    r_new = 0; g_new = c; b_new = x;
  } else if (h_norm >= 3/6 && h_norm < 4/6) {
    r_new = 0; g_new = x; b_new = c;
  } else if (h_norm >= 4/6 && h_norm < 5/6) {
    r_new = x; g_new = 0; b_new = c;
  } else {
    r_new = c; g_new = 0; b_new = x;
  }
  
  r_new = Math.round((r_new + m) * 255);
  g_new = Math.round((g_new + m) * 255);
  b_new = Math.round((b_new + m) * 255);
  
  return `#${((1 << 24) + (r_new << 16) + (g_new << 8) + b_new).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Генерирует разнообразный цвет для упражнения на основе дисциплины
 * Создает уникальные цвета для каждого упражнения, связанные с цветом дисциплины
 * @param exerciseKey - Ключ упражнения
 * @param disciplineColor - Цвет дисциплины
 * @returns HEX цвет для упражнения
 */
export function getExerciseColor(exerciseKey: string, disciplineColor: string): string {
  const hash = hashString(exerciseKey);
  const variation = hash % 360; // Используем hue для вариации
  
  // Конвертируем дисциплину в HSL для работы с hue
  const hex = disciplineColor.replace('#', '');
  const num = parseInt(hex, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  
  // Простая конвертация RGB в HSL (приближенная)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2 / 255;
  const s = max === min ? 0 : (max - min) / (255 - Math.abs(2 * l * 255 - 255));
  
  // Вычисляем hue (приближенно)
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / (max - min) + 2) / 6;
    else h = ((r - g) / (max - min) + 4) / 6;
  }
  
  // Добавляем вариацию hue для разнообразия упражнений
  const newHue = (h * 360 + variation * 0.3) % 360;
  const newSaturation = Math.min(Math.max(s * 100 + (hash % 20) - 10, 50), 75);
  const newLightness = Math.min(Math.max(l * 100 + (hash % 15) - 7, 45), 60);
  
  // Конвертируем HSL обратно в RGB
  const h_norm = newHue / 360;
  const s_norm = newSaturation / 100;
  const l_norm = newLightness / 100;
  
  const c = (1 - Math.abs(2 * l_norm - 1)) * s_norm;
  const x = c * (1 - Math.abs((h_norm * 6) % 2 - 1));
  const m = l_norm - c / 2;
  
  let r_new = 0, g_new = 0, b_new = 0;
  
  if (h_norm >= 0 && h_norm < 1/6) {
    r_new = c; g_new = x; b_new = 0;
  } else if (h_norm >= 1/6 && h_norm < 2/6) {
    r_new = x; g_new = c; b_new = 0;
  } else if (h_norm >= 2/6 && h_norm < 3/6) {
    r_new = 0; g_new = c; b_new = x;
  } else if (h_norm >= 3/6 && h_norm < 4/6) {
    r_new = 0; g_new = x; b_new = c;
  } else if (h_norm >= 4/6 && h_norm < 5/6) {
    r_new = x; g_new = 0; b_new = c;
  } else {
    r_new = c; g_new = 0; b_new = x;
  }
  
  r_new = Math.round((r_new + m) * 255);
  g_new = Math.round((g_new + m) * 255);
  b_new = Math.round((b_new + m) * 255);
  
  return `#${((1 << 24) + (r_new << 16) + (g_new << 8) + b_new).toString(16).slice(1).toUpperCase()}`;
}

