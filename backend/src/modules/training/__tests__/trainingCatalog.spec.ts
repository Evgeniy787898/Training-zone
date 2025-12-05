import { describe, expect, it, vi } from 'vitest';
import { loadActiveTrainingDisciplines, loadTrainingPrograms } from '../trainingCatalog.js';
import type { SafePrismaClient } from '../../types/prisma.js';

const buildPrismaMock = () => ({
  trainingDiscipline: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  trainingProgram: {
    findMany: vi.fn().mockResolvedValue([]),
  },
});

describe('trainingCatalog services', () => {
  it('loads only active disciplines', async () => {
    const prisma = buildPrismaMock();
    prisma.trainingDiscipline.findMany.mockResolvedValue([{ id: 'd1' }]);

    const rows = await loadActiveTrainingDisciplines(prisma as unknown as SafePrismaClient);

    expect(rows).toEqual([{ id: 'd1' }]);
    expect(prisma.trainingDiscipline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });

  it('filters programs by discipline when provided', async () => {
    const prisma = buildPrismaMock();

    await loadTrainingPrograms(prisma as unknown as SafePrismaClient, { disciplineId: 'discipline-1' });

    expect(prisma.trainingProgram.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ disciplineId: 'discipline-1' }),
      }),
    );
  });
});
