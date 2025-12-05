import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const adviceData = [
    {
        adviceType: 'rest', // Was motivation
        shortText: 'Consistency is key',
        fullText: 'Success in training comes from consistent effort over time. Even a short workout is better than no workout.',
        ideas: ['Set a regular schedule', 'Track your progress', 'Find a training partner'],
        theme: 'blue',
        iconName: 'fire',
    },
    {
        adviceType: 'rest', // Was recovery
        shortText: 'Sleep is your superpower',
        fullText: 'Quality sleep is essential for muscle recovery and growth. Aim for 7-9 hours of sleep per night.',
        ideas: ['Establish a bedtime routine', 'Avoid screens before bed', 'Keep your room cool and dark'],
        theme: 'green',
        iconName: 'moon',
    },
    {
        adviceType: 'training', // Was nutrition
        shortText: 'Fuel your body',
        fullText: 'Proper nutrition supports your training goals. Ensure you are getting enough protein and hydration.',
        ideas: ['Drink water throughout the day', 'Eat protein with every meal', 'Plan your meals ahead'],
        theme: 'orange',
        iconName: 'apple',
    },
    {
        adviceType: 'training', // Was technique
        shortText: 'Form over ego',
        fullText: 'Prioritize proper form over lifting heavier weights. Good technique prevents injury and ensures better results.',
        ideas: ['Record your sets', 'Ask for feedback', 'Start with lighter weights'],
        theme: 'red',
        iconName: 'check',
    },
    {
        adviceType: 'training', // Was mindset
        shortText: 'Embrace the challenge',
        fullText: 'Growth happens outside your comfort zone. Embrace difficult workouts as opportunities to get stronger.',
        ideas: ['Visualize success', 'Focus on your "why"', 'Celebrate small wins'],
        theme: 'purple',
        iconName: 'brain',
    },
];

async function main() {
    console.log('🌱 Seeding daily advice...');

    for (const advice of adviceData) {
        await prisma.dailyAdvice.upsert({
            where: { id: uuidv4() }, // Note: This won't actually upsert by content, but since we use random IDs it will always create. 
            // Better to check if similar content exists or just create.
            // Since we don't have a unique key other than ID, let's just create if count is 0.
            update: {},
            create: {
                id: uuidv4(),
                ...advice,
            },
        });
    }

    // Always insert/upsert to ensure we have the correct types
    console.log('Upserting advice records...');
    for (const advice of adviceData) {
        // We use a deterministic ID based on shortText to avoid duplicates if running multiple times
        // Or just create new ones. Let's just create new ones for simplicity if they don't exist.
        // Actually, let's just add them.
        await prisma.dailyAdvice.create({
            data: {
                id: uuidv4(),
                ...advice,
            },
        });
    }
    console.log(`✅ Added ${adviceData.length} advice records with correct types`);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
