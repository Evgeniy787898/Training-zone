import { ref, onMounted, onUnmounted, type Ref } from 'vue';

/**
 * Composable для работы с Intersection Observer API
 * Позволяет отслеживать видимость элементов и запускать колбэки при входе/выходе в viewport
 */
export function useIntersectionObserver(
  target: Ref<HTMLElement | null>,
  options: IntersectionObserverInit = {}
) {
  const isIntersecting = ref(false);
  const entry = ref<IntersectionObserverEntry | null>(null);
  let observer: IntersectionObserver | null = null;

  const defaultOptions: IntersectionObserverInit = {
    root: null, // viewport
    rootMargin: '50px', // Начинаем загрузку за 50px до входа в viewport (preload zone)
    threshold: 0.1, // Срабатывает когда 10% элемента видно
    ...options,
  };

  const setupObserver = () => {
    if (!target.value) return;

    observer = new IntersectionObserver((entries) => {
      entries.forEach((intersectionEntry) => {
        entry.value = intersectionEntry;
        isIntersecting.value = intersectionEntry.isIntersecting;
      });
    }, defaultOptions);

    observer.observe(target.value);
  };

  const disconnect = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  onMounted(() => {
    // Используем nextTick для гарантии, что элемент уже в DOM
    setTimeout(() => {
      setupObserver();
    }, 0);
  });

  onUnmounted(() => {
    disconnect();
  });

  // Метод для переподключения observer (если элемент изменился)
  const reconnect = () => {
    disconnect();
    setTimeout(() => {
      setupObserver();
    }, 0);
  };

  return {
    isIntersecting,
    entry,
    reconnect,
    disconnect,
  };
}

/**
 * Упрощенная версия для простых случаев - возвращает только isIntersecting
 */
export function useIntersectionObserverSimple(
  target: Ref<HTMLElement | null>,
  callback: (isIntersecting: boolean) => void,
  options: IntersectionObserverInit = {}
) {
  let observer: IntersectionObserver | null = null;

  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px', // Preload zone
    threshold: 0.1,
    ...options,
  };

  const setupObserver = () => {
    if (!target.value) return;

    observer = new IntersectionObserver((entries) => {
      entries.forEach((intersectionEntry) => {
        callback(intersectionEntry.isIntersecting);
      });
    }, defaultOptions);

    observer.observe(target.value);
  };

  const disconnect = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  onMounted(() => {
    setTimeout(() => {
      setupObserver();
    }, 0);
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    disconnect,
    reconnect: () => {
      disconnect();
      setTimeout(() => {
        setupObserver();
      }, 0);
    },
  };
}


