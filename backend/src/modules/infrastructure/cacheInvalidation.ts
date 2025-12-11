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

/**
 * Полная очистка всех кешей пользователя (для SETTINGS-003)
 */
export async function invalidateAllUserCaches(profileId: string): Promise<{
    invalidated: string[];
    timestamp: string;
}> {
    const invalidated: string[] = [];

    await invalidateProfileSummaryCache(profileId);
    invalidated.push('profileSummary');

    await invalidateReportsCache(profileId);
    invalidated.push('reports');

    await invalidateExerciseCatalogCache(profileId);
    invalidated.push('exerciseCatalog');

    await invalidateAssistantNotesCache(profileId);
    invalidated.push('assistantNotes');

    return {
        invalidated,
        timestamp: new Date().toISOString(),
    };
}
