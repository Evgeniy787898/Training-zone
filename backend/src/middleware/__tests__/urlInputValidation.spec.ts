import { describe, expect, it, vi } from 'vitest';
import { createUrlInputValidationMiddleware } from '../urlInputValidation.js';

describe('URL input validation middleware', () => {
  const runMiddleware = async (req: any) => {
    const next = vi.fn();
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as any;
    const middleware = createUrlInputValidationMiddleware();

    const request = {
      originalUrl: req.originalUrl ?? '/api/resource',
      method: req.method ?? 'GET',
      ...req,
    } as any;

    await middleware(request, res, next);

    return { request, res, next, json };
  };

  it('sanitizes params and query strings before continuing', async () => {
    const req = {
      params: { slug: '  Тест\u0008 ' },
      query: { q: ' value\r\nwith spaces\u200B ' },
    };

    const { next, request } = await runMiddleware(req);

    expect(request.params.slug).toBe('Тест');
    expect(request.query.q).toBe('value\nwith spaces');
    expect(next).toHaveBeenCalled();
  });

  it('rejects values with forbidden symbols', async () => {
    const req = {
      params: { slug: 'bad<value>' },
    };

    const { res, json, next } = await runMiddleware(req);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'invalid_url_input' }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
