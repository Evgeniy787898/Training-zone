import type { Profile } from '@prisma/client';
import type { ProfileRepository } from './profile.repository.js';

export class ProfileService {
    constructor(private readonly profileRepository: ProfileRepository) { }

    async getOrCreateProfileByTelegram(
        telegramId: bigint,
        userData: { firstName?: string; lastName?: string }
    ): Promise<Profile> {
        let profile = await this.profileRepository.findByTelegramId(telegramId);

        if (!profile) {
            profile = await this.profileRepository.create({
                telegramId,
                firstName: userData.firstName ?? null,
                lastName: userData.lastName ?? null,
            });
        } else {
            const updates: { firstName?: string; lastName?: string } = {};
            if (userData.firstName && profile.firstName !== userData.firstName) {
                updates.firstName = userData.firstName;
            }
            if (userData.lastName && profile.lastName !== userData.lastName) {
                updates.lastName = userData.lastName;
            }

            if (Object.keys(updates).length > 0) {
                profile = await this.profileRepository.update(profile.id, updates);
            }
        }

        return profile;
    }

    async getProfileById(id: string): Promise<Profile | null> {
        return this.profileRepository.findById(id);
    }

    async getProfileByTelegramId(telegramId: bigint): Promise<Profile | null> {
        return this.profileRepository.findByTelegramId(telegramId);
    }

    async findProfileByPinHash(pinHash: string): Promise<Profile | null> {
        return this.profileRepository.findByPinHash(pinHash);
    }

    async createWebProfile(pinHash: string): Promise<Profile> {
        // Special ID for web version, or we rely on auto-increment/uuid if telegramId is optional?
        // In auth.ts it used BigInt(-1)
        const webTelegramId = BigInt(-1);

        let webProfile = await this.profileRepository.findByTelegramId(webTelegramId);

        if (!webProfile) {
            webProfile = await this.profileRepository.create({
                telegramId: webTelegramId,
                pinHash,
                pinUpdatedAt: new Date(),
            });
        } else {
            webProfile = await this.profileRepository.update(webProfile.id, {
                pinHash,
                pinUpdatedAt: new Date(),
            });
        }

        return webProfile;
    }

    async updatePin(profileId: string, pinHash: string): Promise<Profile> {
        return this.profileRepository.update(profileId, {
            pinHash,
            pinUpdatedAt: new Date(),
        });
    }

    async updatePreferences(id: string, data: {
        preferences?: any;
        notificationTime?: Date | string | null;
        timezone?: string | null;
        notificationsPaused?: boolean | null;
    }): Promise<Profile> {
        return this.profileRepository.update(id, data as any);
    }

    async getProfilePreferences(id: string): Promise<{ preferences: any } | null> {
        const profile = await this.profileRepository.findById(id);
        if (!profile) return null;
        return { preferences: profile.preferences };
    }
}
