import { computed, type Ref } from 'vue';
import { lightenColor, mixColors, getDisciplineColor, generateDisciplineGradient, getExerciseColor, getProgramColor } from '@/utils/colorUtils';
import { EXERCISE_CARD_COLORS } from '@/constants/exercises';
import type { DisplayProgram, TrainingProgram, ProgramExercise } from '@/types/exercises-page';

export function useExercisesPageStyles(
    currentProgram: Ref<DisplayProgram | null>,
    activeProgramColor: Ref<string>,
    programExercises: Ref<ProgramExercise[]>
) {

    // Exercise card colors - разнообразная палитра для карточек упражнений
    const exerciseCardColors = EXERCISE_CARD_COLORS;

    // Функция для получения уникального цвета на основе строки (exerciseKey или id)
    const getColorFromString = (str: string): string => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % exerciseCardColors.length;
        return exerciseCardColors[index];
    };

    // Кеш градиентов дисциплин для оптимизации
    const disciplineGradientsCache = new Map<string, ReturnType<typeof generateDisciplineGradient>>();

    // Получение градиента дисциплины с кешированием
    const getDisciplineGradientCached = (disciplineId: string, disciplineName: string): ReturnType<typeof generateDisciplineGradient> => {
        const key = `${disciplineId}_${disciplineName}`;
        if (!disciplineGradientsCache.has(key)) {
            const primaryColor = getDisciplineColor(disciplineId, disciplineName);
            disciplineGradientsCache.set(key, generateDisciplineGradient(primaryColor));
        }
        return disciplineGradientsCache.get(key)!;
    };

    // Мемоизация стилей упражнений с использованием цветов дисциплины
    const exerciseCardStyles = computed(() => {
        // Получаем градиент текущей дисциплины
        const programName = currentProgram.value?.name ?? currentProgram.value?.title ?? '';
        const disciplineGradient = currentProgram.value?.id && programName
            ? getDisciplineGradientCached(currentProgram.value.id, programName)
            : null;

        return programExercises.value.map((exercise, index) => {
            let color: string;
            let lightenedBg: string;

            if (!exercise) {
                // Запасной цвет на случай отсутствия данных
                color = exerciseCardColors[index % exerciseCardColors.length];
                lightenedBg = lightenColor(color, 0.92);
            } else {
                // Генерируем цвет упражнения на основе дисциплины
                const exerciseKey = exercise.exerciseKey || exercise.id;
                if (disciplineGradient) {
                    color = getExerciseColor(exerciseKey, disciplineGradient.primary);
                } else {
                    // Fallback на старую систему
                    color = getColorFromString(exerciseKey);
                }
                lightenedBg = lightenColor(color, 0.92);
            }

            return {
                '--exercise-card-color': color,
                '--exercise-card-bg': lightenedBg,
                '--exercise-card-icon-bg': lightenColor(color, 0.88),
                /* Плавная смена градиентов */
                '--exercise-card-gradient-start': lightenedBg,
                '--exercise-card-gradient-mid': mixColors(lightenedBg, color, 98),
                '--exercise-card-gradient-end': 'var(--color-bg-elevated)',
            };
        });
    });

    const pageStyleVars = computed(() => {
        // Получаем цвет текущей карточки направления
        let baseColor = activeProgramColor.value;

        // Если цвет слишком нейтральный, используем значение по умолчанию
        if (!baseColor || baseColor === '#A3A3A3' ||
            baseColor === '#E5E7EB' || baseColor === '#9CA3AF' || baseColor === '#6B7280') {
            baseColor = '#10A37F'; // ChatGPT Green по умолчанию
        }

        // Генерируем оттенки для скроллбара на основе цвета карточки направления
        // Делаем более тусклые цвета (больше серого, меньше насыщенности)
        const scrollThumbBase = baseColor;
        const scrollThumbActive = lightenColor(scrollThumbBase, 0.5); // Более яркий при hover
        // Увеличиваем смешение с серым до 75% для более тусклого вида
        const scrollThumbInactive = mixColors(scrollThumbBase, '#E5E7EB', 75); // Более тусклый оттенок

        return {
            '--scroll-thumb-color-active': scrollThumbActive,
            '--scroll-thumb-color-base': scrollThumbInactive,
            '--scroll-thumb-color-hover': mixColors(scrollThumbBase, scrollThumbActive, 70),
            '--scroll-track-color': 'transparent',
        };
    });

    const getProgramStyles = (program: DisplayProgram | null) => {
        if (!program) {
            return {};
        }

        // Используем theme variables для консистентности с пресетами
        return {
            '--program-border-color': 'var(--color-border)',
            '--program-title-color': 'var(--color-accent)',
            '--program-subtitle-color': 'var(--color-text-secondary)',
            '--program-bg-color': 'var(--color-bg)',
            '--program-bg-soft-color': 'var(--color-bg-secondary)',
            '--program-nav-bg': 'var(--color-bg-elevated)',
            '--program-nav-color': 'var(--color-accent)',
            '--program-gradient-start': 'var(--color-bg)',
            '--program-gradient-mid': 'var(--color-bg-secondary)',
            '--program-gradient-end': 'var(--color-bg-elevated)',
        };
    };

    const getTrainingProgramStyles = (program: TrainingProgram | null) => {
        if (!program) return {};

        // Обычные карточки программ с отличающимся оттенком от направления
        const disciplineColor = currentProgram.value?.color || '#10A37F';
        const programColor = getProgramColor(disciplineColor);
        const programBorderColor = mixColors(programColor, '#0F172A', 45);

        return {
            '--training-program-bg': 'var(--color-surface-card, rgba(15,17,23,0.96))',
            '--training-program-border': programBorderColor,
            '--training-program-title-color': 'var(--color-text-primary, #f4f4f5)',
            '--training-program-description-color': 'var(--color-text-secondary, #cbd5f5)',
            '--training-program-nav-color': programBorderColor,
            '--training-program-gradient-start': 'color-mix(in srgb, var(--color-surface-card, rgba(15,17,23,0.96)) 95%, transparent)',
            '--training-program-gradient-mid': 'color-mix(in srgb, var(--color-surface-card, rgba(15,17,23,0.96)) 90%, transparent)',
            '--training-program-gradient-end': 'color-mix(in srgb, var(--color-surface-card, rgba(15,17,23,0.96)) 86%, transparent)',
            '--connection-color': programBorderColor,
        };
    };

    // Мемоизированный цвет для модалки упражнения на основе дисциплины
    const getExerciseModalColor = (selectedExercise: ProgramExercise | null) => {
        if (!selectedExercise) return '#3B82F6';

        const exerciseKey = selectedExercise.exerciseKey || selectedExercise.id;

        // Получаем градиент текущей дисциплины
        const disciplineGradient = currentProgram.value?.gradient ||
            (currentProgram.value?.id && currentProgram.value?.name
                ? getDisciplineGradientCached(currentProgram.value.id, currentProgram.value.name)
                : null);

        // Генерируем цвет упражнения на основе дисциплины
        if (disciplineGradient) {
            return getExerciseColor(exerciseKey, disciplineGradient.primary);
        }

        // Fallback на старую систему
        return getColorFromString(exerciseKey);
    };

    return {
        exerciseCardStyles,
        pageStyleVars,
        getProgramStyles,
        getTrainingProgramStyles,
        getExerciseModalColor,
        getColorFromString,  // Экспортируем на случай, если понадобится вне
        getDisciplineGradientCached, // Экспортируем на случай, если понадобится вне
    };
}
