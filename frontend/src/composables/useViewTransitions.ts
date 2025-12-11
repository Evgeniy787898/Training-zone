/**
 * useViewTransitions - View Transitions API Integration (DS-002)
 * 
 * Provides smooth page-to-page transitions using the native View Transitions API.
 * Falls back gracefully on unsupported browsers.
 * 
 * @see https://developer.chrome.com/docs/web-platform/view-transitions/
 */

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

// Note: startViewTransition is defined in TypeScript's DOM lib.
// We just check for its existence at runtime.

const isSupported = ref(false);

export function useViewTransitions() {
    onMounted(() => {
        isSupported.value = typeof document.startViewTransition === 'function';
    });

    /**
     * Wraps a callback in a View Transition if supported.
     * Falls back to direct execution otherwise.
     */
    const withTransition = async (callback: () => Promise<void> | void): Promise<void> => {
        if (!isSupported.value || !document.startViewTransition) {
            await callback();
            return;
        }

        const transition = document.startViewTransition(callback);
        await transition.finished;
    };

    return {
        isSupported,
        withTransition,
    };
}

/**
 * Install View Transitions on Vue Router.
 * Call this once in your router setup.
 */
export function installViewTransitions() {
    const supported = typeof document !== 'undefined' &&
        typeof document.startViewTransition === 'function';

    if (!supported) {
        console.log('[ViewTransitions] Not supported in this browser, using fallback');
        return;
    }

    const router = useRouter();

    // Store the original push/replace methods
    const originalPush = router.push.bind(router);
    const originalReplace = router.replace.bind(router);

    // Override push with View Transition
    router.push = async (to) => {
        return new Promise((resolve, reject) => {
            document.startViewTransition!(() => {
                return originalPush(to).then(resolve).catch(reject);
            });
        });
    };

    // Override replace with View Transition
    router.replace = async (to) => {
        return new Promise((resolve, reject) => {
            document.startViewTransition!(() => {
                return originalReplace(to).then(resolve).catch(reject);
            });
        });
    };

    console.log('[ViewTransitions] Installed successfully');
}
