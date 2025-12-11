import { defineAsyncComponent } from 'vue';

export interface LazyComponentOptions {
    /** Delay in ms before showing the loading state. Defaults to 50ms to avoid flashes. */
    delay?: number;
    /** Number of retry attempts if the dynamic import fails. Defaults to 2 retries. */
    maxRetries?: number;
    /** Allow callers to react to loader errors (e.g., monitoring). */
    onError?: (error: unknown) => void;
    /** Whether Vue should suspend while waiting for the component. Defaults to false for drop-in usage. */
    suspensible?: boolean;
}

export function createLazyComponent(
    loader: () => Promise<any>,
    {
        delay = 50,
        maxRetries = 2,
        onError,
        suspensible = false,
    }: LazyComponentOptions = {}
) {
    return defineAsyncComponent({
        loader: async () => {
            try {
                const component = await loader();
                if (component && 'default' in component) {
                    return component.default;
                }
                return component;
            } catch (error) {
                onError?.(error);
                throw error;
            }
        },
        delay,
        // No timeout - components will wait indefinitely instead of throwing errors
        suspensible,
        onError(error, retry, fail, attempts) {
            onError?.(error);
            if (attempts <= maxRetries) {
                retry();
                return;
            }
            fail();
        },
    });
}
