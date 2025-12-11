import { createRouter, createWebHistory, createMemoryHistory, type Router } from 'vue-router';
import { createLazyRoute } from './lazyRoutes';

const exercisesPage = createLazyRoute(() => import('@/pages/ExercisesPage.vue'));

const lazyPages = {
    today: createLazyRoute(() => import('@/pages/TodayPage.vue')),
    exercises: exercisesPage,
    programs: exercisesPage,
    settings: createLazyRoute(() => import('@/pages/SettingsPage.vue')),
    progress: createLazyRoute(() => import('@/pages/ProgressPage.vue')),
    report: createLazyRoute(() => import('@/pages/ReportPage.vue')),
    library: createLazyRoute(() => import('@/pages/LibraryPage.vue')),
    week: createLazyRoute(() => import('@/pages/WeekPlanPage.vue')),
    history: createLazyRoute(() => import('@/pages/HistoryPage.vue')),
    progressPhotos: createLazyRoute(() => import('@/pages/ProgressPhotosPage.vue')),
    evolution: createLazyRoute(() => import('@/pages/EvolutionPage.vue')),
    onboarding: createLazyRoute(() => import('@/pages/OnboardingPage.vue')),
} as const;

export type AppRouteSlug = keyof typeof lazyPages;

export const prefetchRouteBySlug = (slug: AppRouteSlug) => {
    return lazyPages[slug]?.preload() ?? Promise.resolve();
};

export const routes = [
    { path: '/', redirect: '/today' },
    { path: '/today', name: 'Today', component: lazyPages.today.component, meta: { slug: 'today' satisfies AppRouteSlug } },
    { path: '/exercises', name: 'Exercises', component: lazyPages.exercises.component, meta: { slug: 'exercises' satisfies AppRouteSlug } },
    { path: '/programs', name: 'Programs', component: lazyPages.programs.component, meta: { slug: 'programs' satisfies AppRouteSlug } },
    { path: '/settings', name: 'Settings', component: lazyPages.settings.component, meta: { slug: 'settings' satisfies AppRouteSlug } },
    { path: '/progress', name: 'Progress', component: lazyPages.progress.component, meta: { slug: 'progress' satisfies AppRouteSlug } },
    { path: '/report', name: 'Report', component: lazyPages.report.component, meta: { slug: 'report' satisfies AppRouteSlug } },
    { path: '/library', name: 'Library', component: lazyPages.library.component, meta: { slug: 'library' satisfies AppRouteSlug } },
    { path: '/week', name: 'Week', component: lazyPages.week.component, meta: { slug: 'week' satisfies AppRouteSlug } },
    { path: '/history', name: 'History', component: lazyPages.history.component, meta: { slug: 'history' satisfies AppRouteSlug } },
    { path: '/progress-photos', name: 'ProgressPhotos', component: lazyPages.progressPhotos.component, meta: { slug: 'progressPhotos' satisfies AppRouteSlug } },
    { path: '/evolution', name: 'Evolution', component: lazyPages.evolution.component, meta: { slug: 'evolution' satisfies AppRouteSlug } },
    { path: '/digital-lab', redirect: '/evolution' }, // Redirect from old path
    { path: '/onboarding', name: 'Onboarding', component: lazyPages.onboarding.component, meta: { slug: 'onboarding' satisfies AppRouteSlug } },
    { path: '/:pathMatch(.*)*', redirect: '/today' },
];

export const createAppRouter = (ssr = false): Router => {
    return createRouter({
        history: ssr ? createMemoryHistory() : createWebHistory(),
        routes,
    });
};

export default createAppRouter();
