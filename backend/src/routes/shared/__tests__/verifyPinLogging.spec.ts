import { describe, expect, it } from 'vitest';
import {
  describeBruteForceKey,
  summarizeVerifyPinHeaders,
  summarizeVerifyPinPayload,
} from '../verifyPinLogging.js';

describe('verifyPinLogging helpers', () => {
  it('summarizes payload without including sensitive values', () => {
    const payload = {
      pin: '1234',
      telegram_id: 123456789,
      initData: 'query_id=abc&user={"id":1}',
    };

    const summary = summarizeVerifyPinPayload(payload);

    expect(summary).toEqual({
      hasPin: true,
      pinLength: 4,
      hasInitData: true,
      initDataLength: payload.initData.length,
      hasTelegramId: true,
    });
    expect(JSON.stringify(summary)).not.toContain('1234');
    expect(JSON.stringify(summary)).not.toContain(payload.initData);
  });

  it('summarizes headers by presence only', () => {
    const headers = {
      authorization: 'Bearer token',
      'x-telegram-id': '12345',
      'x-telegram-init-data': 'payload',
      'x-profile-id': 'profile',
    };

    const summary = summarizeVerifyPinHeaders(headers);

    expect(summary).toEqual({
      hasAuthorization: true,
      hasTelegramIdHeader: true,
      hasInitDataHeader: true,
      hasProfileIdHeader: true,
    });
    expect(JSON.stringify(summary)).not.toContain('token');
  });

  it('describes brute-force keys by type only', () => {
    expect(describeBruteForceKey('telegram:123')).toEqual({ keyType: 'telegram_id' });
    expect(describeBruteForceKey('profile:abc')).toEqual({ keyType: 'profile_id' });
    expect(describeBruteForceKey('initData:hash')).toEqual({ keyType: 'init_data' });
    expect(describeBruteForceKey('ip:127.0.0.1')).toEqual({ keyType: 'ip' });
    expect(describeBruteForceKey('unknown')).toEqual({ keyType: 'unknown' });
  });
});

