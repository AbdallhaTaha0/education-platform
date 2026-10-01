/**
 * Identity integration: lazy Redis connection concurrency and fail-closed
 * behavior against the real dependency (plus a dead one).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRedisClient, ensureRedis } from '../../src/infra/redis.js';
import { checkRateLimit } from '../../src/modules/identity/rateLimit.js';
import {
  createWorld,
  csrfBootstrap,
  registerStudent,
  uniqueIp,
  TEST_ORIGIN,
  type IdentityWorld,
} from './identity-helpers.js';

let world: IdentityWorld;

beforeAll(async () => {
  world = await createWorld();
});

afterAll(async () => {
  await world.close();
});

describe('lazy redis concurrency', () => {
  it('20 simultaneous first connections share one attempt', async () => {
    const fresh = createRedisClient(world.config.redisUrl);
    try {
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          ensureRedis(fresh).then(
            () => 'ok' as const,
            (err: unknown) => `failed: ${err instanceof Error ? err.message : err}`,
          ),
        ),
      );
      expect(results.every((r) => r === 'ok')).toBe(true);
      expect(fresh.status).toBe('ready');
    } finally {
      await fresh.disconnect();
    }
  });

  it('concurrent first identity requests produce no 500s', async () => {
    const cold = await createWorld();
    try {
      const attempts = await Promise.all(
        Array.from({ length: 10 }, () => registerStudent(cold.app)),
      );
      for (const res of attempts) {
        expect(res.status).toBe(201);
      }
    } finally {
      await cold.close();
    }
  });

  it('every rate-limit key carries a bounded TTL', async () => {
    await ensureRedis(world.redis);
    const ip = uniqueIp();
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await checkRateLimit(world.redis, 'probe', ip, { windowSec: 60, max: 10 });
    }
    const keys = await world.redis.keys('rl:probe:*');
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      // eslint-disable-next-line no-await-in-loop
      const ttl = await world.redis.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    }
  });
});

describe('unavailable redis fails closed', () => {
  it('identity writes are denied with a controlled error, never bypassed', async () => {
    const dead = await createWorld({ redisUrl: 'redis://127.0.0.1:5999' });
    try {
      const { jar, token } = await csrfBootstrap(dead.app);
      const res = await request(dead.app)
        .post('/auth/register')
        .set('Origin', TEST_ORIGIN)
        .set('X-Forwarded-For', uniqueIp())
        .set('Cookie', jar.header())
        .set('X-Csrf-Token', token)
        .send({
          displayName: 'Dead Redis',
          email: 'dead@example.test',
          phone: '+201000000001',
          password: 'dead secret twelve words',
        });
      // Controlled 500 envelope: the request is refused, rate limiting and
      // revocation checks are not silently skipped.
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('internal_error');
      expect(res.body.error.requestId).toBeDefined();
    } finally {
      await dead.close();
    }
  });

  it('authenticated reads fail closed instead of bypassing revocation', async () => {
    const reg = await registerStudent(world.app);
    const dead = await createWorld({ redisUrl: 'redis://127.0.0.1:5999' });
    try {
      const res = await request(dead.app).get('/auth/me').set('Cookie', reg.jar.header());
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('internal_error');
    } finally {
      await dead.close();
    }
  });
});
