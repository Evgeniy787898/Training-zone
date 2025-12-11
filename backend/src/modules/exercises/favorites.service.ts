import type { FavoritesRepository } from './favorites.repository.js';

export class FavoritesService {
    constructor(private readonly repository: FavoritesRepository) { }

    async getFavorites(profileId: string): Promise<string[]> {
        return this.repository.getKeys(profileId);
    }

    async isFavorite(profileId: string, exerciseKey: string): Promise<boolean> {
        const favorite = await this.repository.findByProfileIdAndKey(profileId, exerciseKey);
        return favorite !== null;
    }

    async addFavorite(profileId: string, exerciseKey: string): Promise<{ added: boolean; exerciseKey: string }> {
        await this.repository.add(profileId, exerciseKey);
        return { added: true, exerciseKey };
    }

    async removeFavorite(profileId: string, exerciseKey: string): Promise<{ removed: boolean; exerciseKey: string }> {
        await this.repository.remove(profileId, exerciseKey);
        return { removed: true, exerciseKey };
    }

    async toggleFavorite(profileId: string, exerciseKey: string): Promise<{ isFavorite: boolean; exerciseKey: string }> {
        const exists = await this.isFavorite(profileId, exerciseKey);
        if (exists) {
            await this.removeFavorite(profileId, exerciseKey);
            return { isFavorite: false, exerciseKey };
        } else {
            await this.addFavorite(profileId, exerciseKey);
            return { isFavorite: true, exerciseKey };
        }
    }
}
