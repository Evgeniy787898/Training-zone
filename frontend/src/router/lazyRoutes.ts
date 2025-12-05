import type { Component } from 'vue';

export interface LazyRouteHandle {
    component: () => Promise<Component>;
    preload: () => Promise<void>;
}

export type LazyRouteLoader = () => Promise<Component | { default: Component }>;

export function createLazyRoute(
    loader: LazyRouteLoader,
): LazyRouteHandle {
    let pendingLoad: Promise<Component | { default: Component }> | null = null;

    const resolveLoader = () => {
        if (!pendingLoad) {
            pendingLoad = loader();
        }
        return pendingLoad;
    };

    const componentLoader = async () => {
        const component = await resolveLoader();
        if (component && 'default' in component) {
            return component.default;
        }
        return component;
    };

    return {
        component: componentLoader,
        preload: async () => {
            try {
                await resolveLoader();
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.warn('[lazy-route] Prefetch failed', error);
                }
            }
        },
    };
}
