import { createApplication } from '@/features/core/createApp';
import { scheduleAfterFirstPaint } from '@/features/core/firstRender';
import { initMotionPreferences } from '@/features/core/motion';
import { scheduleWarmup } from '@/features/core/prefetch';
import { initServiceWorker } from '@/features/core/serviceWorker';
import { initTelegramAuth } from '@/features/core/telegram';

declare const __CDN_ORIGIN__: string;

function ensureCdnHints(): void {
    if (typeof document === 'undefined') {
        return;
    }

    const origin = typeof __CDN_ORIGIN__ === 'string' ? __CDN_ORIGIN__.trim() : '';
    if (!origin || origin === '/' || origin === '.' || !/^https?:\/\//.test(origin)) {
        return;
    }

    const createHint = (rel: string, options: { crossOrigin?: string } = {}) => {
        const hintKey = `${rel}:${origin}`;
        if (document.head.querySelector(`link[rel="${rel}"][data-cdn-origin="${hintKey}"]`)) {
            return;
        }

        const link = document.createElement('link');
        link.rel = rel;
        link.href = origin;
        link.dataset.cdnOrigin = hintKey;
        if (options.crossOrigin) {
            link.crossOrigin = options.crossOrigin;
        }
        document.head.appendChild(link);
    };

    createHint('preconnect', { crossOrigin: 'anonymous' });
    createHint('dns-prefetch');
}

export const bootstrap = async () => {
    // Initialize basic theme system ASAP (light/dark mode)
    const { useTheme } = await import('@/composables/useTheme');
    const { initializeTheme } = useTheme();
    initializeTheme();

    window.addEventListener('unhandledrejection', (event) => {
        import('@/services/errorHandler').then(({ default: ErrorHandler }) => {
            // Don't show toast for some common non-critical rejections if needed
            ErrorHandler.handleWithToast(event.reason, 'Unhandled Promise Rejection');
        });
    });

    const initialState = window.__PINIA_INITIAL_STATE__ ?? {};
    const { app, pinia, router } = createApplication(false, initialState);

    // Initialize app store theme (custom accent colors) BEFORE mounting
    // This ensures PinScreen gets the correct accent color
    const { useAppStore } = await import('@/stores/app');
    const appStore = useAppStore(pinia);
    appStore.initializeTheme();

    initMotionPreferences();
    ensureCdnHints();

    // Don't block app mount on Telegram auth - let it run in background
    // This is critical for mobile performance
    initTelegramAuth(pinia).catch((e) => {
        console.warn('[Telegram Auth] Background init failed:', e);
    });

    await router.isReady();

    app.mount('#app');

    // Re-apply theme AFTER mount to ensure CSS vars take priority over any component CSS
    // that was loaded during mounting
    import('vue').then(({ nextTick }) => {
        nextTick(() => {
            appStore.initializeTheme();
            console.log('[entry-client] Re-applied theme after mount');
        });
    });

    delete window.__PINIA_INITIAL_STATE__;

    scheduleAfterFirstPaint(() => {
        scheduleWarmup(router);
        void initServiceWorker();

        // Web Vitals не должны попадать в основной бандл: подтягиваем их лениво
        if ('performance' in window) {
            void import('@/features/observability/webVitals').then((mod) => mod.initWebVitals());
        }
    });
};
