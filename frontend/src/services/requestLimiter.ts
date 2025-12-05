export type AsyncTask<T> = () => Promise<T>;

interface Deferred<T> {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

class DebounceController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private task: AsyncTask<any> | null = null;
  private resolvers: Deferred<any>[] = [];

  run<T>(task: AsyncTask<T>, wait: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.task = task;
      this.resolvers.push({ resolve, reject });
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this.timer = setTimeout(() => {
        this.timer = null;
        const pendingTask = this.task;
        this.task = null;
        const resolvers = this.resolvers.splice(0);
        if (!pendingTask) {
          resolvers.forEach(({ reject }) => reject(new Error('No debounced task available')));
          return;
        }
        pendingTask()
          .then((result) => {
            resolvers.forEach(({ resolve }) => resolve(result));
          })
          .catch((error) => {
            resolvers.forEach(({ reject }) => reject(error));
          });
      }, wait);
    });
  }

  isIdle(): boolean {
    return this.timer === null && this.resolvers.length === 0 && !this.task;
  }
}

class ThrottleController {
  private running = false;
  private cooldownUntil = 0;
  private currentResolvers: Deferred<any>[] = [];
  private queuedTask: AsyncTask<any> | null = null;
  private queuedResolvers: Deferred<any>[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  run<T>(task: AsyncTask<T>, wait: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const now = Date.now();

      if (this.running) {
        this.currentResolvers.push({ resolve, reject });
        return;
      }

      if (now >= this.cooldownUntil && !this.timer) {
        this.start(task, wait, [{ resolve, reject }]);
        return;
      }

      this.queuedTask = task;
      this.queuedResolvers.push({ resolve, reject });
      this.schedule(wait, now);
    });
  }

  private start<T>(task: AsyncTask<T>, wait: number, resolvers: Deferred<T>[]): void {
    this.running = true;
    this.currentResolvers = resolvers;
    Promise.resolve()
      .then(() => task())
      .then((result) => {
        this.currentResolvers.forEach(({ resolve }) => resolve(result));
        this.finish(wait);
      })
      .catch((error) => {
        this.currentResolvers.forEach(({ reject }) => reject(error));
        this.finish(wait);
      });
  }

  private finish(wait: number): void {
    this.running = false;
    this.currentResolvers = [];
    this.cooldownUntil = Date.now() + wait;
    if (this.queuedResolvers.length) {
      this.schedule(wait);
    }
  }

  private schedule(wait: number, now = Date.now()): void {
    if (this.timer) {
      return;
    }
    const delay = Math.max(this.cooldownUntil - now, 0);
    this.timer = setTimeout(() => {
      this.timer = null;
      const task = this.queuedTask;
      const resolvers = this.queuedResolvers.splice(0);
      this.queuedTask = null;
      if (!task) {
        resolvers.forEach(({ reject }) => reject(new Error('No throttled task available')));
        return;
      }
      this.start(task, wait, resolvers);
    }, delay);
  }

  isIdle(): boolean {
    return !this.running && !this.timer && !this.queuedTask && this.currentResolvers.length === 0;
  }
}

const debounceControllers = new Map<string, DebounceController>();
const throttleControllers = new Map<string, ThrottleController>();
let keyCounter = 0;

function nextKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}:${Date.now()}:${keyCounter}`;
}

function getDebounceController(key?: string): { key: string; controller: DebounceController } {
  const resolvedKey = key ?? nextKey('debounce');
  let controller = debounceControllers.get(resolvedKey);
  if (!controller) {
    controller = new DebounceController();
    debounceControllers.set(resolvedKey, controller);
  }
  return { key: resolvedKey, controller };
}

function getThrottleController(key?: string): { key: string; controller: ThrottleController } {
  const resolvedKey = key ?? nextKey('throttle');
  let controller = throttleControllers.get(resolvedKey);
  if (!controller) {
    controller = new ThrottleController();
    throttleControllers.set(resolvedKey, controller);
  }
  return { key: resolvedKey, controller };
}

function cleanupIfIdle(
  key: string,
  controller: DebounceController | ThrottleController,
  type: 'debounce' | 'throttle'
) {
  if ('isIdle' in controller && controller.isIdle()) {
    if (type === 'debounce') {
      debounceControllers.delete(key);
    } else {
      throttleControllers.delete(key);
    }
  }
}

export async function debounceRequest<T>(task: AsyncTask<T>, wait: number, key?: string): Promise<T> {
  if (wait <= 0) {
    return task();
  }
  const { key: resolvedKey, controller } = getDebounceController(key);
  try {
    return await controller.run(task, wait);
  } finally {
    cleanupIfIdle(resolvedKey, controller, 'debounce');
  }
}

export async function throttleRequest<T>(task: AsyncTask<T>, wait: number, key?: string): Promise<T> {
  if (wait <= 0) {
    return task();
  }
  const { key: resolvedKey, controller } = getThrottleController(key);
  try {
    return await controller.run(task, wait);
  } finally {
    cleanupIfIdle(resolvedKey, controller, 'throttle');
  }
}
