/**
 * Утилита для обработки swipe жестов
 * Поддерживает touch events и mouse events для универсальности
 */

import { Ref, watch, onUnmounted } from 'vue';

export interface SwipeOptions {
  threshold?: number; // Минимальное расстояние для срабатывания свайпа (px)
  velocityThreshold?: number; // Минимальная скорость для срабатывания свайпа (px/ms)
  maxDuration?: number; // Максимальная длительность жеста (ms)
  preventDefault?: boolean; // Предотвращать стандартное поведение
  direction?: 'horizontal' | 'vertical' | 'both'; // Направление свайпа
  onSwipe?: (direction: SwipeDirection, distance: number, velocity: number) => void;
  onSwipeStart?: (event: TouchEvent | MouseEvent) => void;
  onSwipeMove?: (event: TouchEvent | MouseEvent, distance: number) => void;
  onSwipeEnd?: (event: TouchEvent | MouseEvent) => void;
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  isTracking: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<SwipeOptions, 'onSwipe' | 'onSwipeStart' | 'onSwipeMove' | 'onSwipeEnd'>> = {
  threshold: 50,
  velocityThreshold: 0.3,
  maxDuration: 500,
  preventDefault: true,
  direction: 'horizontal',
};

export class SwipeGesture {
  private element: HTMLElement;
  private options: Required<Omit<SwipeOptions, 'onSwipe' | 'onSwipeStart' | 'onSwipeMove' | 'onSwipeEnd'>> & Pick<SwipeOptions, 'onSwipe' | 'onSwipeStart' | 'onSwipeMove' | 'onSwipeEnd'>;
  private state: SwipeState = {
    startX: 0,
    startY: 0,
    startTime: 0,
    currentX: 0,
    currentY: 0,
    isTracking: false,
  };
  private rafId: number | null = null;
  private touchIdentifier: number | null = null;

  constructor(element: HTMLElement, options: SwipeOptions = {}) {
    if (!element || !(element instanceof HTMLElement)) {
      console.warn('[SwipeGesture] Invalid element provided, gestures will not work');
      this.element = element; // Store anyway to avoid crash
      this.options = { ...DEFAULT_OPTIONS, ...options };
      return; // Don't init
    }
    this.element = element;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.init();
  }

  private init() {
    if (!this.element || !(this.element instanceof HTMLElement)) {
      return; // Safety check
    }
    // Touch events
    this.element.addEventListener('touchstart', this.handleStart, { passive: false });
    this.element.addEventListener('touchmove', this.handleMove, { passive: false });
    this.element.addEventListener('touchend', this.handleEnd, { passive: false });
    this.element.addEventListener('touchcancel', this.handleEnd, { passive: false });

    // Mouse events для поддержки десктопных устройств
    this.element.addEventListener('mousedown', this.handleStart, { passive: false });
    this.element.addEventListener('mousemove', this.handleMove, { passive: false });
    this.element.addEventListener('mouseup', this.handleEnd, { passive: false });
    this.element.addEventListener('mouseleave', this.handleEnd, { passive: false });
  }

  private getEventCoordinates(event: TouchEvent | MouseEvent): { x: number; y: number } | null {
    if (event instanceof TouchEvent) {
      if (this.touchIdentifier !== null) {
        const touch = Array.from(event.touches).find(t => t.identifier === this.touchIdentifier);
        if (touch) {
          return { x: touch.clientX, y: touch.clientY };
        }
      }
      // Если не найдена нужная точка касания, берем первую
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        return { x: touch.clientX, y: touch.clientY };
      }
      return null;
    } else {
      return { x: event.clientX, y: event.clientY };
    }
  }

  private handleStart = (event: TouchEvent | MouseEvent) => {
    if (event instanceof TouchEvent && event.touches.length > 1) {
      // Игнорируем мультитач
      return;
    }

    const coords = this.getEventCoordinates(event);
    if (!coords) return;

    // НЕ вызываем preventDefault при старте для горизонтальных свайпов
    // Это позволяет браузеру определить направление жеста (вертикальный скролл vs горизонтальный swipe)
    // preventDefault будет вызван в handleMove только если движение горизонтальное

    this.state.startX = coords.x;
    this.state.startY = coords.y;
    this.state.currentX = coords.x;
    this.state.currentY = coords.y;
    this.state.startTime = performance.now();
    this.state.isTracking = true;

    if (event instanceof TouchEvent && event.touches.length > 0) {
      this.touchIdentifier = event.touches[0].identifier;
    }

    this.options.onSwipeStart?.(event);
  };

