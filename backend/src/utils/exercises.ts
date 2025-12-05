import { buildExerciseLevelImageUrl, rewriteStoredAssetReference } from '../services/staticAssets.js';

const toDataUrl = (value: unknown): string | null => {
    if (!value) {
        return null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        if (trimmed.startsWith('data:')) {
            return trimmed;
        }
        if (trimmed.startsWith('\\x')) {
            return `data:image/jpeg;base64,${Buffer.from(trimmed.slice(2), 'hex').toString('base64')}`;
        }
        return `data:image/jpeg;base64,${trimmed}`;
    }
    if (value instanceof Buffer) {
        return `data:image/jpeg;base64,${value.toString('base64')}`;
    }
    if (value instanceof Uint8Array) {
        return `data:image/jpeg;base64,${Buffer.from(value).toString('base64')}`;
    }
    if (Array.isArray(value)) {
        return `data:image/jpeg;base64,${Buffer.from(value).toString('base64')}`;
    }
    return null;
};

const ensureString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};

export const collectLevelImages = (level: any, limit = 3): string[] => {
    if (!level) {
        return [];
    }

    const images: string[] = [];

    const pushUnique = (value: string | null) => {
        if (value && !images.includes(value)) {
            images.push(value);
        }
    };

    pushUnique(rewriteStoredAssetReference(ensureString(level.imageUrl)));
    pushUnique(rewriteStoredAssetReference(ensureString(level.imageUrl2)));
    pushUnique(rewriteStoredAssetReference(ensureString(level.imageUrl3)));

    return images.slice(0, limit);
};
