import type { PrismaClient } from '@prisma/client';
import { ProfileRepository, ProfileService, RefreshTokenRepository, RefreshTokenService } from '../modules/profile/index.js';
import { SessionRepository, SessionService } from '../modules/sessions/index.js';
import { ExerciseRepository, ExerciseService } from '../modules/exercises/index.js';
import { FavoritesRepository } from '../modules/exercises/favorites.repository.js';
import { FavoritesService } from '../modules/exercises/favorites.service.js';
import { UserProgramRepository, UserProgramService } from '../modules/userPrograms/index.js';
import { ProgressPhotoRepository } from '../modules/progress/progressPhotoRepository.js';
import { ProgressPhotoService } from '../modules/progress/progressPhotoService.js';
import { BodyScanRepository } from '../modules/bodyScan/bodyScanRepository.js';
import { BodyScanService } from '../modules/bodyScan/bodyScanService.js';
import { EvolutionRepository, EvolutionService } from '../modules/evolution/index.js';
import { GeminiService } from '../services/gemini.js';
import { historyService } from '../services/historyService.js';

import { AuditService } from '../modules/security/index.js';

export interface ServiceContainer {
    profileRepository: ProfileRepository;
    profileService: ProfileService;
    refreshTokenRepository: RefreshTokenRepository;
    refreshTokenService: RefreshTokenService;
    sessionRepository: SessionRepository;
    sessionService: SessionService;
    exerciseRepository: ExerciseRepository;
    exerciseService: ExerciseService;
    favoritesRepository: FavoritesRepository;
    favoritesService: FavoritesService;
    userProgramRepository: UserProgramRepository;
    userProgramService: UserProgramService;
    progressPhotoRepository: ProgressPhotoRepository;
    progressPhotoService: ProgressPhotoService;
    bodyScanRepository: BodyScanRepository;
    bodyScanService: BodyScanService;
    evolutionRepository: EvolutionRepository;
    evolutionService: EvolutionService;
    geminiService: GeminiService;
    auditService: AuditService;
}

export function setupServices(prisma: PrismaClient): ServiceContainer {
    const profileRepository = new ProfileRepository(prisma);
    const auditService = new AuditService(prisma);
    const profileService = new ProfileService(profileRepository, auditService);
    const refreshTokenRepository = new RefreshTokenRepository(prisma);
    const refreshTokenService = new RefreshTokenService(refreshTokenRepository);

    const sessionRepository = new SessionRepository(prisma);
    // HistoryService is a singleton in this context for simplicity, or we check if we need to new it.
    // backend/src/services/historyService.ts exports `export const historyService = new HistoryService();`
    // and `export class HistoryService`.
    // I will use `new HistoryService()` if I can import the class, or cleaner: use the exported singleton if specific config isn't needed.
    // However, `servicesSetup.ts` manually instantiates.
    // Let's import the singleton/class.
    // I need to add import to the top of file first.
    const sessionService = new SessionService(sessionRepository);

    const exerciseRepository = new ExerciseRepository(prisma);
    const exerciseService = new ExerciseService(exerciseRepository);

    const favoritesRepository = new FavoritesRepository(prisma);
    const favoritesService = new FavoritesService(favoritesRepository);

    const userProgramRepository = new UserProgramRepository(prisma);
    const userProgramService = new UserProgramService(userProgramRepository);

    const progressPhotoRepository = new ProgressPhotoRepository(prisma);
    const progressPhotoService = new ProgressPhotoService(progressPhotoRepository);

    const geminiService = new GeminiService();
    const bodyScanRepository = new BodyScanRepository(prisma);
    const bodyScanService = new BodyScanService(bodyScanRepository, geminiService);

    const evolutionRepository = new EvolutionRepository(prisma);
    const evolutionService = new EvolutionService(evolutionRepository);

    return {
        profileRepository,
        profileService,
        refreshTokenRepository,
        refreshTokenService,
        sessionRepository,
        sessionService,
        exerciseRepository,
        exerciseService,
        favoritesRepository,
        favoritesService,
        userProgramRepository,
        userProgramService,
        progressPhotoRepository,
        progressPhotoService,
        bodyScanRepository,
        bodyScanService,
        evolutionRepository,
        evolutionService,
        geminiService,
        auditService,
    };
}
