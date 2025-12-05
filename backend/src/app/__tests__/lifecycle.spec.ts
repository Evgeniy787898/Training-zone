import { describe, expect, it, vi } from 'vitest';
import { ApplicationLifecycle } from '../lifecycle.js';

type Context = { events: string[] };

const createLifecycle = () =>
  new ApplicationLifecycle<Context>({ events: [] }, { logger: console });

describe('ApplicationLifecycle', () => {
  it('runs steps in registration order and cleans up in reverse', async () => {
    const lifecycle = createLifecycle();
    const context = lifecycle.getContext();

    lifecycle.registerStep({
      name: 'a',
      run: () => context.events.push('run:a'),
      cleanup: () => context.events.push('cleanup:a'),
    });
    lifecycle.registerStep({
      name: 'b',
      run: () => context.events.push('run:b'),
      cleanup: () => context.events.push('cleanup:b'),
    });

    await lifecycle.start();
    await lifecycle.shutdown();

    expect(context.events).toEqual([
      'run:a',
      'run:b',
      'cleanup:b',
      'cleanup:a',
    ]);
  });

  it('runs cleanups for executed steps when a later step fails', async () => {
    const lifecycle = createLifecycle();
    const context = lifecycle.getContext();
    const failingStep = vi.fn(() => {
      throw new Error('failed');
    });

    lifecycle.registerStep({
      name: 'first',
      run: () => context.events.push('first'),
      cleanup: () => context.events.push('cleanup:first'),
    });
    lifecycle.registerStep({
      name: 'second',
      run: failingStep,
      cleanup: () => context.events.push('cleanup:second'),
    });

    await expect(lifecycle.start()).rejects.toThrow('failed');
    expect(context.events).toEqual(['first', 'cleanup:first']);
  });

  it('makes shutdown idempotent', async () => {
    const lifecycle = createLifecycle();
    const cleanup = vi.fn();
    lifecycle.registerStep({
      name: 'only',
      cleanup,
    });

    await lifecycle.start();
    await lifecycle.shutdown();
    await lifecycle.shutdown();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

