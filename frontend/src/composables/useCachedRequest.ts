import { ref, shallowRef, type Ref, type ShallowRef } from 'vue';
import { useBatchUpdates } from './useBatchUpdates';
import { createSingleFlight } from '@/utils/singleFlight';

export interface UseCachedRequestOptions<TResult, TArgs extends any[]> {
  /**
   * Функция формирования ключа запроса. По умолчанию используется JSON.stringify аргументов.
   */
  createKey?: (...args: TArgs) => string;
  /**
   * Позволяет отключить dedupe и всегда выполнять фабрику заново.
   */
  dedupe?: boolean;
  /**
   * Начальное значение (используется, если не задан initialValueFactory).
   */
  initialValue?: TResult;
  /**
   * Позволяет создавать новое начальное значение при каждом сбросе (актуально для массивов/объектов).
   */
  initialValueFactory?: () => TResult;
}

export interface UseCachedRequestResult<TResult, TArgs extends any[]> {
  data: ShallowRef<TResult>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  execute: (...args: TArgs) => Promise<TResult>;
  refresh: () => Promise<TResult> | null;
  clear: () => void;
  invalidate: () => void;
}

export function useCachedRequest<TResult, TArgs extends any[]>(
  fetcher: (...args: TArgs) => Promise<TResult>,
  options: UseCachedRequestOptions<TResult, TArgs> = {}
): UseCachedRequestResult<TResult, TArgs> {
  const { batchRAF, batchNextTick } = useBatchUpdates();
  const singleFlight = createSingleFlight<TResult>();

  const resolveInitialValue = (): TResult => {
    if (typeof options.initialValueFactory === 'function') {
      return options.initialValueFactory();
    }
    return options.initialValue as TResult;
  };

  const data = shallowRef<TResult>(resolveInitialValue());
  const loading = ref(false);
  const error = ref<Error | null>(null);

  let lastKey: string | null = null;
  let lastArgs: TArgs | null = null;

  const getKey = (...args: TArgs) => {
    if (options.createKey) {
      return options.createKey(...args);
    }
    return JSON.stringify(args ?? []);
  };

  const execute = async (...args: TArgs): Promise<TResult> => {
    const key = getKey(...args);
    lastKey = key;
    lastArgs = args;
    loading.value = true;
    error.value = null;

    const factory = () =>
      fetcher(...args).then((result) => {
        batchRAF(() => {
          data.value = result;
        });
        return result;
      });

    const promise = options.dedupe === false ? factory() : singleFlight.run(key, factory);

    return promise
      .catch((err) => {
        const normalized = err instanceof Error ? err : new Error('Request failed');
        error.value = normalized;
        throw normalized;
      })
      .finally(() => {
        batchNextTick(() => {
          loading.value = false;
        });
      });
  };

  const refresh = () => {
    if (!lastArgs) {
      return null;
    }
    if (lastKey) {
      singleFlight.clear(lastKey);
    }
    return execute(...lastArgs);
  };

  const clear = () => {
    batchRAF(() => {
      data.value = resolveInitialValue();
    });
    error.value = null;
    loading.value = false;
    lastArgs = null;
    if (lastKey) {
      singleFlight.clear(lastKey);
      lastKey = null;
    }
  };

  const invalidate = () => {
    if (lastKey) {
      singleFlight.clear(lastKey);
      lastKey = null;
    }
    lastArgs = null;
  };

  return {
    data,
    loading,
    error,
    execute,
    refresh,
    clear,
    invalidate,
  };
}
