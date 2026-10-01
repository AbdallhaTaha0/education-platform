/** Isolated populated 8->9 migration drill. No preview or external DRM access. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, 'postgres');
assert.equal(url.pathname, '/education_platform_test');
const database = `m6deliveryupgrade_${randomBytes(8).toString('hex')}`;
assert.match(database, /^m6deliveryupgrade_[a-f0-9]{16}$/);
const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';
const target = new URL(url);
target.pathname = `/${database}`;
const directory = mkdtempSync(path.join(tmpdir(), 'm6-delivery-upgrade-'));
const prior = path.join(directory, 'prior'),
  full = path.join(directory, 'full');
const control = new pg.Client({ connectionString: String(adminUrl) });
const db = new pg.Client({ connectionString: String(target) });
let created = false,
  connected = false;
function migrate(source) {
  execFileSync(
    'npx',
    ['--no-install', 'prisma', 'migrate', 'deploy', '--schema', path.join(source, 'schema.prisma')],
    { env: { ...process.env, DATABASE_URL: String(target) }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
}
async function snapshot() {
  const tables = [
    'User',
    'Wallet',
    'WalletLedgerEntry',
    'Subscription',
    'RechargeRequest',
    'Course',
  ];
  const rows = {};
  for (const table of tables)
    rows[table] = (
      await db.query(
        `SELECT COALESCE(jsonb_agg(to_jsonb(t) - 'firstPublicationAt' - 'notificationRecordedAt' ORDER BY id), '[]') AS data FROM "${table}" t`,
      )
    ).rows[0].data;
  return rows;
}
try {
  for (const dir of [prior, full]) cpSync('prisma', dir, { recursive: true });
  rmSync(path.join(prior, 'migrations', '20261001110000_m6_delivery'), { recursive: true });
  await control.connect();
  await control.query(`CREATE DATABASE "${database}"`);
  created = true;
  migrate(prior);
  await db.connect();
  connected = true;
  assert.equal(
    Number(
      (
        await db.query(
          'SELECT count(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
        )
      ).rows[0].n,
    ),
    8,
  );
  await db.query(`
    INSERT INTO "User" (id,email,phone,"displayName","passwordHash","updatedAt") VALUES ('student','m6-upgrade@example.test','+201000000999','Fixture','fixture',now());
    INSERT INTO "Wallet" (id,"userId","balancePiastres","updatedAt") VALUES ('wallet','student',10000,now());
    INSERT INTO "WalletLedgerEntry" (id,"walletId","amountPiastres","entryType","refType","refId") VALUES ('credit','wallet',10000,'CREDIT_RECHARGE','fixture','credit');
    INSERT INTO "Subscription" (id,"studentId","courseId","purchaseId","startsAt","expiresAt") VALUES ('sub','student','deleted-course','purchase',now()-interval '2 days',now()-interval '1 day');
    INSERT INTO "RechargeRequest" (id,"studentId","amountPiastres",channel,"referenceNorm","senderName","senderPhone","transferDate","proofFilename","proofMime","proofSize","proofHash",status,"reviewerId","reviewedAt","idempotencyKey","updatedAt")
    VALUES ('review','student',10000,'INSTAPAY','ABCD','Fixture','01012345678',now(),'fixture.png','image/png',1,repeat('f',64),'APPROVED','admin',now(),'key',now());
    INSERT INTO "Course" (id,slug,"titleAr","titleEn","descriptionAr","descriptionEn",status,"priorStatus","publishedAt","updatedAt") VALUES
    ('published','old-publication','اختبار','Fixture','اختبار','Fixture','PUBLISHED',NULL,now()-interval '1 day',now()),
    ('archived','old-archived','اختبار','Fixture','اختبار','Fixture','ARCHIVED','PUBLISHED',NULL,now()),
    ('draft','new-draft','اختبار','Fixture','اختبار','Fixture','DRAFT',NULL,NULL,now());
  `);
  const before = await snapshot();
  migrate(full);
  assert.deepEqual(await snapshot(), before);
  assert.equal(
    Number(
      (
        await db.query(
          'SELECT count(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
        )
      ).rows[0].n,
    ),
    9,
  );
  assert.equal(
    Number(
      (await db.query('SELECT count(*) AS n FROM "Course" WHERE "firstPublicationAt" IS NOT NULL'))
        .rows[0].n,
    ),
    2,
  );
  assert.equal(
    Number(
      (
        await db.query(
          'SELECT count(*) AS n FROM "RechargeRequest" WHERE "notificationRecordedAt" IS NOT NULL',
        )
      ).rows[0].n,
    ),
    1,
  );
  assert.equal(
    Number((await db.query('SELECT count(*) AS n FROM "NotificationEvent"')).rows[0].n),
    0,
  );
  assert.equal(
    Number((await db.query('SELECT count(*) AS n FROM "NotificationRollout"')).rows[0].n),
    1,
  );
  console.log(
    'M6 populated upgrade PASS: 8->9, six legacy table snapshots unchanged, source baselines established, zero historical events.',
  );
} finally {
  if (connected) await db.end();
  if (created) {
    await control.query(`DROP DATABASE "${database}"`);
    console.log('M6 owned upgrade database removed.');
  }
  await control.end();
  rmSync(directory, { recursive: true });
}
