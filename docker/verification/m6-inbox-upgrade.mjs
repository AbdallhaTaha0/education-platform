/** Docker-only, disposable M5 -> M6 migration drill. Never connects to DRM. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(url.hostname, 'postgres', 'use the isolated compose.test.yml PostgreSQL');
assert.equal(url.pathname, '/education_platform_test', 'refusing a non-test database');
const adminUrl = new URL(url); adminUrl.pathname = '/postgres';
const target = `upgradeprobe_m6_${randomBytes(8).toString('hex')}`;
assert.match(target, /^upgradeprobe_m6_[a-f0-9]{16}$/);
const targetUrl = new URL(url); targetUrl.pathname = `/${target}`;
const work = mkdtempSync(path.join(tmpdir(), 'm6-inbox-upgrade-'));
const priorDir = path.join(work, 'm5');
const fullDir = path.join(work, 'full');
const source = path.join(process.cwd(), 'prisma');
const addition = '20261001090000_m6_notifications';
let created = false;

async function database(connectionString, fn) {
  const client = new pg.Client({ connectionString: String(connectionString) });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}
function migrate(dir) {
  execFileSync('npx', ['--no-install', 'prisma', 'migrate', 'deploy', '--schema', path.join(dir, 'schema.prisma')], {
    env: { ...process.env, DATABASE_URL: String(targetUrl), PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
function drift(dir) {
  try {
    return execFileSync('npx', ['--no-install', 'prisma', 'migrate', 'diff', '--from-url', String(targetUrl),
      '--to-schema-datamodel', path.join(dir, 'schema.prisma'), '--exit-code'], {
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: 'true' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    if (err.status === 2 && typeof err.stdout === 'string') return err.stdout;
    throw err;
  }
}
const legacyTables = ['User', 'AuthSession', 'RefreshToken', 'Wallet', 'WalletLedgerEntry', 'Purchase',
  'Subscription', 'Course', 'CourseSection', 'Lesson', 'LessonProgress', 'PlaybackReference'];
async function snapshot(db) {
  const result = {};
  for (const table of legacyTables) {
    // Names are fixed locally, never caller input.
    result[table] = (await db.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id), '[]'::jsonb) AS rows FROM "${table}" t`)).rows[0].rows;
  }
  return result;
}
async function countMigrations(db) {
  return Number((await db.query('SELECT count(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')).rows[0].n);
}

try {
  for (const dir of [priorDir, fullDir]) cpSync(source, dir, { recursive: true });
  const names = readdirSync(path.join(fullDir, 'migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.equal(names.length, 8); assert.equal(names.at(-1), addition);
  rmSync(path.join(priorDir, 'migrations', addition), { recursive: true });
  // M6 is appended to the model and adds only three inverse User relations.
  // Reconstruct the prior datamodel to attribute inherited drift accurately.
  const schema = readFileSync(path.join(fullDir, 'schema.prisma'), 'utf8');
  const marker = schema.indexOf('/// M6 durable notification intent.');
  assert.ok(marker > 0);
  const priorSchema = schema.slice(0, marker).replace(/^  notifications Notification\[\]\r?\n/m, '')
    .replace(/^  notificationAudience NotificationAudience\[\]\r?\n/m, '')
    .replace(/^  notificationInboxState NotificationInboxState\?\r?\n/m, '');
  assert.ok(!priorSchema.includes('Notification'));
  writeFileSync(path.join(priorDir, 'schema.prisma'), priorSchema);
  await database(adminUrl, async (db) => { await db.query(`CREATE DATABASE "${target}"`); created = true; });
  migrate(priorDir);
  const priorDrift = drift(priorDir);
  const before = await database(targetUrl, async (db) => {
    assert.equal(await countMigrations(db), 7);
    await db.query(`
      INSERT INTO "User" (id,email,phone,"displayName","passwordHash",role,"updatedAt") VALUES
        ('student','m6-upgrade@example.test','+201000000091','Student','fixture','STUDENT',now()),
        ('admin','m6-upgrade-admin@example.test','+201000000092','Admin','fixture','ADMIN',now());
      INSERT INTO "AuthSession" (id,"userId","absoluteExpiresAt") VALUES ('session','student',now()+interval '1 day');
      INSERT INTO "RefreshToken" (id,"sessionId","tokenHash") VALUES ('refresh','session','fixture-hash');
      INSERT INTO "Wallet" (id,"userId","balancePiastres","updatedAt") VALUES ('wallet','student',9000,now());
      INSERT INTO "WalletLedgerEntry" (id,"walletId","amountPiastres","entryType","refType","refId") VALUES
        ('credit','wallet',10000,'CREDIT_RECHARGE','fixture','credit'),
        ('debit','wallet',-1000,'DEBIT_PURCHASE','fixture','debit');
      INSERT INTO "Course" (id,slug,"titleAr","titleEn","descriptionAr","descriptionEn",status,"updatedAt")
        VALUES ('course','m6-upgrade-course','دورة','Course','وصف','Description','PUBLISHED',now());
      INSERT INTO "CourseSection" (id,"courseId","titleAr","titleEn",position,"updatedAt")
        VALUES ('section','course','قسم','Section',1,now());
      INSERT INTO "Lesson" (id,"sectionId","titleAr","titleEn",position,"updatedAt")
        VALUES ('lesson','section','درس','Lesson',1,now());
      INSERT INTO "Purchase" (id,"studentId","planId","courseId","pricePiastres","durationDays","idempotencyKey")
        VALUES ('purchase','student','historical-plan','course',1000,30,'fixture-purchase');
      INSERT INTO "Subscription" (id,"studentId","courseId","purchaseId","startsAt","expiresAt")
        VALUES ('subscription','student','course','purchase',now(),now()+interval '30 days');
      INSERT INTO "LessonProgress" (id,"studentId","lessonId","courseId","positionSeconds","durationSeconds","updatedAt")
        VALUES ('progress','student','lesson','course',42.5,120,now());
      INSERT INTO "PlaybackReference" (id,"studentId","lessonId","courseId","externalSessionId","externalAssetId",
        provider,"tokenExpiresAt","sessionExpiresAt","updatedAt")
        VALUES ('playback','student','lesson','course','opaque-session','opaque-asset','fixture',
        now()+interval '5 minutes',now()+interval '1 hour',now());
    `);
    return snapshot(db);
  });
  migrate(fullDir);
  assert.equal(drift(fullDir), priorDrift, 'M6 must add no datamodel drift beyond the prior schema');
  await database(targetUrl, async (db) => {
    assert.equal(await countMigrations(db), 8);
    assert.deepEqual(await snapshot(db), before, 'legacy rows must remain byte-equivalent as JSON');
    const tables = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'
      AND table_name IN ('NotificationEvent','NotificationAudience','Notification','NotificationInboxState')`)).rows;
    assert.equal(tables.length, 4);
    for (const { table_name: table } of tables) {
      assert.equal(Number((await db.query(`SELECT count(*) AS n FROM "${table}"`)).rows[0].n), 0);
    }
  });
  // Deploying the same migration twice must preserve both rows and migration count.
  migrate(fullDir);
  await database(targetUrl, async (db) => {
    assert.equal(await countMigrations(db), 8); assert.deepEqual(await snapshot(db), before);
  });
  console.log('M6 UPGRADE PASS: 7 -> 8 migrations; 12 populated legacy tables unchanged; 4 empty notification tables; redeploy unchanged.');
  console.log('M6 drift comparison PASS: prior and upgraded drift are identical (inherited catalog index names).');
} catch (err) {
  // Exclude Prisma output/URLs and database connection details from evidence.
  console.error(`M6 UPGRADE FAIL: ${err instanceof assert.AssertionError ? err.message : 'migration or database operation failed'}`);
  process.exitCode = 1;
} finally {
  if (created) {
    try {
      await database(adminUrl, (db) => db.query(`DROP DATABASE "${target}"`));
      console.log('M6 upgrade database removed.');
    } catch { console.error('M6 upgrade database cleanup failed.'); process.exitCode = 1; }
  }
  assert.ok(work.startsWith(path.join(tmpdir(), 'm6-inbox-upgrade-')));
  rmSync(work, { recursive: true, force: true });
}
