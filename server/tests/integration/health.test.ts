/**
 * Integration: health endpoints against REAL platform PostgreSQL + Redis.
 *
 * Runs inside Docker (docker/compose.test.yml `test` service) where
 * DATABASE_URL/REDIS_URL point at isolated test containers. Never run this
 * against development or production data.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { createPostgresPool, closePostgres } from '../../src/infra/postgres.js';
import { createRedisClient, closeRedis } from '../../src/infra/redis.js';

const config = loadConfig(process.env);
const pool = createPostgresPool(config.databaseUrl);
const redis = createRedisClient(config.redisUrl);
const prisma = new PrismaClient();
const app = createApp({ config, postgresPool: pool, redisClient: redis, prisma });

afterAll(async () => {
  await Promise.all([closePostgres(pool), closeRedis(redis), prisma.$disconnect()]);
});

describe('health integration (real postgres + redis)', () => {
  it('liveness responds without dependencies', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('readiness is 200 when platform dependencies are reachable', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.postgres.status).toBe('up');
    expect(res.body.checks.redis.status).toBe('up');
  });

  it('readiness is 503 when dependencies are unreachable (bounded)', async () => {
    const badApp = createApp({
      config: { ...config, readyTimeoutMs: 500 },
      postgresPool: createPostgresPool('postgresql://invalid:5432@127.0.0.1:5999/nope'),
      redisClient: createRedisClient('redis://127.0.0.1:5998'),
      prisma,
    });
    const started = Date.now();
    const res = await request(badApp).get('/health/ready');
    const elapsed = Date.now() - started;
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    // Bounded: must fail fast, not hang on default driver timeouts.
    expect(elapsed).toBeLessThan(10_000);
    expect(JSON.stringify(res.body)).not.toContain('5999');
  });
});
