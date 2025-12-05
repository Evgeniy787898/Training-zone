import { env } from '@/config/env';

const rawBase = env.VITE_STATIC_CDN_BASE || env.VITE_ASSET_BASE || env.BASE_URL || '/';

const normalizeBase = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '/') {
        return '';
    }

    return trimmed.replace(/\/+$/u, '');
};

const normalizedBase = normalizeBase(rawBase);

export const staticAssetBase = normalizedBase || '/';

export function buildStaticAssetUrl(path: string): string {
    const cleaned = path.startsWith('/') ? path.slice(1) : path;
    if (!cleaned) {
        return staticAssetBase === '/' ? '/' : `${staticAssetBase}/`;
    }

    if (!normalizedBase) {
        return `/${cleaned}`;
    }

    return `${normalizedBase}/${cleaned}`;
}
