type Task = () => void;

/**
 * Schedules non-critical work to run after the first paint so hydration is not delayed.
 * Falls back to a timeout when requestIdleCallback is not available (e.g., older Safari).
 */
export function scheduleAfterFirstPaint(task: Task): void {
    if (typeof window === 'undefined') return;

    const invoke = () => {
        try {
            task();
        } catch (error) {
            // Non-critical work should never block rendering; swallow errors to avoid noisy logs
            console.error('Deferred task failed', error);
        }
    };

    if ('requestIdleCallback' in window) {
        (window as typeof window & { requestIdleCallback: typeof requestIdleCallback }).requestIdleCallback(invoke, {
            timeout: 1000,
        });
        return;
    }

    setTimeout(invoke, 0);
}
