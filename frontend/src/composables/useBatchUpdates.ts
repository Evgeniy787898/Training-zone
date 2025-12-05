import { nextTick } from 'vue';

/**
 * Composable для батчинга DOM updates через nextTick/requestAnimationFrame
 * Группирует изменения для минимизации re-renders
 */
export function useBatchUpdates() {
  let pendingUpdates: (() => void)[] = [];
  let rafId: number | null = null;
  let nextTickId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Батчит обновление через requestAnimationFrame
   */
  const batchRAF = (update: () => void) => {
    pendingUpdates.push(update);
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        pendingUpdates.forEach(fn => fn());
        pendingUpdates = [];
        rafId = null;
      });
    }
  };

  /**
   * Батчит обновление через nextTick
   */
  const batchNextTick = (update: () => void) => {
    pendingUpdates.push(update);
    
    if (nextTickId === null) {
      nextTick(nextTick).then(() => {
        pendingUpdates.forEach(fn => fn());
        pendingUpdates = [];
        nextTickId = null;
      });
    }
  };

  /**
   * Гибридный батчинг: сначала RAF, затем nextTick
   */
  const batchHybrid = (update: () => void) => {
    pendingUpdates.push(update);
    
    if (rafId === null && nextTickId === null) {
      rafId = requestAnimationFrame(() => {
        nextTick().then(() => {
          pendingUpdates.forEach(fn => fn());
          pendingUpdates = [];
          rafId = null;
          nextTickId = null;
        });
      });
    }
  };

  /**
   * Очистка всех pending updates
   */
  const flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (nextTickId !== null) {
      clearTimeout(nextTickId);
      nextTickId = null;
    }
    pendingUpdates.forEach(fn => fn());
    pendingUpdates = [];
  };

  return {
    batchRAF,
    batchNextTick,
    batchHybrid,
    flush,
  };
}
