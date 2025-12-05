export type MemoizeOptions<T extends (...args: any[]) => any> = {
  getKey?: (...args: Parameters<T>) => unknown;
  maxSize?: number;
};

function defaultSerializeArgs(args: readonly unknown[]): unknown {
  if (args.length <= 1) {
    return args[0];
  }
  try {
    return JSON.stringify(args);
  } catch {
    return args[0];
  }
}

export function memoize<T extends (...args: any[]) => any>(fn: T, options: MemoizeOptions<T> = {}): T {
  const cache = new Map<unknown, ReturnType<T>>();
  const { maxSize = 0 } = options;

  return function memoized(this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const key = options.getKey ? options.getKey(...args) : defaultSerializeArgs(args);

    if (key !== undefined && cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn.apply(this, args);

    if (key !== undefined) {
      cache.set(key, result);
      if (maxSize > 0 && cache.size > maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
    }

    return result;
  } as T;
}

function shallowEqualArrays(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

export function memoizeOne<T extends (...args: any[]) => any>(
  fn: T,
  isEqual: (newArgs: Parameters<T>, lastArgs: Parameters<T>) => boolean = shallowEqualArrays,
): T {
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown;
  let lastResult: ReturnType<T>;

  return function memoized(this: unknown, ...args: Parameters<T>): ReturnType<T> {
    if (lastArgs && lastThis === this && isEqual(args, lastArgs)) {
      return lastResult;
    }

    lastResult = fn.apply(this, args);
    lastArgs = args;
    lastThis = this;
    return lastResult;
  } as T;
}
