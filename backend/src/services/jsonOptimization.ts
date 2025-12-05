import { PrismaClient } from '@prisma/client';
import { isPlainObject } from '../utils/object.js';

const WRITE_ACTIONS = new Set(['create', 'update', 'updateMany', 'createMany', 'upsert']);
const MAX_DEPTH = 50;

export const optimizeJsonValue = (value: unknown, depth = 0): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (depth > MAX_DEPTH) {
    return value;
  }

  if (Array.isArray(value)) {
    const optimized = value
      .map((item) => optimizeJsonValue(item, depth + 1))
      .filter((item) => item !== undefined);
    return optimized;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    entries.sort(([a], [b]) => a.localeCompare(b));

    const optimizedObject: Record<string, unknown> = {};

    for (const [key, nested] of entries) {
      const optimizedNested = optimizeJsonValue(nested, depth + 1);
      if (optimizedNested !== undefined) {
        optimizedObject[key] = optimizedNested;
      }
    }

    return optimizedObject;
  }

  return value;
};

export const applyJsonOptimization = (prisma: PrismaClient) => {
  prisma.$use(async (params, next) => {
    if (!WRITE_ACTIONS.has(params.action)) {
      return next(params);
    }

    const args = params.args ?? {};

    if (args.data) {
      args.data = optimizeJsonValue(args.data);
    }

    if (params.action === 'upsert') {
      if (args.create) {
        args.create = optimizeJsonValue(args.create);
      }
      if (args.update) {
        args.update = optimizeJsonValue(args.update);
      }
    }

    return next(params);
  });
};
