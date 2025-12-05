import type { Prisma } from '@prisma/client';

export const achievementSummarySelect = {
    id: true,
    profileId: true,
    title: true,
    description: true,
    awardedAt: true,
    triggerSource: true,
} satisfies Prisma.AchievementSelect;

export const assistantNoteSummarySelect = {
    id: true,
    profileId: true,
    title: true,
    content: true,
    tags: true,
    source: true,
    metadata: true,
    createdAt: true,
} satisfies Prisma.AssistantNoteSelect;

export const exerciseCatalogSelect = {
    id: true,
    exerciseKey: true,
    title: true,
    focus: true,
    description: true,
    cue: true,
    programId: true,
    iconUrl: true,
    iconUrlHover: true,
} satisfies Prisma.ExerciseSelect;

export const exerciseLevelDetailedSelect = {
    id: true,
    exerciseKey: true,
    level: true,
    title: true,
    execution: true,
    technique: true,
    improvement: true,
    sets: true,
    reps: true,
    orderIndex: true,
    disciplineId: true,
    imageUrl: true,
    imageUrl2: true,
    imageUrl3: true,
    updatedAt: true,
} satisfies Prisma.ExerciseLevelSelect;

export const exerciseProgressWithSessionSelect = {
    id: true,
    exerciseKey: true,
    levelTarget: true,
    levelResult: true,
    volumeTarget: true,
    volumeActual: true,
    rpe: true,
    decision: true,
    notes: true,
    createdAt: true,
    session: {
        select: {
            plannedAt: true,
        },
    },
} satisfies Prisma.ExerciseProgressSelect;

export const trainingProgramSummarySelect = {
    id: true,
    disciplineId: true,
    name: true,
    description: true,
    frequency: true,
    restDay: true,
    programData: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.TrainingProgramSelect;

export const trainingDisciplineSummarySelect = {
    id: true,
    name: true,
    description: true,
    imageUrl: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.TrainingDisciplineSelect;

export const userTrainingProgramSummarySelect = {
    id: true,
    profileId: true,
    disciplineId: true,
    programId: true,
    initialLevels: true,
    currentLevels: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    discipline: {
        select: trainingDisciplineSummarySelect,
    },
    program: {
        select: trainingProgramSummarySelect,
    },
} satisfies Prisma.UserTrainingProgramSelect;

export const dailyAdviceSummarySelect = {
    id: true,
    adviceType: true,
    shortText: true,
    fullText: true,
    ideas: true,
    iconName: true,
    theme: true,
} satisfies Prisma.DailyAdviceSelect;

export const dailyAdviceSelectionWithAdviceSelect = {
    id: true,
    profileId: true,
    date: true,
    adviceId: true,
    selectedAt: true,
    advice: {
        select: dailyAdviceSummarySelect,
    },
} satisfies Prisma.DailyAdviceSelectionSelect;
