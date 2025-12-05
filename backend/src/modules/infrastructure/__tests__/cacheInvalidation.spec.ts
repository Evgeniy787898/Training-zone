import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateCachedResourceMock = vi.fn();
const bumpCachedResourceScopeMock = vi.fn();

vi.mock('../cacheStrategy.js', () => ({
  invalidateCachedResource: (...args: unknown[]) => invalidateCachedResourceMock(...args),
  bumpCachedResourceScope: (...args: unknown[]) => bumpCachedResourceScopeMock(...args),
}));

describe('cacheInvalidation helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('invalidates profile summaries only when profileId is provided', async () => {
    const { invalidateProfileSummaryCache } = await import('../cacheInvalidation.js');

    await invalidateProfileSummaryCache('profile-42');
    await invalidateProfileSummaryCache(null);

    expect(invalidateCachedResourceMock).toHaveBeenCalledTimes(1);
    expect(invalidateCachedResourceMock).toHaveBeenCalledWith('profileSummary', { profileId: 'profile-42' });
  });

  it('bump-based invalidators pass through scoped params', async () => {
    const { invalidateReportsCache, invalidateExerciseCatalogCache, invalidateAssistantNotesCache } = await import(
      '../cacheInvalidation.js'
    );

    await invalidateReportsCache('p-1');
    await invalidateExerciseCatalogCache(undefined);
    await invalidateAssistantNotesCache('p-1');
    await invalidateAssistantNotesCache(null);

    expect(bumpCachedResourceScopeMock).toHaveBeenCalledWith('reports', { profileId: 'p-1' });
    expect(bumpCachedResourceScopeMock).toHaveBeenCalledWith('exerciseCatalog', { profileId: null });
    expect(bumpCachedResourceScopeMock).toHaveBeenCalledWith('assistantNotesPage', { profileId: 'p-1' });
  });

  it('session-derived invalidation chains cover reports, catalog, and summary', async () => {
    const { invalidateSessionDerivedCaches } = await import('../cacheInvalidation.js');

    await invalidateSessionDerivedCaches('profile-a');
    await invalidateSessionDerivedCaches(undefined);

    expect(bumpCachedResourceScopeMock).toHaveBeenCalledWith('reports', { profileId: 'profile-a' });
    expect(bumpCachedResourceScopeMock).toHaveBeenCalledWith('exerciseCatalog', { profileId: 'profile-a' });
    expect(invalidateCachedResourceMock).toHaveBeenCalledWith('profileSummary', { profileId: 'profile-a' });
  });
});
