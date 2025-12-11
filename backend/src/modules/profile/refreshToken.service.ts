import crypto from 'crypto';
import type { RefreshTokenRepository } from './refreshToken.repository.js';
import { AppError } from '../../services/errors.js';
import { ERROR_CODES } from '../../types/errors.js';

export class RefreshTokenService {
    constructor(private readonly refreshTokenRepository: RefreshTokenRepository) { }

    private generateTokenString(): string {
        return crypto.randomBytes(40).toString('hex');
    }

    async createRefreshToken(profileId: string) {
        const token = this.generateTokenString();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

        const refreshToken = await this.refreshTokenRepository.create({
            token,
            profileId,
            expiresAt,
        });

        return refreshToken;
    }

    async verifyRefreshToken(token: string) {
        const refreshToken = await this.refreshTokenRepository.findByToken(token);

        if (!refreshToken) {
            throw new AppError({
                code: ERROR_CODES.INVALID_TOKEN,
                message: 'Invalid refresh token',
                statusCode: 401,
                category: 'authentication'
            });
        }

        if (refreshToken.revoked) {
            // Security: Potential token reuse. 
            // Ideally we should revoke ALL tokens for this user.
            await this.refreshTokenRepository.revokeAllForProfile(refreshToken.profileId);

            throw new AppError({
                code: ERROR_CODES.TOKEN_REVOKED,
                message: 'RefreshToken was revoked',
                statusCode: 401,
                category: 'authentication'
            });
        }

        if (refreshToken.expiresAt < new Date()) {
            throw new AppError({
                code: ERROR_CODES.TOKEN_EXPIRED,
                message: 'RefreshToken expired',
                statusCode: 401,
                category: 'authentication'
            });
        }

        return refreshToken;
    }

    async rotateRefreshToken(oldToken: string) {
        const refreshToken = await this.verifyRefreshToken(oldToken);

        // Revoke old
        await this.refreshTokenRepository.revoke(oldToken);

        // Issue new
        const newRefreshToken = await this.createRefreshToken(refreshToken.profileId);

        return {
            newRefreshToken,
            profileId: refreshToken.profileId
        };
    }

    async revoke(token: string) {
        return this.refreshTokenRepository.revoke(token);
    }
}
