
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file in project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
    const exercises = await prisma.exercise.findMany({
        select: {
            exerciseKey: true,
            title: true,
            iconUrl: true
        }
    });

    console.log('Existing exercises:');
    exercises.forEach(e => {
        console.log(`Key: "${e.exerciseKey}", Title: "${e.title}", Icon: ${e.iconUrl ? 'SET' : 'NULL'}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
