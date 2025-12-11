import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue';

export function useParallaxEffect(
    exercisesPageRef: Ref<HTMLElement | null>,
    pageTitleRef: Ref<HTMLElement | null>,
    programsSectionRef: Ref<HTMLElement | null>,
    trainingProgramsSectionRef: Ref<HTMLElement | null>,
    exercisesSectionRef: Ref<HTMLElement | null>,
) {
    // Параллакс коэффициенты для разных элементов (0 = нет движения, 1 = полное движение)
    const parallaxConfig = {
        pageTitle: 0.25,      // Легкий параллакс для заголовка
        programsSection: 0.4, // Средний для секции направлений
        trainingPrograms: 0.35, // Средний-легкий для программ
        exercises: 0.3,       // Легкий для упражнений
        background: 0.6,      // Сильный для фоновых элементов
    };

    // Позиция скролла
    const scrollY = ref(0);
    const windowHeight = ref(0);
    const isReducedMotion = ref(false);

    // Проверка prefers-reduced-motion
    const checkReducedMotion = () => {
        if (typeof window !== 'undefined' && window.matchMedia) {
            isReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }
    };

    // Функция для расчета параллакс-трансформации элемента (улучшенный алгоритм)
    const getParallaxTransform = (element: HTMLElement | null, coefficient: number): string => {
        if (!element || isReducedMotion.value) return 'translateY(0)';

        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + scrollY.value;
        const elementCenter = elementTop + rect.height / 2;
        const viewportCenter = scrollY.value + windowHeight.value / 2;

        // Расстояние от центра элемента до центра viewport
        const distance = viewportCenter - elementCenter;

        // Нормализация расстояния (от -1 до 1)
        const normalizedDistance = distance / windowHeight.value;

        // Параллакс-смещение с плавной кривой (ease-out эффект)
        // Используем квадратичную функцию для более плавного эффекта
        const parallaxOffset = normalizedDistance * coefficient * windowHeight.value * 0.15;

        // Ограничиваем максимальное смещение для производительности
        const maxOffset = windowHeight.value * 0.2;
        const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, parallaxOffset));

        return `translate3d(0, ${clampedOffset}px, 0)`;
    };

    // Computed свойства для параллакс-стилей (с оптимизацией)
    const parallaxPageTitle = computed(() => {
        if (isReducedMotion.value) return {};
        return {
            transform: getParallaxTransform(pageTitleRef.value, parallaxConfig.pageTitle),
            transition: 'none',
            willChange: 'transform',
        };
    });

    const parallaxProgramsSection = computed(() => {
        if (isReducedMotion.value) return {};
        return {
            transform: getParallaxTransform(programsSectionRef.value, parallaxConfig.programsSection),
            transition: 'none',
            willChange: 'transform',
        };
    });

    const parallaxTrainingPrograms = computed(() => {
        if (isReducedMotion.value) return {};
        return {
            transform: getParallaxTransform(trainingProgramsSectionRef.value, parallaxConfig.trainingPrograms),
            transition: 'none',
            willChange: 'transform',
        };
    });

    const parallaxExercises = computed(() => {
        if (isReducedMotion.value) return {};
        return {
            transform: getParallaxTransform(exercisesSectionRef.value, parallaxConfig.exercises),
            transition: 'none',
            willChange: 'transform',
        };
    });

    // Параллакс для фонового градиента (улучшенный)
    const parallaxBackground = computed(() => {
        if (isReducedMotion.value || !exercisesPageRef.value) return {};

        // Плавное изменение позиции фона в зависимости от скролла
        const parallaxOffset = (scrollY.value / windowHeight.value) * parallaxConfig.background * 30;
        const clampedOffset = Math.max(-30, Math.min(30, parallaxOffset));

        return {
            backgroundPosition: `center ${50 + clampedOffset}%`,
            transition: isReducedMotion.value ? 'background-position 0.3s ease' : 'none',
            willChange: isReducedMotion.value ? 'auto' : 'background-position',
        };
    });

    // Обработчик скролла с оптимизацией (throttle через RAF + performance throttling)
    let rafId: number | null = null;
    let lastScrollTime = 0;

    const handleScroll = () => {
        const now = performance.now();

        // Увеличен throttle до 32ms для лучшей производительности при скролле
        if (now - lastScrollTime < 32) {
            return;
        }

        // Если уже запланирован RAF - не создаем новый (оптимизация)
        if (rafId !== null) return;

        rafId = requestAnimationFrame(() => {
            // Обновляем значения синхронно для минимальной задержки
            scrollY.value = window.scrollY || window.pageYOffset || 0;
            windowHeight.value = window.innerHeight;
            lastScrollTime = performance.now();
            rafId = null;
        });
    };

    // Обработчик изменения размера окна (debounced)
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);

        resizeTimeout = setTimeout(() => {
            windowHeight.value = window.innerHeight;
            scrollY.value = window.scrollY || window.pageYOffset || 0;
            resizeTimeout = null;
        }, 150);
    };

    // Проверка производительности устройства (для отключения параллакса на слабых устройствах)
    const isLowEndDevice = (): boolean => {
        if (typeof navigator === 'undefined') return false;

        // Проверяем количество ядер процессора (приблизительно)
        const hardwareConcurrency = navigator.hardwareConcurrency || 2;

        // Проверяем память (если доступно)
        // @ts-ignore - deviceMemory может быть доступен в некоторых браузерах
        const deviceMemory = navigator.deviceMemory || 4;

        // Отключаем параллакс на слабых устройствах для производительности
        return hardwareConcurrency <= 2 || deviceMemory <= 2;
    };

    // Инициализация параллакса
    const initParallax = () => {
        if (typeof window === 'undefined') return;

        checkReducedMotion();

        // Отключаем параллакс на слабых устройствах или при reduced motion
        if (isReducedMotion.value || isLowEndDevice()) {
            isReducedMotion.value = true;
            return;
        }

        scrollY.value = window.scrollY || window.pageYOffset || 0;
        windowHeight.value = window.innerHeight;

        // Добавляем обработчики с passive: true для оптимизации производительности
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize, { passive: true });

        // Также слушаем изменения prefers-reduced-motion в реальном времени
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            const handleMotionChange = (_event: MediaQueryListEvent | MediaQueryList) => {
                checkReducedMotion();
                if (isReducedMotion.value) {
                    cleanupParallax();
                } else if (!isLowEndDevice()) {
                    window.addEventListener('scroll', handleScroll, { passive: true });
                    window.addEventListener('resize', handleResize, { passive: true });
                }
            };

            // Современный способ (addEventListener)
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', handleMotionChange);
            } else {
                // Fallback для старых браузеров
                // @ts-ignore
                mediaQuery.addListener(handleMotionChange);
            }
        }
    };

    // Очистка параллакса
    const cleanupParallax = () => {
        if (typeof window === 'undefined') return;

        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);

        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }

        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
            resizeTimeout = null;
        }
    };

    onMounted(() => {
        initParallax();
    });

    onUnmounted(() => {
        cleanupParallax();
    });

    return {
        parallaxPageTitle,
        parallaxProgramsSection,
        parallaxTrainingPrograms,
        parallaxExercises,
        parallaxBackground,
    };
}
