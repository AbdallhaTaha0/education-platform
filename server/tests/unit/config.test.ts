import { describe, expect, it } from 'vitest';
import { loadConfig, redactUrlForLog } from '../../src/config.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://postgres:postgres@postgres:5432/education_platform',
  REDIS_URL: 'redis://redis:6379',
  AUTH_JWT_SECRET: 'test-secret-that-is-long-enough-32',
  AUTH_ISSUER: 'edu-platform-test',
  AUTH_AUDIENCE: 'edu-platform-test-web',
  ALLOWED_ORIGINS: 'http://localhost:8080',
};

describe('loadConfig', () => {
  it('applies safe defaults for optional settings', () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('development');
    expect(config.logLevel).toBe('info');
    expect(config.readyTimeoutMs).toBe(2000);
    expect(config.drmBaseUrl).toBeUndefined();
    expect(config.drmRequestTimeoutMs).toBe(5000);
    expect(config.drmMaxRetries).toBe(2);
  });

  it('accepts explicit valid values including optional DRM settings', () => {
    const config = loadConfig({
      ...baseEnv,
      PORT: '4000',
      NODE_ENV: 'production',
      COOKIE_SECURE: 'true',
      READY_TIMEOUT_MS: '1500',
      DRM_BASE_URL: 'https://drm.example.internal',
      DRM_CLIENT_ID: 'test-client-01',
      DRM_CLIENT_SECRET: 'test-secret-that-is-long-enough-0123456789',
    });
    expect(config.port).toBe(4000);
    expect(config.readyTimeoutMs).toBe(1500);
    expect(config.drmBaseUrl).toBe('https://drm.example.internal');
    expect(config.isProduction).toBe(true);
    expect(config.cookieSecure).toBe(true);
    expect(config.jwtSecret).toBe(baseEnv.AUTH_JWT_SECRET);
    expect(config.allowedOrigins).toEqual(['http://localhost:8080']);
  });

  it('rejects partial DRM configuration (all-or-none)', () => {
    expect(() => loadConfig({ ...baseEnv, DRM_BASE_URL: 'https://drm.example.internal' })).toThrow(/DRM/);
    expect(() => loadConfig({ ...baseEnv, DRM_CLIENT_ID: 'abc12345' })).toThrow(/DRM/);
    expect(() =>
      loadConfig({ ...baseEnv, DRM_BASE_URL: 'https://x.example', DRM_CLIENT_ID: 'abc12345' }),
    ).toThrow(/DRM/);
  });

  it('rejects out-of-range DRM timeout/retry bounds', () => {
    expect(() => loadConfig({ ...baseEnv, DRM_REQUEST_TIMEOUT_MS: '10' })).toThrow(/DRM_REQUEST_TIMEOUT_MS/);
    expect(() => loadConfig({ ...baseEnv, DRM_REQUEST_TIMEOUT_MS: '99999' })).toThrow(/DRM_REQUEST_TIMEOUT_MS/);
    expect(() => loadConfig({ ...baseEnv, DRM_MAX_RETRIES: '-1' })).toThrow(/DRM_MAX_RETRIES/);
    expect(() => loadConfig({ ...baseEnv, DRM_MAX_RETRIES: '9' })).toThrow(/DRM_MAX_RETRIES/);
    const ok = loadConfig({ ...baseEnv, DRM_REQUEST_TIMEOUT_MS: '250', DRM_MAX_RETRIES: '0' });
    expect(ok.drmRequestTimeoutMs).toBe(250);
    expect(ok.drmMaxRetries).toBe(0);
  });

  it('requires HTTPS DRM URL and full credentials in production', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
        DRM_BASE_URL: 'http://drm.example.internal',
        DRM_CLIENT_ID: 'test-client-01',
        DRM_CLIENT_SECRET: 'test-secret-that-is-long-enough-0123456789',
      }),
    ).toThrow(/HTTPS/);
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: 'production', COOKIE_SECURE: 'true' })).toThrow(/DRM/);
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

  it('fails closed when the signing secret is missing or weak', () => {
    const { AUTH_JWT_SECRET: _drop, ...noSecret } = baseEnv;
    expect(() => loadConfig(noSecret)).toThrow(/AUTH_JWT_SECRET/);
    expect(() => loadConfig({ ...baseEnv, AUTH_JWT_SECRET: 'too-short' })).toThrow(/AUTH_JWT_SECRET/);
  });

  it('fails closed when issuer or audience is missing or wildcarded', () => {
    const { AUTH_ISSUER: _i, ...noIssuer } = baseEnv;
    expect(() => loadConfig(noIssuer)).toThrow(/AUTH_ISSUER/);
    expect(() => loadConfig({ ...baseEnv, AUTH_AUDIENCE: '*' })).toThrow(/AUTH_AUDIENCE/);
  });

  it('fails closed on missing or wildcarded origins', () => {
    const { ALLOWED_ORIGINS: _o, ...noOrigins } = baseEnv;
    expect(() => loadConfig(noOrigins)).toThrow(/ALLOWED_ORIGINS/);
    expect(() => loadConfig({ ...baseEnv, ALLOWED_ORIGINS: '*' })).toThrow(/ALLOWED_ORIGINS/);
    expect(() => loadConfig({ ...baseEnv, ALLOWED_ORIGINS: 'not-a-url' })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('fails closed when production cookie security is disabled', () => {
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: 'production' })).toThrow(/COOKIE_SECURE/);
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: 'production', COOKIE_SECURE: 'false' })).toThrow(
      /COOKIE_SECURE/,
    );
  });

  it('allows explicit insecure cookies outside production (local Docker HTTP)', () => {
    const config = loadConfig({ ...baseEnv, NODE_ENV: 'development' });
    expect(config.isProduction).toBe(false);
    expect(config.cookieSecure).toBe(false);
  });

  it('rejects reduced Argon2 cost outside NODE_ENV=test', () => {
    const weak = { ARGON2_MEMORY_KB: '1', ARGON2_TIME_COST: '1', ARGON2_PARALLELISM: '1' };
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: 'production', COOKIE_SECURE: 'true', ...weak })).toThrow(
      /Argon2/,
    );
    expect(() => loadConfig({ ...baseEnv, ...weak })).toThrow(/Argon2/);
    const testEnv = loadConfig({ ...baseEnv, NODE_ENV: 'test', ...weak });
    expect(testEnv.argon2).toEqual({ memoryKb: 1, timeCost: 1, parallelism: 1 });
  });

  it('rejects absurd Argon2 cost in every environment', () => {
    const huge = { ARGON2_MEMORY_KB: '99999999' };
    expect(() => loadConfig({ ...baseEnv, ...huge })).toThrow(/Argon2/);
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: 'test', ...huge })).toThrow(/Argon2/);
    expect(() => loadConfig({ ...baseEnv, ARGON2_TIME_COST: '99' })).toThrow(/Argon2/);
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
