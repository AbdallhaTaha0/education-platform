/**
 * Identity integration: registration, login, sessions, refresh rotation,
 * logout, expiry, cookies, and credential-leak scans — all against real
 * PostgreSQL + Redis in the disposable test project.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authedPost,
  createWorld,
  csrfBootstrap,
  issuedSecrets,
  loginWith,
  registerStudent,
  sessionIdFromJar,
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

describe('registration', () => {
  it('creates STUDENT with safe profile, session cookies, and 201', async () => {
    const { status, body, jar, user } = await registerStudent(world.app);
    expect(status).toBe(201);
    expect(user.role).toBe('STUDENT');
    expect(user.email).toContain('@example.test');
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('password');
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('passwordHash');
    expect(jar.get('edu_access')).toBeDefined();
    expect(jar.get('edu_refresh')).toBeDefined();
    expect(jar.get('edu_csrf')).toBeDefined();
  });

  it('never exposes issued credentials in JSON bodies', async () => {
    const reg = await registerStudent(world.app);
    const login = await loginWith(world.app, reg.user.email);
    const bodies = [JSON.stringify(reg.body), JSON.stringify(login.body)];
    const refresh = await authedPost(world.app, '/auth/refresh', login.jar);
    expect(refresh.status).toBe(200);
    bodies.push(JSON.stringify(refresh.body));
    const me = await request(world.app).get('/auth/me').set('Cookie', login.jar.header());
    bodies.push(JSON.stringify(me.body));
    const secrets = [...issuedSecrets({ headers: {} })];
    const jar2 = login.jar;
    for (const name of ['edu_access', 'edu_refresh']) {
      const v = jar2.get(name);
      if (v) secrets.push(decodeURIComponent(v));
    }
    for (const body of bodies) {
      for (const secret of secrets) {
        expect(body).not.toContain(secret);
      }
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('tokenHash');
    }
  });

  it('always creates STUDENT and rejects role injection', async () => {
    const { jar, token } = await csrfBootstrap(world.app);
    for (const body of [
      { displayName: 'X', email: uniqueEmail(), phone: uniquePhone(), password: TEST_PASSWORD, role: 'ADMIN' },
      { displayName: 'X', email: uniqueEmail(), phone: uniquePhone(), password: TEST_PASSWORD, isAdmin: true },
      { displayName: 'X', email: uniqueEmail(), phone: uniquePhone(), password: TEST_PASSWORD, role: 'STUDENT' },
    ]) {
      const res = await request(world.app)
        .post('/auth/register')
        .set('Origin', TEST_ORIGIN)
        .set('X-Forwarded-For', uniqueIp())
        .set('Cookie', jar.header())
        .set('X-Csrf-Token', token)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FIELD');
    }
  });

  it('rejects conflicts with distinct codes', async () => {
    const first = await registerStudent(world.app);
    expect(first.status).toBe(201);
    const dupEmail = await registerStudent(world.app, { email: first.user.email });
    expect(dupEmail.status).toBe(409);
    expect((dupEmail.body as { error: { code: string } }).error.code).toBe('EMAIL_TAKEN');
    const dupPhone = await registerStudent(world.app, { phone: first.user.phone });
    expect(dupPhone.status).toBe(409);
    expect((dupPhone.body as { error: { code: string } }).error.code).toBe('PHONE_TAKEN');
  });

  it('validates email, phone, and password policy', async () => {
    const badEmail = await registerStudent(world.app, { email: 'not-an-email' });
    expect(badEmail.status).toBe(400);
    const badPhone = await registerStudent(world.app, { phone: 'abc' });
    expect(badPhone.status).toBe(400);
    const shortPw = await registerStudent(world.app, { password: 'short1!' });
    expect(shortPw.status).toBe(400);
  });
});

describe('login with either identifier', () => {
  it('logs in independently with normalized email and local phone', async () => {
    const email = uniqueEmail();
    const reg = await registerStudent(world.app, { email });
    expect(reg.status).toBe(201);
    const byEmail = await loginWith(world.app, `  ${email.toUpperCase()}  `);
    expect(byEmail.status).toBe(200);
    expect(byEmail.user.id).toBe(reg.user.id);
    const storedPhone = reg.user.phone;
    const localForm = storedPhone.startsWith('+20') ? `0${storedPhone.slice(3)}` : storedPhone;
    const byPhone = await loginWith(world.app, localForm);
    expect(byPhone.status).toBe(200);
    expect(byPhone.user.id).toBe(reg.user.id);
  });

  it('returns one public failure shape for wrong and unknown identifiers', async () => {
    const reg = await registerStudent(world.app);
    const wrong = await loginWith(world.app, reg.user.email, 'wrong password twelve');
    const unknownEmail = await loginWith(world.app, uniqueEmail(), 'wrong password twelve');
    const unknownPhone = await loginWith(world.app, uniquePhone(), 'wrong password twelve');
    for (const res of [wrong, unknownEmail, unknownPhone]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
      });
    }
    expect(Object.keys(wrong.body).sort()).toEqual(Object.keys(unknownEmail.body).sort());
  });
});

describe('profile and cookies', () => {
  it('GET /auth/me returns the safe profile for the session owner', async () => {
    const reg = await registerStudent(world.app);
    const res = await request(world.app).get('/auth/me').set('Cookie', reg.jar.header());
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: reg.user.id, role: 'STUDENT' });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('rejects missing and tampered access credentials', async () => {
    const anon = await request(world.app).get('/auth/me');
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe('TOKEN_MISSING');
    const reg = await registerStudent(world.app);
    const tampered = await request(world.app)
      .get('/auth/me')
      .set('Cookie', `edu_access=${reg.jar.access().slice(0, -4)}xxxx`);
    expect(tampered.status).toBe(401);
    expect(tampered.body.error.code).toBe('TOKEN_INVALID');
  });

  it('sets development cookie attributes without Secure', async () => {
    const { token, jar: fresh } = await csrfBootstrap(world.app);
    const res = await request(world.app)
      .post('/auth/register')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', fresh.header())
      .set('X-Csrf-Token', token)
      .send({ displayName: 'Cookie Check', email: uniqueEmail(), phone: uniquePhone(), password: TEST_PASSWORD });
    expect(res.status).toBe(201);
    const setCookies = res.headers['set-cookie'] as unknown as string[];
    const access = setCookies.find((h) => h.startsWith('edu_access='));
    const refresh = setCookies.find((h) => h.startsWith('edu_refresh='));
    expect(access).toContain('Path=/api');
    expect(access).toContain('HttpOnly');
    expect(access).toContain('SameSite=Lax');
    expect(access).toContain('Max-Age=900');
    expect(access).not.toContain('Secure');
    expect(refresh).toContain('Path=/api/auth');
    expect(refresh).toContain('HttpOnly');
  });

  it('sets Secure cookies in production mode', async () => {
    const prod = await createWorld({ cookieSecure: true });
    try {
      const { jar, token } = await csrfBootstrap(prod.app);
      const res = await request(prod.app)
        .post('/auth/register')
        .set('Origin', TEST_ORIGIN)
        .set('X-Forwarded-For', uniqueIp())
        .set('Cookie', jar.header())
        .set('X-Csrf-Token', token)
        .send({ displayName: 'Secure Check', email: uniqueEmail(), phone: uniquePhone(), password: TEST_PASSWORD });
      expect(res.status).toBe(201);
      const setCookies = res.headers['set-cookie'] as unknown as string[];
      for (const header of setCookies) {
        expect(header).toContain('Secure');
      }
    } finally {
      await prod.close();
    }
  });

  it('stores argon2id hashes, never plaintext', async () => {
    const reg = await registerStudent(world.app, { password: TEST_PASSWORD });
    const row = await world.prisma.user.findUniqueOrThrow({ where: { id: reg.user.id } });
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row.passwordHash).not.toContain(TEST_PASSWORD);
  });
});

describe('refresh rotation and revocation', () => {
  it('rotates credentials; replay persists revocation durably', async () => {
    const reg = await registerStudent(world.app);
    const sessionId = sessionIdFromJar(reg.jar);
    const first = await authedPost(world.app, '/auth/refresh', reg.jar);
    expect(first.status).toBe(200);
    const rotated = first.headers['set-cookie'] as unknown as string[];
    expect(rotated.some((h) => h.startsWith('edu_refresh='))).toBe(true);
    expect(JSON.stringify(first.body)).not.toContain('edu_refresh');

    // Old credential replay → reuse revokes the whole family.
    const replay = await authedPost(world.app, '/auth/refresh', reg.jar);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSED');

    // Durability: revocation persisted in PostgreSQL, not just Redis.
    const session = await world.prisma.authSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.revokedAt).not.toBeNull();
    expect(session.revokeReason).toBe('reuse');
    const outstanding = await world.prisma.refreshToken.count({
      where: { sessionId, consumed: false },
    });
    expect(outstanding).toBe(0);

    // PostgreSQL stays authoritative after the tombstone is deleted.
    await world.redis.del(`sessrev:${sessionId}`);
    const freshJar = reg.jar;
    freshJar.setFrom(first);
    const me = await request(world.app).get('/auth/me').set('Cookie', freshJar.header());
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('SESSION_REVOKED');
    // The winner's rotated refresh credential is consumed too.
    const winnerRetry = await request(world.app)
      .post('/auth/refresh')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', freshJar.header())
      .set('X-Csrf-Token', freshJar.csrf())
      .send({});
    expect(winnerRetry.status).toBe(401);
  });

  it('allows at most one of two concurrent refreshes', async () => {
    const reg = await registerStudent(world.app);
    const attempt = () =>
      request(world.app)
        .post('/auth/refresh')
        .set('Origin', TEST_ORIGIN)
        .set('X-Forwarded-For', uniqueIp())
        .set('Cookie', reg.jar.header())
        .set('X-Csrf-Token', reg.jar.csrf())
        .send({});
    const [a, b] = await Promise.all([attempt(), attempt()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 401]);
    const loser = a.status === 401 ? a : b;
    const winner = a.status === 200 ? a : b;
    expect(loser.body.error.code).toBe('TOKEN_REUSED');
    // Family revoked: the winner's fresh credential fails too.
    const winnerJar = reg.jar;
    winnerJar.setFrom(winner);
    const retry = await request(world.app)
      .post('/auth/refresh')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', winnerJar.header())
      .set('X-Csrf-Token', winnerJar.csrf())
      .send({});
    expect(retry.status).toBe(401);
    const me = await request(world.app).get('/auth/me').set('Cookie', reg.jar.header());
    expect(me.status).toBe(401);
  });

  it('rejects malformed refresh credentials', async () => {
    const { jar } = await csrfBootstrap(world.app);
    const res = await request(world.app)
      .post('/auth/refresh')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', `${jar.header()}; edu_refresh=not-a-real-secret`)
      .set('X-Csrf-Token', jar.csrf())
      .send({});
    expect(res.status).toBe(401);
    expect(['TOKEN_INVALID', 'CSRF_INVALID']).toContain(res.body.error.code);
  });
});

describe('expiry with injected time', () => {
  it('denies access after the 15-minute token lifetime', async () => {
    const reg = await registerStudent(world.app);
    const live = await request(world.app).get('/auth/me').set('Cookie', reg.jar.header());
    expect(live.status).toBe(200);
    const future = await createWorld({}, () => Date.now() + 16 * 60 * 1000);
    try {
      const res = await request(future.app).get('/auth/me').set('Cookie', reg.jar.header());
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
    } finally {
      await future.close();
    }
  });

  it('denies refresh after the 30-day absolute session expiry', async () => {
    const reg = await registerStudent(world.app);
    const future = await createWorld({}, () => Date.now() + 31 * 24 * 60 * 60 * 1000);
    try {
      const res = await request(future.app)
        .post('/auth/refresh')
        .set('Origin', TEST_ORIGIN)
        .set('X-Forwarded-For', uniqueIp())
        .set('Cookie', reg.jar.header())
        .set('X-Csrf-Token', reg.jar.csrf())
        .send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
    } finally {
      await future.close();
    }
  });
});

describe('logout', () => {
  it('revokes immediately, clears cookies exactly, and stays idempotent', async () => {
    const reg = await registerStudent(world.app);
    const res = await authedPost(world.app, '/auth/logout', reg.jar);
    expect(res.status).toBe(200);
    const cleared = res.headers['set-cookie'] as unknown as string[];
    expect(cleared.some((h) => h.startsWith('edu_access=') && h.includes('Max-Age=0'))).toBe(true);
    expect(cleared.some((h) => h.startsWith('edu_refresh=') && h.includes('Path=/api/auth'))).toBe(true);

    const me = await request(world.app).get('/auth/me').set('Cookie', reg.jar.header());
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('SESSION_REVOKED');

    // Idempotent: again, and also with no credentials at all.
    const again = await authedPost(world.app, '/auth/logout', reg.jar);
    expect(again.status).toBe(200);
    const { jar } = await csrfBootstrap(world.app);
    const bare = await request(world.app)
      .post('/auth/logout')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', jar.header())
      .send({});
    expect(bare.status).toBe(200);
  });

  it('revokes via the access cookie when the refresh cookie is missing', async () => {
    const reg = await registerStudent(world.app);
    const sessionId = sessionIdFromJar(reg.jar);
    const accessOnly = `edu_access=${encodeURIComponent(reg.jar.access())}`;
    const res = await request(world.app)
      .post('/auth/logout')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .set('Cookie', accessOnly)
      .send({});
    expect(res.status).toBe(200);
    const session = await world.prisma.authSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.revokedAt).not.toBeNull();
    expect(session.revokeReason).toBe('logout');
    const me = await request(world.app).get('/auth/me').set('Cookie', reg.jar.header());
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('SESSION_REVOKED');
  });

  it('stays revoked after the tombstone is deleted', async () => {
    const reg = await registerStudent(world.app);
    const sessionId = sessionIdFromJar(reg.jar);
    const res = await authedPost(world.app, '/auth/logout', reg.jar);
    expect(res.status).toBe(200);
    await world.redis.del(`sessrev:${sessionId}`);
    const me = await request(world.app).get('/auth/me').set('Cookie', reg.jar.header());
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('SESSION_REVOKED');
  });

  it('logout-all revokes every session of the user only', async () => {
    const email = uniqueEmail();
    const password = TEST_PASSWORD;
    const first = await registerStudent(world.app, { email, password });
    expect(first.status).toBe(201);
    const second = await loginWith(world.app, email, password);
    expect(second.status).toBe(200);
    const other = await registerStudent(world.app, { password });
    expect(other.status).toBe(201);

    const res = await authedPost(world.app, '/auth/logout-all', first.jar);
    expect(res.status).toBe(200);
    expect(res.body.data.revoked).toBe(2);

    for (const jar of [first.jar, second.jar]) {
      const me = await request(world.app).get('/auth/me').set('Cookie', jar.header());
      expect(me.status).toBe(401);
    }
    const otherMe = await request(world.app).get('/auth/me').set('Cookie', other.jar.header());
    expect(otherMe.status).toBe(200);
  });
});
