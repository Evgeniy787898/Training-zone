import type { Profile } from '@prisma/client';
import type { ProfileRepository } from './profile.repository.js';
import type { AuditService } from '../modules/security/audit.service.js';

export class ProfileService {
    constructor(
        private readonly profileRepository: ProfileRepository,
        private readonly auditService: AuditService
    ) { }

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
            await this.auditService.log('PROFILE_UPDATE', profile.id, 'SUCCESS', {
                metadata: { action: 'create_profile', method: 'telegram' }
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
                await this.auditService.log('PROFILE_UPDATE', profile.id, 'SUCCESS', {
                    metadata: { action: 'update_profile', fields: Object.keys(updates) }
                });
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
            await this.auditService.log('PROFILE_UPDATE', webProfile.id, 'SUCCESS', {
                metadata: { action: 'create_web_profile' }
            });
        } else {
            webProfile = await this.profileRepository.update(webProfile.id, {
                pinHash,
                pinUpdatedAt: new Date(),
            });
            await this.auditService.log('PIN_CHANGE', webProfile.id, 'SUCCESS', {
                metadata: { action: 'update_web_pin' }
            });
        }

        return webProfile;
    }

    async updatePin(profileId: string, pinHash: string): Promise<Profile> {
        const result = await this.profileRepository.update(profileId, {
            pinHash,
            pinUpdatedAt: new Date(),
        });
        await this.auditService.log('PIN_CHANGE', profileId, 'SUCCESS', {});
        return result;
    }

    async updatePreferences(id: string, data: {
        preferences?: any;
        notificationTime?: Date | string | null;
        timezone?: string | null;
        notificationsPaused?: boolean | null;
    }): Promise<Profile> {
        const result = await this.profileRepository.update(id, data as any);
        await this.auditService.log('PROFILE_UPDATE', id, 'SUCCESS', {
            metadata: { action: 'update_preferences', fields: Object.keys(data) }
        });
        return result;
    }

    async getProfilePreferences(id: string): Promise<{ preferences: any } | null> {
        const profile = await this.profileRepository.findById(id);
        if (!profile) return null;
        return { preferences: profile.preferences };
    }
}
