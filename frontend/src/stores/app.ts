import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiClient } from '@/services/api';
import { cachedApiClient } from '@/services/cachedApi';
import { invalidateProgramContextCaches } from '@/services/cacheManager';
import type {
    ExerciseLevel,
    ProgramExercise,
    ProfileSummary,
    TelegramUser,
    AssistantSessionState,
    UserProgramSnapshot,
} from '@/types';

export type ThemeMode = 'dark';
export type ThemePresetId = 'nocturne';

export type ThemePreset = {
    id: ThemePresetId;
    label: string;
    mode: ThemeMode;
    cssVars: Record<string, string>;
};

type RgbColor = { r: number; g: number; b: number };

type CustomThemePalette = {
    accent: RgbColor;
    background: RgbColor;
    textPrimary: RgbColor;
    textSecondary: RgbColor;
};

const themePresets: ThemePreset[] = [
    {
        id: 'nocturne',
        label: 'Nocturne Black',
        mode: 'dark',
        cssVars: {
            '--color-bg': '#050505',
            '--color-bg-secondary': '#090a0f',
            '--color-bg-elevated': '#0f1117',
            '--color-surface': 'rgba(148, 163, 184, 0.12)',
            '--color-surface-hover': 'rgba(148, 163, 184, 0.18)',
            '--color-surface-tint': 'rgba(59, 130, 246, 0.18)',
            '--color-surface-strong': 'rgba(148, 163, 184, 0.3)',
            '--color-surface-glass': 'rgba(15, 23, 42, 0.72)',
            '--color-border': 'rgba(148, 163, 184, 0.28)',
            '--color-border-strong': 'rgba(148, 163, 184, 0.42)',
            '--color-border-subtle': 'rgba(15, 23, 42, 0.5)',
            '--color-text-primary': '#f4f4f5',
            '--color-text-secondary': '#cbd5f5',
            '--color-text-muted': '#94a3b8',
            '--color-text-inverse': '#070709',
            '--color-accent': '#60a5fa',
            '--color-accent-hover': '#3b82f6',
            '--color-accent-contrast': '#0b1120',
            '--color-accent-light': 'rgba(96, 165, 250, 0.28)',
            '--color-success': '#22d3ee',
            '--color-success-soft': 'rgba(34, 211, 238, 0.32)',
            '--color-warning': '#fbbf24',
            '--color-warning-soft': 'rgba(251, 191, 36, 0.34)',
            '--color-danger': '#fb7185',
            '--color-danger-soft': 'rgba(251, 113, 133, 0.32)',
            '--color-info': '#a855f7',
            '--gradient-accent': 'linear-gradient(150deg, rgba(96, 165, 250, 0.24) 0%, rgba(56, 189, 248, 0.16) 100%)',
            '--gradient-accent-strong': 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
            '--gradient-info-strong': 'linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)',
            '--gradient-surface': 'linear-gradient(160deg, rgba(9, 10, 15, 0.94) 0%, rgba(4, 5, 8, 0.96) 100%)',
            '--shadow-xs': '0 1px 2px rgba(8, 47, 73, 0.35)',
            '--shadow-sm': '0 12px 26px rgba(8, 47, 73, 0.4)',
            '--shadow-md': '0 24px 46px rgba(8, 47, 73, 0.48)',
            '--shadow-lg': '0 36px 70px rgba(8, 47, 73, 0.55)',
            '--shadow-xl': '0 48px 92px rgba(8, 47, 73, 0.58)',
            '--scroll-thumb-color-hover': 'rgba(148, 163, 184, 0.6)',
            '--app-background-gradient':
                'radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.22), transparent 55%), radial-gradient(circle at 80% 0%, rgba(56, 189, 248, 0.18), transparent 45%), linear-gradient(180deg, rgba(2, 6, 23, 0.85) 0%, rgba(2, 6, 23, 0.6) 100%)',
            '--panel-surface-gradient': 'linear-gradient(150deg, rgba(15, 17, 23, 0.94) 0%, rgba(9, 11, 18, 0.96) 100%)',
            '--panel-surface-base': 'rgba(9, 11, 18, 0.94)',
        },
    },
];

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

const hexToRgb = (hex: string): RgbColor => {
    const normalized = hex.trim().replace('#', '');
    if (normalized.length !== 6) {
        return { r: 96, g: 165, b: 250 };
    }
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return { r, g, b };
};

