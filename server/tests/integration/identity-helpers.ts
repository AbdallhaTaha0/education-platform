/**
 * Shared helpers for identity integration tests (real PostgreSQL + Redis).
 * Each state-changing request carries an exact approved Origin and a valid
 * CSRF pair, mirroring the browser client. Rate-limit isolation uses a
 * unique spoofed client IP per test (single X-Forwarded-For entry, which
 * Express resolves to req.ip with one trusted proxy hop, as behind Nginx).
 */
import request from 'supertest';
import type { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createApp } from '../../src/app.js';
import { loadConfig, type ServerConfig } from '../../src/config.js';
import { createPostgresPool, closePostgres } from '../../src/infra/postgres.js';
import { createRedisClient, closeRedis } from '../../src/infra/redis.js';
import { hashPassword } from '../../src/modules/identity/password.js';
import type { Clock } from '../../src/modules/identity/tokens.js';

export const TEST_ORIGIN = 'http://localhost:8080';

export interface IdentityWorld {
  app: Express;
  prisma: PrismaClient;
  redis: Redis;
  config: ServerConfig;
  close: () => Promise<void>;
}

export async function createWorld(
  overrides: Partial<ServerConfig> = {},
  clock?: Clock,
): Promise<IdentityWorld> {
  const config = { ...loadConfig(process.env), ...overrides };
  const pool = createPostgresPool(config.databaseUrl);
  const redis = createRedisClient(config.redisUrl);
  const prisma = new PrismaClient();
  const app = createApp(
    { config, postgresPool: pool, redisClient: redis, prisma },
    clock ? { clock } : {},
  );
  return {
    app,
    prisma,
    redis,
    config,
    close: async () => {
      await Promise.all([closePostgres(pool), closeRedis(redis), prisma.$disconnect()]);
    },
  };
}

/** Minimal cookie jar fed from Set-Cookie response headers. */
export class Jar {
  private values = new Map<string, string>();

