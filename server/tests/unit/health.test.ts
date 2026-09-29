import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import { createApp } from '../../src/app.js';
import type { ServerConfig } from '../../src/config.js';
import { REQUEST_ID_HEADER } from '../../src/middleware/requestId.js';

const config: ServerConfig = {
  nodeEnv: 'test',
  port: 3000,
  databaseUrl: 'postgresql://postgres:postgres@postgres:5432/education_platform',
  redisUrl: 'redis://redis:6379',
  logLevel: 'silent',
  serviceName: 'education-platform-server',
  serviceVersion: '0.3.0-m3-test',
  readyTimeoutMs: 1000,
  drmRequestTimeoutMs: 1000,
  drmMaxRetries: 2,
  isProduction: false,
  jwtSecret: 'test-secret-that-is-long-enough-32',
  authIssuer: 'edu-platform-test',
  authAudience: 'edu-platform-test-web',
  allowedOrigins: ['http://localhost:8080'],
  cookieSecure: false,
  argon2: { memoryKb: 8192, timeCost: 2, parallelism: 1 },
};

const up = { status: 'up' as const, latencyMs: 1 };
const down = { status: 'down' as const, latencyMs: 1 };

function buildApp(checks: { postgres?: typeof up | typeof down; redis?: typeof up | typeof down } = {}) {
  return createApp(
    {
      config,
      postgresPool: {} as Pool,
      redisClient: {} as Redis,
      prisma: {} as PrismaClient,
    },
    {
      checkPostgresFn: vi.fn().mockResolvedValue(checks.postgres ?? up),
      checkRedisFn: vi.fn().mockResolvedValue(checks.redis ?? up),
    },
  );
}

describe('health endpoints (stubbed dependencies)', () => {
  it('GET /health/live confirms the process without touching dependencies', async () => {
    const res = await request(buildApp()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('education-platform-server');
    expect(res.headers[REQUEST_ID_HEADER]).toBeDefined();
  });

  it('GET /health/ready returns 200 when required dependencies are up', async () => {
    const res = await request(buildApp()).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.postgres.status).toBe('up');
    expect(res.body.checks.redis.status).toBe('up');
    // Optional external DRM is reported, never gating.
    expect(res.body.drm.mode).toBe('optional-external');
  });

  it('GET /health/ready returns 503 when a required dependency is down', async () => {
    const res = await request(buildApp({ redis: down })).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.checks.redis.status).toBe('down');
    expect(JSON.stringify(res.body)).not.toContain('redis://');
  });

  it('echoes a caller-provided request id', async () => {
    const res = await request(buildApp()).get('/health/live').set(REQUEST_ID_HEADER, 'abc-123');
    expect(res.headers[REQUEST_ID_HEADER]).toBe('abc-123');
  });

  it('returns safe JSON for unknown routes', async () => {
    const res = await request(buildApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
