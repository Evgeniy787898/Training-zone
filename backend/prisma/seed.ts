import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_PROFILE_ID = '99900099-9999-4999-9999-999999999999';
const TEST_TELEGRAM_ID = 999000999n;

async function main() {
    console.log('🌱 Starting database seed...');

    // 1. Create test profile
    const profile = await prisma.profile.upsert({
        where: { id: TEST_PROFILE_ID },
        update: {},
        create: {
            id: TEST_PROFILE_ID,
            telegramId: TEST_TELEGRAM_ID,
            firstName: 'Test',
            lastName: 'User',
            timezone: 'Europe/Moscow',
            equipment: ['pull-up bar', 'resistance bands', 'dumbbells'],
            goals: { primary: 'Build strength', secondary: 'Improve flexibility' },
            preferences: { language: 'ru', aiTone: 'supportive' },
        },
    });
    console.log('✅ Created test profile:', profile.id);

    // 2. Create disciplines
    const calisthenics = await prisma.trainingDiscipline.upsert({
        where: { name: 'Calisthenics' },
        update: {},
        create: {
            name: 'Calisthenics',
            description: 'Bodyweight strength training',
            isActive: true,
        },
    });

    const running = await prisma.trainingDiscipline.upsert({
        where: { name: 'Running' },
        update: {},
        create: {
            name: 'Running',
            description: 'Cardiovascular endurance',
            isActive: true,
        },
    });

    const stretching = await prisma.trainingDiscipline.upsert({
        where: { name: 'Stretching' },
        update: {},
        create: {
            name: 'Stretching',
            description: 'Flexibility and mobility work',
            isActive: true,
        },
    });
    console.log('✅ Created 3 disciplines');

    // 3. Create exercises with progression levels
    const pushUpsExercise = await prisma.exercise.upsert({
        where: { exerciseKey: 'push-ups' },
        update: {},
        create: {
            exerciseKey: 'push-ups',
            title: 'Push-ups',
            focus: 'Chest, Triceps, Shoulders',
            description: 'Basic upper body push movement',
            cue: 'Keep core tight, elbows at 45 degrees',
        },
    });

    const pushUpsLevels = [
        { levelCode: 'floor', levelName: 'Floor Push-ups', reps: 5, sets: 3 },
        { levelCode: 'incline', levelName: 'Incline Push-ups', reps: 8, sets: 3 },
        { levelCode: 'knee', levelName: 'Knee Push-ups', reps: 10, sets: 3 },
        { levelCode: 'standard', levelName: 'Standard Push-ups', reps: 12, sets: 3 },
        { levelCode: 'wide', levelName: 'Wide Push-ups', reps: 10, sets: 3 },
        { levelCode: 'diamond', levelName: 'Diamond Push-ups', reps: 8, sets: 3 },
        { levelCode: 'archer', levelName: 'Archer Push-ups', reps: 6, sets: 3 },
        { levelCode: 'one-arm', levelName: 'One-Arm Push-ups', reps: 4, sets: 3 },
    ];

    for (const level of pushUpsLevels) {
        await prisma.exerciseLevel.upsert({
            where: {
                exerciseKey_level: {
                    exerciseKey: 'push-ups',
                    level: level.levelCode,
                },
            },
            update: {},
            create: {
                exerciseKey: 'push-ups',
                level: level.levelCode,
                title: level.levelName,
                reps: level.reps,
                sets: level.sets,
                disciplineId: calisthenics.id,
            },
        });
    }

    const pullUpsExercise = await prisma.exercise.upsert({
        where: { exerciseKey: 'pull-ups' },
        update: {},
        create: {
            exerciseKey: 'pull-ups',
            title: 'Pull-ups',
            focus: 'Back, Biceps',
            description: 'Vertical pulling movement',
            cue: 'Full range of motion, controlled descent',
        },
    });

    const pullUpsLevels = [
        { levelCode: 'assisted', levelName: 'Assisted Pull-ups', reps: 8, sets: 3 },
        { levelCode: 'negative', levelName: 'Negative Pull-ups', reps: 5, sets: 3 },
        { levelCode: 'standard', levelName: 'Standard Pull-ups', reps: 6, sets: 3 },
        { levelCode: 'wide', levelName: 'Wide Grip Pull-ups', reps: 5, sets: 3 },
        { levelCode: 'weighted', levelName: 'Weighted Pull-ups', reps: 4, sets: 3 },
        { levelCode: 'one-arm', levelName: 'One-Arm Pull-ups', reps: 2, sets: 3 },
    ];

    for (const level of pullUpsLevels) {
        await prisma.exerciseLevel.upsert({
            where: {
                exerciseKey_level: {
                    exerciseKey: 'pull-ups',
                    level: level.levelCode,
                },
            },
            update: {},
            create: {
                exerciseKey: 'pull-ups',
                level: level.levelCode,
                title: level.levelName,
                reps: level.reps,
                sets: level.sets,
                disciplineId: calisthenics.id,
            },
        });
    }

    const squatsExercise = await prisma.exercise.upsert({
        where: { exerciseKey: 'squats' },
        update: {},
        create: {
            exerciseKey: 'squats',
            title: 'Squats',
            focus: 'Legs, Glutes',
            description: 'Fundamental lower body movement',
            cue: 'Knees track over toes, sit back into hips',
        },
    });

    const squatsLevels = [
        { levelCode: 'bodyweight', levelName: 'Bodyweight Squats', reps: 15, sets: 3 },
        { levelCode: 'goblet', levelName: 'Goblet Squats', reps: 12, sets: 3 },
        { levelCode: 'pistol-assisted', levelName: 'Assisted Pistol Squats', reps: 5, sets: 3 },
        { levelCode: 'pistol', levelName: 'Pistol Squats', reps: 8, sets: 3 },
    ];

    for (const level of squatsLevels) {
        await prisma.exerciseLevel.upsert({
            where: {
                exerciseKey_level: {
                    exerciseKey: 'squats',
                    level: level.levelCode,
                },
            },
            update: {},
            create: {
                exerciseKey: 'squats',
                level: level.levelCode,
                title: level.levelName,
                reps: level.reps,
                sets: level.sets,
                disciplineId: calisthenics.id,
            },
        });
    }

    const plankExercise = await prisma.exercise.upsert({
        where: { exerciseKey: 'plank' },
        update: {},
        create: {
            exerciseKey: 'plank',
            title: 'Plank',
            focus: 'Core',
            description: 'Isometric core hold',
            cue: 'Straight line from head to heels, engage glutes',
        },
    });

    await prisma.exerciseLevel.upsert({
        where: {
            exerciseKey_level: {
                exerciseKey: 'plank',
                level: 'standard',
            },
        },
        update: {},
        create: {
            exerciseKey: 'plank',
            level: 'standard',
            title: 'Standard Plank',
            sets: 3,
            execution: '60 seconds hold',
            disciplineId: calisthenics.id,
        },
    });

    console.log('✅ Created 4 exercises with progression levels');

    // 4. Create training programs
    const fullBodyProgram = await prisma.trainingProgram.upsert({
        where: { name: 'Full Body Strength' },
        update: {},
        create: {
            name: 'Full Body Strength',
            description: 'Complete bodyweight workout covering all major muscle groups',
            disciplineId: calisthenics.id,
            frequency: 3,
            restDay: 'Sunday',
            isActive: true,
            programData: {
                exercises: [
                    { exerciseKey: 'push-ups', levelCode: 'standard', order: 1 },
                    { exerciseKey: 'pull-ups', levelCode: 'standard', order: 2 },
                    { exerciseKey: 'squats', levelCode: 'bodyweight', order: 3 },
                    { exerciseKey: 'plank', levelCode: 'standard', order: 4 },
                ],
            },
        },
    });

    const upperBodyProgram = await prisma.trainingProgram.upsert({
        where: { name: 'Upper Body Focus' },
        update: {},
        create: {
            name: 'Upper Body Focus',
            description: 'Intensive upper body strength development',
            disciplineId: calisthenics.id,
            frequency: 4,
            restDay: 'Wednesday',
            isActive: true,
            programData: {
                exercises: [
                    { exerciseKey: 'push-ups', levelCode: 'diamond', order: 1 },
                    { exerciseKey: 'pull-ups', levelCode: 'wide', order: 2 },
                    { exerciseKey: 'plank', levelCode: 'standard', order: 3 },
                ],
            },
        },
    });

    console.log('✅ Created 2 training programs');

    // 5. Generate 30 days of training history
    const now = new Date();
    const sessionsCreated = [];

    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
        const plannedDate = new Date(now);
        plannedDate.setDate(plannedDate.getDate() - daysAgo);
        plannedDate.setHours(10, 0, 0, 0);

        // 80% completion rate
        const isCompleted = Math.random() < 0.8;
        const status = isCompleted ? 'done' : (daysAgo === 0 ? 'planned' : 'skipped');

        const session = await prisma.trainingSession.create({
            data: {
                profileId: TEST_PROFILE_ID,
                plannedAt: plannedDate,
                status,
                disciplineId: calisthenics.id,
                programId: daysAgo % 2 === 0 ? fullBodyProgram.id : upperBodyProgram.id,
                notes: isCompleted ? 'Good session' : undefined,
            },
        });

        sessionsCreated.push(session);

        if (isCompleted) {
            // Add exercise progress for completed sessions
            const exercises = ['push-ups', 'pull-ups', 'squats', 'plank'];
            const currentExercise = exercises[daysAgo % exercises.length];

            await prisma.exerciseProgress.create({
                data: {
                    sessionId: session.id,
                    profileId: TEST_PROFILE_ID,
                    exerciseKey: currentExercise,
                    levelTarget: 'standard',
                    levelResult: 'standard',
                    volumeTarget: 36,
                    volumeActual: 30 + Math.floor(Math.random() * 12),
                    rpe: (6 + Math.random() * 3).toFixed(1),
                    decision: 'maintain',
                    streakSuccess: Math.floor(Math.random() * 5),
                    notes: 'Felt strong',
                },
            });
        }
    }

    console.log(`✅ Created ${sessionsCreated.length} training sessions (30 days)`);

    // 6. Add a few achievements
    await prisma.achievement.create({
        data: {
            profileId: TEST_PROFILE_ID,
            title: 'First Workout Complete',
            description: 'Completed your first training session',
            triggerSource: 'auto',
        },
    });

    await prisma.achievement.create({
        data: {
            profileId: TEST_PROFILE_ID,
            title: 'Week Warrior',
            description: 'Completed 7 consecutive days',
            triggerSource: 'auto',
            awardedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
    });

    console.log('✅ Created 2 achievements');

    console.log('🎉 Database seeding completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`- Test Profile ID: ${TEST_PROFILE_ID}`);
    console.log(`- Telegram ID: ${TEST_TELEGRAM_ID}`);
    console.log(`- Disciplines: 3`);
    console.log(`- Exercises: 4 (with progression levels)`);
    console.log(`- Programs: 2`);
    console.log(`- Training Sessions: ${sessionsCreated.length}`);
    console.log(`- Achievements: 2`);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
