import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p) => resolve(__dirname, '..', p);

const routesToPrerender = ['/', '/today', '/exercises', '/progress'];

const serializeState = (state) => {
    return JSON.stringify(state ?? {}).replace(/</g, '\\u003c');
};

const buildPage = (template, { html, preloadLinks, state }) => {
    const stateScript = `<script>window.__PINIA_INITIAL_STATE__=${serializeState(state)};</script>`;

    return template
        .replace('<!--preload-links-->', preloadLinks ?? '')
        .replace('<!--app-html-->', html ?? '')
        .replace('<!--pinia-state-->', stateScript);
};

const ensureDir = async (path) => {
    await mkdir(path, { recursive: true });
};

const writePrerenderedPage = async (url, content) => {
    const normalized = url === '/' ? '' : url.replace(/^\/+/, '');
    const targetDir = normalized ? toAbsolute(join('../dist', normalized)) : toAbsolute('../dist');
    await ensureDir(targetDir);
    await writeFile(resolve(targetDir, 'index.html'), content, 'utf-8');
};

const run = async () => {
    const template = await readFile(toAbsolute('../dist/index.html'), 'utf-8');
    const manifest = JSON.parse(await readFile(toAbsolute('../dist/ssr-manifest.json'), 'utf-8'));
    const { render } = await import(toAbsolute('../dist-ssr/entry-server.mjs'));

    for (const url of routesToPrerender) {
        const result = await render(url, manifest);
        const html = buildPage(template, result);
        await writePrerenderedPage(url, html);
    }
};

run().catch((error) => {
    console.error('[prerender] Failed to prerender routes', error);
    process.exit(1);
});
