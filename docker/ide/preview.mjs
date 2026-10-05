/** Bounded M9 upgrade of the retained localhost:8080 platform only.
 * check|upgrade. No DRM commands, volume deletion or database reset.
 * A protected, git-ignored pg_dump is required before additive migration.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '../..'), docker = process.env.DOCKER_EXE || 'docker';
if (resolve(process.cwd()) !== root) throw new Error('Run from repository root.');
const args = ['compose', '--env-file', '.env', '--env-file', 'docker/local-settings.env.local', '-p', 'fayq-local-preview', '-f', 'docker/compose.dev.yml', '-f', 'docker/compose.local.yml'];
function capture(argv, encoding = 'utf8') {
  const r = spawnSync(docker, argv, { cwd: root, encoding, maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('Preview action failed (private diagnostics suppressed).'); return r.stdout;
}
function action(argv) { capture([...args, ...argv]); }
function guard() {
  const r = spawnSync(process.execPath, ['docker/local-preview.mjs', 'check'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Retained preview guard refused.');
  const c = JSON.parse(capture([...args, 'config', '--format', 'json']));
  for (const name of ['server', 'client', 'migrate', 'grading']) capture(['image', 'inspect', '--format', '{{.Id}}', c.services[name].image]);
  const ids = capture([...args, 'ps', '-aq']).trim().split(/\s+/).filter(Boolean);
  const permitted = Object.values(c.volumes).map((v) => v.name);
  for (const id of ids) {
    const [container] = JSON.parse(capture(['inspect', id]));
    if (container.Config.Labels?.['com.docker.compose.project'] !== 'fayq-local-preview') throw new Error('Runtime ownership refused.');
    for (const m of container.Mounts) {
      if (container.Config.Labels['com.docker.compose.service'] === 'grading' && m.Type === 'bind' && m.Source === '/var/run/docker.sock' && m.Destination === '/var/run/docker.sock') continue;
      if (m.Type !== 'volume' || !permitted.includes(m.Name)) throw new Error('Runtime mount refused.');
    }
  }
}
const courseRevisions = process.argv.includes('--course-revisions');
const tables = ['User', 'Wallet', 'Purchase', 'Subscription', 'Course', 'CourseSection', 'Lesson', 'MediaMapping', ...(courseRevisions ? ['SubscriptionPlan', 'Assessment', 'AssessmentVersion', 'AssessmentPass', 'LessonProgress', 'PlaybackReference', 'PreservedLessonUnlock', 'LessonCaption', 'LessonResource', 'MaterialObject'] : [])];
const row = courseRevisions ? `(to_jsonb(t) - ARRAY['revisionOwnerId','workingCopyId','requestedSlug','historical','originId','inheritedMediaId','retiredAt','retirementOperationId','retirementNextAttempt'])::text` : 'row_to_json(t)::text';
const sql = tables.map((t) => `SELECT '${t}', count(*), md5(coalesce(string_agg(${row}, ',' ORDER BY ${courseRevisions ? row : 'id'}),'')) FROM "${t}" t`).join(' UNION ALL ');
function snapshot() {
  return capture([...args, 'exec', '-T', 'postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"', 'sh', sql]);
}
guard();
const command = process.argv[2] || 'check';
if (command === 'upgrade') {
  const dir = join(root, 'docker/browser/evidence/m9'); mkdirSync(dir, { recursive: true });
  if (spawnSync('git', ['check-ignore', '--quiet', 'docker/browser/evidence/m9/preview-backup.dump'], { cwd: root }).status !== 0) throw new Error('Backup ignore guard refused.');
  let servingStopped = false;
  try {
    action(['stop', 'server', ...(courseRevisions ? ['grading'] : [])]); servingStopped = true;
    const before = snapshot();
    const installed = capture([...args, 'exec', '-T', 'postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"', 'sh', 'SELECT count(*) FROM "_prisma_migrations" WHERE migration_name=\'20261001210000_m9_assessments\' AND finished_at IS NOT NULL']).trim() === '1';
    const reachSQL = 'SELECT count(*) FROM (SELECT "studentId","lessonId" FROM "LessonProgress" UNION SELECT "studentId","lessonId" FROM "PlaybackReference") old LEFT JOIN "PreservedLessonUnlock" p USING ("studentId","lessonId") WHERE p."studentId" IS NULL';
    const unmatchedBefore = installed ? capture([...args, 'exec', '-T', 'postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"', 'sh', reachSQL]).trim() : '0';
    const dump = capture([...args, 'exec', '-T', 'postgres', 'sh', '-c', 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'], null);
    if (!Buffer.isBuffer(dump) || dump.length < 100 || dump.subarray(0, 5).toString() !== 'PGDMP') throw new Error('Backup proof failed.');
    const file = join(dir, `preview-before-${courseRevisions ? 'course-revisions' : 'm9'}-${Date.now()}.dump`);
    const fd = openSync(file, 'wx', 0o600); try { writeFileSync(fd, dump); } finally { closeSync(fd); }
    console.log('Protected database backup created=true');
    action(['run', '--rm', '--no-deps', 'migrate']);
    if (snapshot() !== before) throw new Error('Existing platform data fingerprint changed; backup retained.');
    const reach = capture([...args, 'exec', '-T', 'postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"', 'sh', reachSQL]);
    // Repeated upgrades must not retroactively grandfather post-M9 progress.
    if (reach.trim() !== unmatchedBefore) throw new Error('Reached-lesson preservation failed.');
    console.log('Existing users/wallets/purchases/subscriptions/catalog/media fingerprints preserved=true; existing reached lessons preserved=true');
    action(['up', '-d', '--wait', 'server', 'client', 'grading']);
    // Static upstream DNS is resolved at Nginx startup. Application image
    // replacement may change addresses even though the edge image is unchanged.
    action(['up', '-d', '--wait', '--no-deps', '--force-recreate', 'nginx']); servingStopped = false;
    writeFileSync(join(dir, courseRevisions ? 'preview-course-revisions-upgrade.json' : 'preview-upgrade.json'), JSON.stringify({ version: courseRevisions ? 'course-revisions-20261005' : '0.9.0-m9', dataPreserved: true, reachedPreserved: true, fingerprintedTables: tables.length, backup: file.split(/[\\/]/).pop(), time: new Date().toISOString() }), { mode: 0o600 });
    console.log(`${courseRevisions ? 'Course revisions' : 'M9'} preview ready: http://localhost:8080; DRM unchanged`);
  } catch (error) {
    if (servingStopped) console.error('Preview readiness needs recovery; retained volumes and backup are preserved. Follow the M9 rollback runbook.');
    throw error;
  }
} else if (command !== 'check') throw new Error('Supported commands: check|upgrade.');
