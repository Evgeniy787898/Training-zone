let registrationPromise: Promise<void> | null = null;

export function initServiceWorker(): Promise<void> | null {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return null;
    }

    // Disable Service Worker in dev mode when using ngrok (MIME type issues)
    if (import.meta.env.DEV) {
        const hostname = window.location.hostname;
        if (hostname.includes('ngrok-free.dev') || hostname.includes('ngrok.io')) {
            console.info('[sw] Service Worker disabled in dev mode via ngrok');
            return null;
        }
    }

    if (registrationPromise) {
        return registrationPromise;
    }

    registrationPromise = import('virtual:pwa-register')
        .then(({ registerSW }) => {
            const updateSW = registerSW({
                immediate: true,
                onOfflineReady() {
                    console.info('[sw] Offline cache is ready');
                },
                onNeedRefresh() {
                    updateSW(true).catch((error) => {
                        console.error('[sw] Failed to activate updated service worker', error);
                    });
                },
                onRegisterError(error) {
                    console.error('[sw] Registration error', error);
                },
            });
        })
        .catch((error) => {
            console.error('[sw] Failed to bootstrap service worker', error);
        });

    return registrationPromise;
}
