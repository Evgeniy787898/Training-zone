import { describe, expect, it } from 'vitest';
import { parseImageProcessorResponse, parseTelegramMessageResponse } from '../externalDataValidation.js';

describe('external data validation helpers', () => {
  it('parses valid telegram responses', () => {
    const result = parseTelegramMessageResponse({
      ok: true,
      result: { message_id: 1, chat: { id: 42 } },
    });

    expect(result).toEqual({ message_id: 1, chat: { id: 42 } });
  });

  it('throws when telegram payload is invalid', () => {
    expect(() => parseTelegramMessageResponse({ ok: false })).toThrow();
    expect(() => parseTelegramMessageResponse({})).toThrow();
  });

  it('parses valid image-processor payloads', () => {
    const payload = { processedImage: 'base64', width: 100, format: 'webp' };
    expect(parseImageProcessorResponse(payload)).toEqual(payload);
  });

  it('throws for malformed image-processor payloads', () => {
    expect(() => parseImageProcessorResponse({})).toThrow('image-processor returned malformed payload');
  });
});
