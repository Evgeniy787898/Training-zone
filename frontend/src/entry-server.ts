import { renderToString } from 'vue/server-renderer';
import { createApplication } from '@/features/core/createApp';

type SSRManifest = Record<string, string[]>;

const renderPreloadLinks = (modules: Set<string> | undefined, manifest?: SSRManifest): string => {
    if (!modules || !manifest) return '';

    let links = '';
    const seen = new Set<string>();

    for (const id of modules) {
        const files = manifest[id];
        if (!files) continue;

        for (const file of files) {
            if (seen.has(file)) continue;
            seen.add(file);

            if (file.endsWith('.js')) {
                links += `<link rel="modulepreload" crossorigin href="${file}">`;
            } else if (file.endsWith('.css')) {
                links += `<link rel="stylesheet" href="${file}">`;
            } else if (file.endsWith('.woff2')) {
                links += `<link rel="preload" href="${file}" as="font" type="font/woff2" crossorigin>`;
            } else if (file.endsWith('.woff')) {
                links += `<link rel="preload" href="${file}" as="font" type="font/woff" crossorigin>`;
            }
        }
    }

    return links;
};

export const render = async (url: string, manifest?: SSRManifest) => {
    const { app, router, pinia } = createApplication(true);

    await router.push(url);
    await router.isReady();

    const ctx: Record<string, any> = {};
    const html = await renderToString(app, ctx);
    const state = pinia.state.value;
    const preloadLinks = renderPreloadLinks(ctx.modules as Set<string> | undefined, manifest);

    return { html, state, preloadLinks };
};
