import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/training-disciplines', async (req, res) => {
    try {
        const disciplines = await prisma.trainingDiscipline.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });

        res.json(disciplines);
    } catch (error) {
        console.error('Error fetching disciplines:', error);
        res.status(500).json({ error: 'Failed to fetch disciplines' });
    }
});

app.get('/api/training-programs', async (req, res) => {
    try {
        const { discipline_id } = req.query;

        const where = { isActive: true };
        if (discipline_id) {
            where.disciplineId = discipline_id;
        }

        const programs = await prisma.trainingProgram.findMany({
            where,
            include: {
                discipline: {
                    select: { name: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json(programs);
    } catch (error) {
        console.error('Error fetching programs:', error);
        res.status(500).json({ error: 'Failed to fetch programs' });
    }
});

app.get('/api/exercises/:exerciseKey/levels', async (req, res) => {
    try {
        const { exerciseKey } = req.params;

        const levels = await prisma.exerciseLevel.findMany({
            where: {
                exerciseKey,
                isActive: true
            },
            orderBy: [
                { level: 'asc' }
            ]
        });

        // Группируем уровни по тройкам
        const groupedLevels = [];
        for (let i = 0; i < levels.length; i += 3) {
            groupedLevels.push(levels.slice(i, i + 3));
        }

        res.json({
            exerciseKey,
            levels: groupedLevels
        });
    } catch (error) {
        console.error('Error fetching exercise levels:', error);
        res.status(500).json({ error: 'Failed to fetch exercise levels' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 TZONA V2 Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});
