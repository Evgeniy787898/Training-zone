import { createApp as createClientApp, createSSRApp, type App as VueApp } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import App from '@/App.vue';
import { createAppRouter } from '@/router';
import '@/style.css';

type CreateAppResult = {
    app: VueApp;
    pinia: Pinia;
    router: ReturnType<typeof createAppRouter>;
};

export const createApplication = (ssr = false, initialState?: Record<string, any>): CreateAppResult => {
    const app = (ssr ? createSSRApp : createClientApp)(App);
    const pinia = createPinia();
    const router = createAppRouter(ssr);

    if (initialState) {
        pinia.state.value = { ...pinia.state.value, ...initialState };
    }

    app.use(pinia);
    app.use(router);

    // Global Error Handler
    app.config.errorHandler = (err, _instance, info) => {
        // Avoid infinite loops if ErrorHandler itself fails
        try {
            // Dynamically import to avoid circular dependencies if any
            import('@/services/errorHandler').then(({ default: ErrorHandler }) => {
                ErrorHandler.handleWithToast(err, `Vue: ${info}`);
            });
        } catch (e) {
            console.error('Failed to handle error:', e);
            console.error('Original error:', err);
        }
    };

    return { app, pinia, router };
};
