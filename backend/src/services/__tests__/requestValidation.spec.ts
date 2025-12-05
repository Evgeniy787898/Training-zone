import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RequestValidationService } from '../requestValidation.js';

const schemas = {
  body: z.object({ name: z.string().min(1) }),
  query: z.object({ page: z.coerce.number().int().min(1).default(1) }).optional(),
};

describe('RequestValidationService', () => {
  it('returns parsed payloads when every schema passes', () => {
    const result = RequestValidationService.validate(schemas, {
      body: { name: 'John' },
      query: { page: '2' },
    });

    if (!result.success) {
      throw new Error('Expected validation to succeed');
    }

    expect(result.data.body).toEqual({ name: 'John' });
    expect(result.data.query).toEqual({ page: 2 });
  });

  it('returns AppError metadata when validation fails', () => {
    const result = RequestValidationService.validate(schemas, {
      body: { name: '' },
      query: { page: '2' },
    });

    if (result.success) {
      throw new Error('Expected validation to fail');
    }

    expect(result.error.code).toBe('validation_failed');
    expect(result.error.statusCode).toBe(422);
    expect(result.details.part).toBe('body');
    expect(result.details.issues[0]?.path).toEqual(['name']);
  });

  it('supports custom messages per request part', () => {
    const result = RequestValidationService.validate(
      schemas,
      { body: { name: '' } },
      { messages: { body: { error: 'custom_error', message: 'Неверное имя' } } },
    );

    if (result.success) {
      throw new Error('Expected validation to fail');
    }

    expect(result.error.code).toBe('custom_error');
    expect(result.error.message).toContain('Неверное имя');
  });
});
