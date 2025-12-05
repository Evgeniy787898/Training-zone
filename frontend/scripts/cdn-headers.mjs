import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const manifestPath = path.join(distDir, 'manifest.json');

const hashedAssetPattern = /-[a-f0-9]{8,}\./i;

async function pathExists(target) {
    try {
        await fs.stat(target);
        return true;
    } catch {
        return false;
    }
}

async function collectDistFiles(directory, base = '') {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        if (entry.name.startsWith('.')) {
            continue;
        }
        const relative = path.posix.join(base, entry.name);
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            const nested = await collectDistFiles(absolute, relative);
            files.push(...nested);
        } else {
            files.push(relative);
        }
    }

    return files;
}

function normalisePath(file) {
    return `/${file.replace(/\\/g, '/')}`;
}

function buildHeadersBlock(targetPath, headerLines) {
    const lines = [targetPath];
    for (const line of headerLines) {
        lines.push(`  ${line}`);
    }
    lines.push('');
    return lines.join('\n');
}

async function generateHeaders() {
    if (!(await pathExists(distDir))) {
        console.warn('[cdn] dist directory is missing, skipping header generation');
        return;
    }

    const immutableFiles = new Set();
    const revalidateFiles = new Set();

    if (await pathExists(manifestPath)) {
        const rawManifest = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(rawManifest);
        Object.values(manifest).forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            if (entry.file) {
                immutableFiles.add(entry.file);
            }
            if (Array.isArray(entry.css)) {
                entry.css.forEach((cssFile) => immutableFiles.add(cssFile));
            }
            if (Array.isArray(entry.assets)) {
                entry.assets.forEach((assetFile) => immutableFiles.add(assetFile));
            }
        });
    }

    const distFiles = await collectDistFiles(distDir);
    for (const file of distFiles) {
        if (file.endsWith('.html')) {
            revalidateFiles.add(file);
            continue;
        }
        if (file.endsWith('_headers') || file.endsWith('cdn-manifest.json')) {
            continue;
        }
        if (file.endsWith('ssr-manifest.json') || file.endsWith('manifest.json')) {
            revalidateFiles.add(file);
            continue;
        }
        if (hashedAssetPattern.test(path.basename(file))) {
            immutableFiles.add(file);
            continue;
        }
        if (file.startsWith('assets/')) {
            immutableFiles.add(file);
            continue;
        }
        revalidateFiles.add(file);
    }

    const immutableList = Array.from(immutableFiles).sort();
    const revalidateList = Array.from(revalidateFiles).sort();

    const immutableHeaders = [
        'Cache-Control: public, max-age=31536000, immutable',
        'CDN-Cache-Control: public, max-age=31536000, immutable',
        'Edge-Cache-Tag: assets',
    ];

    const revalidateHeaders = [
        'Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400',
        'CDN-Cache-Control: public, max-age=60, stale-while-revalidate=86400',
        'Edge-Cache-Tag: html',
    ];

    const defaultHeaders = [
        'Cache-Control: public, max-age=30',
        'CDN-Cache-Control: public, max-age=30',
        'X-Content-Type-Options: nosniff',
    ];

    const headerSections = [];
    headerSections.push(buildHeadersBlock('/*', defaultHeaders));
    immutableList.forEach((file) => {
        headerSections.push(buildHeadersBlock(normalisePath(file), immutableHeaders));
    });
    revalidateList.forEach((file) => {
        headerSections.push(buildHeadersBlock(normalisePath(file), revalidateHeaders));
    });

    const headersPath = path.join(distDir, '_headers');
    await fs.writeFile(headersPath, `${headerSections.join('\n')}\n`, 'utf-8');

    const cdnManifest = {
        generatedAt: new Date().toISOString(),
        assetBase: process.env.VITE_STATIC_CDN_BASE || process.env.VITE_ASSET_BASE || '/',
        groups: {
            immutable: {
                ttlSeconds: 31536000,
                headers: immutableHeaders,
                paths: immutableList.map(normalisePath),
            },
            revalidate: {
                ttlSeconds: 60,
                staleWhileRevalidateSeconds: 86400,
                headers: revalidateHeaders,
                paths: revalidateList.map(normalisePath),
            },
            default: {
                ttlSeconds: 30,
                headers: defaultHeaders,
            },
        },
    };

    const cdnManifestPath = path.join(distDir, 'cdn-manifest.json');
    await fs.writeFile(cdnManifestPath, `${JSON.stringify(cdnManifest, null, 2)}\n`, 'utf-8');

    console.log('[cdn] Generated _headers and cdn-manifest.json');
}

generateHeaders().catch((error) => {
    console.error('[cdn] Failed to prepare edge headers', error);
    process.exit(1);
});
