/**
 * Identity integration: admin creation isolation, first-admin bootstrap
 * (success / refusal / concurrency / password silence), and the
 * database-level two-role invariant.
 */
import { execFile } from 'node:child_process';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapFirstAdmin } from '../../src/modules/identity/bootstrap.js';
import {
  authedPost,
  createWorld,
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

const BOOT_PASSWORD = 'bootstrap secret twelve words ok';

beforeAll(async () => {
  world = await createWorld();
});

afterAll(async () => {
  await world.close();
});

/**
 * Clear every admin so the one-time bootstrap precondition holds.
 *
 * This is the D13 invariant and it is genuinely global, so each test that needs
 * an admin-free table establishes it itself. Relying on the file's `beforeAll`
 * made the first test depend on being the first test in the file.
 */
async function clearAdmins(): Promise<void> {
  await world.prisma.user.deleteMany({ where: { role: 'ADMIN' } });
}

function runCli(env: Record<string, string>): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(
      'node',
      ['dist/bootstrap.js'],
      { cwd: '/srv/server', env: { ...process.env, ...env }, timeout: 60000 },
      (err, stdout, stderr) => {
        resolve({ code: err && 'code' in err ? Number((err as { code: unknown }).code) : 0, out: `${stdout}\n${stderr}` });
      },
    );
  });
}

describe('first-admin bootstrap CLI', () => {
  it('creates the first admin once and refuses repeats without revealing the password', async () => {
    // Bootstrap demands zero pre-existing admins; students never interfere.
    await clearAdmins();
    const email = uniqueEmail();
    const phone = uniquePhone();
    const first = await runCli({
      BOOTSTRAP_ADMIN_NAME: 'Bootstrap Admin',
      BOOTSTRAP_ADMIN_EMAIL: email,
      BOOTSTRAP_ADMIN_PHONE: phone,
      BOOTSTRAP_ADMIN_PASSWORD: BOOT_PASSWORD,
    });
    expect(first.code).toBe(0);
    expect(first.out).toContain(email);
    expect(first.out).not.toContain(BOOT_PASSWORD);

    const stored = await world.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.role).toBe('ADMIN');
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);

    const repeat = await runCli({
      BOOTSTRAP_ADMIN_NAME: 'Second Attempt',
      BOOTSTRAP_ADMIN_EMAIL: uniqueEmail(),
      BOOTSTRAP_ADMIN_PHONE: uniquePhone(),
      BOOTSTRAP_ADMIN_PASSWORD: 'another secret password twelve',
    });
    expect(repeat.code).toBe(1);
    expect(repeat.out).not.toContain('another secret password twelve');
  });

  it('exits non-zero on invalid input', async () => {
    const bad = await runCli({
      BOOTSTRAP_ADMIN_NAME: 'x',
      BOOTSTRAP_ADMIN_EMAIL: 'not-an-email',
      BOOTSTRAP_ADMIN_PHONE: uniquePhone(),
      BOOTSTRAP_ADMIN_PASSWORD: 'short',
    });
    expect(bad.code).toBe(1);
  });
});

describe('bootstrap concurrency and silence', () => {
  it('lets exactly one of two simultaneous bootstraps succeed', async () => {
    await clearAdmins();
    const params = { memoryKb: 8192, timeCost: 2, parallelism: 1 };
    const attempt = () =>
      bootstrapFirstAdmin(
        {
          displayName: 'Race Admin',
          email: uniqueEmail(),
          phone: uniquePhone(),
          password: 'concurrent secret twelve words',
        },
        { prisma: world.prisma, argon2: params },
      );
    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason = (rejected[0] as PromiseRejectedResult).reason as { code?: string };
    expect(reason.code).toBe('ADMIN_EXISTS');
    const admins = await world.prisma.user.count({ where: { role: 'ADMIN' } });
    expect(admins).toBe(1);
  });

  it('returns safe output containing neither password nor hash', async () => {
    await clearAdmins();
    const created = await bootstrapFirstAdmin(
      { displayName: 'Quiet Admin', email: uniqueEmail(), phone: uniquePhone(), password: 'silent secret twelve words' },
      { prisma: world.prisma, argon2: { memoryKb: 8192, timeCost: 2, parallelism: 1 } },
    );
    expect(created.role).toBe('ADMIN');
    const dumped = JSON.stringify(created);
    expect(dumped).not.toContain('silent secret twelve words');
    expect(dumped).not.toContain('passwordHash');
    expect(dumped).not.toContain('tokenHash');
  });
});

describe('admin creation endpoint', () => {
  it('lets an authenticated ADMIN create another ADMIN', async () => {
    await clearAdmins();
    const admin = await bootstrapFirstAdmin(
      { displayName: 'Root Admin', email: uniqueEmail(), phone: uniquePhone(), password: 'root secret twelve words' },
      { prisma: world.prisma, argon2: { memoryKb: 8192, timeCost: 2, parallelism: 1 } },
    );
    const session = await loginWith(world.app, admin.email, 'root secret twelve words');
    expect(session.status).toBe(200);
    expect(session.user.role).toBe('ADMIN');

    const email = uniqueEmail();
    const res = await authedPost(world.app, '/admin/users', session.jar, {
      displayName: 'Second Admin',
      email,
      phone: uniquePhone(),
      password: 'second secret twelve words',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    const secondLogin = await loginWith(world.app, email, 'second secret twelve words');
    expect(secondLogin.status).toBe(200);
    expect(secondLogin.user.role).toBe('ADMIN');
  });

  it('rejects unauthenticated and STUDENT attempts', async () => {
    const anon = await request(world.app)
      .post('/admin/users')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .send({ displayName: 'X', email: uniqueEmail(), phone: uniquePhone(), password: TEST_PASSWORD });
    expect(anon.status).toBe(401);

    const student = await registerStudent(world.app);
    const denied = await authedPost(world.app, '/admin/users', student.jar, {
      displayName: 'Sneaky',
      email: uniqueEmail(),
      phone: uniquePhone(),
      password: TEST_PASSWORD,
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects client-supplied roles and duplicate identifiers', async () => {
    await clearAdmins();
    const admin = await bootstrapFirstAdmin(
      { displayName: 'Root Two', email: uniqueEmail(), phone: uniquePhone(), password: 'root two secret twelve' },
      { prisma: world.prisma, argon2: { memoryKb: 8192, timeCost: 2, parallelism: 1 } },
    );
    const session = await loginWith(world.app, admin.email, 'root two secret twelve');
    const injected = await authedPost(world.app, '/admin/users', session.jar, {
      displayName: 'X',
      email: uniqueEmail(),
      phone: uniquePhone(),
      password: TEST_PASSWORD,
      role: 'STUDENT',
    });
    expect(injected.status).toBe(400);
    expect(injected.body.error.code).toBe('INVALID_FIELD');

    const dup = await authedPost(world.app, '/admin/users', session.jar, {
      displayName: 'Duplicate Name',
      email: admin.email,
      phone: uniquePhone(),
      password: TEST_PASSWORD,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
  });
});

describe('two-role invariant', () => {
  it('the database rejects any third role', async () => {
    await expect(
      world.prisma.$executeRaw`INSERT INTO "User"(id, email, phone, "displayName", "passwordHash", role) VALUES ('x', 'x@x.test', '+10000000000', 'X', 'h', 'SUPER')`,
    ).rejects.toThrow();
  });

  it('only STUDENT and ADMIN exist as enum labels', async () => {
    const rows = await world.prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'Role' ORDER BY enumlabel`;
    expect(rows.map((r) => r.enumlabel).sort()).toEqual(['ADMIN', 'STUDENT']);
  });
});
