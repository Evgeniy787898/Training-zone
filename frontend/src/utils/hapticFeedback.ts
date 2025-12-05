/**
 * Утилита для haptic feedback через Telegram WebApp SDK
 * Предоставляет тактильную обратную связь при взаимодействии с элементами интерфейса
 */

/**
 * Проверяет, доступен ли Telegram WebApp SDK
 */
const isTelegramWebApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Telegram?.WebApp;
};

/**
 * Получает экземпляр Telegram WebApp
 */
const getTelegramWebApp = (): any => {
  if (typeof window === 'undefined') return null;
  return (window as any).Telegram?.WebApp || null;
};

/**
 * Получает HapticFeedback API из Telegram WebApp
 */
const getHapticFeedback = (): any => {
  const tg = getTelegramWebApp();
  return tg?.HapticFeedback || null;
};

/**
 * Haptic feedback типы для impactOccurred
 */
export type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

/**
 * Haptic feedback типы для notificationOccurred
 */
export type HapticNotificationType = 'error' | 'success' | 'warning';

/**
 * Легкая вибрация при клике/тапе на элемент
 * Используется для большинства интерактивных элементов
 */
export const hapticLight = (): void => {
  const haptic = getHapticFeedback();
  if (haptic?.impactOccurred) {
    try {
      haptic.impactOccurred('light');
    } catch (error) {
      // Тихая ошибка - haptic feedback не критичен
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Средняя вибрация при важных действиях
 * Используется для навигации, переключения секций
 */
export const hapticMedium = (): void => {
  const haptic = getHapticFeedback();
  if (haptic?.impactOccurred) {
    try {
      haptic.impactOccurred('medium');
    } catch (error) {
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Сильная вибрация при критических действиях
 * Используется для важных подтверждений
 */
export const hapticHeavy = (): void => {
  const haptic = getHapticFeedback();
  if (haptic?.impactOccurred) {
    try {
      haptic.impactOccurred('heavy');
    } catch (error) {
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Жесткая вибрация для жестких элементов
 */
export const hapticRigid = (): void => {
  const haptic = getHapticFeedback();
  if (haptic?.impactOccurred) {
    try {
      haptic.impactOccurred('rigid');
    } catch (error) {
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Мягкая вибрация для мягких элементов
 */
export const hapticSoft = (): void => {
  const haptic = getHapticFeedback();
  if (haptic?.impactOccurred) {
    try {
      haptic.impactOccurred('soft');
    } catch (error) {
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Вибрация при успешном действии
 */
export const hapticSuccess = (): void => {
  const haptic = getHapticFeedback();
  if (haptic?.notificationOccurred) {
    try {
      haptic.notificationOccurred('success');
    } catch (error) {
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Вибрация при ошибке
 */
export const hapticError = (): void => {
  const haptic = getHapticFeedback();
  if (haptic?.notificationOccurred) {
    try {
      haptic.notificationOccurred('error');
    } catch (error) {
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Вибрация при предупреждении
 */
export const hapticWarning = (): void => {
  const haptic = getHapticFeedback();
  if (haptic?.notificationOccurred) {
    try {
      haptic.notificationOccurred('warning');
    } catch (error) {
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Вибрация при изменении выбора
 * Используется для переключения между элементами
 */
export const hapticSelection = (): void => {
  const haptic = getHapticFeedback();
  if (haptic?.selectionChanged) {
    try {
      haptic.selectionChanged();
    } catch (error) {
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Кастомная вибрация с указанным стилем
 */
export const hapticImpact = (style: HapticImpactStyle = 'light'): void => {
  const haptic = getHapticFeedback();
  if (haptic?.impactOccurred) {
    try {
      haptic.impactOccurred(style);
    } catch (error) {
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Кастомная вибрация уведомления с указанным типом
 */
export const hapticNotification = (type: HapticNotificationType = 'success'): void => {
  const haptic = getHapticFeedback();
  if (haptic?.notificationOccurred) {
    try {
      haptic.notificationOccurred(type);
    } catch (error) {
      console.debug('Haptic feedback error:', error);
    }
  }
};

/**
 * Проверяет, поддерживается ли haptic feedback
 */
export const isHapticSupported = (): boolean => {
  return isTelegramWebApp() && !!getHapticFeedback();
};

/**
 * Экспорт всех функций для удобства использования
 */
export default {
  light: hapticLight,
  medium: hapticMedium,
  heavy: hapticHeavy,
  rigid: hapticRigid,
  soft: hapticSoft,
  success: hapticSuccess,
  error: hapticError,
  warning: hapticWarning,
  selection: hapticSelection,
  impact: hapticImpact,
  notification: hapticNotification,
  isSupported: isHapticSupported,
};

