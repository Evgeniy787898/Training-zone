/**
 * Утилиты для debounce и throttle
 */

/**
 * Debounce функция - задерживает выполнение функции до тех пор, пока не пройдет указанное время с последнего вызова
 * @param fn - Функция для debounce
 * @param delay - Задержка в миллисекундах
 * @returns Debounced функция
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(): void;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastContext: any;

  const invoke = () => {
    if (timeoutId === null || !lastArgs) {
      return;
    }
    fn.apply(lastContext, lastArgs);
    timeoutId = null;
    lastArgs = null;
    lastContext = null;
  };

  const debounced = function (this: any, ...args: Parameters<T>) {
    lastArgs = args;
    lastContext = this;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(invoke, delay);
  } as DebouncedFunction<T>;

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    lastContext = null;
  };

  debounced.flush = () => {
    if (timeoutId === null) {
      return;
    }
    clearTimeout(timeoutId);
    invoke();
  };

  return debounced;
}

/**
 * Throttle функция - ограничивает частоту выполнения функции
 * @param fn - Функция для throttle
 * @param delay - Минимальный интервал между вызовами в миллисекундах
 * @returns Throttled функция
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    } else {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn.apply(this, args);
        timeoutId = null;
      }, delay - timeSinceLastCall);
    }
  };
}

