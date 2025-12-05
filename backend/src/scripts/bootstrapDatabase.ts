import { Prisma, PrismaClient } from '@prisma/client';
import {
  EXERCISE_CUES,
  EXERCISE_METADATA,
  PROGRESSION_DATA,
} from '../modules/ai/staticPlan.js';

const prisma = new PrismaClient();

const trainingDisciplines = [
  {
    slug: 'calisthenics',
    name: 'Калистеника',
    description: 'Прогрессия с собственным весом: техника, сила, баланс.',
    isActive: true,
  },
  {
    slug: 'recovery',
    name: 'Восстановление',
    description: 'Лёгкая мобильность, дыхание и расслабление между тяжёлыми днями.',
    isActive: true,
  },
];

const trainingPrograms = [
  {
    directionSlug: 'calisthenics',
    name: 'Одиночное заключение',
    description: 'Шестидневная программа калистеники с отдыхом в воскресенье.',
    frequency: 6,
    restDay: 'sunday',
    isActive: true,
    programData: [
      {
        day: 'monday',
        exercises: [
          { key: 'pullups', name: 'Подтягивания' },
          { key: 'squats', name: 'Приседания' },
        ],
      },
      {
        day: 'tuesday',
        exercises: [
          { key: 'pushups', name: 'Отжимания' },
          { key: 'leg_raises', name: 'Подъемы ног' },
        ],
      },
      {
        day: 'wednesday',
        exercises: [
          { key: 'handstand', name: 'Отжимания в стойке на руках' },
          { key: 'bridge', name: 'Мостик' },
        ],
      },
      {
        day: 'thursday',
        exercises: [
          { key: 'pullups', name: 'Подтягивания' },
          { key: 'squats', name: 'Приседания' },
        ],
      },
      {
        day: 'friday',
        exercises: [
          { key: 'pushups', name: 'Отжимания' },
          { key: 'leg_raises', name: 'Подъемы ног' },
        ],
      },
      {
        day: 'saturday',
        exercises: [
          { key: 'handstand', name: 'Отжимания в стойке на руках' },
          { key: 'bridge', name: 'Мостик' },
        ],
      },
    ],
  },
];

const TX_BATCH_SIZE = 10;

async function executeInBatches<T>(
  operations: Prisma.PrismaPromise<T>[],
  start = 0,
  results: T[] = [],
): Promise<T[]> {
  if (start >= operations.length) {
    return results;
  }

  const chunk = operations.slice(start, start + TX_BATCH_SIZE);
  const chunkResults = await prisma.$transaction(chunk);
  results.push(...chunkResults);
  return executeInBatches(operations, start + TX_BATCH_SIZE, results);
}

async function upsertDisciplines() {
  const operations = trainingDisciplines.map((discipline) =>
    prisma.trainingDiscipline.upsert({
      where: { name: discipline.name },
      update: {
        description: discipline.description,
        isActive: discipline.isActive,
        updatedAt: new Date(),
      },
      create: {
        name: discipline.name,
        description: discipline.description,
        isActive: discipline.isActive,
      },
    }),
  );

  const map = new Map<string, { id: string }>();
  const records = await executeInBatches(operations);
  records.forEach((record, index) => {
    const slug = trainingDisciplines[index]?.slug;
    if (slug) {
      map.set(slug, { id: record.id });
    }
  });
  return map;
}

async function upsertPrograms(disciplineBySlug: Map<string, { id: string }>) {
  const operations = trainingPrograms.map((program) => {
    const discipline = program.directionSlug ? disciplineBySlug.get(program.directionSlug) : undefined;
    return prisma.trainingProgram.upsert({
      where: { name: program.name },
      update: {
        disciplineId: discipline?.id ?? null,
        description: program.description,
        frequency: program.frequency,
        restDay: program.restDay,
        isActive: program.isActive,
        programData: program.programData as unknown as any,
        updatedAt: new Date(),
      },
      create: {
        disciplineId: discipline?.id ?? null,
        name: program.name,
        description: program.description,
        frequency: program.frequency,
        restDay: program.restDay,
        isActive: program.isActive,
        programData: program.programData as unknown as any,
      },
    });
  });

  await executeInBatches(operations);
}

async function upsertExercises(disciplineBySlug: Map<string, { id: string }>) {
  const calisthenics = disciplineBySlug.get('calisthenics');
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  for (const [exerciseKey, meta] of Object.entries(EXERCISE_METADATA)) {
    operations.push(
      prisma.exercise.upsert({
        where: { exerciseKey },
        update: {
          title: meta.title ?? exerciseKey,
          focus: meta.focus ?? null,
          description: meta.description ?? null,
          cue: EXERCISE_CUES[exerciseKey] ?? null,
        },
        create: {
          exerciseKey,
          title: meta.title ?? exerciseKey,
          focus: meta.focus ?? null,
          description: meta.description ?? null,
          cue: EXERCISE_CUES[exerciseKey] ?? null,
        },
      }),
    );

    const levels = PROGRESSION_DATA[exerciseKey] || [];
    levels.forEach((levelData, index) => {
      operations.push(
        prisma.exerciseLevel.upsert({
          where: {
            exerciseKey_level: {
              exerciseKey,
              level: levelData.level,
            },
          },
          update: {
            title: levelData.title,
            sets: levelData.sets ?? null,
            reps: levelData.reps ?? null,
            orderIndex: index,
            disciplineId: calisthenics?.id ?? null,
            isActive: true,
          },
          create: {
            exerciseKey,
            level: levelData.level,
            title: levelData.title,
            sets: levelData.sets ?? null,
            reps: levelData.reps ?? null,
            orderIndex: index,
            disciplineId: calisthenics?.id ?? null,
            isActive: true,
          },
        }),
      );
    });
  }

  await executeInBatches(operations);
}

async function main() {
  console.log('🚀 Подготовка каталога направлений, программ и упражнений...');
  const disciplineMap = await upsertDisciplines();
  await upsertPrograms(disciplineMap);
  await upsertExercises(disciplineMap);
  console.log('✅ Каталог направлений, программ и упражнений обновлён.');
}

main()
  .catch((error) => {
    console.error('❌ Ошибка подготовки базы:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
