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

const storageEnv = {
  STORAGE_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
  STORAGE_REGION: 'auto',
  STORAGE_ACCESS_KEY_ID: 'test-access-key',
  STORAGE_SECRET_ACCESS_KEY: 'test-storage-secret',
  STORAGE_BUCKET: 'fayq-lesson-files-prod',
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

  it('accepts valid production settings and ignores legacy DRM variables', () => {
    const config = loadConfig({
      ...baseEnv,
      ...storageEnv,
      PORT: '4000',
      NODE_ENV: 'production',
      COOKIE_SECURE: 'true',
      READY_TIMEOUT_MS: '1500',
      DRM_BASE_URL: 'https://legacy-drm.example.internal',
      DRM_CLIENT_ID: 'legacy-client',
      DRM_CLIENT_SECRET: 'legacy-secret',
    });
    expect(config.port).toBe(4000);
    expect(config.readyTimeoutMs).toBe(1500);
    expect(config.drmBaseUrl).toBeUndefined();
    expect(config.drmClientId).toBeUndefined();
    expect(config.drmClientSecret).toBeUndefined();
    expect(config.storageBucket).toBe(storageEnv.STORAGE_BUCKET);
    expect(config.isProduction).toBe(true);
    expect(config.cookieSecure).toBe(true);
    expect(config.jwtSecret).toBe(baseEnv.AUTH_JWT_SECRET);
    expect(config.allowedOrigins).toEqual(['http://localhost:8080']);
  });

  it('requires complete HTTPS object storage in production for lesson videos', () => {
    const production = { ...baseEnv, NODE_ENV: 'production', COOKIE_SECURE: 'true' };
    expect(() => loadConfig(production)).toThrow(/STORAGE_ENDPOINT.*required in production/);
    expect(() =>
      loadConfig({ ...production, STORAGE_ENDPOINT: storageEnv.STORAGE_ENDPOINT }),
    ).toThrow(/all-or-none/);
    expect(() =>
      loadConfig({
        ...production,
        ...storageEnv,
        STORAGE_ENDPOINT: 'http://account-id.r2.cloudflarestorage.com',
      }),
    ).toThrow(/STORAGE_ENDPOINT.*HTTPS/);
    const config = loadConfig({ ...production, ...storageEnv });
    expect(config.storageEndpoint).toBe(storageEnv.STORAGE_ENDPOINT);
    expect(config.storageRegion).toBe('auto');
    expect(config.storageBucket).toBe(storageEnv.STORAGE_BUCKET);
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
    expect(() => loadConfig({ ...baseEnv, AUTH_JWT_SECRET: 'too-short' })).toThrow(
      /AUTH_JWT_SECRET/,
    );
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
    expect(() => loadConfig({ ...baseEnv, ALLOWED_ORIGINS: 'not-a-url' })).toThrow(
      /ALLOWED_ORIGINS/,
    );
  });

  it('fails closed when production cookie security is disabled', () => {
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: 'production' })).toThrow(/COOKIE_SECURE/);
    expect(() =>
      loadConfig({ ...baseEnv, NODE_ENV: 'production', COOKIE_SECURE: 'false' }),
    ).toThrow(/COOKIE_SECURE/);
  });

  it('allows explicit insecure cookies outside production (local Docker HTTP)', () => {
    const config = loadConfig({ ...baseEnv, NODE_ENV: 'development' });
    expect(config.isProduction).toBe(false);
    expect(config.cookieSecure).toBe(false);
  });

  it('rejects reduced Argon2 cost outside NODE_ENV=test', () => {
    const weak = { ARGON2_MEMORY_KB: '1', ARGON2_TIME_COST: '1', ARGON2_PARALLELISM: '1' };
    expect(() =>
      loadConfig({ ...baseEnv, NODE_ENV: 'production', COOKIE_SECURE: 'true', ...weak }),
    ).toThrow(/Argon2/);
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

describe('no-DRM configuration', () => {
  it('does not expose playback assertion settings even when legacy values are present', () => {
    const config = loadConfig({
      ...baseEnv,
      DRM_ASSERTION_ISSUER: 'https://legacy.example',
      DRM_ASSERTION_AUDIENCE: 'legacy',
      DRM_ASSERTION_PRIVATE_KEY_B64: 'legacy-key',
      DRM_ASSERTION_KEY_ID: 'legacy-key-id',
      DRM_PUBLIC_BASE_URL: 'https://legacy.example',
    });
    expect(config.drmAssertionIssuer).toBeUndefined();
    expect(config.drmAssertionAudience).toBeUndefined();
    expect(config.drmAssertionAlgorithm).toBeUndefined();
    expect(config.drmAssertionSigningKey).toBeUndefined();
    expect(config.drmAssertionKeyId).toBeUndefined();
    expect(config.drmPublicBaseUrl).toBeUndefined();
  });
});

describe('redactUrlForLog', () => {
  it('exposes host only, never credentials or paths', () => {
    const redacted = redactUrlForLog(
      'postgresql://user:s3cret@db.internal:5432/app?sslmode=require',
    );
    expect(redacted).toBe('postgresql://db.internal:5432');
    expect(redacted).not.toContain('s3cret');
    expect(redacted).not.toContain('user');
  });

  it('handles unparseable input safely', () => {
    expect(redactUrlForLog('not a url')).toBe('unparseable-url');
  });
});
