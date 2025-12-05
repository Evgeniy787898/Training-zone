import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyStringSanitization, sanitizeStringValue } from '../stringSanitization.js';

describe('string sanitization helpers', () => {
  it('removes control characters, zero width chars, normalizes and trims', () => {
    const dirty = '\u200b  T\u0008е\u0301st\r\n';
    const sanitized = sanitizeStringValue(dirty);
    expect(sanitized).toBe('Tе́st');
  });

  describe('Prisma middleware wiring', () => {
    const prisma = { $use: vi.fn() } as any;

    beforeEach(() => {
      prisma.$use.mockReset();
      applyStringSanitization(prisma);
    });

    it('sanitizes string fields during write operations', async () => {
      const middleware = prisma.$use.mock.calls[0][0];
      const next = vi.fn(async (params) => params);
      const params = {
        action: 'create',
        args: {
          data: {
            name: '  My\u0007 Name ',
            nested: { description: 'Line\r\nBreak' },
          },
        },
      };

      await middleware(params, next);

      expect(params.args.data.name).toBe('My Name');
      expect(params.args.data.nested.description).toBe('Line\nBreak');
      expect(next).toHaveBeenCalledWith(params);
    });

    it('skips non-write actions', async () => {
      const middleware = prisma.$use.mock.calls[0][0];
      const next = vi.fn(async (params) => params);
      const params = { action: 'findMany', args: { where: { id: '1' } } };

      await middleware(params, next);

      expect(params.args.where.id).toBe('1');
      expect(next).toHaveBeenCalledWith(params);
    });
  });
});
