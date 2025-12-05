/**
 * Утилиты для сжатия данных перед сохранением в localStorage
 * Использует простой алгоритм сжатия для текстовых данных
 */

/**
 * Простое сжатие строки (удаление пробелов, минификация JSON)
 */
export function compress(data: any): string {
  try {
    const jsonString = JSON.stringify(data);
    
    // Минификация: удаление лишних пробелов в JSON
    // Это простое сжатие, для реального сжатия можно использовать pako или lz-string
    return jsonString
      .replace(/\s+/g, ' ') // Замена множественных пробелов одним
      .replace(/\s*([{}[\]:,])\s*/g, '$1') // Удаление пробелов вокруг скобок и запятых
      .trim();
  } catch (error) {
    console.error('Compression error:', error);
    return JSON.stringify(data);
  }
}

/**
 * Распаковка сжатых данных
 */
export function decompress<T>(compressed: string): T {
  try {
    return JSON.parse(compressed) as T;
  } catch (error) {
    console.error('Decompression error:', error);
    throw error;
  }
}

/**
 * Проверка нужно ли использовать сжатие (для больших данных)
 */
export function shouldCompress(data: any): boolean {
  try {
    const jsonString = JSON.stringify(data);
    // Сжимаем если данные больше 50KB
    return jsonString.length > 50 * 1024;
  } catch {
    return false;
  }
}

/**
 * Получение размера данных в байтах
 */
export function getDataSize(data: any): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
}
