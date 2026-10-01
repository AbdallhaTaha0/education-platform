/**
 * Identity integration: CSRF synchronizer lifetime aligned with the 30-day
 * absolute session (real PostgreSQL + Redis, mutable clock).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authedPost,
  createClockedWorld,
  maxAgeOf,
  registerStudent,
  sessionIdFromJar,
  uniqueIp,
  TEST_ORIGIN,
  type IdentityWorld,
} from './identity-helpers.js';

let clocked: IdentityWorld & { advance: (ms: number) => void; now: () => number };
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  clocked = await createClockedWorld();
});

afterAll(async () => {
  await clocked.close();
});

describe('csrf session lifetime', () => {
  it('refreshes after two idle days within the absolute lifetime', async () => {
    const reg = await registerStudent(clocked.app);
    expect(reg.status).toBe(201);
    clocked.advance(2 * DAY);
    const res = await authedPost(clocked.app, '/auth/refresh', reg.jar);
    expect(res.status).toBe(200);
    const setCookies = res.headers['set-cookie'] as unknown as string[];
    expect(maxAgeOf(setCookies, 'edu_csrf')).toBeLessThanOrEqual(
      maxAgeOf(setCookies, 'edu_refresh'),
    );
  });

  it('bootstrap during an active session rebinds without breaking refresh', async () => {
    const reg = await registerStudent(clocked.app);
    const boot = await request(clocked.app).get('/auth/csrf').set('Cookie', reg.jar.header());
    expect(boot.status).toBe(200);
    const bootCookies = boot.headers['set-cookie'] as unknown as string[];
    expect(bootCookies.some((h) => h.startsWith('edu_csrf='))).toBe(true);
    reg.jar.setFrom(boot);
    const res = await authedPost(clocked.app, '/auth/refresh', reg.jar);
    expect(res.status).toBe(200);
  });

  it('cookie lifetimes never exceed the remaining absolute lifetime', async () => {
    const reg = await registerStudent(clocked.app);
    // Near the end of absolute life, rotation issues short-lived cookies.
    clocked.advance(29 * DAY);
    const res = await authedPost(clocked.app, '/auth/refresh', reg.jar);
    expect(res.status).toBe(200);
    const setCookies = res.headers['set-cookie'] as unknown as string[];
    const refreshAge = maxAgeOf(setCookies, 'edu_refresh');
    const csrfAge = maxAgeOf(setCookies, 'edu_csrf');
    expect(refreshAge).toBeLessThanOrEqual(DAY + 60);
    expect(refreshAge).toBeGreaterThan(0);
    expect(csrfAge).toBeLessThanOrEqual(refreshAge);
  });

  it('rejects cross-session csrf values', async () => {
    const a = await registerStudent(clocked.app);
    const b = await registerStudent(clocked.app);
    const res = await request(clocked.app)
      .post('/auth/refresh')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', b.jar.header())
      .set('X-Csrf-Token', a.jar.csrf())
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('refuses bootstrap on an expired session without clobbering cookies', async () => {
    const reg = await registerStudent(clocked.app);
    clocked.advance(31 * DAY);
    const boot = await request(clocked.app).get('/auth/csrf').set('Cookie', reg.jar.header());
    expect(boot.status).toBe(401);
    expect(boot.body.error.code).toBe('SESSION_EXPIRED');
    const setCookies = (boot.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    expect(setCookies.some((h) => h.startsWith('edu_csrf='))).toBe(false);
  });

  it('missing session csrf state fails closed without consuming the credential', async () => {
    const reg = await registerStudent(clocked.app);
    const sessionId = sessionIdFromJar(reg.jar);
    await clocked.prisma.authSession.update({ where: { id: sessionId }, data: { csrfHash: null } });
    const res = await authedPost(clocked.app, '/auth/refresh', reg.jar);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
    const session = await clocked.prisma.authSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(session.revokedAt).toBeNull();
    const outstanding = await clocked.prisma.refreshToken.count({
      where: { sessionId, consumed: false },
    });
    expect(outstanding).toBe(1);
  });
});