  private handleMove = (event: TouchEvent | MouseEvent) => {
    if (!this.state.isTracking) return;

    const coords = this.getEventCoordinates(event);
    if (!coords) return;

    this.state.currentX = coords.x;
    this.state.currentY = coords.y;

    const deltaX = this.state.currentX - this.state.startX;
    const deltaY = this.state.currentY - this.state.startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Разрешаем вертикальный скролл - предотвращаем только горизонтальные движения
    // Это позволяет скроллить страницу даже когда палец на карточке
    if (this.options.preventDefault && this.options.direction === 'horizontal') {
      // Предотвращаем только если движение преимущественно горизонтальное
      if (absDeltaX > absDeltaY && absDeltaX > 10) {
        event.preventDefault();
      }
      // Для вертикального движения (скролл) НЕ вызываем preventDefault
    } else if (this.options.preventDefault) {
      event.preventDefault();
    }

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    this.options.onSwipeMove?.(event, distance);

    // Визуальная обратная связь (опционально)
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
      });
    }
  };

  private handleEnd = (event: TouchEvent | MouseEvent) => {
    if (!this.state.isTracking) return;

    const coords = this.getEventCoordinates(event);
    if (!coords) return;

    if (this.options.preventDefault) {
      event.preventDefault();
    }

    const deltaX = this.state.currentX - this.state.startX;
    const deltaY = this.state.currentY - this.state.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = performance.now() - this.state.startTime;
    const velocity = distance / duration;

    this.state.isTracking = false;
    this.touchIdentifier = null;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.options.onSwipeEnd?.(event);

    // Проверяем условия для срабатывания свайпа
    if (duration > this.options.maxDuration) {
      return;
    }

    if (distance < this.options.threshold) {
      return;
    }

    if (velocity < this.options.velocityThreshold) {
      return;
    }

    // Определяем направление
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    let direction: SwipeDirection = null;

    if (this.options.direction === 'horizontal') {
      if (absDeltaX > absDeltaY && absDeltaX >= this.options.threshold) {
        direction = deltaX > 0 ? 'right' : 'left';
      }
    } else if (this.options.direction === 'vertical') {
      if (absDeltaY > absDeltaX && absDeltaY >= this.options.threshold) {
        direction = deltaY > 0 ? 'down' : 'up';
      }
    } else if (this.options.direction === 'both') {
      if (absDeltaX > absDeltaY && absDeltaX >= this.options.threshold) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else if (absDeltaY > absDeltaX && absDeltaY >= this.options.threshold) {
        direction = deltaY > 0 ? 'down' : 'up';
      }
    }

    if (direction && this.options.onSwipe) {
      this.options.onSwipe(direction, distance, velocity);
    }
  };

  public destroy() {
    if (!this.element || !(this.element instanceof HTMLElement)) return;

    this.element.removeEventListener('touchstart', this.handleStart);
    this.element.removeEventListener('touchmove', this.handleMove);
    this.element.removeEventListener('touchend', this.handleEnd);
    this.element.removeEventListener('touchcancel', this.handleEnd);
    this.element.removeEventListener('mousedown', this.handleStart);
    this.element.removeEventListener('mousemove', this.handleMove);
    this.element.removeEventListener('mouseup', this.handleEnd);
    this.element.removeEventListener('mouseleave', this.handleEnd);

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

/**
 * Хук для создания swipe жеста (для использования в Vue компонентах)
 */
export function useSwipe(element: Ref<HTMLElement | null>, options: SwipeOptions = {}) {
  let swipe: SwipeGesture | null = null;

  watch(
    () => element.value,
    (newElement) => {
      if (swipe) {
        swipe.destroy();
        swipe = null;
      }

      if (newElement) {
        swipe = new SwipeGesture(newElement, options);
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    if (swipe) {
      swipe.destroy();
      swipe = null;
    }
  });

  return {
    swipe,
  };
}

