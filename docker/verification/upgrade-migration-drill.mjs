/**
 * Upgrade-migration drill (TEST-ONLY, disposable).
 *
 * Proves the M5 migration applies on top of the ACCEPTED M4 schema (the six
 * accepted migrations) as an upgrade on a database that already holds rows, not
 * only from an empty state. It creates its own uniquely named database through
 * the `postgres` maintenance database and refuses to run unless that name is
 * clearly disposable, so it can never touch development or production data.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;
const adminUrl = process.env.UPGRADE_ADMIN_URL;
const sourceDir = process.env.UPGRADE_MIGRATIONS_DIR;
const target = process.env.UPGRADE_DB_NAME;
const m4Cutoff = process.env.UPGRADE_M4_PREFIX;

if (!adminUrl || !sourceDir || !target || !m4Cutoff) {
  console.error('missing required environment');
  process.exit(2);
}
if (!/^upgradeprobe_[a-z0-9_]+$/.test(target)) {
  console.error('refusing: unsafe target database name');
  process.exit(2);
}
const targetUrl = adminUrl.replace(/\/[^/?]+(\?|$)/, `/${target}$1`);

const workRoot = '/tmp/upgrade-drill';
const m4Dir = path.join(workRoot, 'm4');
const fullDir = path.join(workRoot, 'full');

async function withClient(url, fn) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function scalar(client, sql) {
  const res = await client.query(sql);
  return String(res.rows[0].v);
}

function migrate(dir, url) {
  // Run from the server package so `npx prisma` resolves, and point it at the
  // STAGED schema: the migrations directory is derived from the schema location,
  // which is exactly the set being applied.
  execFileSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--schema', path.join(dir, 'schema.prisma')],
    {
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: url },
      cwd: process.env.UPGRADE_WORKSPACE ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

const main = async () => {
  await withClient(adminUrl, async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS "${target}"`);
    await admin.query(`CREATE DATABASE "${target}"`);
  });

  rmSync(workRoot, { recursive: true, force: true });
  mkdirSync(m4Dir, { recursive: true });
  mkdirSync(fullDir, { recursive: true });
  for (const dir of [m4Dir, fullDir]) {
    cpSync(path.join(sourceDir, 'migrations'), path.join(dir, 'migrations'), { recursive: true });
    cpSync(path.join(sourceDir, 'schema.prisma'), path.join(dir, 'schema.prisma'));
  }

  // Stage 1: the accepted M4 state only. Count migration DIRECTORIES; the
  // migrations folder also holds a Prisma lock file.
  for (const entry of readdirSync(path.join(m4Dir, 'migrations'))) {
    if (entry.startsWith(m4Cutoff))
      rmSync(path.join(m4Dir, 'migrations', entry), { recursive: true, force: true });
  }
  const m4Count = readdirSync(path.join(m4Dir, 'migrations'), { withFileTypes: true }).filter(
    (entry) => entry.isDirectory(),
  ).length;
  if (m4Count !== 6) {
    console.error(`unexpected M4 migration count: ${m4Count}`);
    process.exit(1);
  }
  migrate(m4Dir, targetUrl);

  const result = await withClient(targetUrl, async (db) => {
    const afterM4 = await scalar(
      db,
      'SELECT count(*) AS v FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
    );
    // Representative accepted-state rows, so the upgrade runs against real data.
    await db.query(
      `INSERT INTO "User"(id,email,phone,"displayName","passwordHash",role,"createdAt","updatedAt") VALUES
        ('11111111-1111-4111-8111-111111111111','probe@example.test','+201000000099','Probe','x','STUDENT',now(),now()),
        ('22222222-2222-4222-8222-222222222222','probe-admin@example.test','+201000000098','Probe Admin','x','ADMIN',now(),now())`,
    );
    await db.query(
      `INSERT INTO "Course"(id,slug,"titleAr","titleEn","descriptionAr","descriptionEn",status,"createdAt","updatedAt")
       VALUES ('33333333-3333-4333-8333-333333333333','probe-course','course','Course','d','d','PUBLISHED',now(),now())`,
    );
    const usersBefore = await scalar(db, 'SELECT count(*) AS v FROM "User"');
    const coursesBefore = await scalar(db, 'SELECT count(*) AS v FROM "Course"');
    return { afterM4, usersBefore, coursesBefore };
  });

  // Stage 2: the upgrade.
  migrate(fullDir, targetUrl);

  const after = await withClient(targetUrl, async (db) => {
    const applied = await scalar(
      db,
      'SELECT count(*) AS v FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
    );
    const users = await scalar(db, 'SELECT count(*) AS v FROM "User"');
    const courses = await scalar(db, 'SELECT count(*) AS v FROM "Course"');
    const m5Tables = await scalar(
      db,
      `SELECT count(*) AS v FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('PlaybackReference','LessonProgress')`,
    );
    return { applied, users, courses, m5Tables };
  });

  console.log(`stage1 applied=${result.afterM4}`);
  console.log(`stage2 applied=${after.applied}`);
  console.log(`users ${result.usersBefore} -> ${after.users}`);
  console.log(`courses ${result.coursesBefore} -> ${after.courses}`);
  console.log(`m5_tables=${after.m5Tables}`);

  const ok =
    result.afterM4 === '6' &&
    after.applied === '7' &&
    result.usersBefore === after.users &&
    result.coursesBefore === after.courses &&
    after.m5Tables === '2';
  console.log(ok ? 'UPGRADE-DRILL PASS' : 'UPGRADE-DRILL FAIL');

  await withClient(adminUrl, async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS "${target}"`);
  });
  rmSync(workRoot, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
};

main().catch((err) => {
  console.error(`upgrade drill failed: ${err && err.code ? err.code : 'error'}`);
  process.exit(1);
});
