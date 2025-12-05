import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createSafeFileAccess, PathTraversalError } from '../services/pathSecurity.js';

type LevelMatcher = (level: string) => boolean;

interface ExerciseImageGroup {
    match: LevelMatcher;
    baseName: string;
}

interface ExerciseImageConfig {
    dir: string;
    groups: ExerciseImageGroup[];
}

const IMAGE_CONFIG: Record<string, ExerciseImageConfig> = {
    pushups: {
        dir: 'Отжимания',
        groups: [
            { match: (level) => level.startsWith('1.'), baseName: 'Отжимания от стены' },
            { match: (level) => level.startsWith('2.'), baseName: 'Отжимания в наклоне' },
            { match: (level) => level.startsWith('3.'), baseName: 'Отжимания на коленях' },
            { match: (level) => level.startsWith('4.'), baseName: 'Неполные отжимания' },
            { match: (level) => level.startsWith('5.'), baseName: 'Полные отжимания' },
            { match: (level) => level.startsWith('6.'), baseName: 'Узкие отжимания' },
            { match: (level) => level.startsWith('7.'), baseName: 'Разновысокие отжимания' },
            { match: (level) => level.startsWith('8.'), baseName: 'Неполные отжимания на одной руке' },
            { match: (level) => level.startsWith('9.'), baseName: 'Отжимания на одной руке с поддержкой' },
            { match: (level) => level.startsWith('10.'), baseName: 'Отжимания на одной руке' },
        ],
    },
    squats: {
        dir: 'Приседания',
        groups: [
            { match: (level) => level.startsWith('1.'), baseName: 'Приседания в стойке на плечах' },
            { match: (level) => level.startsWith('2.'), baseName: 'Приседания «Складной нож»' },
            { match: (level) => level.startsWith('3.'), baseName: 'Приседания с поддержкой' },
            { match: (level) => level.startsWith('4.'), baseName: 'Неполные приседания' },
            { match: (level) => level.startsWith('5.'), baseName: 'Полные приседания' },
            { match: (level) => level.startsWith('6.'), baseName: 'Узкие приседания' },
            { match: (level) => level.startsWith('7.'), baseName: 'Разновысокие приседания' },
            { match: (level) => level.startsWith('8.'), baseName: 'Неполные приседания на одной ноге' },
            { match: (level) => level.startsWith('9.'), baseName: 'Приседания на одной ноге поддержкой' },
            { match: (level) => level.startsWith('10.'), baseName: 'Приседания на одной ноге' },
        ],
    },
    pullups: {
        dir: 'Подтягивания',
        groups: [
            { match: (level) => level.startsWith('1.'), baseName: 'Вертикальные подтягивания' },
            { match: (level) => level.startsWith('2.'), baseName: 'Горизонтальные подтягивания' },
            { match: (level) => level.startsWith('3.'), baseName: 'Подтягивания «складной нож»' },
            { match: (level) => level.startsWith('4.'), baseName: 'Неполные подтягивания' },
            { match: (level) => level.startsWith('5.'), baseName: 'Полные подтягивания' },
            { match: (level) => level.startsWith('6.'), baseName: 'Узкие подтягивания' },
            { match: (level) => level.startsWith('7.'), baseName: 'Разновысокие подтягивания' },
            { match: (level) => level.startsWith('8.'), baseName: 'Неполные подтягивания на одной руке' },
            { match: (level) => level.startsWith('9.'), baseName: 'Подтягивания на одной руке с поддержкой' },
            { match: (level) => level.startsWith('10.'), baseName: 'Подтягивания на одной руке' },
        ],
    },
    leg_raises: {
        dir: 'Подъемы ног',
        groups: [
            { match: (level) => level.startsWith('1.'), baseName: 'Подтягивание коленей к груди' },
            { match: (level) => level.startsWith('2.'), baseName: 'Подъемы коленей из положения лежа' },
            { match: (level) => level.startsWith('3.'), baseName: 'Подъемы согнутых ног из положения лежа' },
            { match: (level) => level.startsWith('4.'), baseName: 'Подъемы ног «Лягушка»' },
            { match: (level) => level.startsWith('5.'), baseName: 'Подъемы прямых ног из положения лежа' },
            { match: (level) => level.startsWith('6.'), baseName: 'Подтягивание коленей в висе' },
            { match: (level) => level.startsWith('7.'), baseName: 'Подъемы согнутых ног в висе' },
            { match: (level) => level.startsWith('8.'), baseName: 'Подъемы ног в висе — «Лягушка»' },
            { match: (level) => level.startsWith('9.'), baseName: 'Неполные подъемы прямых ног в висе' },
            { match: (level) => level.startsWith('10.'), baseName: 'Подъемы прямых ног в висе' },
        ],
    },
    bridge: {
        dir: 'Мостик',
        groups: [
            { match: (level) => level.startsWith('1.'), baseName: '«Мостик» от плеч' },
            { match: (level) => level.startsWith('2.'), baseName: 'Прямой «Мостик»' },
            { match: (level) => level.startsWith('3.'), baseName: '«Мостик» из обратного наклона' },
            { match: (level) => level.startsWith('4.'), baseName: '«Мостик» из упора на голову' },
            { match: (level) => level.startsWith('5.'), baseName: '«Полумостик»' },
            { match: (level) => level.startsWith('6.'), baseName: 'Полный «Мостик»' },
            { match: (level) => level.startsWith('7.'), baseName: '«Мостик» по стенке вниз' },
            { match: (level) => level.startsWith('8.'), baseName: '«Мостик» по стенке вверх' },
            { match: (level) => level.startsWith('9.'), baseName: 'Неполный «мостик» из положения стоя' },
            { match: (level) => level.startsWith('10.'), baseName: 'Полный «мостик» из положения стоя' },
        ],
    },
    handstand: {
        dir: 'Отжимания в стойке на руках',
        groups: [
            { match: (level) => level.startsWith('1.'), baseName: 'Стойка на голове у стены' },
            { match: (level) => level.startsWith('2.'), baseName: 'Стойка «ворон»' },
            { match: (level) => level.startsWith('3.'), baseName: '«Стоика на руках» у стены' },
            { match: (level) => level.startsWith('4.'), baseName: 'Неполные отжимания в стоике на руках у стены' },
            { match: (level) => level.startsWith('5.'), baseName: 'Отжимания в стойке на руках у стены' },
            { match: (level) => level.startsWith('6.'), baseName: 'Узкие отжимания в стойке на руках у стены' },
            { match: (level) => level.startsWith('7.'), baseName: 'Разновысокие отжимания в стойке на руках у стены' },
            { match: (level) => level.startsWith('8.'), baseName: 'Неполные отжимания на одной руке' },
            { match: (level) => level.startsWith('9.'), baseName: 'Отжимания на одной руке с поддержкой' },
            { match: (level) => level.startsWith('10.'), baseName: 'Отжимания в стойке на одной руке' },
        ],
    },
};

