/**
 * Predictive UI Loading (FE-V01)
 * 
 * Analyzes user navigation patterns and preloads likely next routes.
 * Uses time-of-day and current page to predict behavior.
 */

import { ref, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';

// Navigation predictions based on current route and time
interface PredictionRule {
    currentRoute: string;
    timeRange?: { start: number; end: number }; // Hours (0-23)
    predictedRoutes: string[];
    probability: number; // 0-1
}

// Prediction rules based on user behavior patterns
const PREDICTION_RULES: PredictionRule[] = [
    // Morning: Today -> Exercises (starting workout)
    {
        currentRoute: '/today',
        timeRange: { start: 6, end: 12 },
        predictedRoutes: ['/exercises', '/week-plan'],
        probability: 0.8,
    },
    // Evening: Today -> Exercises -> Progress (workout + review)
    {
        currentRoute: '/today',
        timeRange: { start: 17, end: 22 },
        predictedRoutes: ['/exercises', '/progress'],
        probability: 0.85,
    },
    // After exercises -> Progress (check results)
    {
        currentRoute: '/exercises',
        predictedRoutes: ['/progress', '/settings'],
        probability: 0.7,
    },
    // Week plan -> Today (start training)
    {
        currentRoute: '/week-plan',
        predictedRoutes: ['/today', '/exercises'],
        probability: 0.75,
    },
    // Progress -> Evolution (body tracking)
    {
        currentRoute: '/progress',
        predictedRoutes: ['/evolution', '/settings'],
        probability: 0.6,
    },
    // Settings -> Today (back to main)
    {
        currentRoute: '/settings',
        predictedRoutes: ['/today'],
        probability: 0.8,
    },
];

// Track navigation history for pattern learning
const navigationHistory = ref<string[]>([]);
const MAX_HISTORY = 20;

/**
 * Get current hour (0-23)
 */
const getCurrentHour = (): number => new Date().getHours();

/**
 * Check if current time is within range
 */
const isInTimeRange = (range?: { start: number; end: number }): boolean => {
    if (!range) return true;
    const hour = getCurrentHour();
    if (range.start <= range.end) {
        return hour >= range.start && hour <= range.end;
    }
    // Handle overnight ranges (e.g., 22-6)
    return hour >= range.start || hour <= range.end;
};

/**
 * Get predicted routes for current page
 */
export const getPredictedRoutes = (currentPath: string): string[] => {
    const matchingRules = PREDICTION_RULES.filter(
        (rule) =>
            rule.currentRoute === currentPath &&
            isInTimeRange(rule.timeRange) &&
            rule.probability > 0.5
    );

    const predictedRoutes = new Set<string>();
    matchingRules
        .sort((a, b) => b.probability - a.probability)
        .forEach((rule) => {
            rule.predictedRoutes.forEach((route) => predictedRoutes.add(route));
        });

    return Array.from(predictedRoutes);
};

/**
 * Preload route component and data
 */
const preloadRoute = async (routePath: string): Promise<void> => {
    // Dynamic import of route components (Vite handles chunking)
    const routeModules: Record<string, () => Promise<any>> = {
        '/today': () => import('@/pages/TodayPage.vue'),
        '/exercises': () => import('@/pages/ExercisesPage.vue'),
        '/progress': () => import('@/pages/ProgressPage.vue'),
        '/week-plan': () => import('@/pages/WeekPlanPage.vue'),
        '/evolution': () => import('@/pages/EvolutionPage.vue'),
        '/settings': () => import('@/pages/SettingsPage.vue'),
    };

    const loader = routeModules[routePath];
    if (loader) {
        try {
            await loader();
            console.debug(`[predictive] Preloaded: ${routePath}`);
        } catch (error) {
            console.warn(`[predictive] Failed to preload: ${routePath}`, error);
        }
    }
};

/**
 * Vue composable for predictive loading
 */
export const usePredictivePreload = () => {
    const route = useRoute();
    let preloadTimeout: ReturnType<typeof setTimeout> | null = null;

    // Add current route to history
    const recordNavigation = (path: string) => {
        navigationHistory.value.push(path);
        if (navigationHistory.value.length > MAX_HISTORY) {
            navigationHistory.value.shift();
        }
    };

    // Preload predicted routes after a short delay
    const schedulePredictiveLoad = () => {
        if (preloadTimeout) {
            clearTimeout(preloadTimeout);
        }

        preloadTimeout = setTimeout(() => {
            const predicted = getPredictedRoutes(route.path);
            predicted.forEach((routePath) => {
                preloadRoute(routePath);
            });
        }, 500); // Wait 500ms before preloading
    };

    // Watch for route changes
    watch(
        () => route.path,
        (newPath) => {
            recordNavigation(newPath);
            schedulePredictiveLoad();
        },
        { immediate: true }
    );

    onUnmounted(() => {
        if (preloadTimeout) {
            clearTimeout(preloadTimeout);
        }
    });

    return {
        navigationHistory,
        getPredictedRoutes: () => getPredictedRoutes(route.path),
    };
};

export default {
    usePredictivePreload,
    getPredictedRoutes,
    preloadRoute,
};
