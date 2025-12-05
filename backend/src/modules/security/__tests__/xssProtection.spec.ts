import { describe, expect, it, vi } from 'vitest';

import { applyXssProtection } from '../xssProtection.js';

describe('applyXssProtection', () => {
  const createPrismaStub = () => ({
    $use: vi.fn(),
  });

  it('rejects dangerous markup before it reaches Prisma', async () => {
    const prisma = createPrismaStub();
    applyXssProtection(prisma as any);

    const middleware = (prisma.$use as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(middleware).toBeTypeOf('function');

    await expect(
      middleware(
        {
          action: 'create',
          args: { data: { notes: '<script>alert(1)</script>' } },
        },
        vi.fn(),
      ),
    ).rejects.toThrowError(/XSS/i);
  });

  it('escapes harmless characters so stored data stays safe to render', async () => {
    const prisma = createPrismaStub();
    applyXssProtection(prisma as any);

    const middleware = (prisma.$use as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const next = vi.fn().mockResolvedValue('ok');
    const payload = { comment: '2 < 3 & 5 > 4' };

    const result = await middleware(
      {
        action: 'create',
        args: { data: payload },
      },
      next,
    );

    expect(result).toBe('ok');
    expect(payload.comment).toBe('2 &lt; 3 &amp; 5 &gt; 4');
    expect(next).toHaveBeenCalledOnce();
  });
});

