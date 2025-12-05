import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue';

export interface VirtualScrollerEntry<T> {
  item: T;
  index: number;
  offset: number;
}

export interface VirtualScrollerOptions<T> {
  items: Ref<T[]>;
  estimateSize?: number;
  overscan?: number;
  disabledThreshold?: number;
  enabled?: Ref<boolean> | boolean;
  containerRef?: Ref<HTMLElement | null>;
}

export interface VirtualScrollerResult<T> {
  containerRef: Ref<HTMLElement | null>;
  virtualItems: ComputedRef<VirtualScrollerEntry<T>[]>;
  isVirtualized: ComputedRef<boolean>;
  totalHeight: ComputedRef<number>;
  offsetTop: ComputedRef<number>;
  estimateSize: number;
}

export function useVirtualScroller<T>(options: VirtualScrollerOptions<T>): VirtualScrollerResult<T> {
  const estimate = Math.max(1, options.estimateSize ?? 96);
  const overscan = Math.max(1, options.overscan ?? 4);
  const disabledThreshold = Math.max(0, options.disabledThreshold ?? 16);
  const targetRef = options.containerRef ?? ref<HTMLElement | null>(null);
  const itemsRef = options.items;

  const scrollTop = ref(0);
  const viewportHeight = ref(0);

  const isClient = typeof window !== 'undefined';
  const manualEnabled = computed(() => {
    if (typeof options.enabled === 'boolean') {
      return options.enabled;
    }
    if (options.enabled && 'value' in options.enabled) {
      return Boolean(options.enabled.value);
    }
    return true;
  });

  const isVirtualized = computed(() => manualEnabled.value && itemsRef.value.length > disabledThreshold);

  const totalHeight = computed(() => (isVirtualized.value ? itemsRef.value.length * estimate : itemsRef.value.length * estimate));

  const visibleRange = computed(() => {
    if (!isVirtualized.value) {
      const end = itemsRef.value.length;
      return { start: 0, end };
    }

    const viewport = viewportHeight.value || estimate;
    const startIndex = Math.max(0, Math.floor(scrollTop.value / estimate) - overscan);
    const visibleCount = Math.ceil(viewport / estimate) + overscan * 2;
    const endIndex = Math.min(itemsRef.value.length, startIndex + visibleCount);

    return { start: startIndex, end: endIndex };
  });

  const virtualItems = computed(() => {
    const { start, end } = visibleRange.value;
    return itemsRef.value.slice(start, end).map((item, offsetIndex) => {
      const index = start + offsetIndex;
      return { item, index, offset: index * estimate } satisfies VirtualScrollerEntry<T>;
    });
  });

  const offsetTop = computed(() => (isVirtualized.value ? visibleRange.value.start * estimate : 0));

  const updateMetrics = () => {
    const el = targetRef.value;
    if (!el) return;
    viewportHeight.value = el.clientHeight;
    scrollTop.value = el.scrollTop;
  };

  const scheduleMetricsUpdate = () => {
    if (isClient && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => updateMetrics());
    } else {
      updateMetrics();
    }
  };

  let resizeObserver: ResizeObserver | null = null;
  const supportsResizeObserver = isClient && typeof ResizeObserver !== 'undefined';
  const handleWindowResize = () => updateMetrics();

  const detach = (element: HTMLElement | null) => {
    if (!element) return;
    element.removeEventListener('scroll', onScroll);
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    } else if (isClient) {
      window.removeEventListener('resize', handleWindowResize);
    }
  };

  const onScroll = () => {
    scrollTop.value = targetRef.value?.scrollTop ?? 0;
  };

  const attach = (element: HTMLElement | null) => {
    if (!element) return;
    element.addEventListener('scroll', onScroll, { passive: true });
    if (supportsResizeObserver) {
      resizeObserver = new ResizeObserver(() => updateMetrics());
      resizeObserver.observe(element);
    } else if (isClient) {
      window.addEventListener('resize', handleWindowResize);
    }
    updateMetrics();
  };

  watch(targetRef, (element, prev) => {
    if (prev) {
      detach(prev);
    }
    if (element) {
      attach(element);
    }
  }, { immediate: true });

  watch(() => itemsRef.value.length, () => {
    scheduleMetricsUpdate();
  });

  onBeforeUnmount(() => {
    if (targetRef.value) {
      detach(targetRef.value);
    }
  });

  return {
    containerRef: targetRef,
    virtualItems,
    isVirtualized,
    totalHeight,
    offsetTop,
    estimateSize: estimate,
  };
}
