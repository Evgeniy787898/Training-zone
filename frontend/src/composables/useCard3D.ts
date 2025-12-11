import { ref, onUnmounted, onMounted } from 'vue';
import type { StyleValue } from 'vue';

/**
 * Detect if device is likely weak (mobile, low memory, etc.)
 */
function isWeakDevice(): boolean {
    if (typeof window === 'undefined') return false;

    // Check for mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Check for low memory (if available)
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory < 4;

    // Check for low CPU cores
    const lowCores = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4;

    // Consider touch-only devices (no hover capability)
    const noHover = window.matchMedia('(hover: none)').matches;

    return (isMobile && (lowMemory || lowCores)) || (isMobile && noHover);
}

export function useCard3D() {
    const card3DHover = ref<Record<string, { rotateX: number; rotateY: number }>>({});

    // Check for reduced motion preference
    const prefersReducedMotion = ref(false);
    const isWeak = ref(false);

    // Computed flag to disable 3D effects
    const is3DDisabled = ref(false);

    let raf3DId: number | null = null;
    const pending3DUpdates = new Map<string, { rotateX: number; rotateY: number }>();
    let motionMediaQuery: MediaQueryList | null = null;

    onMounted(() => {
        // Check reduced motion preference
        if (typeof window !== 'undefined') {
            motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            prefersReducedMotion.value = motionMediaQuery.matches;

            // Listen for changes
            const handleMotionChange = (e: MediaQueryListEvent) => {
                prefersReducedMotion.value = e.matches;
                is3DDisabled.value = prefersReducedMotion.value || isWeak.value;
            };
            motionMediaQuery.addEventListener('change', handleMotionChange);
        }

        // Check for weak device
        isWeak.value = isWeakDevice();

        // Set initial disabled state
        is3DDisabled.value = prefersReducedMotion.value || isWeak.value;
    });

    const handle3DMouseMove = (event: MouseEvent, cardId: string) => {
        // Skip 3D effects if disabled
        if (is3DDisabled.value) return;

        // Сохраняем вычисления для batch обновления в RAF (не блокируем UI)
        const card = (event.currentTarget as HTMLElement);
        const rect = card.getBoundingClientRect();
        const cardCenterX = rect.left + rect.width / 2;
        const cardCenterY = rect.top + rect.height / 2;

        const mouseX = event.clientX - cardCenterX;
        const mouseY = event.clientY - cardCenterY;

        const maxRotateX = 8;
        const maxRotateY = 8;

        const rotateY = (mouseX / (rect.width / 2)) * maxRotateY;
        const rotateX = -(mouseY / (rect.height / 2)) * maxRotateX;

        const clampedRotateX = Math.max(-maxRotateX, Math.min(maxRotateX, rotateX));
        const clampedRotateY = Math.max(-maxRotateY, Math.min(maxRotateY, rotateY));

        // Сохраняем обновление для batch обработки в RAF
        pending3DUpdates.set(cardId, { rotateX: clampedRotateX, rotateY: clampedRotateY });

        // Используем RAF для batch обновления всех карточек за один кадр
        if (raf3DId === null) {
            raf3DId = requestAnimationFrame(() => {
                // Применяем все обновления за один раз (не блокируем UI)
                pending3DUpdates.forEach((value, id) => {
                    if (!card3DHover.value[id]) {
                        card3DHover.value[id] = { rotateX: 0, rotateY: 0 };
                    }
                    card3DHover.value[id] = value;
                });
                pending3DUpdates.clear();
                raf3DId = null;
            });
        }
    };

    const handle3DMouseLeave = (cardId: string) => {
        if (card3DHover.value[cardId]) {
            card3DHover.value[cardId] = { rotateX: 0, rotateY: 0 };
        }
    };

    const getCard3DStyle = (cardId: string): StyleValue => {
        // If 3D is disabled, return empty style
        if (is3DDisabled.value) {
            return {};
        }

        const hover = card3DHover.value[cardId];

        // Если нет 3D эффекта - не возвращаем ничего
        if (!hover || (hover.rotateX === 0 && hover.rotateY === 0)) {
            return {};
        }

        return {
            transform: `perspective(1000px) rotateX(${hover.rotateX}deg) rotateY(${hover.rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
            zIndex: 10,
            boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
            transition: 'none', // Отключаем плавную анимацию при движении (для мгновенного отклика)
            willChange: 'transform, box-shadow'
        };
    };

    onUnmounted(() => {
        if (raf3DId !== null) {
            cancelAnimationFrame(raf3DId);
        }
        pending3DUpdates.clear();
        motionMediaQuery = null;
    });

    return {
        card3DHover,
        handle3DMouseMove,
        handle3DMouseLeave,
        getCard3DStyle,
        is3DDisabled, // Expose for debugging/status
    };
}
