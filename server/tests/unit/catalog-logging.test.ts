import { describe, expect, it } from 'vitest';
import { LOG_REDACT_PATHS, sanitizeForLog, containsSecretMaterial } from '../../src/logger.js';

describe('M3 log redaction', () => {
  it('covers authorization, cookies, CSRF, and DRM credential headers', () => {
    const paths = [...LOG_REDACT_PATHS];
    expect(paths).toContain('req.headers.authorization');
    expect(paths).toContain('req.headers.cookie');
    expect(paths).toContain('res.headers["set-cookie"]');
    expect(paths).toContain('req.headers["x-csrf-token"]');
    expect(paths).toContain('req.headers["x-client-secret"]');
    expect(paths).toContain('req.headers["x-client-id"]');
  });

  it('redacts token/secret/key/assertion/signature/credential fields', () => {
    const out = JSON.stringify(
      sanitizeForLog({
        token: 'abc',
        secret: 's',
        key: 'k',
        assertion: 'a',
        signature: 'sig',
        credential: 'c',
        uploadUrl: 'https://x.example/u?token=abc&sig=def'.padEnd(200, 'x'),
        storageKey: 'uploads/app/key',
        confirmation: 'edu-123',
        safe: { externalAssetId: 'edu-123', status: 'READY', attempt: 2 },
      }),
    );
    expect(out).not.toContain('abc');
    expect(out).toContain('[Redacted]');
    expect(out).toContain('edu-123');
    expect(out).toContain('READY');
  });

  it('detects secret material in serialized payloads', () => {
    expect(containsSecretMaterial('hello secret-world', ['secret-world'])).toEqual([
      'secret-world',
    ]);
    expect(containsSecretMaterial('clean', ['secret-world'])).toEqual([]);
  });

  it('truncates oversized values and nested depth', () => {
    const big = 'x'.repeat(5000);
    const out = sanitizeForLog({ blob: big }) as { blob: string };
    expect(out.blob.length).toBeLessThan(5000);
    expect(out.blob).toContain('[Truncated]');
  });
});
