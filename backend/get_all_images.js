#!/usr/bin/env node
// Скрипт для получения всех картинок упражнений из базы данных
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getAllImages() {
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
                imageUrl: true,
                imageUrl2: true
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

getAllImages();


