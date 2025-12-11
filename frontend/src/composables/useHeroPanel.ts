import { ref, computed, watch, nextTick, Ref } from 'vue';

export interface HeroPanelRefs {
    headerRef: Ref<HTMLElement | null>;
    footerRef: Ref<HTMLElement | null>;
    headerPullIndicatorRef: Ref<HTMLElement | null>;
}

export interface HeroPanelOptions {
    heroExpanded: Ref<boolean>;
    isGridLayoutActive: Ref<boolean>;
}

export function useHeroPanel(refs: HeroPanelRefs, options: HeroPanelOptions) {
    const { headerRef, footerRef } = refs;
    const { heroExpanded, isGridLayoutActive } = options;

    // Drag state
    const isDragging = ref(false);
    const dragStartY = ref(0);
    const dragStartTime = ref(0);
    const currentDragY = ref(0);
    const headerHeight = ref(64);
    const maxHeaderOffset = ref(0);

    let resizeObserver: ResizeObserver | null = null;
    let dragMoveFrame = 0;
    let pendingDragState: { deltaY: number } | null = null;
    const nonPassiveTouchOptions: AddEventListenerOptions = { passive: false };

    // Calculate header transform
    // Header starts at top: 0. When expanded, it should move down by maxHeaderOffset
    // so its top edge aligns with the bottom edge of the panel.
    // maxHeaderOffset = viewport - header - footer, so header ends up just above footer.
    const headerStyle = computed(() => {
        if (isGridLayoutActive.value) {
            return { transform: 'translateY(0)', transition: 'none' };
        }

        if (isDragging.value) {
            const offset = Math.max(0, Math.min(currentDragY.value, maxHeaderOffset.value));
            return { transform: `translateY(${offset}px)`, transition: 'none' };
        } else if (heroExpanded.value) {
            return {
                transform: `translateY(${maxHeaderOffset.value}px)`,
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            };
        } else {
            return {
                transform: 'translateY(0)',
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            };
        }
    });

    // Calculate content panel style
    const contentPanelStyle = computed(() => {
        if (isGridLayoutActive.value) {
            return { height: 'auto', transition: 'none' };
        }
        if (isDragging.value) {
            const offset = Math.max(0, Math.min(currentDragY.value, maxHeaderOffset.value));
            // Height should be exactly the offset, stopping at the header top
            return { height: `${offset}px`, transition: 'none' };
        } else if (heroExpanded.value) {
            // Height should be exactly the max offset
            return {
                height: `${maxHeaderOffset.value}px`,
                transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            };
        } else {
            return {
                height: '0',
                transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            };
        }
    });

    // Calculate max offset
    const calculateMaxOffset = () => {
        if (typeof window === 'undefined') return;

        const headerElement = headerRef.value;
        if (!headerElement) return;

        const headerRect = headerElement.getBoundingClientRect();
        const measuredHeaderHeight = headerRect.height || headerElement.offsetHeight || headerHeight.value || 64;
        if (measuredHeaderHeight > 0 && measuredHeaderHeight !== headerHeight.value) {
            headerHeight.value = measuredHeaderHeight;
        }

        // Calculate available height based on viewport
        // Panel starts at top: 0 and should end at the top edge of the expanded header
        // When expanded, header moves down and sits above footer
        // So panel height = viewport - headerHeight - footerHeight
        const footerElement = footerRef.value;
        let footerH = 0;

        if (footerElement) {
            const footerRect = footerElement.getBoundingClientRect();
            footerH = footerRect.height;
        } else {
            // Fallback if footer ref not found
            const rootStyles = window.getComputedStyle(document.documentElement);
            footerH = parseFloat(rootStyles.getPropertyValue('--footer-height') || '64');
        }

        // Max offset = viewport - header - footer
        // This ensures panel ends exactly at the top edge of the expanded header
        const viewportHeight = window.innerHeight;
        const calculatedOffset = Math.max(0, viewportHeight - measuredHeaderHeight - footerH);

        maxHeaderOffset.value = calculatedOffset;
    };

    // Scheduler for offset updates
    const createMaxOffsetScheduler = () => {
        let leadingFrame = 0;
        let trailingFrame = 0;

        const cancel = () => {
            if (leadingFrame) {
                window.cancelAnimationFrame(leadingFrame);
                leadingFrame = 0;
            }
            if (trailingFrame) {
                window.cancelAnimationFrame(trailingFrame);
                trailingFrame = 0;
            }
        };

        const schedule = () => {
            cancel();
            leadingFrame = window.requestAnimationFrame(() => {
                trailingFrame = window.requestAnimationFrame(() => {
                    trailingFrame = 0;
                    calculateMaxOffset();
                });
            });
        };

        return { schedule, cancel };
    };

    const maxOffsetScheduler = typeof window === 'undefined'
        ? { schedule: () => { }, cancel: () => { } }
        : createMaxOffsetScheduler();

    const scheduleMaxOffsetUpdate = maxOffsetScheduler.schedule;
    const cancelMaxOffsetUpdate = maxOffsetScheduler.cancel;

    // Apply drag movement
    const applyDragMove = (deltaY: number) => {
        const startOffset = heroExpanded.value ? maxHeaderOffset.value : 0;
        const newOffset = startOffset + deltaY;
        const clamped = Math.max(0, Math.min(newOffset, maxHeaderOffset.value));

        if (clamped !== currentDragY.value) {
            currentDragY.value = clamped;
        }
    };

    // Safe touch event check
    const isTouchEvent = (event: Event): event is TouchEvent => {
        return typeof window !== 'undefined' && 'TouchEvent' in window && event instanceof TouchEvent;
    };

    // Drag handlers
    const handleDragStart = (event: MouseEvent | TouchEvent) => {
        if (isGridLayoutActive.value) return;
        const target = event.target as HTMLElement;

        // If expanded, ONLY allow drag from the pull indicator or the top header bar
        // This allows native scrolling in the content panel
        if (heroExpanded.value) {
            const isIndicator = target?.closest('.header-pull-indicator');
            const isHeaderBar = target?.closest('.header-content');

            // If touching content panel (and not header/indicator), allow native scroll
            if (!isIndicator && !isHeaderBar) return;
        }

        const isFromHeader = target?.closest('.app-header');

        if (isTouchEvent(event)) {
            if (!isFromHeader) return;
        } else {
            const isIndicator = target?.closest('.header-pull-indicator');
            // Allow dragging from header content on desktop too for better UX
            const isHeaderContent = target?.closest('.header-content');
            if (!isIndicator && !isHeaderContent) return;
        }

        isDragging.value = true;
        const y = isTouchEvent(event) ? event.touches[0].clientY : event.clientY;
        const now = performance.now();
        dragStartY.value = y;
        dragStartTime.value = now;
        currentDragY.value = heroExpanded.value ? maxHeaderOffset.value : 0;
        pendingDragState = null;
        if (dragMoveFrame) {
            cancelAnimationFrame(dragMoveFrame);
            dragMoveFrame = 0;
        }

        // Only prevent default if we are actually dragging the header
        if (isTouchEvent(event)) {
            // event.preventDefault(); // Don't prevent default immediately, let browser decide if it's a scroll or not? 
            // Actually for header drag we usually want to prevent default to stop body scroll
            // But since we restricted the target area, it should be safe.
            event.preventDefault();
        }
    };

    const handleDragMove = (event: MouseEvent | TouchEvent) => {
        if (isGridLayoutActive.value) return;
        if (!isDragging.value) return;

        const y = isTouchEvent(event)
            ? (event.touches[0]?.clientY || event.changedTouches[0]?.clientY)
            : event.clientY;

        if (y === undefined || y === null) return;

        const deltaY = y - dragStartY.value;

        if (isTouchEvent(event) && Math.abs(deltaY) > 5) {
            event.preventDefault();
        }

        pendingDragState = { deltaY };

        if (!dragMoveFrame) {
            dragMoveFrame = requestAnimationFrame(() => {
                dragMoveFrame = 0;
                if (!pendingDragState) return;
                applyDragMove(pendingDragState.deltaY);
                pendingDragState = null;
            });
        }
    };

    const handleDragEnd = () => {
        if (isGridLayoutActive.value) return;
        if (!isDragging.value) return;

        if (dragMoveFrame) {
            cancelAnimationFrame(dragMoveFrame);
            dragMoveFrame = 0;
        }

        if (pendingDragState) {
            applyDragMove(pendingDragState.deltaY);
            pendingDragState = null;
        }

        const now = performance.now();
        const totalDuration = now - dragStartTime.value;
        const startOffset = heroExpanded.value ? maxHeaderOffset.value : 0;
        const totalDistance = Math.abs(currentDragY.value - startOffset);
        const velocity = totalDuration > 0 ? totalDistance / totalDuration : 0;
        const isFastSwipe = velocity > 0.5 || (totalDistance > 50 && totalDuration < 200);
        const direction = currentDragY.value - startOffset;

        isDragging.value = false;

        if (isFastSwipe && totalDistance > 30) {
            if (direction > 0) {
                heroExpanded.value = true;
            } else if (direction < 0) {
                heroExpanded.value = false;
            } else {
                const threshold = maxHeaderOffset.value * 0.5;
                heroExpanded.value = currentDragY.value > threshold;
            }
        } else {
            const threshold = maxHeaderOffset.value * 0.5;
            heroExpanded.value = currentDragY.value > threshold;
        }

        currentDragY.value = 0;
    };

    // Resize handler
    const handleResize = () => {
        scheduleMaxOffsetUpdate();
    };

    // Watch hero expanded state
    watch(heroExpanded, () => {
        nextTick(() => {
            scheduleMaxOffsetUpdate();
        });
    });

    // ResizeObserver setup
    const supportsResizeObserver = typeof window !== 'undefined' && 'ResizeObserver' in window;

    const initializeResizeObserver = () => {
        if (!supportsResizeObserver) return;

        if (!resizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                scheduleMaxOffsetUpdate();
            });
        }

        const headerElement = headerRef.value;
        const footerElement = footerRef.value;

        if (headerElement) {
            resizeObserver.observe(headerElement);
        }
        if (footerElement) {
            resizeObserver.observe(footerElement);
        }
    };

    // Watch refs for ResizeObserver
    watch(headerRef, (element, previous) => {
        if (!resizeObserver) return;
        if (previous) {
            resizeObserver.unobserve(previous);
        }
        if (element) {
            resizeObserver.observe(element);
            scheduleMaxOffsetUpdate();
        }
    });

    watch(footerRef, (element, previous) => {
        if (!resizeObserver) return;
        if (previous) {
            resizeObserver.unobserve(previous);
        }
        if (element) {
            resizeObserver.observe(element);
            scheduleMaxOffsetUpdate();
        }
    });

    // Toggle hero
    const toggleHero = () => {
        if (isGridLayoutActive.value) return;
        heroExpanded.value = !heroExpanded.value;
    };

    // Lifecycle
    const setupEventListeners = () => {
        if (typeof window === 'undefined') return;

        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchmove', handleDragMove, nonPassiveTouchOptions);
        window.addEventListener('touchend', handleDragEnd);
        window.addEventListener('touchcancel', handleDragEnd);
        window.addEventListener('resize', handleResize);

        nextTick(() => {
            const headerElement = headerRef.value;
            if (headerElement) {
                const measuredHeight = headerElement.getBoundingClientRect().height;
                if (measuredHeight > 0) {
                    headerHeight.value = measuredHeight;
                }
            }
            scheduleMaxOffsetUpdate();
            initializeResizeObserver();
        });
    };

    const cleanupEventListeners = () => {
        if (typeof window === 'undefined') return;

        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove, nonPassiveTouchOptions);
        window.removeEventListener('touchend', handleDragEnd);
        window.removeEventListener('touchcancel', handleDragEnd);
        window.removeEventListener('resize', handleResize);
        cancelMaxOffsetUpdate();
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
    };

    return {
        // State
        isDragging,
        headerHeight,
        maxHeaderOffset,

        // Computed
        headerStyle,
        contentPanelStyle,

        // Methods
        handleDragStart,
        toggleHero,
        setupEventListeners,
        cleanupEventListeners,
        scheduleMaxOffsetUpdate,
    };
}
