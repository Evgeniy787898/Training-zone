import type {
    Achievement,
    AssistantNote,
    DailyAdvice,
    DailyAdviceSelection,
    DialogEvent,
    DialogState,
    Exercise,
    ExerciseLevel,
    ExerciseProgress,
    Metric,
    ObservabilityEvent,
    OperationLog,
    PrismaClient,
    Profile,
    TrainingDiscipline,
    TrainingProgram,
    TrainingSession,
    TrainingSessionExercise,
    UserTrainingProgram,
    WorkoutAuditLog,
} from '@prisma/client';

export type UnsafePrismaMethod = '$executeRawUnsafe' | '$queryRawUnsafe' | '$executeRaw' | '$queryRaw';

export type RemoveUnsafeMethods<T> = Omit<T, UnsafePrismaMethod>;

export type SafePrismaClient = RemoveUnsafeMethods<PrismaClient>;

export type PrismaProfile = Profile;
export type PrismaTrainingSession = TrainingSession;
export type PrismaTrainingSessionExercise = TrainingSessionExercise;
export type PrismaExerciseProgress = ExerciseProgress;
export type PrismaMetric = Metric;
export type PrismaAchievement = Achievement;
export type PrismaDailyAdvice = DailyAdvice;
export type PrismaDailyAdviceSelection = DailyAdviceSelection;
export type PrismaAssistantNote = AssistantNote;
export type PrismaDialogState = DialogState;
export type PrismaDialogEvent = DialogEvent;
export type PrismaOperationLog = OperationLog;
export type PrismaObservabilityEvent = ObservabilityEvent;
export type PrismaTrainingProgram = TrainingProgram;
export type PrismaTrainingDiscipline = TrainingDiscipline;
export type PrismaExercise = Exercise;
export type PrismaExerciseLevel = ExerciseLevel;
export type PrismaUserTrainingProgram = UserTrainingProgram;
export type PrismaWorkoutAuditLog = WorkoutAuditLog;

export type PrismaModels = {
    profile: PrismaProfile;
    trainingSession: PrismaTrainingSession;
    trainingSessionExercise: PrismaTrainingSessionExercise;
    exerciseProgress: PrismaExerciseProgress;
    metric: PrismaMetric;
    achievement: PrismaAchievement;
    dailyAdvice: PrismaDailyAdvice;
    dailyAdviceSelection: PrismaDailyAdviceSelection;
    assistantNote: PrismaAssistantNote;
    dialogState: PrismaDialogState;
    dialogEvent: PrismaDialogEvent;
    operationLog: PrismaOperationLog;
    observabilityEvent: PrismaObservabilityEvent;
    trainingProgram: PrismaTrainingProgram;
    trainingDiscipline: PrismaTrainingDiscipline;
    exercise: PrismaExercise;
    exerciseLevel: PrismaExerciseLevel;
    userTrainingProgram: PrismaUserTrainingProgram;
    workoutAuditLog: PrismaWorkoutAuditLog;
};

export type PrismaModelName = keyof PrismaModels;

export type PrismaModel<TName extends PrismaModelName = PrismaModelName> = PrismaModels[TName];
