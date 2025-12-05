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
    { path: '/:pathMatch(.*)*', redirect: '/today' },
];

export const createAppRouter = (ssr = false): Router => {
    return createRouter({
        history: ssr ? createMemoryHistory() : createWebHistory(),
        routes,
    });
};

export default createAppRouter();
