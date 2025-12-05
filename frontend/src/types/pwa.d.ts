declare module 'virtual:pwa-register' {
    interface RegisterSWOptions {
        immediate?: boolean;
        onNeedRefresh?: () => void;
        onOfflineReady?: () => void;
        onRegistered?: (registration?: ServiceWorkerRegistration | undefined) => void;
        onRegisterError?: (error: Error) => void;
    }

    export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

declare module 'workbox-core' {
    export function clientsClaim(): void;
}

declare module 'workbox-precaching' {
    export function cleanupOutdatedCaches(): void;
    export function precacheAndRoute(entries: Array<{ url: string; revision?: string | null }>, options?: any): void;
}

declare module 'workbox-routing' {
    type MatchCallback = (context: { url: URL; request: Request }) => boolean;
    type Handler = any;
    export function registerRoute(match: MatchCallback, handler: Handler): void;
    export function setCatchHandler(handler: (options: { event: FetchEvent }) => Promise<Response>): void;
}

declare module 'workbox-strategies' {
    export class NetworkFirst {
        constructor(options?: any);
    }
    export class StaleWhileRevalidate {
        constructor(options?: any);
    }
    export class CacheFirst {
        constructor(options?: any);
    }
}

declare module 'workbox-expiration' {
    export class ExpirationPlugin {
        constructor(options?: any);
    }
}

declare module 'workbox-cacheable-response' {
    export class CacheableResponsePlugin {
        constructor(options?: any);
    }
}