  setFrom(res: { headers: Record<string, unknown> }): void {
    const raw = res.headers['set-cookie'];
    const list = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
    for (const header of list) {
      const pair = header.split(';', 1)[0] ?? '';
      const idx = pair.indexOf('=');
      if (idx > 0) this.values.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }

  header(): string {
    return [...this.values.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  get(name: string): string | undefined {
    return this.values.get(name);
  }

  csrf(): string {
    const token = this.values.get('edu_csrf');
    if (!token) throw new Error('missing edu_csrf in jar');
    return decodeURIComponent(token);
  }

  refresh(): string {
    const secret = this.values.get('edu_refresh');
    if (!secret) throw new Error('missing edu_refresh in jar');
    return decodeURIComponent(secret);
  }

  access(): string {
    const token = this.values.get('edu_access');
    if (!token) throw new Error('missing edu_access in jar');
    return decodeURIComponent(token);
  }
}

let counter = 0;

export function uniqueEmail(): string {
  counter += 1;
  return `m2t${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1e6)}@example.test`;
}

/** Valid Egyptian mobile numbers, unique per call. */
export function uniquePhone(): string {
  counter += 1;
  const tail = String(10000000 + Math.floor(Math.random() * 89999999));
  const prefix = ['010', '011', '012', '015'][(counter % 4) as 0 | 1 | 2 | 3] ?? '015';
  return `${prefix}${tail}`;
}

export function uniqueIp(): string {
  counter += 1;
  return `10.200.${counter % 250}.${1 + Math.floor(Math.random() * 250)}`;
}

export const TEST_PASSWORD = 'correct horse battery staple m2';

/**
 * Create an ADMIN owned by exactly this world, without touching any other admin.
 *
 * The one-time bootstrap rule (D13) is a product invariant and stays covered by
 * `identity-admin.test.ts`, which needs the admin-free table. Every other file
 * only needs "a world that owns an admin". Reaching for the bootstrap path
 * required a global `deleteMany({ role: 'ADMIN' })`, which silently destroyed
 * the sessions of worlds that were still alive and made the suite depend on
 * which file happened to run first. Inserting the row directly keeps each
 * world independent.
 */
export async function createTestAdmin(
  world: IdentityWorld,
  displayName: string,
  password: string,
): Promise<{ id: string; email: string }> {
  const email = uniqueEmail();
  const phone = uniquePhone();
  const passwordHash = await hashPassword(password, {
    memoryKb: 8192,
    timeCost: 2,
    parallelism: 1,
  });
  const created = await world.prisma.user.create({
    data: { email, phone, displayName, passwordHash, role: 'ADMIN' },
  });
  return { id: created.id, email };
}

/** Bootstrap a CSRF pair: GET /auth/csrf, keep cookie + token. */
export async function csrfBootstrap(app: Express): Promise<{ jar: Jar; token: string }> {
  const jar = new Jar();
  const res = await request(app).get('/auth/csrf');
  jar.setFrom(res);
  return { jar, token: jar.csrf() };
}

export interface Credential {
  jar: Jar;
  user: { id: string; email: string; phone: string; displayName: string; role: string };
}

/** Register a fresh STUDENT, returning the session jar + safe user. */
export async function registerStudent(
  app: Express,
  overrides: { email?: string; phone?: string; password?: string; displayName?: string } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Credential & { status: number; body: any }> {
  const { jar, token } = await csrfBootstrap(app);
  const res = await request(app)
    .post('/auth/register')
    .set('Origin', TEST_ORIGIN)
    .set('X-Forwarded-For', uniqueIp())
    .set('Cookie', jar.header())
    .set('X-Csrf-Token', token)
    .send({
      displayName: overrides.displayName ?? 'Test Student',
      email: overrides.email ?? uniqueEmail(),
      phone: overrides.phone ?? uniquePhone(),
      password: overrides.password ?? TEST_PASSWORD,
    });
  jar.setFrom(res);
  return {
    jar,
    user: (res.body as { data: { user: Credential['user'] } }).data?.user,
    status: res.status,
    body: res.body,
  };
}

/** Log in with an identifier, returning the session jar + safe user. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loginWith(
  app: Express,
  identifier: string,
  password = TEST_PASSWORD,
): Promise<Credential & { status: number; body: any }> {
  const { jar, token } = await csrfBootstrap(app);
  const res = await request(app)
    .post('/auth/login')
    .set('Origin', TEST_ORIGIN)
    .set('X-Forwarded-For', uniqueIp())
    .set('Cookie', jar.header())
    .set('X-Csrf-Token', token)
    .send({ identifier, password });
  jar.setFrom(res);
  return {
    jar,
    user: (res.body as { data: { user: Credential['user'] } }).data?.user,
    status: res.status,
    body: res.body,
  };
}

/** Authenticated POST carrying jar cookies + fresh CSRF header + origin. */
export function authedPost(
  app: Express,
  path: string,
  jar: Jar,
  body: Record<string, unknown> = {},
) {
  return request(app)
    .post(path)
    .set('Origin', TEST_ORIGIN)
    .set('X-Forwarded-For', uniqueIp())
    .set('Cookie', jar.header())
    .set('X-Csrf-Token', jar.csrf())
    .send(body);
}

/** Extract readable Set-Cookie values for leak scans. */
export function issuedSecrets(res: { headers: Record<string, unknown> }): string[] {
  const jar = new Jar();
  jar.setFrom(res);
  const out: string[] = [];
  for (const name of ['edu_access', 'edu_refresh']) {
    const value = jar.get(name);
    if (value) out.push(decodeURIComponent(value));
  }
  return out;
}

/** Read the session id from an access JWT payload (test introspection only;
 * never trusted — the server always verifies the signature). */
export function sessionIdFromJar(jar: Jar): string {
  const payload = jar.access().split('.')[1] ?? '';
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    sid?: string;
  };
  if (!decoded.sid) throw new Error('no sid in access token');
  return decoded.sid;
}

/** Parse a Set-Cookie Max-Age for an assertion. */
export function maxAgeOf(setCookies: string[], name: string): number {
  const header = setCookies.find((h) => h.startsWith(`${name}=`));
  const match = header?.match(/Max-Age=(\d+)/);
  if (!match) throw new Error(`no Max-Age for ${name}`);
  return Number(match[1]);
}

/** A world with a manually advanced clock for lifetime tests. */
export async function createClockedWorld(): Promise<
  IdentityWorld & { advance: (ms: number) => void; now: () => number }
> {
  let now = Date.now();
  const world = await createWorld({}, () => now);
  return {
    ...world,
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
