import { describe, expect, it } from 'vitest';
import { loadConfig, redactUrlForLog } from '../../src/config.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://postgres:postgres@postgres:5432/education_platform',
  REDIS_URL: 'redis://redis:6379',
};

describe('loadConfig', () => {
  it('applies safe defaults for optional settings', () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('development');
    expect(config.logLevel).toBe('info');
    expect(config.readyTimeoutMs).toBe(2000);
    expect(config.drmBaseUrl).toBeUndefined();
  });

  it('accepts explicit valid values including optional DRM settings', () => {
    const config = loadConfig({
      ...baseEnv,
      PORT: '4000',
      NODE_ENV: 'production',
      READY_TIMEOUT_MS: '1500',
      DRM_BASE_URL: 'https://drm.example.internal',
    });
    expect(config.port).toBe(4000);
    expect(config.readyTimeoutMs).toBe(1500);
    expect(config.drmBaseUrl).toBe('https://drm.example.internal');
  });

  it('rejects missing required platform dependencies', () => {
    expect(() => loadConfig({ REDIS_URL: baseEnv.REDIS_URL })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: baseEnv.DATABASE_URL })).toThrow(/REDIS_URL/);
  });

  it('rejects invalid ports and timeouts', () => {
    expect(() => loadConfig({ ...baseEnv, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...baseEnv, PORT: '70000' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...baseEnv, READY_TIMEOUT_MS: '-5' })).toThrow(/READY_TIMEOUT_MS/);
  });
});

describe('redactUrlForLog', () => {
  it('exposes host only, never credentials or paths', () => {
    const redacted = redactUrlForLog('postgresql://user:s3cret@db.internal:5432/app?sslmode=require');
    expect(redacted).toBe('postgresql://db.internal:5432');
    expect(redacted).not.toContain('s3cret');
    expect(redacted).not.toContain('user');
  });

  it('handles unparseable input safely', () => {
    expect(redactUrlForLog('not a url')).toBe('unparseable-url');
  });
});
