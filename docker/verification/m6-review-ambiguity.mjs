/** Independent reviewer reproduction; Docker-only, disposable owned database. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
const sourceUrl = new URL(process.env.DATABASE_URL);
assert.equal(sourceUrl.hostname, 'postgres'); assert.equal(sourceUrl.pathname, '/education_platform_test');
const database = `m6review_${randomBytes(8).toString('hex')}`;
assert.match(database, /^m6review_[a-f0-9]{16}$/);
const controlUrl = new URL(sourceUrl); controlUrl.pathname = '/postgres';
const targetUrl = new URL(sourceUrl); targetUrl.pathname = `/${database}`;
const directory = mkdtempSync(path.join(tmpdir(), 'm6-review-'));
const prior = path.join(directory, 'prior'), full = path.join(directory, 'full');
const control = new pg.Client({ connectionString: String(controlUrl) });
const db = new pg.Client({ connectionString: String(targetUrl) });
let created = false, connected = false;
function migrate(source) {
  return execFileSync('npx', ['--no-install', 'prisma', 'migrate', 'deploy', '--schema', path.join(source, 'schema.prisma')],
    { env: { ...process.env, DATABASE_URL: String(targetUrl) }, stdio: ['ignore', 'pipe', 'pipe'] });
}
try {
  for (const dir of [prior, full]) cpSync('prisma', dir, { recursive: true });
  rmSync(path.join(prior, 'migrations', '20261001110000_m6_delivery'), { recursive: true });
  await control.connect(); await control.query(`CREATE DATABASE "${database}"`); created = true;
  migrate(prior); await db.connect(); connected = true;
  await db.query(`INSERT INTO "Course" (id,slug,"titleAr","titleEn","descriptionAr","descriptionEn",status,"updatedAt")
    VALUES ('ambiguous','ambiguous-archive','اختبار','Fixture','اختبار','Fixture','ARCHIVED',now())`);
  await db.query(`INSERT INTO "Course" (id,slug,"titleAr","titleEn","descriptionAr","descriptionEn",status,"priorStatus","publishedAt","updatedAt") VALUES
    ('prior','known-prior','اختبار','Fixture','اختبار','Fixture','ARCHIVED','PUBLISHED',NULL,now()),
    ('timestamp','known-timestamp','اختبار','Fixture','اختبار','Fixture','ARCHIVED',NULL,now(),now()),
    ('audit','known-audit','اختبار','Fixture','اختبار','Fixture','ARCHIVED',NULL,NULL,now()),
    ('unarchive','known-unarchive','اختبار','Fixture','اختبار','Fixture','ARCHIVED',NULL,NULL,now()),
    ('irrelevant','unrelated-audit','اختبار','Fixture','اختبار','Fixture','ARCHIVED',NULL,NULL,now());
    INSERT INTO "AuditEvent" (id,"actorUserId",action,"entityType","entityId",metadata) VALUES
      ('audit-publication','review-fixture','COURSE_PUBLISHED','Course','audit','{}'),
      ('audit-unarchive','review-fixture','COURSE_UNARCHIVED','Course','unarchive','{"restoredTo":"PUBLISHED"}'),
      ('audit-irrelevant','review-fixture','COURSE_UNARCHIVED','Course','irrelevant','{"restoredTo":"READY"}');`);
  const document = readFileSync('/review/docker-and-operations.md', 'utf8');
  const diagnostic = document.split('### M6 activation diagnostic')[1]?.match(/```sql\r?\n([\s\S]+?)\r?\n```/)?.[1];
  assert.ok(diagnostic, 'current operations document must contain diagnostic SQL');
  assert.deepEqual((await db.query(diagnostic)).rows.map(row => row.id).sort(), ['ambiguous', 'irrelevant']);
  console.log('Reviewer diagnostic query PASS: excludes prior status, timestamp, publication audit and published-unarchive evidence; retains unknown and unrelated-audit rows.');
  let sqlRejected = false;
  try { await db.query(readFileSync(path.join(full, 'migrations', '20261001110000_m6_delivery', 'migration.sql'), 'utf8')); }
  catch (error) { sqlRejected = error.message === 'M6 activation blocked: archived course publication history needs explicit review'; }
  await db.query('ROLLBACK');
  assert.equal(sqlRejected, true, 'direct migration SQL must identify ambiguous history');
  let rejected = false, informative = false;
  try { migrate(full); } catch (error) {
    rejected = error.status !== 0;
    const diagnostics = String(error.stdout ?? '') + String(error.stderr ?? '');
    informative = diagnostics.includes('M6 activation blocked');
  }
  assert.equal(rejected, true, 'ambiguous archived publication history must block activation');
  assert.equal((await db.query(`SELECT to_regclass('"NotificationRollout"') AS table_name`)).rows[0].table_name, null);
  assert.equal(Number((await db.query(`SELECT count(*) AS n FROM information_schema.columns WHERE table_name='Course' AND column_name='firstPublicationAt'`)).rows[0].n), 0);
  assert.equal((await db.query(`SELECT status,"priorStatus","publishedAt" FROM "Course" WHERE id='ambiguous'`)).rows[0].status, 'ARCHIVED');
  console.log('Reviewer ambiguity PASS: migration rejects unknown publication history, rolls back activation schema, preserves archived source.');
  console.log(`Reviewer diagnostic observation: Prisma deploy exposes intended exception=${informative}; direct SQL exposes the precise cause.`);
} finally {
  if (connected) await db.end();
  if (created) { await control.query(`DROP DATABASE "${database}"`); console.log('Reviewer owned ambiguity database removed.'); }
  await control.end(); rmSync(directory, { recursive: true });
}
