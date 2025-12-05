import { describe, expect, it, vi } from 'vitest';
import { applyJsonOptimization, optimizeJsonValue } from '../jsonOptimization.js';

const createMockPrisma = () => {
  const handlers: any[] = [];
  return {
    handlers,
    $use: vi.fn((cb) => handlers.push(cb)),
  } as any;
};

describe('optimizeJsonValue', () => {
  it('drops undefined entries and sorts keys', () => {
    const input = { b: { z: 1, a: undefined }, a: [undefined, { d: 2, c: null }] };
    const result = optimizeJsonValue(input);

    expect(result).toEqual({
      a: [{ c: null, d: 2 }],
      b: { z: 1 },
    });
  });

  it('avoids deep recursion', () => {
    let value: any = null;
    for (let i = 0; i < 60; i += 1) {
      value = { next: value };
    }

    const result = optimizeJsonValue(value);
    expect(result).toHaveProperty('next');
  });
});

describe('applyJsonOptimization', () => {
  it('optimizes write actions', async () => {
    const prisma = createMockPrisma();
    applyJsonOptimization(prisma as any);

    const [, handler] = prisma.handlers;
    const params = {
      action: 'create',
      args: {
        data: { b: 1, a: undefined },
      },
    };

    const next = vi.fn((p) => p.args.data);
    const result = await handler(params, next);

    expect(result).toEqual({ b: 1 });
    expect(next).toHaveBeenCalled();
  });

  it('ignores non-write actions', async () => {
    const prisma = createMockPrisma();
    applyJsonOptimization(prisma as any);

    const [, handler] = prisma.handlers;
    const params = { action: 'findMany', args: { data: { shouldStay: true } } };
    const next = vi.fn();
    await handler(params, next);
    expect(next).toHaveBeenCalledWith(params);
  });
});
