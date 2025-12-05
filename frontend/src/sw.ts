/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

type RouteMatchContext = {
    request: Request;
    url: URL;
};

const BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/') || '/';
const offlineUrl = `${BASE_URL}offline.html`;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

const manifestEntries = self.__WB_MANIFEST ?? [];
precacheAndRoute([
    ...manifestEntries,
    { url: offlineUrl, revision: '1' },
]);

const pageCache = new NetworkFirst({
    cacheName: 'tzona-pages-v1',
    networkTimeoutSeconds: 5,
    plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 32, purgeOnQuotaError: true }),
    ],
});

const assetCache = new StaleWhileRevalidate({
    cacheName: 'tzona-assets-v1',
    plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 64, purgeOnQuotaError: true }),
    ],
});

const apiCache = new NetworkFirst({
    cacheName: 'tzona-api-v1',
    networkTimeoutSeconds: 10,
    plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 10, purgeOnQuotaError: true }),
    ],
});

registerRoute(({ request }: RouteMatchContext) => request.mode === 'navigate', pageCache);

registerRoute(
    ({ request }: RouteMatchContext) => ['style', 'script', 'font', 'worker'].includes(request.destination),
    assetCache,
);

registerRoute(
    ({ url, request }: RouteMatchContext) => url.pathname.startsWith('/api/') && request.method === 'GET',
    apiCache,
);

registerRoute(
    ({ request }: RouteMatchContext) => request.destination === 'image',
    new CacheFirst({
        cacheName: 'tzona-images-v1',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7, purgeOnQuotaError: true }),
        ],
    }),
);

setCatchHandler(async ({ event }: { event: FetchEvent }) => {
    const fetchEvent = event as FetchEvent;
    if (fetchEvent.request.destination === 'document') {
        const cached = await caches.match(offlineUrl);
        if (cached) {
            return cached;
        }
    }

    return Response.error();
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
