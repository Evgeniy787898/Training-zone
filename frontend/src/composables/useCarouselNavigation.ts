import { computed, ref, type ComputedRef } from 'vue';

type LengthSource = ComputedRef<number> | (() => number);

const defaultBatch = (fn: () => void) => fn();

const resolveLength = (source: LengthSource): number =>
  typeof source === 'function' ? source() : source.value;

const clampIndex = (index: number, length: number): number => {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index > length - 1) return length - 1;
  return index;
};

interface UseCarouselNavigationOptions {
  length: LengthSource;
  initialIndex?: number;
  batch?: (fn: () => void) => void;
}

export function useCarouselNavigation({
  length,
  initialIndex = 0,
  batch = defaultBatch,
}: UseCarouselNavigationOptions) {
  const visibleIndex = ref(initialIndex);
  const prevIndex = ref(initialIndex);

  const hasPrev = computed(() => visibleIndex.value > 0);
  const hasNext = computed(() => visibleIndex.value < resolveLength(length) - 1);
  const slideDirection = computed(() => (visibleIndex.value > prevIndex.value ? 'next' : 'prev'));

  const setIndex = (nextIndex: number) => {
    batch(() => {
      const bounded = clampIndex(nextIndex, resolveLength(length));
      prevIndex.value = visibleIndex.value;
      visibleIndex.value = bounded;
    });
  };

  const reset = (nextIndex = 0) => setIndex(nextIndex);

  const selectPrev = () => {
    if (hasPrev.value) setIndex(visibleIndex.value - 1);
  };

  const selectNext = () => {
    if (hasNext.value) setIndex(visibleIndex.value + 1);
  };

  return {
    visibleIndex,
    prevIndex,
    hasPrev,
    hasNext,
    slideDirection,
    setIndex,
    reset,
    selectPrev,
    selectNext,
  };
}
