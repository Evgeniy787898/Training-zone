import { createTraceId, runWithTrace } from '../services/trace.js';

export type RecurringTaskOptions = {
  name: string;
  intervalMs: number;
  run: () => void | Promise<void>;
  /**
   * Whether the task should be triggered immediately after start.
   * Defaults to true.
   */
  immediate?: boolean;
  /**
   * Skip scheduling another run while the previous iteration is still running.
   * Defaults to true.
   */
  skipIfRunning?: boolean;
  /**
   * Automatically start the interval upon creation.
   * Defaults to true.
   */
  autoStart?: boolean;
  /**
   * Optional AbortSignal to dispose the task when aborted.
   */
  signal?: AbortSignal | null;
  /**
   * Optional callback invoked whenever the task throws.
   */
  onError?: (error: unknown, meta: { name: string }) => void;
};

export type RecurringTaskHandle = {
  start: () => void;
  stop: () => void;
  dispose: () => void;
  trigger: () => Promise<void>;
  isRunning: () => boolean;
};

export function createRecurringTask(options: RecurringTaskOptions): RecurringTaskHandle {
  const {
    name,
    intervalMs,
    run,
    immediate = true,
    skipIfRunning = true,
    autoStart = true,
    signal,
    onError,
  } = options;

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(`[recurring-task:${name}] intervalMs must be a positive number`);
  }

  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let disposed = false;

  const handleError = onError || ((error: unknown) => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    console.error(`[recurring-task:${name}] execution failed`, error);
  });

  const execute = async () => {
    if (disposed) {
      return;
    }
    if (skipIfRunning && running) {
      return;
    }
    running = true;
    try {
      await runWithTrace({ traceId: createTraceId(), resource: `recurring:${name}` }, () => run());
    } catch (error) {
      handleError(error, { name });
    } finally {
      running = false;
    }
  };

  const start = () => {
    if (disposed || timer) {
      return;
    }
    timer = setInterval(() => {
      void execute();
    }, intervalMs);
    timer.unref?.();
    if (immediate) {
      void execute();
    }
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const dispose = () => {
    disposed = true;
    stop();
  };

  if (signal) {
    const abortHandler = () => {
      dispose();
      signal.removeEventListener('abort', abortHandler);
    };
    signal.addEventListener('abort', abortHandler, { once: true });
  }

  if (autoStart) {
    start();
  }

  return {
    start,
    stop,
    dispose,
    trigger: () => execute(),
    isRunning: () => running,
  };
}

export type IntervalController = ReturnType<typeof createRecurringTask>;
