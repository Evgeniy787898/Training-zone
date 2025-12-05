import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { debounceRequest, throttleRequest } from '@/services/requestLimiter';

export interface LazyListPageResult<T> {
  items: T[];
  hasMore?: boolean;
}

export interface LazyListOptions<T> {
  fetchPage: (page: number, pageSize: number) => Promise<LazyListPageResult<T>>;
  pageSize?: number;
  initialPage?: number;
  immediate?: boolean;
  root?: Ref<Element | null> | Element | null | (() => Element | null);
  rootMargin?: string;
  threshold?: number;
  limiterKey?: string;
  throttleMs?: number;
  debounceMs?: number;
}

interface ObserverHandle {
  observe: (element: Element) => void;
  disconnect: () => void;
}

export function useLazyList<T>(options: LazyListOptions<T>) {
  const pageSize = options.pageSize ?? 20;
  const initialPage = options.initialPage ?? 1;
  const limiterKey = options.limiterKey ?? `lazy-list:${Math.random().toString(36).slice(2)}`;
  const throttleMs = typeof options.throttleMs === 'number' ? options.throttleMs : 500;
  const debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 0;

  const items = ref<T[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(true);
  const sentinelRef = ref<HTMLElement | null>(null);
  const currentPage = ref(initialPage);

  let observer: ObserverHandle | null = null;
  let pendingLoad: Promise<void> | null = null;

  const supportsIntersectionObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window;

  const resolveObserverRoot = (): Element | null => {
    if (!options.root) {
      return null;
    }
    if (typeof options.root === 'function') {
      return options.root();
    }
    if (typeof (options.root as Ref<Element | null>).value !== 'undefined') {
      return (options.root as Ref<Element | null>).value;
    }
    return options.root as Element | null;
  };

  const cleanupObserver = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  const attachObserver = (element: HTMLElement | null) => {
    if (!supportsIntersectionObserver) {
      return;
    }
    cleanupObserver();
    if (!element || !hasMore.value) {
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            void loadNext();
          }
        });
      },
      {
        root: resolveObserverRoot(),
        rootMargin: options.rootMargin ?? '200px 0px',
        threshold: options.threshold ?? 0,
      },
    );

    observer.observe(element);
  };

  const waitForPending = async () => {
    if (pendingLoad) {
      try {
        await pendingLoad;
      } catch (err) {
        console.warn('[useLazyList] Pending load failed:', err);
      }
    }
  };

  const runFetch = async () => {
    if (pendingLoad || loading.value || !hasMore.value) {
      return pendingLoad ?? Promise.resolve();
    }

    pendingLoad = (async () => {
      loading.value = true;
      error.value = null;
      try {
        const result = await options.fetchPage(currentPage.value, pageSize);
        const pageItems = Array.isArray(result.items) ? result.items : [];

        const mergedItems = currentPage.value === initialPage
          ? [...pageItems]
          : (pageItems.length > 0 ? [...items.value, ...pageItems] : items.value);
        items.value = mergedItems as T[];

        const computedHasMore = typeof result.hasMore === 'boolean'
          ? result.hasMore
          : pageItems.length >= pageSize;
        hasMore.value = computedHasMore;
        currentPage.value += 1;
      } catch (err: any) {
        error.value = err?.message ?? 'Не удалось загрузить данные';
      } finally {
        loading.value = false;
      }
    })();

    try {
      await pendingLoad;
    } finally {
      pendingLoad = null;
    }
  };

  const runWithLimiter = async () => {
    if (debounceMs > 0) {
      await debounceRequest(runFetch, debounceMs, limiterKey);
      return;
    }
    if (throttleMs > 0) {
      await throttleRequest(runFetch, throttleMs, limiterKey);
      return;
    }
    await runFetch();
  };

  const loadNext = async () => {
    await runWithLimiter();
  };

  const reset = async () => {
    await waitForPending();
    cleanupObserver();
    items.value = [];
    currentPage.value = initialPage;
    hasMore.value = true;
    error.value = null;
  };

  const reload = async () => {
    await reset();
    await loadNext();
  };

  watch(
    () => sentinelRef.value,
    (element) => {
      if (!element) {
        cleanupObserver();
        return;
      }
      attachObserver(element);
    },
    { immediate: true },
  );

  watch(
    () => hasMore.value,
    (value) => {
      if (!value) {
        cleanupObserver();
      } else if (sentinelRef.value) {
        attachObserver(sentinelRef.value);
      }
    },
  );

  onBeforeUnmount(() => {
    cleanupObserver();
  });

  if (options.immediate !== false) {
    void runFetch();
  }

  return {
    items,
    loading,
    error,
    hasMore,
    sentinelRef,
    loadMore: loadNext,
    reload,
    reset,
  };
}
