/**
 * Critical prefetching is orchestrated from a single place so that login flows
 * can warm future routes, API payloads, and static media without duplicating
 * heuristics around connection speed or idle time.  The helpers below expose a
 * predictable contract for both eager warmups (after PIN login) and ad-hoc
 * prefetching (e.g., when hovering a link).
 */
import { cachedApiClient } from '@/services/cachedApi';
import { prefetchRouteBySlug, type AppRouteSlug } from '@/router';
import { buildStaticAssetUrl } from '@/utils/staticAssets';

interface PrefetchTask {
    id: string;
    run: () => Promise<unknown>;
}

interface PrefetchAsset {
    id: string;
    href: string;
    as?: 'document' | 'script' | 'style' | 'image' | 'font';
    crossOrigin?: 'anonymous' | 'use-credentials';
}

const CRITICAL_ROUTE_SLUGS: readonly AppRouteSlug[] = [
    'today',
    'exercises',
    'programs',
    'settings',
    'report',
];

const CRITICAL_DATA_TASKS: readonly PrefetchTask[] = [
    { id: 'profileSummary', run: () => cachedApiClient.getProfileSummary() },
    { id: 'todaySession', run: () => cachedApiClient.getTodaySession() },
    { id: 'weekPlan', run: () => cachedApiClient.getWeekPlan() },
    { id: 'dailyAdvice', run: () => cachedApiClient.getDailyAdvice() },
    { id: 'achievements', run: () => cachedApiClient.getAchievements({ page: 1, pageSize: 10 }) },
    { id: 'trainingDisciplines', run: () => cachedApiClient.getTrainingDisciplines() },
    { id: 'trainingPrograms', run: () => cachedApiClient.getTrainingPrograms() },
    { id: 'userProgram', run: () => cachedApiClient.getUserProgram() },
    { id: 'exerciseCatalog', run: () => cachedApiClient.getExerciseCatalog() },
];

const PREDICTIVE_ROUTE_TASKS: Record<AppRouteSlug, PrefetchTask[]> = {
    today: [
        { id: 'todaySession', run: () => cachedApiClient.getTodaySession() },
        { id: 'dailyAdvice', run: () => cachedApiClient.getDailyAdvice() },
    ],
    exercises: [
        { id: 'exerciseCatalog', run: () => cachedApiClient.getExerciseCatalog() },
    ],
    programs: [
        { id: 'trainingPrograms', run: () => cachedApiClient.getTrainingPrograms() },
        { id: 'trainingDisciplines', run: () => cachedApiClient.getTrainingDisciplines() },
    ],
    settings: [
        { id: 'profileSummary', run: () => cachedApiClient.getProfileSummary() },
    ],
    report: [
        { id: 'achievements', run: () => cachedApiClient.getAchievements({ page: 1, pageSize: 10 }) },
    ],
    progress: [],
    week: [],
    library: [],
};

const CRITICAL_MEDIA_ASSETS: readonly PrefetchAsset[] = [
    { id: 'app-icon-192', href: buildStaticAssetUrl('/icons/icon-192.png'), as: 'image' },
    { id: 'app-icon-512', href: buildStaticAssetUrl('/icons/icon-512.png'), as: 'image' },
    { id: 'maskable-icon', href: buildStaticAssetUrl('/icons/maskable-icon-512.png'), as: 'image' },
    { id: 'offline-page', href: buildStaticAssetUrl('/offline.html'), as: 'document' },
];

const startedTasks = new Map<string, Promise<void>>();
const prefetchedAssets = new Set<string>();
let routesPrefetched = false;
let hasStarted = false;

const slowConnections = new Set(['slow-2g', '2g']);

function shouldPrefetch(): boolean {
    if (typeof navigator === 'undefined') {
        return false;
    }

    const connection = (navigator as Partial<typeof navigator> & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;

    if (connection?.saveData) {
        return false;
    }

    if (connection?.effectiveType && slowConnections.has(connection.effectiveType)) {
        return false;
    }

    return true;
}

const runWhenIdle = (fn: () => void) => {
    if (typeof window === 'undefined') {
        return;
    }

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => fn(), { timeout: 1500 });
        return;
    }

    setTimeout(fn, 350);
};

function prefetchRoutes(): Promise<unknown>[] {
    if (routesPrefetched) {
        return [];
    }

    routesPrefetched = true;
    return CRITICAL_ROUTE_SLUGS.map(slug => prefetchRouteBySlug(slug));
}

function prefetchMediaAssets(): void {
    if (typeof document === 'undefined') {
        return;
    }

    for (const asset of CRITICAL_MEDIA_ASSETS) {
        if (prefetchedAssets.has(asset.id)) {
            continue;
        }

        prefetchedAssets.add(asset.id);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = asset.href;
        if (asset.as) {
            link.as = asset.as;
        }
        if (asset.crossOrigin) {
            link.crossOrigin = asset.crossOrigin;
        }
        document.head.appendChild(link);
    }
}

function runDataTask(task: PrefetchTask): Promise<void> {
    const inFlight = startedTasks.get(task.id);
    if (inFlight) {
        return inFlight;
    }

    const promise = (async () => {
        try {
            await task.run();
        } catch (error) {
            if (import.meta.env.DEV) {
                console.warn('[prefetch] task failed', task.id, error);
            }
        }
    })().finally(() => {
        startedTasks.delete(task.id);
    });

    startedTasks.set(task.id, promise);
    return promise;
}

function prefetchDataResources(): Promise<void>[] {
    return CRITICAL_DATA_TASKS.map(task => runDataTask(task));
}

function prefetchPredictiveTasks(slug: AppRouteSlug): Promise<void>[] {
    const tasks = PREDICTIVE_ROUTE_TASKS[slug];
    if (!tasks) {
        return [];
    }

    return tasks.map(task => runDataTask(task));
}

/**
 * Launches the orchestrated prefetch only once per session.  We guard it with
 * connection checks, idle callbacks, and our deduplicated task registry so the
 * app avoids hammering the API on slow networks while still warming critical
 * resources as soon as the device has bandwidth to spare.
 */
export function startCriticalPrefetch(): void {
    if (hasStarted || typeof window === 'undefined') {
        return;
    }

    if (!shouldPrefetch()) {
        return;
    }

    hasStarted = true;
    runWhenIdle(() => {
        prefetchMediaAssets();
        void Promise.allSettled([
            ...prefetchRoutes(),
            ...prefetchDataResources(),
        ]);
    });
}

export function warmCriticalRoutes(slugs: AppRouteSlug[]): void {
    const uniqueSlugs = slugs.filter(slug => CRITICAL_ROUTE_SLUGS.includes(slug));
    if (!uniqueSlugs.length) {
        return;
    }

    void Promise.allSettled(uniqueSlugs.map(slug => prefetchRouteBySlug(slug)));
}

/**
 * Prefetches data for an anticipated route without eagerly fetching every
 * critical payload. Intended for hover/focus events on navigation links so the
 * next screen can render faster while avoiding duplicated requests.
 */
export function prefetchPredictedRoute(slug: AppRouteSlug): void {
    if (!shouldPrefetch()) {
        return;
    }

    void Promise.allSettled([
        ...prefetchPredictiveTasks(slug),
        prefetchRouteBySlug(slug),
    ]);
}
