import type { PrismaClient } from '@prisma/client';
import { ProfileRepository, ProfileService } from '../modules/profile/index.js';
import { SessionRepository, SessionService } from '../modules/sessions/index.js';
import { ExerciseRepository, ExerciseService } from '../modules/exercises/index.js';
import { UserProgramRepository, UserProgramService } from '../modules/userPrograms/index.js';

export interface ServiceContainer {
    profileRepository: ProfileRepository;
    profileService: ProfileService;
    sessionRepository: SessionRepository;
    sessionService: SessionService;
    exerciseRepository: ExerciseRepository;
    exerciseService: ExerciseService;
    userProgramRepository: UserProgramRepository;
    userProgramService: UserProgramService;
}

export function setupServices(prisma: PrismaClient): ServiceContainer {
    const profileRepository = new ProfileRepository(prisma);
    const profileService = new ProfileService(profileRepository);

    const sessionRepository = new SessionRepository(prisma);
    const sessionService = new SessionService(sessionRepository);

    const exerciseRepository = new ExerciseRepository(prisma);
    const exerciseService = new ExerciseService(exerciseRepository);

    const userProgramRepository = new UserProgramRepository(prisma);
    const userProgramService = new UserProgramService(userProgramRepository);

    return {
        profileRepository,
        profileService,
        sessionRepository,
        sessionService,
        exerciseRepository,
        exerciseService,
        userProgramRepository,
        userProgramService,
    };
}
