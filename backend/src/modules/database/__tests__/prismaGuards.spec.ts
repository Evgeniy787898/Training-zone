import { describe, expect, it, vi } from 'vitest';

import { hardenPrismaAgainstSqlInjection } from '../prismaGuards.js';

describe('hardenPrismaAgainstSqlInjection', () => {
  const createPrismaStub = () => ({
    $use: vi.fn(),
  });

  it('disables raw query helpers to block SQL injection attempts', () => {
    const prisma = createPrismaStub();

    const safeClient = hardenPrismaAgainstSqlInjection(prisma as any);

    expect(() => (safeClient as any).$queryRawUnsafe('SELECT 1')).toThrowError(
      /Prisma \$queryRawUnsafe is disabled/i,
    );
    expect(() => (safeClient as any).$executeRaw('SELECT 1')).toThrowError(
      /Prisma \$executeRaw is disabled/i,
    );
  });

  it('guards middleware-based raw queries', async () => {
    const prisma = createPrismaStub();

    hardenPrismaAgainstSqlInjection(prisma as any);

    const middleware = (prisma.$use as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(middleware).toBeTypeOf('function');

    await expect(
      middleware({ action: 'queryRaw', args: {} }, vi.fn()),
    ).rejects.toThrowError(/disabled to enforce typed queries/i);
  });
});

