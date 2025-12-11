import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefreshTokenService } from '../refreshToken.service.js';
import type { RefreshTokenRepository } from '../refreshToken.repository.js';
import { AppError } from '../../../services/errors.js';
import { ERROR_CODES } from '../../../types/errors.js';

describe('RefreshTokenService', () => {
    let service: RefreshTokenService;
    let repository: RefreshTokenRepository;

    const mockDate = new Date('2024-01-01T00:00:00Z');

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(mockDate);

        repository = {
            create: vi.fn(),
            findByToken: vi.fn(),
            findByProfileId: vi.fn(),
            revoke: vi.fn(),
            revokeAllForProfile: vi.fn(),
            deleteExpired: vi.fn(),
        } as unknown as RefreshTokenRepository;

        service = new RefreshTokenService(repository);
    });

    describe('createRefreshToken', () => {
        it('should create a refresh token with 30 days expiration', async () => {
            const profileId = 'test-profile-id';
            const expectedExpiresAt = new Date(mockDate);
            expectedExpiresAt.setDate(expectedExpiresAt.getDate() + 30);

            const mockToken = {
                id: 'test-id',
                token: 'generated-token',
                profileId,
                expiresAt: expectedExpiresAt,
                createdAt: mockDate,
                revoked: false,
            };

            vi.spyOn(repository, 'create').mockResolvedValue(mockToken);

            const result = await service.createRefreshToken(profileId);

            expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
                profileId,
                expiresAt: expectedExpiresAt,
            }));
            expect(result).toEqual(mockToken);
        });
    });

    describe('verifyRefreshToken', () => {
        it('should return token if valid', async () => {
            const mockToken = {
                id: 'test-id',
                token: 'valid-token',
                profileId: 'pid',
                expiresAt: new Date('2024-02-01'), // Future
                revoked: false,
                createdAt: mockDate,
            };
            vi.spyOn(repository, 'findByToken').mockResolvedValue(mockToken as any);

            const result = await service.verifyRefreshToken('valid-token');
            expect(result).toEqual(mockToken);
        });

        it('should throw INVALID_TOKEN if not found', async () => {
            vi.spyOn(repository, 'findByToken').mockResolvedValue(null);

            await expect(service.verifyRefreshToken('invalid')).rejects.toThrow(AppError);
            await expect(service.verifyRefreshToken('invalid')).rejects.toMatchObject({
                code: ERROR_CODES.INVALID_TOKEN
            });
        });

        it('should throw TOKEN_REVOKED if revoked', async () => {
            const mockToken = {
                id: 'test-id',
                token: 'revoked-token',
                profileId: 'pid',
                expiresAt: new Date('2024-02-01'),
                revoked: true,
                createdAt: mockDate,
            };
            vi.spyOn(repository, 'findByToken').mockResolvedValue(mockToken as any);

            await expect(service.verifyRefreshToken('revoked-token')).rejects.toMatchObject({
                code: ERROR_CODES.TOKEN_REVOKED
            });
            expect(repository.revokeAllForProfile).toHaveBeenCalledWith('pid');
        });

        it('should throw TOKEN_EXPIRED if expired', async () => {
            const mockToken = {
                id: 'test-id',
                token: 'expired-token',
                profileId: 'pid',
                expiresAt: new Date('2023-12-31'), // Past
                revoked: false,
                createdAt: mockDate,
            };
            vi.spyOn(repository, 'findByToken').mockResolvedValue(mockToken as any);

            await expect(service.verifyRefreshToken('expired-token')).rejects.toMatchObject({
                code: ERROR_CODES.TOKEN_EXPIRED
            });
        });
    });

    describe('rotateRefreshToken', () => {
        it('should rotate token successfully', async () => {
            const oldToken = 'old-token';
            const profileId = 'pid';
            const mockOldToken = {
                id: '1',
                token: oldToken,
                profileId,
                expiresAt: new Date('2024-02-01'),
                revoked: false,
            };

            const mockNewToken = {
                id: '2',
                token: 'new-token',
                profileId,
                expiresAt: new Date('2024-02-01'),
                revoked: false,
            };

            vi.spyOn(repository, 'findByToken').mockResolvedValue(mockOldToken as any);
            vi.spyOn(repository, 'revoke').mockResolvedValue(mockOldToken as any);
            vi.spyOn(repository, 'create').mockResolvedValue(mockNewToken as any);

            const result = await service.rotateRefreshToken(oldToken);

            expect(repository.revoke).toHaveBeenCalledWith(oldToken);
            expect(repository.create).toHaveBeenCalled();
            expect(result).toEqual({
                newRefreshToken: mockNewToken,
                profileId,
            });
        });
    });
});
