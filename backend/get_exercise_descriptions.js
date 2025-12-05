#!/usr/bin/env node
// Скрипт для получения полных описаний упражнений из базы данных
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getDescriptions() {
    try {
        const levels = await prisma.exerciseLevel.findMany({
            where: {
                exerciseKey: {
                    in: ['pullups', 'squats', 'pushups', 'leg_raises', 'bridge', 'handstand']
                }
            },
            select: {
                exerciseKey: true,
                level: true,
                title: true,
                execution: true,
                technique: true,
                improvement: true
            },
            orderBy: [
                { exerciseKey: 'asc' },
                { level: 'asc' }
            ]
        });
        
        console.log(JSON.stringify(levels, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

getDescriptions();

