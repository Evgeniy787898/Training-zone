type ProgressiveTask = {
  run: () => Promise<void> | void;
  delayMs?: number;
};

const scheduleIdle = (cb: () => void, delayMs = 120) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as typeof window & { requestIdleCallback: any }).requestIdleCallback(cb, { timeout: delayMs });
    return;
  }

  setTimeout(cb, delayMs);
};

/**
 * Выполняет задачи по очереди после первого рендера, чтобы не блокировать загрузку критического контента.
 */
export const runProgressiveTasks = (tasks: ProgressiveTask[]): void => {
  const queue = [...tasks];

  const executeNext = () => {
    const next = queue.shift();
    if (!next) return;

    const proceed = () => {
      Promise.resolve()
        .then(next.run)
        .catch((error) => {
          console.debug('[progressive-content] task failed', error);
        })
        .finally(() => {
          if (queue.length > 0) {
            scheduleIdle(executeNext, next.delayMs ?? 90);
          }
        });
    };

    if (next.delayMs && next.delayMs > 0) {
      setTimeout(proceed, next.delayMs);
    } else {
      scheduleIdle(proceed);
    }
  };

  scheduleIdle(executeNext, 60);
};
