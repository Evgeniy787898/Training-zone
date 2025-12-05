import {
    invalidateCachedResource,
    bumpCachedResourceScope,
} from './cacheStrategy.js';

export async function invalidateProfileSummaryCache(profileId?: string | null): Promise<void> {
    if (!profileId) {
        return;
    }
    await invalidateCachedResource('profileSummary', { profileId });
}

export async function invalidateReportsCache(profileId?: string | null): Promise<void> {
    if (!profileId) {
        return;
    }
    await bumpCachedResourceScope('reports', { profileId });
}

export async function invalidateExerciseCatalogCache(profileId?: string | null): Promise<void> {
    await bumpCachedResourceScope('exerciseCatalog', { profileId: profileId ?? null });
}

export async function invalidateAssistantNotesCache(profileId?: string | null): Promise<void> {
    if (!profileId) {
        return;
    }
    await bumpCachedResourceScope('assistantNotesPage', { profileId });
}

export async function invalidateSessionDerivedCaches(profileId?: string | null): Promise<void> {
    if (!profileId) {
        return;
    }
    await invalidateReportsCache(profileId);
    await invalidateExerciseCatalogCache(profileId);
    await invalidateProfileSummaryCache(profileId);
}