const rgbToHex = ({ r, g, b }: RgbColor) => {
    const toHex = (channel: number) => clampByte(channel).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const themeStorageKey = 'tzona-custom-theme-palette-v1';

const resolveDefaultPalette = (): CustomThemePalette => {
    const preset = themePresets[0];
    return {
        accent: hexToRgb(preset.cssVars['--color-accent'] ?? '#60a5fa'),
        background: hexToRgb(preset.cssVars['--color-bg'] ?? '#050505'),
        textPrimary: hexToRgb(preset.cssVars['--color-text-primary'] ?? '#f4f4f5'),
        textSecondary: hexToRgb(preset.cssVars['--color-text-secondary'] ?? '#cbd5f5'),
    };
};

const loadStoredPalette = (): CustomThemePalette => {
    if (typeof window === 'undefined') {
        return resolveDefaultPalette();
    }
    try {
        const raw = window.localStorage.getItem(themeStorageKey);
        if (!raw) return resolveDefaultPalette();
        const parsed = JSON.parse(raw) as Partial<CustomThemePalette>;
        const fallback = resolveDefaultPalette();
        return {
            accent: parsed.accent ?? fallback.accent,
            background: parsed.background ?? fallback.background,
            textPrimary: parsed.textPrimary ?? fallback.textPrimary,
            textSecondary: parsed.textSecondary ?? fallback.textSecondary,
        };
    } catch (error) {
        console.error('Failed to parse stored palette', error);
        return resolveDefaultPalette();
    }
};

type ProgramContextSnapshot = {
    userProgram: UserProgramSnapshot | null;
    exercises: ProgramExercise[];
    levels: Map<string, ExerciseLevel[]>;
    revision: number;
    loadedAt: number | null;
};

const PROGRAM_CONTEXT_REFRESH_INTERVAL = 30 * 1000;

export const useAppStore = defineStore('app', () => {
    const toast = ref<{ title: string; message: string; type: 'success' | 'error' | 'warning' | 'info'; traceId?: string } | null>(null);
    const telegramUser = ref<TelegramUser | null>(null);
    const profileSummary = ref<ProfileSummary | null>(null);
    const demoMode = ref(false);
    const heroStatus = ref<'training' | 'rest' | null>(null);
    const now = new Date();
    const heroBadgeValue = ref(now.getDate().toString().padStart(2, '0'));
    const heroBadge = computed(() => heroBadgeValue.value);
    const themePresetId = ref<ThemePresetId>('nocturne');
    const customThemePalette = ref<CustomThemePalette>(loadStoredPalette());
    const openAdviceModalFn = ref<(() => void) | null>(null);
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    const appliedCssVariables = new Map<string, string>();

    // Shared program context state
    const userProgram = ref<UserProgramSnapshot | null>(null);
    const programSource = ref<string | null>(null);
    const programExercises = ref<ProgramExercise[]>([]);
    const exerciseLevels = ref<Map<string, ExerciseLevel[]>>(new Map());
    const programPlanKeys = ref<Set<string>>(new Set());
    const programLoading = ref(false);
    const programError = ref<string | null>(null);
    const programRevision = ref(0);
    const programLoadedAt = ref<number | null>(null);
    let programRequestId = 0;

    const assistantSessionState = ref<AssistantSessionState | null>(null);
    const assistantSessionMeta = ref<{ updatedAt: string | null; expiresAt: string | null } | null>(null);
    const assistantLatencyStats = ref<AssistantSessionState['latencyStats']>(null);
    const lastAssistantClosedAt = ref<string | null>(null);
    let assistantSessionTimer: ReturnType<typeof setInterval> | null = null;
    let lastLatencySampleToasted = 0;
    let lastLatencyAlertTimestamp: string | null = null;

    const showToast = (data: { title: string; message: string; type: 'success' | 'error' | 'warning' | 'info'; traceId?: string }) => {
        toast.value = data;

        if (toastTimer !== null) {
            clearTimeout(toastTimer);
        }

        toastTimer = setTimeout(() => {
            if (toast.value === data) {
                toast.value = null;
            }
            toastTimer = null;
        }, 5000);
    };

    const refreshProfile = async () => {
        try {
            const data = await apiClient.getProfileSummary();
            profileSummary.value = data;
            applyThemeFromSummary(data as ProfileSummary);
        } catch (error) {
            console.error('Failed to refresh profile:', error);
        }
    };

    const applyAssistantLatencyStats = (state: AssistantSessionState | null) => {
        if (!state) {
            assistantLatencyStats.value = null;
            lastLatencySampleToasted = 0;
            lastLatencyAlertTimestamp = null;
            return;
        }

        assistantLatencyStats.value = state.latencyStats ?? null;

        const alert = state.latencyAlert;
        if (alert && alert.triggeredAt && alert.triggeredAt !== lastLatencyAlertTimestamp) {
            showToast({
                title: alert.severity === 'error' ? 'Ассистент серьёзно замедлился' : 'Ассистент замедлился',
                message: alert.message,
                type: alert.severity === 'error' ? 'error' : 'warning',
            });
            lastLatencyAlertTimestamp = alert.triggeredAt;
            if (typeof state.latencyStats?.samples === 'number') {
                lastLatencySampleToasted = state.latencyStats.samples;
            }
            return;
        }

        const stats = state.latencyStats;
        if (!stats) {
            return;
        }

        if (typeof stats.samples === 'number' && stats.samples > lastLatencySampleToasted) {
            const lastMs = typeof stats.lastMs === 'number' ? stats.lastMs : null;
            const threshold = typeof stats.slowThresholdMs === 'number' ? stats.slowThresholdMs : 3500;
            const slowRatio = typeof stats.slowRatio === 'number' ? stats.slowRatio : 0;
            if (lastMs !== null && lastMs > threshold * 1.2) {
                const averageLabel = typeof stats.averageMs === 'number' ? `${Math.round(stats.averageMs)} мс` : '—';
                showToast({
                    title: 'Ассистент отвечает медленно',
                    message: `Последний ответ занял ${Math.round(lastMs)} мс. Среднее: ${averageLabel}.`,
                    type: 'warning',
                });
                lastLatencySampleToasted = stats.samples;
                return;
            }
            if (slowRatio >= 0.45) {
                showToast({
                    title: 'Много медленных ответов',
                    message: `Медленными стали ${Math.round(slowRatio * 100)}% последних ответов ассистента.`,
                    type: 'warning',
                });
                lastLatencySampleToasted = stats.samples;
            }
        }
    };

    const refreshAssistantSessionState = async ({ force = false }: { force?: boolean } = {}) => {
        try {
            const data = force
                ? await cachedApiClient.refreshAssistantSessionState()
                : await cachedApiClient.getAssistantSessionState();
            assistantSessionState.value = data?.state ?? null;
            assistantSessionMeta.value = data ? { updatedAt: data.updatedAt, expiresAt: data.expiresAt } : null;
            applyAssistantLatencyStats(assistantSessionState.value);

            if (data?.state?.status === 'closed' && data.state.closedAt) {
                if (lastAssistantClosedAt.value !== data.state.closedAt) {
                    showToast({
                        title: 'Диалог ассистента завершён',
                        message: 'Ассистент очистил историю после периода бездействия. Начните новый запрос, чтобы продолжить.',
                        type: 'info',
                    });
                    lastAssistantClosedAt.value = data.state.closedAt;
                }
            } else if (data?.state?.status === 'active') {
                lastAssistantClosedAt.value = null;
            }

            return data?.state ?? null;
        } catch (error) {
            console.error('Failed to refresh assistant session state:', error);
            return null;
        }
    };

    const ensureAssistantSessionMonitor = () => {
        if (typeof window === 'undefined') {
            return;
        }
        if (assistantSessionTimer !== null) {
            return;
        }
        assistantSessionTimer = setInterval(() => {
            refreshAssistantSessionState().catch((error) => {
                console.error('Assistant session monitor refresh failed:', error);
            });
        }, 5 * 60 * 1000);
    };

    const stopAssistantSessionMonitor = () => {
        if (assistantSessionTimer !== null) {
            clearInterval(assistantSessionTimer);
            assistantSessionTimer = null;
        }
    };

    const setHeroStatus = (status: 'training' | 'rest' | null) => {
        heroStatus.value = status;
    };

    const getProgramContextSnapshot = (): ProgramContextSnapshot => ({
        userProgram: userProgram.value,
        exercises: [...programExercises.value],
        levels: new Map(exerciseLevels.value),
        revision: programRevision.value,
        loadedAt: programLoadedAt.value,
    });

    const normalizeProgramData = (data: any) => {
        if (!data) {
            return null;
        }
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (error) {
                console.warn('Failed to parse program data JSON', error);
                return null;
            }
        }
        return data;
    };

    const collectProgramKeys = (rawData: any): Set<string> => {
        const keys = new Set<string>();
        const data = normalizeProgramData(rawData);
        if (!data) {
            return keys;
        }

        const extractFromDay = (day: any) => {
            if (!day) return;
            const list = Array.isArray(day.exercises) ? day.exercises : [];
            list.forEach((entry: any) => {
                if (entry && typeof entry === 'object') {
                    const key = entry.exerciseKey || entry.key;
                    if (typeof key === 'string' && key.trim().length) {
                        keys.add(key);
                    }
                }
            });
        };

        if (Array.isArray(data)) {
            data.forEach(extractFromDay);
        } else if (data && typeof data === 'object') {
            if (Array.isArray((data as any).days)) {
                (data as any).days.forEach(extractFromDay);
            }
            if (Array.isArray((data as any).sessions)) {
                (data as any).sessions.forEach(extractFromDay);
            }
            if (Array.isArray((data as any).plan)) {
                (data as any).plan.forEach(extractFromDay);
            }
        }

        return keys;
    };

    const mapWithConcurrency = async <T, R>(
        items: readonly T[],
        limit: number,
        iterator: (item: T, index: number) => Promise<R>,
    ): Promise<R[]> => {
        if (!items.length) {
            return [];
        }

        const results: R[] = new Array(items.length);
        let nextIndex = 0;
        let active = 0;
        let rejected = false;

        return new Promise<R[]>((resolve, reject) => {
            const maybeResolve = () => {
                if (!rejected && nextIndex >= items.length && active === 0) {
                    resolve(results);
                }
            };

            const launchNext = () => {
                if (rejected) {
                    return;
                }
                if (nextIndex >= items.length) {
                    maybeResolve();
                    return;
                }

                const currentIndex = nextIndex++;
                active += 1;

                iterator(items[currentIndex], currentIndex)
                    .then((value) => {
                        results[currentIndex] = value;
                        active -= 1;
                        if (nextIndex < items.length) {
                            launchNext();
                        } else {
                            maybeResolve();
                        }
                    })
                    .catch((error) => {
                        if (!rejected) {
                            rejected = true;
                            reject(error);
                        }
                    });
            };

            const initial = Math.min(Math.max(1, limit), items.length);
            for (let i = 0; i < initial; i += 1) {
                launchNext();
            }
        });
    };

    const setsEqual = (a: Set<string>, b: Set<string>) => {
        if (a.size !== b.size) return false;
        for (const value of a) {
            if (!b.has(value)) return false;
        }
        return true;
    };

    const mapsEqual = (a: Map<string, ExerciseLevel[]>, b: Map<string, ExerciseLevel[]>) => {
        if (a.size !== b.size) return false;
        for (const [key, list] of a) {
            const other = b.get(key);
            if (!other || other.length !== list.length) return false;
        }
        return true;
    };

    const arraysEqual = <T>(left: readonly T[], right: readonly T[]) => {
        if (left.length !== right.length) return false;
        return left.every((value, index) => value === right[index]);
    };

    const applyProgramContextState = (patch: {
        userProgram?: UserProgramSnapshot | null;
        programSource?: string | null;
        programPlanKeys?: Set<string>;
        programExercises?: ProgramExercise[];
        exerciseLevels?: Map<string, ExerciseLevel[]>;
        programLoadedAt?: number | null;
        programError?: string | null;
        bumpRevision?: boolean;
    }) => {
        let changed = false;

        if (patch.userProgram !== undefined && patch.userProgram !== userProgram.value) {
            userProgram.value = patch.userProgram;
            changed = true;
        }

        if (patch.programSource !== undefined && patch.programSource !== programSource.value) {
            programSource.value = patch.programSource;
            changed = true;
        }

        if (patch.programPlanKeys !== undefined && !setsEqual(patch.programPlanKeys, programPlanKeys.value)) {
            programPlanKeys.value = patch.programPlanKeys;
            changed = true;
        }

        if (patch.programExercises !== undefined && !arraysEqual(patch.programExercises, programExercises.value)) {
            programExercises.value = patch.programExercises;
            changed = true;
        }

        if (patch.exerciseLevels !== undefined && !mapsEqual(patch.exerciseLevels, exerciseLevels.value)) {
            exerciseLevels.value = patch.exerciseLevels;
            changed = true;
        }

        if (patch.programLoadedAt !== undefined && patch.programLoadedAt !== programLoadedAt.value) {
            programLoadedAt.value = patch.programLoadedAt;
            changed = true;
        }

        if (patch.programError !== undefined && patch.programError !== programError.value) {
            programError.value = patch.programError;
            changed = true;
        }

        if ((patch.bumpRevision || changed) && patch.bumpRevision !== false) {
            programRevision.value += 1;
        }
    };

    // Фоновое обновление контекста программы без блокировки UI
    const refreshProgramContextInBackground = async (includeLevels: boolean) => {
        const previousSnapshot = getProgramContextSnapshot();
        const previousSource = programSource.value;
        const previousPlanKeys = new Set(programPlanKeys.value);
        let hadError: unknown = null;
        let nextExercises: ProgramExercise[] = [];
        let nextLevels: Map<string, ExerciseLevel[]> | null = null;

        try {
            const loadedProgram = await cachedApiClient.getUserProgram();
            applyProgramContextState({
                userProgram: loadedProgram ?? null,
                programSource: loadedProgram?.source ?? null,
                programPlanKeys: collectProgramKeys(loadedProgram?.program?.programData),
                bumpRevision: false,
            });

            if (loadedProgram?.program?.id) {
                const response = await cachedApiClient.getProgramExercises(loadedProgram.program.id);
                const rawExercises = Array.isArray(response)
                    ? response
                    : Array.isArray((response as any)?.items)
                        ? (response as any).items
                        : [];
                if (programPlanKeys.value.size) {
                    nextExercises = rawExercises.filter((exercise: ProgramExercise) =>
                        programPlanKeys.value.has(exercise.exerciseKey)
                    );
                } else {
                    nextExercises = rawExercises;
                }
            } else {
                nextExercises = [];
            }

            if (includeLevels) {
                if (nextExercises.length) {
                    const previousLevels = new Map(exerciseLevels.value);
                    try {
                        const entries = await mapWithConcurrency(nextExercises, 4, async (exercise) => {
                            const payload = await cachedApiClient.getExerciseLevels(exercise.exerciseKey);
                            const list = Array.isArray((payload as any)?.items)
                                ? (payload as any).items as ExerciseLevel[]
                                : [];
                            return [exercise.exerciseKey, list] as [string, ExerciseLevel[]];
                        });
                        nextLevels = new Map(entries);
                    } catch (error) {
                        hadError = error;
                        nextLevels = previousLevels;
                    }
                } else {
                    nextLevels = new Map();
                }
            }
        } catch (error: any) {
            hadError = error;
        } finally {
            if (hadError) {
                console.warn('[refreshProgramContextInBackground] Failed:', hadError);
                const message = hadError instanceof Error
                    ? hadError.message
                    : 'Не удалось обновить программу пользователя.';
                applyProgramContextState({
                    userProgram: previousSnapshot.userProgram,
                    programSource: previousSource,
                    programPlanKeys: previousPlanKeys,
                    programExercises: previousSnapshot.exercises,
                    exerciseLevels: previousSnapshot.levels,
                    programError: message,
                });
                if (!toast.value || toast.value.message !== message) {
                    showToast({ title: 'Не удалось обновить программу', message, type: 'error' });
                }
            } else {
                applyProgramContextState({
                    programExercises: nextExercises,
                    exerciseLevels: includeLevels && nextLevels ? nextLevels : exerciseLevels.value,
                    programLoadedAt: Date.now(),
                    programError: null,
                });
            }
        }
    };

    const ensureProgramContext = async (options?: { force?: boolean; includeLevels?: boolean }) => {
        const force = options?.force ?? false;
        const includeLevels = options?.includeLevels !== false;
        const snapshot = getProgramContextSnapshot();
        if (force) {
            invalidateProgramContextCaches({
                includeGlobal: true,
                disciplineId: snapshot.userProgram?.disciplineId ?? snapshot.userProgram?.discipline?.id ?? null,
                programId: snapshot.userProgram?.programId ?? snapshot.userProgram?.program?.id ?? null,
                exerciseKeys: snapshot.exercises.map((exercise) => exercise.exerciseKey),
            });
        }

        // Если есть кеш - возвращаем сразу (мгновенный показ контента)
        // Обновление в фоне через cachedApiClient.getWithBackgroundRefresh
        const hasCache = !!snapshot.userProgram;

        // КРИТИЧНО: Если запрошены уровни (includeLevels=true) и их НЕТ (levels.size === 0),
        // то ОБЯЗАТЕЛЬНО загружаем, даже если кеш свежий
        const needsLevels = includeLevels && snapshot.levels.size === 0 && snapshot.exercises.length > 0;

        const shouldSkipFetch =
            !force &&
            hasCache &&
            !needsLevels && // НЕ пропускаем если нужны уровни
            (!includeLevels || snapshot.levels.size > 0 || snapshot.exercises.length === 0) &&
            !!snapshot.loadedAt &&
            Date.now() - snapshot.loadedAt < PROGRAM_CONTEXT_REFRESH_INTERVAL;

        if (shouldSkipFetch) {
            console.log('[ensureProgramContext] Skipping fetch - using cached data');
            return snapshot;
        }

        // Если есть кеш, но он устаревший - возвращаем его сразу и обновляем в фоне
        if (!force && hasCache && snapshot.loadedAt) {
            // Запускаем обновление в фоне, не блокируя UI
            refreshProgramContextInBackground(includeLevels);
            return snapshot;
        }

        programLoading.value = true;
        programError.value = null;
        const requestId = ++programRequestId;

        const finalize = () => {
            if (requestId === programRequestId) {
                programLoading.value = false;
            }
        };

        try {
            const loadedProgram = await cachedApiClient.getUserProgram();
            if (requestId !== programRequestId) {
                return getProgramContextSnapshot();
            }

            userProgram.value = loadedProgram ?? null;
            programSource.value = loadedProgram?.source ?? null;
            programPlanKeys.value = collectProgramKeys(loadedProgram?.program?.programData);

            let exercises: ProgramExercise[] = [];
            if (loadedProgram?.program?.id) {
                const response = await cachedApiClient.getProgramExercises(loadedProgram.program.id);
                const rawExercises = Array.isArray(response)
                    ? response
                    : Array.isArray((response as any)?.items)
                        ? (response as any).items
                        : [];
                if (programPlanKeys.value.size) {
                    exercises = rawExercises.filter((exercise: ProgramExercise) =>
                        programPlanKeys.value.has(exercise.exerciseKey)
                    );
                } else {
                    exercises = rawExercises;
                }
            }

            let levelsMap = exerciseLevels.value;
            if (includeLevels) {
                console.log('[ensureProgramContext] Loading exercise levels WITH images...', {
                    exercisesCount: exercises.length,
                    exerciseKeys: exercises.map(e => e.exerciseKey),
                });
                if (!exercises.length) {
                    levelsMap = new Map();
                } else {
                    const entries = await mapWithConcurrency(exercises, 6, async (exercise) => {
                        const payload = await cachedApiClient.getExerciseLevels(exercise.exerciseKey);
                        const list = Array.isArray((payload as any)?.items)
                            ? (payload as any).items as ExerciseLevel[]
                            : [];
                        console.log(`[ensureProgramContext] Loaded ${exercise.exerciseKey}:`, list.length, 'levels');
                        return [exercise.exerciseKey, list] as [string, ExerciseLevel[]];
                    });
                    levelsMap = new Map(entries);
                    console.log('[ensureProgramContext] Exercise levels loaded:', {
                        count: levelsMap.size,
                        keys: Array.from(levelsMap.keys()),
                    });
                }
            }

            if (requestId !== programRequestId) {
                return getProgramContextSnapshot();
            }

            applyProgramContextState({
                programExercises: exercises,
                exerciseLevels: includeLevels ? levelsMap : exerciseLevels.value,
                programLoadedAt: Date.now(),
            });

            return getProgramContextSnapshot();
        } catch (error: any) {
            if (requestId !== programRequestId) {
                return getProgramContextSnapshot();
            }

            if (error?.code === 'NOT_FOUND_ERROR' || error?.response?.status === 404) {
                applyProgramContextState({
                    userProgram: null,
                    programSource: null,
                    programExercises: [],
                    exerciseLevels: new Map(),
                    programPlanKeys: new Set(),
                    programLoadedAt: Date.now(),
                });
                finalize();
                return getProgramContextSnapshot();
            }

            programError.value = error?.message ?? 'Не удалось загрузить программу';
            finalize();
            throw error;
        } finally {
            finalize();
        }
    };

    const invalidateProgramContext = () => {
        applyProgramContextState({
            userProgram: null,
            programSource: null,
            programExercises: [],
            exerciseLevels: new Map(),
            programPlanKeys: new Set(),
            programLoadedAt: null,
        });
    };

    const programDiscipline = computed(() => userProgram.value?.discipline ?? null);
    const programDefinition = computed(() => userProgram.value?.program ?? null);
    const mix = (color1: RgbColor, color2: RgbColor, weight: number) => {
        const w = Math.min(1, Math.max(0, weight));
        return {
            r: clampByte(color1.r * (1 - w) + color2.r * w),
            g: clampByte(color1.g * (1 - w) + color2.g * w),
            b: clampByte(color1.b * (1 - w) + color2.b * w),
        };
    };

    const lighten = (color: RgbColor, amount: number) => mix(color, { r: 255, g: 255, b: 255 }, amount);
    const darken = (color: RgbColor, amount: number) => mix(color, { r: 0, g: 0, b: 0 }, amount);

    const toRgba = (color: RgbColor, alpha: number) => `rgba(${clampByte(color.r)}, ${clampByte(color.g)}, ${clampByte(color.b)}, ${Math.min(1, Math.max(0, alpha))})`;

    const getLuminance = (color: RgbColor) => {
        const srgb = [color.r, color.g, color.b].map((value) => {
            const c = value / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    };

    const pickContrastText = (bgColor: RgbColor) => {
        const luminance = getLuminance(bgColor);
        return luminance > 0.5 ? '#000000' : '#ffffff';
    };

    const programCurrentLevels = computed(() => ({
        ...(userProgram.value?.currentLevels || userProgram.value?.initialLevels || {}),
    } as Record<string, number>));

    const setHeroBadge = (value: string | number | null) => {
        if (value === null || value === undefined) {
            heroBadgeValue.value = '--';
            return;
        }
        const normalized = String(value).trim();
        heroBadgeValue.value = normalized ? normalized.padStart(2, '0') : '--';
    };

    const setOpenAdviceModal = (fn: (() => void) | null) => {
        openAdviceModalFn.value = fn;
    };

    const currentThemePreset = computed<ThemePreset>(() => {
        return themePresets.find((preset) => preset.id === themePresetId.value) ?? themePresets[0];
    });

    const theme = computed<ThemeMode>(() => currentThemePreset.value.mode);

    const customCssOverrides = computed<Record<string, string>>(() => {
        const palette = customThemePalette.value;
        const accent = palette.accent;
        const bg = palette.background;

        // Smart derivation
        const isDark = getLuminance(bg) < 0.5;
        const surfaceMixColor = isDark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };

        // Accent variations
        const accentHex = rgbToHex(accent);
        const accentHover = rgbToHex(isDark ? lighten(accent, 0.15) : darken(accent, 0.1));
        const accentStrong = rgbToHex(isDark ? lighten(accent, 0.25) : darken(accent, 0.2));
        const accentMuted = toRgba(accent, 0.15);

        // Background variations
        const bgHex = rgbToHex(bg);
        const bgSecondary = rgbToHex(mix(bg, surfaceMixColor, 0.04));
        const bgElevated = rgbToHex(mix(bg, surfaceMixColor, 0.08));

        // Surfaces (Glassmorphism)
        // For dark mode: mix background with a bit of white/accent, low opacity
        const surfaceBase = toRgba(mix(bg, surfaceMixColor, 0.08), 0.6);
        const surfaceHover = toRgba(mix(bg, surfaceMixColor, 0.12), 0.7);
        const surfaceStrong = toRgba(mix(bg, surfaceMixColor, 0.18), 0.8);
        const glass = toRgba(mix(bg, accent, 0.05), 0.75); // Slight tint of accent in glass

        // Borders
        const border = toRgba(mix(bg, surfaceMixColor, 0.2), 0.25);
        const borderStrong = toRgba(mix(bg, surfaceMixColor, 0.3), 0.4);

        // Text
        const textPrimaryHex = rgbToHex(palette.textPrimary);
        const textSecondaryHex = rgbToHex(palette.textSecondary);
        const textMuted = toRgba(palette.textSecondary, 0.6);
        const textInverse = pickContrastText(palette.textPrimary);
        const accentContrast = pickContrastText(accent);

        return {
            // Accent
            '--color-accent': accentHex,
            '--color-accent-hover': accentHover,
            '--color-accent-contrast': accentContrast,
            '--color-accent-light': accentMuted,
            '--gradient-accent': `linear-gradient(135deg, ${toRgba(accent, 0.8)} 0%, ${toRgba(accent, 0.4)} 100%)`,
            '--gradient-accent-strong': `linear-gradient(135deg, ${accentHex} 0%, ${accentStrong} 100%)`,

            // Backgrounds
            '--color-bg': bgHex,
            '--color-bg-secondary': bgSecondary,
            '--color-bg-elevated': bgElevated,
            '--app-background-gradient': `radial-gradient(circle at 20% 20%, ${toRgba(accent, 0.08)}, transparent 60%), radial-gradient(circle at 80% 80%, ${toRgba(palette.textSecondary, 0.05)}, transparent 50%), linear-gradient(180deg, ${bgHex} 0%, ${bgSecondary} 100%)`,

            // Surfaces & Glass
            '--color-surface': surfaceBase,
            '--color-surface-hover': surfaceHover,
            '--color-surface-strong': surfaceStrong,
            '--color-surface-glass': glass,
            '--color-surface-tint': toRgba(accent, 0.08),

            // Borders
            '--color-border': border,
            '--color-border-strong': borderStrong,
            '--color-border-subtle': toRgba(mix(bg, surfaceMixColor, 0.1), 0.15),

            // Text
            '--color-text-primary': textPrimaryHex,
            '--color-text-secondary': textSecondaryHex,
            '--color-text-muted': textMuted,
            '--color-text-inverse': textInverse,

            // Panels & Modals
            '--panel-surface-base': bgElevated,
            '--panel-surface-gradient': `linear-gradient(145deg, ${toRgba(mix(bg, surfaceMixColor, 0.08), 0.95)} 0%, ${toRgba(mix(bg, surfaceMixColor, 0.12), 0.98)} 100%)`,
            '--color-bg-nav': toRgba(mix(bg, surfaceMixColor, 0.06), 0.98),
            '--color-bg-modal': toRgba(mix(bg, surfaceMixColor, 0.08), 1),
            '--color-bg-card': toRgba(mix(bg, surfaceMixColor, 0.04), 1),
            '--color-input-bg': toRgba(mix(bg, surfaceMixColor, 0.06), 1),

            // Shadows (tinted with accent/bg)
            '--shadow-xs': `0 1px 2px ${toRgba(mix(bg, { r: 0, g: 0, b: 0 }, 1), 0.25)}`,
            '--shadow-sm': `0 4px 12px ${toRgba(mix(bg, { r: 0, g: 0, b: 0 }, 1), 0.3)}`,
            '--shadow-md': `0 12px 24px ${toRgba(mix(bg, { r: 0, g: 0, b: 0 }, 1), 0.35)}`,
            '--shadow-lg': `0 24px 48px ${toRgba(mix(bg, { r: 0, g: 0, b: 0 }, 1), 0.45)}`,
            '--shadow-xl': `0 32px 64px ${toRgba(mix(bg, { r: 0, g: 0, b: 0 }, 1), 0.5)}`,

            // Scrollbar
            '--scroll-thumb-color-hover': toRgba(palette.textSecondary, 0.5),
        };
    });

    const resolvedCssVars = computed<Record<string, string>>(() => ({
        ...currentThemePreset.value.cssVars,
        ...customCssOverrides.value,
    }));

    const applyThemePresetToDocument = () => {
        const preset = currentThemePreset.value;
        if (typeof document === 'undefined') {
            return;
        }

        const root = document.documentElement;
        root.setAttribute('data-theme', preset.id);
        root.setAttribute('data-theme-mode', preset.mode);
        root.style.setProperty('color-scheme', preset.mode);
        const incomingKeys = new Set<string>();

        Object.entries(resolvedCssVars.value).forEach(([key, value]) => {
            incomingKeys.add(key);
            if (appliedCssVariables.get(key) !== value) {
                root.style.setProperty(key, value);
                appliedCssVariables.set(key, value);
            }
        });

        for (const key of Array.from(appliedCssVariables.keys())) {
            if (!incomingKeys.has(key)) {
                root.style.removeProperty(key);
                appliedCssVariables.delete(key);
            }
        }
    };

    const setThemePreset = (presetId: ThemePresetId, { persist = true } = {}) => {
        const preset = themePresets.find((item) => item.id === presetId) ?? themePresets[0];
        themePresetId.value = preset.id;
        applyThemePresetToDocument();

        if (typeof window !== 'undefined') {
            if (persist) {
                window.localStorage.setItem('tzona-ui-theme-id', preset.id);
            } else {
                window.localStorage.removeItem('tzona-ui-theme-id');
            }
            window.localStorage.removeItem('tzona-ui-theme');
        }
    };

    const persistCustomThemePalette = () => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(themeStorageKey, JSON.stringify(customThemePalette.value));
    };

    const setCustomThemePalette = (palette: CustomThemePalette, { persistLocal = true } = {}) => {
        customThemePalette.value = palette;
        if (persistLocal) {
            persistCustomThemePalette();
        }
        applyThemePresetToDocument();
    };

    const updateCustomThemeColor = (target: keyof CustomThemePalette, patch: Partial<RgbColor>) => {
        const current = customThemePalette.value[target];
        const next: RgbColor = {
            r: patch.r !== undefined ? clampByte(patch.r) : current.r,
            g: patch.g !== undefined ? clampByte(patch.g) : current.g,
            b: patch.b !== undefined ? clampByte(patch.b) : current.b,
        };
        setCustomThemePalette({
            ...customThemePalette.value,
            [target]: next,
        });
    };

    const resetCustomTheme = () => {
        setCustomThemePalette(resolveDefaultPalette());
    };

    const applyThemeFromSummary = (summary: ProfileSummary | null | undefined) => {
        const palette = summary?.profile?.preferences?.themePalette;
        if (palette && palette.accent && palette.background && palette.textPrimary && palette.textSecondary) {
            setCustomThemePalette(palette, { persistLocal: true });
        }
    };

    const syncThemePaletteFromServer = async () => {
        try {
            const response = await apiClient.getThemePalette();
            setCustomThemePalette(response.palette, { persistLocal: true });
            return response;
        } catch (error) {
            console.warn('Failed to sync theme palette from server', error);
            return null;
        }
    };

    const saveThemePaletteToProfile = async () => {
        try {
            return await apiClient.updateThemePalette(customThemePalette.value);
        } catch (error) {
            console.error('Failed to save theme palette:', error);
            throw error;
        }
    };

    const initializeTheme = () => {
        setThemePreset('nocturne', { persist: false });
    };

    if (typeof document !== 'undefined') {
        applyThemePresetToDocument();
    }

    return {
        toast,
        telegramUser,
        profileSummary,
        assistantSessionState,
        assistantSessionMeta,
        assistantLatencyStats,
        demoMode,
        heroStatus,
        heroBadge,
        theme,
        themePresetId,
        themePresets,
        currentThemePreset,
        customThemePalette,
        openAdviceModalFn,
        userProgram,
        programExercises,
        exerciseLevels,
        programPlanKeys,
        programLoading,
        programError,
        programRevision,
        programLoadedAt,
        programSource,
        programDiscipline,
        programDefinition,
        programCurrentLevels,
        showToast,
        refreshProfile,
        refreshAssistantSessionState,
        setHeroStatus,
        setHeroBadge,
        setOpenAdviceModal,
        ensureProgramContext,
        invalidateProgramContext,
        getProgramContextSnapshot,
        setThemePreset,
        setCustomThemePalette,
        updateCustomThemeColor,
        resetCustomTheme,
        initializeTheme,
        saveThemePaletteToProfile,
        syncThemePaletteFromServer,
        ensureAssistantSessionMonitor,
        stopAssistantSessionMonitor,
    };
});
