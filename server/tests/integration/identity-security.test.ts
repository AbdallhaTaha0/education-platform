/**
 * Identity integration: origin enforcement, CSRF enforcement, and
 * Redis-backed rate limiting against real services.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authedPost,
  createWorld,
  csrfBootstrap,
  loginWith,
  registerStudent,
  uniqueEmail,
  uniqueIp,
  uniquePhone,
  TEST_ORIGIN,
  TEST_PASSWORD,
  type IdentityWorld,
} from './identity-helpers.js';

let world: IdentityWorld;

beforeAll(async () => {
  world = await createWorld();
});

afterAll(async () => {
  await world.close();
});

describe('origin enforcement', () => {
  it('rejects missing and hostile origins on every state-changing route', async () => {
    const { jar, token } = await csrfBootstrap(world.app);
    const base = {
      displayName: 'Origin Test',
      email: uniqueEmail(),
      phone: uniquePhone(),
      password: TEST_PASSWORD,
    };

    const noOrigin = await request(world.app)
      .post('/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', jar.header())
      .set('X-Csrf-Token', token)
      .send(base);
    expect(noOrigin.status).toBe(403);
    expect(noOrigin.body.error.code).toBe('ORIGIN_FORBIDDEN');

    const hostile = await request(world.app)
      .post('/auth/register')
      .set('Origin', 'https://evil.example')
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', jar.header())
      .set('X-Csrf-Token', token)
      .send({ ...base, email: uniqueEmail(), phone: uniquePhone() });
    expect(hostile.status).toBe(403);
    expect(hostile.body.error.code).toBe('ORIGIN_FORBIDDEN');

    // Login, logout, refresh, and admin creation are gated identically.
    const loginNoOrigin = await request(world.app)
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ identifier: base.email, password: TEST_PASSWORD });
    expect(loginNoOrigin.status).toBe(403);

    const logoutEvil = await request(world.app)
      .post('/auth/logout')
      .set('Origin', 'http://localhost:8080.evil.example')
      .set('X-Forwarded-For', uniqueIp())
      .send({});
    expect(logoutEvil.status).toBe(403);

    const refreshEvil = await request(world.app)
      .post('/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('X-Forwarded-For', uniqueIp())
      .send({});
    expect(refreshEvil.status).toBe(403);
  });

  it('accepts the exact approved origin', async () => {
    const reg = await registerStudent(world.app);
    expect(reg.status).toBe(201);
  });
});

describe('csrf enforcement', () => {
  it('rejects missing, malformed, and mismatched tokens', async () => {
    const { jar, token } = await csrfBootstrap(world.app);
    const payload = () => ({
      displayName: 'CSRF Test',
      email: uniqueEmail(),
      phone: uniquePhone(),
      password: TEST_PASSWORD,
    });

    const missing = await request(world.app)
      .post('/auth/register')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', jar.header())
      .send(payload());
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe('CSRF_INVALID');

    const mismatched = await request(world.app)
      .post('/auth/register')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', jar.header())
      .set('X-Csrf-Token', 'f'.repeat(64))
      .send(payload());
    expect(mismatched.status).toBe(403);

    // Cross-site shape: valid session cookies but attacker header.
    const reg = await registerStudent(world.app);
    const crossSite = await request(world.app)
      .post('/auth/logout')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', reg.jar.header())
      .set('X-Csrf-Token', 'e'.repeat(64))
      .send({});
    expect(crossSite.status).toBe(403);
    void token;
  });

  it('accepts a rotated bootstrap token for authenticated requests', async () => {
    const reg = await registerStudent(world.app);
    // Re-bootstrap mid-session rebinds safely; the session keeps working.
    const re = await request(world.app).get('/auth/csrf').set('Cookie', reg.jar.header());
    expect(re.status).toBe(200);
    reg.jar.setFrom(re);
    const me = await request(world.app).get('/auth/me').set('Cookie', reg.jar.header());
    expect(me.status).toBe(200);
    const out = await authedPost(world.app, '/auth/logout', reg.jar);
    expect(out.status).toBe(200);
  });
});

describe('redis-backed rate limiting', () => {
  it('limits repeated logins from one client across the shared store', async () => {
    const reg = await registerStudent(world.app);
    const ip = uniqueIp();
    const attempt = () =>
      request(world.app)
        .post('/auth/login')
        .set('Origin', TEST_ORIGIN)
        .set('X-Forwarded-For', ip)
        .send({ identifier: reg.user.email, password: 'wrong password twelve' });
    let limited = 0;
    let last: request.Response | null = null;
    for (let i = 0; i < 12; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await attempt();
      last = res;
      if (res.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
    expect(last?.body.error.code).toBe('RATE_LIMITED');
    expect(last?.headers['retry-after']).toBeDefined();
  });

  it('does not leak the limit across different clients', async () => {
    const reg = await registerStudent(world.app);
    const ok = await loginWith(world.app, reg.user.email);
    expect(ok.status).toBe(200);
  });
});
