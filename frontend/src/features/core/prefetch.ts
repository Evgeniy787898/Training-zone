import type { Router, RouteLocationRaw } from 'vue-router';

type WarmupTarget = RouteLocationRaw | (() => Promise<unknown>);

async function prefetchRouteComponent(router: Router, target: RouteLocationRaw): Promise<void> {
    const resolved = router.resolve(target);
    const components = resolved.matched
        .map((record) => record.components?.default)
        .filter((component): component is () => Promise<unknown> => typeof component === 'function');
    await Promise.allSettled(components.map((loader) => loader()));
}

export async function warmApplication(router: Router, targets: WarmupTarget[]): Promise<void> {
    await Promise.allSettled(
        targets.map(async (target) => {
            if (typeof target === 'function') {
                await target();
                return;
            }
            await prefetchRouteComponent(router, target);
        }),
    );
}

export function scheduleWarmup(router: Router): void {
    const targets: WarmupTarget[] = [
        '/exercises',
        '/progress',
        '/week',
    ];

    const run = () => {
        warmApplication(router, targets).catch((error) => {
            if (import.meta.env.DEV) {
                console.debug('[prefetch] warmup failed', error);
            }
        });
    };

    if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(run, { timeout: 4000 });
    } else {
        setTimeout(run, 1500);
    }
}
