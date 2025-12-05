import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Подключение к старой Supabase для миграции данных
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
    console.log('🔄 Начинаем миграцию данных в TZONA V2...');

    try {
        // 1. Мигрируем направления тренировок
        console.log('📋 Мигрируем направления тренировок...');
        const { data: disciplines } = await supabase
            .from('training_disciplines')
            .select('*');

        for (const discipline of disciplines) {
            await prisma.trainingDiscipline.upsert({
                where: { name: discipline.name },
                update: {
                    description: discipline.description,
                    isActive: discipline.is_active
                },
                create: {
                    name: discipline.name,
                    description: discipline.description,
                    isActive: discipline.is_active
                }
            });
        }
        console.log(`✅ Мигрировано ${disciplines.length} направлений`);

        // 2. Мигрируем программы тренировок
        console.log('🏋️ Мигрируем программы тренировок...');
        const { data: programs } = await supabase
            .from('training_programs')
            .select('*');

        for (const program of programs) {
            const discipline = await prisma.trainingDiscipline.findFirst({
                where: { name: 'Калистеника' }
            });

            await prisma.trainingProgram.upsert({
                where: { name: program.name },
                update: {
                    description: program.description,
                    frequency: program.frequency,
                    restDay: program.rest_day,
                    programData: program.program_data,
                    isActive: program.is_active
                },
                create: {
                    name: program.name,
                    description: program.description,
                    frequency: program.frequency,
                    restDay: program.rest_day,
                    programData: program.program_data,
                    disciplineId: discipline.id,
                    isActive: program.is_active
                }
            });
        }
        console.log(`✅ Мигрировано ${programs.length} программ`);

        // 3. Мигрируем уровни упражнений
        console.log('💪 Мигрируем уровни упражнений...');
        const { data: levels } = await supabase
            .from('exercise_levels')
            .select('*');

        for (const level of levels) {
            const discipline = await prisma.trainingDiscipline.findFirst({
                where: { name: 'Калистеника' }
            });

            await prisma.exerciseLevel.upsert({
                where: {
                    exerciseKey_level: {
                        exerciseKey: level.exercise_key,
                        level: level.level
                    }
                },
                update: {
                    name: level.name,
                    description: level.description,
                    execution: level.execution,
                    context: level.context,
                    technique: level.technique,
                    image1: level.image1,
                    image2: level.image2,
                    image3: level.image3,
                    isActive: level.is_active
                },
                create: {
                    exerciseKey: level.exercise_key,
                    level: level.level,
                    name: level.name,
                    description: level.description,
                    execution: level.execution,
                    context: level.context,
                    technique: level.technique,
                    image1: level.image1,
                    image2: level.image2,
                    image3: level.image3,
                    disciplineId: discipline.id,
                    isActive: level.is_active
                }
            });
        }
        console.log(`✅ Мигрировано ${levels.length} уровней упражнений`);

        console.log('🎉 Миграция завершена успешно!');

    } catch (error) {
        console.error('❌ Ошибка миграции:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrateData();
