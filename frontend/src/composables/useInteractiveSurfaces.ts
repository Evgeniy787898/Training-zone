import { onMounted, onBeforeUnmount, watch, type Ref } from 'vue';

interface InteractiveSurfaceOptions {
  selectors?: string[];
  coarseMultiplier?: number;
}

type InteractionMode = 'fine' | 'coarse';

const DEFAULT_SELECTORS = ['.surface-card'];
const DEFAULT_COARSE_MULTIPLIER = 1.15;

export function useInteractiveSurfaces(
  rootRef: Ref<HTMLElement | null>,
  options: InteractiveSurfaceOptions = {},
) {
  const selectors = options.selectors?.length ? options.selectors : DEFAULT_SELECTORS;
  const selectorQuery = selectors.join(',');
  const coarseMultiplier = options.coarseMultiplier ?? DEFAULT_COARSE_MULTIPLIER;

  let activeTarget: HTMLElement | null = null;
  let activePointerId: number | null = null;
  let frameId = 0;
  let pointerQuery: MediaQueryList | null = null;
  let motionQuery: MediaQueryList | null = null;
  let pointerEnabled = false;
  let prefersReducedMotion = false;

  const setPointerValues = (target: HTMLElement, x: number, y: number, mode: InteractionMode) => {
    if (prefersReducedMotion) {
      return;
    }

    const clampedX = Math.max(-1, Math.min(1, x));
    const clampedY = Math.max(-1, Math.min(1, y));
    const strength = Math.min(1, Math.sqrt(clampedX * clampedX + clampedY * clampedY));

    target.style.setProperty('--pointer-x', clampedX.toFixed(3));
    target.style.setProperty('--pointer-y', clampedY.toFixed(3));
    target.style.setProperty('--pointer-strength', strength.toFixed(3));
    target.style.setProperty('--pointer-active', '1');
    target.dataset.surfaceInteractive = mode;
  };

  const resetPointerValues = (target: HTMLElement) => {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }

    frameId = requestAnimationFrame(() => {
      target.style.setProperty('--pointer-x', '0');
      target.style.setProperty('--pointer-y', '0');
      target.style.setProperty('--pointer-strength', '0');
      target.style.setProperty('--pointer-active', '0');
      delete target.dataset.surfaceInteractive;
    });
  };

  const scheduleUpdate = (target: HTMLElement, x: number, y: number, mode: InteractionMode) => {
    if (prefersReducedMotion) {
      return;
    }

    if (frameId) {
      cancelAnimationFrame(frameId);
    }

    frameId = requestAnimationFrame(() => {
      setPointerValues(target, x, y, mode);
    });
  };

  const clearActiveTarget = (target: HTMLElement | null) => {
    if (!target) return;
    resetPointerValues(target);
    if (activeTarget === target) {
      activeTarget = null;
    }
  };

  const getInteractiveTarget = (source: EventTarget | null): HTMLElement | null => {
    if (!(source instanceof HTMLElement)) {
      return null;
    }

    const root = rootRef.value;
    if (!root) return null;

    const candidate = source.closest(selectorQuery) as HTMLElement | null;
    if (candidate && root.contains(candidate)) {
      return candidate;
    }

    return null;
  };

  const resolveMode = (event: PointerEvent): InteractionMode => {
    if (event.pointerType === 'mouse' && pointerEnabled) {
      return 'fine';
    }

    return 'coarse';
  };

  const applyEventPosition = (
    target: HTMLElement,
    event: PointerEvent,
    mode: InteractionMode,
  ) => {
    const rect = target.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
    const relativeY = (event.clientY - rect.top) / rect.height - 0.5;
    const multiplier = mode === 'fine' ? 2 : coarseMultiplier;

    scheduleUpdate(target, relativeX * multiplier, relativeY * multiplier, mode);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (prefersReducedMotion) return;

    const mode = resolveMode(event);

    if (mode === 'fine') {
      if (!pointerEnabled) return;

      const target = getInteractiveTarget(event.target);
      if (!target) return;

      if (activeTarget && activeTarget !== target) {
        clearActiveTarget(activeTarget);
      }

      activeTarget = target;
      applyEventPosition(target, event, mode);
      return;
    }

    if (activePointerId !== event.pointerId || !activeTarget) {
      return;
    }

    applyEventPosition(activeTarget, event, mode);
  };

  const handlePointerOver = (event: PointerEvent) => {
    if (prefersReducedMotion) return;

    const mode = resolveMode(event);

    if (mode !== 'fine' || !pointerEnabled) {
      return;
    }

    const target = getInteractiveTarget(event.target);
    if (!target) return;

    applyEventPosition(target, event, mode);
    activeTarget = target;
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (prefersReducedMotion) return;

    const target = getInteractiveTarget(event.target);
    if (!target) return;

    if (activeTarget && activeTarget !== target) {
      clearActiveTarget(activeTarget);
    }

    const mode = resolveMode(event);
    activeTarget = target;

    if (mode === 'coarse') {
      activePointerId = event.pointerId;
    }

    applyEventPosition(target, event, mode);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (prefersReducedMotion) return;

    const mode = resolveMode(event);

    if (mode === 'coarse' && activePointerId !== event.pointerId) {
      return;
    }

    activePointerId = null;

    const target = getInteractiveTarget(event.target) || activeTarget;
    clearActiveTarget(target);
  };

  const handlePointerOut = (event: PointerEvent) => {
    if (prefersReducedMotion) return;

    const mode = resolveMode(event);

    if (mode === 'fine' && !pointerEnabled) {
      return;
    }

    const target = getInteractiveTarget(event.target);
    if (!target) return;

    const related = event.relatedTarget as HTMLElement | null;
    if (related && target.contains(related)) {
      return;
    }

    if (mode === 'coarse' && activePointerId !== event.pointerId) {
      return;
    }

    clearActiveTarget(target);
  };

  const handlePointerCancel = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) {
      return;
    }

    activePointerId = null;
    clearActiveTarget(activeTarget);
  };

  const handleWindowBlur = () => {
    activePointerId = null;
    clearActiveTarget(activeTarget);
  };

  const addListeners = (root: HTMLElement | null) => {
    if (!root) return;

    root.addEventListener('pointermove', handlePointerMove);
    root.addEventListener('pointerover', handlePointerOver);
    root.addEventListener('pointerdown', handlePointerDown);
    root.addEventListener('pointerup', handlePointerUp);
    root.addEventListener('pointerout', handlePointerOut);
    root.addEventListener('pointercancel', handlePointerCancel);
  };

  const removeListeners = (root: HTMLElement | null) => {
    if (!root) return;

    root.removeEventListener('pointermove', handlePointerMove);
    root.removeEventListener('pointerover', handlePointerOver);
    root.removeEventListener('pointerdown', handlePointerDown);
    root.removeEventListener('pointerup', handlePointerUp);
    root.removeEventListener('pointerout', handlePointerOut);
    root.removeEventListener('pointercancel', handlePointerCancel);
  };

  const updatePointerCapability = () => {
    pointerEnabled = pointerQuery?.matches ?? false;
    if (!pointerEnabled) {
      clearActiveTarget(activeTarget);
    }
  };

  const updateMotionPreference = () => {
    prefersReducedMotion = motionQuery?.matches ?? false;
    if (prefersReducedMotion) {
      activePointerId = null;
      clearActiveTarget(activeTarget);
    }
  };

  onMounted(() => {
    if (typeof window === 'undefined') {
      return;
    }

    pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    updatePointerCapability();
    pointerQuery.addEventListener('change', updatePointerCapability);

    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    updateMotionPreference();
    motionQuery.addEventListener('change', updateMotionPreference);

    addListeners(rootRef.value);
    window.addEventListener('blur', handleWindowBlur);
  });

  onBeforeUnmount(() => {
    removeListeners(rootRef.value);
    if (pointerQuery) {
      pointerQuery.removeEventListener('change', updatePointerCapability);
    }
    if (motionQuery) {
      motionQuery.removeEventListener('change', updateMotionPreference);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', handleWindowBlur);
    }
  });

  watch(
    rootRef,
    (newRoot, oldRoot) => {
      if (oldRoot !== newRoot) {
        removeListeners(oldRoot);
        addListeners(newRoot);
      }
    },
    { flush: 'post' },
  );
}

export default useInteractiveSurfaces;