const prisma = new PrismaClient();

const projectRoot = path.resolve(process.cwd(), '..');
const imagesAccess = createSafeFileAccess(path.join(projectRoot, 'картинки'));

const tryReadImage = (dir: string, fileName: string): Buffer | null => {
    try {
        const filePath = imagesAccess.resolve(dir, fileName);
        if (!existsSync(filePath)) {
            return null;
        }
        return readFileSync(filePath);
    } catch (error) {
        if (error instanceof PathTraversalError) {
            console.error('[security] Blocked attempt to read image outside of allowed directory', {
                directory: dir,
                fileName,
                baseDir: imagesAccess.root,
            });
            return null;
        }
        throw error;
    }
};

const normalizeSegment = (value: string): string => value.normalize('NFC').trim();

type ExerciseImageUpdate = {
    label: string;
    ids: string[];
    data: { image1?: Buffer; image2?: Buffer; image3?: Buffer };
};

async function runExerciseImageUpdates(updates: ExerciseImageUpdate[], index = 0): Promise<void> {
    if (index >= updates.length) {
        return;
    }
    const target = updates[index];
    if (target.ids.length) {
        const result = await prisma.exerciseLevel.updateMany({
            where: { id: { in: target.ids } },
            data: target.data,
        });
        console.log(`  ✅ ${target.label} → ${result.count} уровней`);
    }
    await runExerciseImageUpdates(updates, index + 1);
}

function readImage(dir: string, baseName: string, index: number): Buffer | null {
    const normalizedDir = normalizeSegment(dir);
    const normalizedBase = normalizeSegment(baseName);
    if (!normalizedDir || !normalizedBase) {
        return null;
    }

    const primaryFileName = `${normalizedBase} ${index}.webp`;
    const primary = tryReadImage(normalizedDir, primaryFileName);
    if (primary) {
        return primary;
    }

    const altFileName = `${normalizedBase}${index}.webp`;
    return tryReadImage(normalizedDir, altFileName);
}

async function applyImagesForExercise(exerciseKey: string, config: ExerciseImageConfig) {
    const levels = await prisma.exerciseLevel.findMany({
        where: { exerciseKey },
        orderBy: { orderIndex: 'asc' },
    });

    if (!levels.length) {
        console.warn(`⚠️  No levels found for exercise ${exerciseKey}`);
        return;
    }

    console.log(`\n📦 Updating images for ${exerciseKey}…`);

    const batchedUpdates: ExerciseImageUpdate[] = [];

    for (const group of config.groups) {
        const targetLevels = levels.filter((level: any) => group.match(level.level));
        if (!targetLevels.length) continue;

        const image1 = readImage(config.dir, group.baseName, 1);
        const image2 = readImage(config.dir, group.baseName, 2);
        const image3 = readImage(config.dir, group.baseName, 3);

        if (!image1 && !image2 && !image3) {
            console.warn(`  ⚠️  Images missing for "${group.baseName}" in ${config.dir}`);
            continue;
        }

        const updateData: { image1?: Buffer; image2?: Buffer; image3?: Buffer } = {};
        if (image1) updateData.image1 = image1;
        if (image2) updateData.image2 = image2;
        if (image3) updateData.image3 = image3;

        batchedUpdates.push({
            ids: targetLevels.map((level: any) => level.id),
            label: group.baseName,
            data: updateData,
        });
    }

    await runExerciseImageUpdates(batchedUpdates);
}

async function main() {
    try {
        for (const [exerciseKey, config] of Object.entries(IMAGE_CONFIG)) {
            await applyImagesForExercise(exerciseKey, config);
        }
    } catch (error) {
        console.error('❌  Failed to import exercise images:', error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

void main();
