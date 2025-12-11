import { ref, type Ref, type ComputedRef } from 'vue';
import { cachedApiClient } from '@/services/cachedApi';
import { buildExerciseImageSource, type ExerciseImageSource } from '@/utils/exerciseImages';
import { stripImageTransforms, stripSrcsetTransforms } from '@/utils/imageTransforms';
import { EXERCISE_IMAGE_SIZES } from '@/constants/exercises';
import type { ProgramExercise } from '@/types/exercises-page';

export function useExercisePreloading(
    programExercises: Ref<ProgramExercise[]>,
    visibleExerciseIndices: ComputedRef<{ start: number; end: number }>
) {
    // State для image preloading
    const exerciseImagesPreloaded = ref<Set<string>>(new Set()); // Кеш предзагруженных изображений
    const exerciseImagesPreloading = ref<Set<string>>(new Set()); // Изображения в процессе загрузки
    const exerciseLevelsCache = ref<Map<string, any>>(new Map()); // Кеш уровней упражнений (для быстрого доступа к изображениям)

    // Функция для извлечения изображений из уровней упражнения
    const extractExerciseImages = (levels: any[]): ExerciseImageSource[] => {
        const images: ExerciseImageSource[] = [];

        for (const level of levels) {
            const candidates = [level?.image1, level?.image2, level?.image3];
            candidates.forEach((candidate) => {
                const source = buildExerciseImageSource(candidate ?? null, {
                    defaultWidth: 720,
                    widths: [360, 480, 640, 768, 960, 1280],
                    sizes: EXERCISE_IMAGE_SIZES,
                });
                if (!source) {
                    return;
                }

                const sanitizedSrc = stripImageTransforms(source.src) ?? source.src;
                const sanitizedSrcset = stripSrcsetTransforms(source.srcset ?? null) ?? source.srcset;

                if (!images.some((existing) => existing.src === sanitizedSrc)) {
                    images.push({
                        ...source,
                        src: sanitizedSrc,
                        srcset: sanitizedSrcset,
                    });
                }
            });
        }

        return images;
    };

    // Предзагрузка изображений упражнения
    const preloadExerciseImages = async (exercise: ProgramExercise, priority: 'high' | 'low' = 'low') => {
        if (!exercise.exerciseKey) return;

        const cacheKey = `exercise_images_${exercise.exerciseKey}`;

        // Проверяем, не загружаем ли уже
        if (exerciseImagesPreloading.value.has(cacheKey)) return;

        // Проверяем, не загружены ли уже
        if (exerciseImagesPreloaded.value.has(cacheKey)) return;

        exerciseImagesPreloading.value.add(cacheKey);

        try {
            // Загружаем уровни упражнения (если еще не загружены)
            let levels = exerciseLevelsCache.value.get(exercise.exerciseKey);

            if (!levels) {
                // Загружаем уровни в фоне (используем кеш для быстрого доступа)
                const data = await cachedApiClient.getExerciseLevels(exercise.exerciseKey);
                levels = data?.items || [];
                exerciseLevelsCache.value.set(exercise.exerciseKey, levels);
            }

            // ОПТИМИЗАЦИЯ: Предзагружаем только первые 3 уровня, чтобы не спамить запросами (вместо всех 30+)
            // Это снижает количество запросов с ~90 до ~9 на упражнение
            const levelsToPreload = levels.slice(0, 3);

            // Извлекаем изображения
            const images = extractExerciseImages(levelsToPreload);

            // Предзагружаем изображения с приоритетом
            const loadImage = (image: ExerciseImageSource) => {
                return new Promise<void>((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        resolve();
                    };
                    img.onerror = () => resolve(); // Игнорируем ошибки (404 и т.д.)
                    if (image.srcset) {
                        img.srcset = image.srcset;
                        if (image.sizes) {
                            img.sizes = image.sizes;
                        }
                    }
                    img.src = image.src;

                    // Для высокого приоритета загружаем быстрее
                    if (priority === 'high') {
                        img.fetchPriority = 'high';
                    }
                });
            };

            // Загружаем изображения параллельно (но с ограничением для низкого приоритета)
            if (priority === 'high') {
                // Для высокого приоритета - все параллельно (их теперь мало)
                await Promise.all(images.map(loadImage));
            } else {
                // Для низкого приоритета - батчами по 3 для экономии ресурсов
                for (let i = 0; i < images.length; i += 3) {
                    const batch = images.slice(i, i + 3);
                    await Promise.all(batch.map(loadImage));
                    // Небольшая задержка между батчами для неблокирующей загрузки
                    if (i + 3 < images.length) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
            }

            exerciseImagesPreloaded.value.add(cacheKey);
        } catch (error) {
            console.warn(`Failed to preload images for ${exercise.exerciseKey}`, error);
        } finally {
            exerciseImagesPreloading.value.delete(cacheKey);
        }
    };

    // Предзагрузка изображений видимых упражнений (high priority)
    const preloadVisibleExerciseImages = () => {
        if (programExercises.value.length === 0) return;

        const { start, end } = visibleExerciseIndices.value;
        const visibleExercises = programExercises.value.slice(start, end);

        // Предзагружаем изображения видимых упражнений с высоким приоритетом
        visibleExercises.forEach((exercise) => {
            if (exercise.exerciseKey) {
                requestAnimationFrame(() => {
                    preloadExerciseImages(exercise, 'high');
                });
            }
        });
    };

    // Предзагрузка изображений всех упражнений после загрузки списка (low priority)
    const preloadAllExerciseImages = () => {
        if (programExercises.value.length === 0) return;

        // Начинаем предзагрузку всех изображений в фоне с низким приоритетом
        programExercises.value.forEach((exercise, index) => {
            if (exercise.exerciseKey) {
                // Небольшая задержка для каждого упражнения, чтобы не перегружать браузер
                setTimeout(() => {
                    preloadExerciseImages(exercise, 'low');
                }, index * 200); // 200ms между каждым упражнением (увеличили интервал)
            }
        });
    };

    // Prefetch данных упражнения при hover на карточку упражнения для мгновенного открытия модалки
    let prefetchExerciseTimeout: ReturnType<typeof setTimeout> | null = null;

    const prefetchExerciseData = (exercise: ProgramExercise) => {
        if (prefetchExerciseTimeout) {
            clearTimeout(prefetchExerciseTimeout);
        }

        // Prefetch уровни упражнения при hover (150ms задержка - быстрее чем для программ)
        prefetchExerciseTimeout = setTimeout(async () => {
            if (!exercise || !exercise.exerciseKey) return;

            try {
                // Prefetch уровни упражнения для мгновенного открытия модалки
                await cachedApiClient.getExerciseLevels(exercise.exerciseKey);
            } catch (err) {
                console.debug('Prefetch exercise levels failed:', err);
            }
        }, 150); // Быстрее для лучшего UX
    };

    const cancelPrefetchExercise = () => {
        if (prefetchExerciseTimeout) {
            clearTimeout(prefetchExerciseTimeout);
            prefetchExerciseTimeout = null;
        }
    };

    const resetPreloadingState = () => {
        exerciseImagesPreloaded.value.clear();
        exerciseImagesPreloading.value.clear();
        exerciseLevelsCache.value.clear();
    };

    return {
        exerciseImagesPreloaded,
        exerciseImagesPreloading,
        exerciseLevelsCache,
        preloadExerciseImages,
        preloadVisibleExerciseImages,
        preloadAllExerciseImages,
        prefetchExerciseData,
        cancelPrefetchExercise,
        resetPreloadingState,
    };
}
