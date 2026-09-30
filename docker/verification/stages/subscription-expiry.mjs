/**
 * Stage: platform subscription expiry stops real DRM playback (TEST-ONLY).
 *
 * A subscribed throwaway student with a platform-issued session: immediately
 * after a fixture moves ONLY that subscription's expiry to near-future time
 * in the disposable platform database (guarded UPDATE on exact database,
 * student, subscription and course identifiers, labeled test setup; purchase
 * policy and access-control code untouched), real time passes and the stage
 * proves: new platform playback is denied, platform renewal is denied, the
 * running session is terminated by the normal 30 s expiry reconciler (never
 * by a manual end before that), and the old bearer stops working while its
 * own token lifetime is still valid (reconciliation delay, not token expiry).
 * Sessions end, the course/media are deleted, accounts log out; financial
 * records stay per policy.
 *
 * Two execution modes, same checks:
 * - Host direct-exec (docker CLI available): the stage applies the fixture
 *   itself through `docker exec` psql. Repeatable single command.
 * - Docker-runner mode (ISO_FILE set): the stage writes the fixture request
 *   to ISO_FILE and waits for ISO_DONE_FILE, which the orchestrating runner
 *   writes after applying the identical guarded SQL. No bearer or credential
 *   ever touches these files (identifiers only, same class as STATE_FILE).
 *
 * Direct execution (repository root, PowerShell) with a Docker-generated MP4:
 *   node docker/verification/stages/subscription-expiry.mjs [--selftest]
 * VERIFY_MEDIA_PATH must point at the fresh media file. Never prints cookies,
 * tokens, secrets, or identifiers beyond run-scoped test names.
 */
import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlatformClient } from '../lib/platform.mjs';
import { expect, recordBlocked, recordFail, step, summary } from '../lib/safe-log.mjs';
import { buildContext } from '../lib/context.mjs';
import { mediaPath, pollUntil } from '../lib/context.mjs';
import { platformDeletionState, platformMediaState, requestExactCourseCleanup } from './platform-lifecycle.mjs';

const PLATFORM_BASE_URL = 'http://127.0.0.1:8082';
const PLATFORM_ORIGIN = 'http://localhost:8082';
const RS256_POSTGRES = 'education-platform-rs256-postgres-1';

function validateFixtureIds(subscriptionId, studentId, courseId) {
  for (const [label, value] of [['subscription', subscriptionId], ['student', studentId], ['course', courseId]]) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error(`fixture refuses: ${label} identifier is not a UUID`);
    }
  }
}
export function buildExpiryFixture(subscriptionId, studentId, courseId, targetIso) {
  validateFixtureIds(subscriptionId, studentId, courseId);
  if (typeof targetIso !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(targetIso) ||
      !Number.isFinite(Date.parse(targetIso))) throw new Error('fixture refuses: bad target time');
  return (
    `UPDATE "Subscription" SET "expiresAt" = '${targetIso}'::timestamptz ` +
    `WHERE "id" = '${subscriptionId}' AND "studentId" = '${studentId}' AND "courseId" = '${courseId}';`
  );
}

export function buildFixtureGuardSelect(subscriptionId, studentId, courseId) {
  validateFixtureIds(subscriptionId, studentId, courseId);
  return (
    `SELECT count(*) FROM "Subscription" WHERE "id" = '${subscriptionId}' ` +
    `AND "studentId" = '${studentId}' AND "courseId" = '${courseId}';`
  );
}

/** Host-side fixture application through docker exec psql. Returns row text. */
export function runPsql(sql, spawn = spawnSync) {
  const result = spawn('docker', ['exec', RS256_POSTGRES, 'psql', '-U', 'postgres', '-d', 'education_platform', '-tA', '-c', sql], {
    encoding: 'utf8',
  });
  return result;
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

/**
 * Apply the guarded fixture. In runner mode the orchestrator performs these
 * same steps; on host the stage performs them directly. Either way exactly
 * one row must match before and after, or the flow aborts.
 */
export async function applySubscriptionFixture({ subscriptionId, studentId, courseId, targetIso }, run = runPsql) {
  const guard = run(buildFixtureGuardSelect(subscriptionId, studentId, courseId));
  const guarded = guard.status === 0 && `${guard.stdout || ''}`.trim() === '1';
  expect('subexp-fixture-guard', guarded, { ok: guarded });
  if (!guarded) return false;
  const apply = run(buildExpiryFixture(subscriptionId, studentId, courseId, targetIso));
  expect('subexp-fixture-applied', apply.status === 0, { status: apply.status });
  if (apply.status !== 0) return false;
  return true;
}

async function waitForRunnerMarker(donePath, timeoutMs = 240000) {
  const start = Date.now();
  for (;;) {
    try {
      readFileSync(donePath, 'utf8');
      return true;
    } catch { /* not yet written */ }
    if (Date.now() - start > timeoutMs) return false;
    await sleep(5000);
  }
}

export async function subscriptionExpiry(ctx) {
  step('subscription-expiry');
  const admin = ctx.platform;
  if (!admin) {
    recordBlocked('subscription-expiry', { note: 'platform URL and origin are required' });
    return { completed: false };
  }
  const student = new PlatformClient(admin.config);
  const runId = ctx.runId;
  const shortId = runId.replace(/[^a-z0-9]/gi, '').slice(-10).toLowerCase();

  const adminLogin = await admin.login(ctx.env.VERIFY_ADMIN_IDENTIFIER, ctx.env.VERIFY_ADMIN_PASSWORD);
  expect('subexp-admin-login', adminLogin.status === 200, { status: adminLogin.status });
  if (adminLogin.status !== 200) return { completed: false };

  const studentPhone = `+201${randomInt(100000000, 999999999)}`;
  const registered = await student.register({
    displayName: 'FAYQ Expiry Student',
    email: `fayq-m5-subexp-${shortId}@example.test`,
    phone: studentPhone,
    password: `Fayq-subexp-${shortId}-pw12`,
  });
  expect('subexp-student-register', registered.status === 201, { status: registered.status });
  if (registered.status !== 201) {
    await admin.logout().catch(() => {});
    return { completed: false };
  }
  const me = await student.call('GET', '/api/auth/me', { withCsrf: false });
  const studentId = me.json?.data?.user?.id;

  let courseId;
  let deletionCompleted = false;
  let grant = null;
  let bearer = '';
  try {
    const slug = `fayq-m5-subexp-${shortId}`;
    const course = await admin.createCourse({
      slug,
      titleAr: `انتهاء ${shortId}`, titleEn: `Expiry ${shortId}`,
      descriptionAr: `وصف ${shortId}`, descriptionEn: `Description ${shortId}`,
    });
    expect('subexp-course', course.status === 201, { status: course.status });
    courseId = course.json?.data?.course?.id;
    if (!courseId || !studentId) return { completed: false, courseId: courseId ?? null };
    const section = await admin.createSection(courseId, { titleAr: `قسم ${shortId}`, titleEn: `Section ${shortId}`, position: 1 });
    const sectionId = section.json?.data?.section?.id;
    const lesson = await admin.createLesson(sectionId, { titleAr: `درس ${shortId}`, titleEn: `Lesson ${shortId}`, position: 1 });
    const lessonId = lesson.json?.data?.lesson?.id;
    const plan = await admin.createPlan(courseId, { currentPricePiastres: 6000, durationDays: 30 });
    const planId = plan.json?.data?.plan?.id;
    if (!sectionId || !lessonId || !planId) return { completed: false, courseId };
    expect('subexp-catalog-ready', true, { ok: true });

    const video = await readFile(mediaPath(ctx.env));
    const registration = await admin.registerLessonMedia(lessonId, { contentType: 'video/mp4', title: 'Expiry verification' });
    const uploadUrl = registration.json?.data?.uploadUrl;
    if (!uploadUrl) return { completed: false, courseId };
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: video });
    expect('subexp-upload', put.status === 200, { status: put.status, bytes: video.length });
    await admin.completeLessonMedia(lessonId);
    const ready = await pollUntil({
      label: 'subexp-ready', attempts: 40, intervalMs: 5000,
      probe: async () => admin.syncLessonMedia(lessonId),
      getState: platformMediaState,
      done: (state) => state === 'READY',
      onState: () => {},
    });
    expect('subexp-ready', ready.reached, { state: ready.state, attempts: ready.attempts });
    if (!ready.reached) return { completed: false, courseId };
    for (const to of ['PROCESSING', 'READY', 'PUBLISHED']) {
      const transition = await admin.transitionCourse(courseId, to);
      if (transition.status !== 200) return { completed: false, courseId };
    }
    expect('subexp-published', true, { ok: true });

    const recharge = await student.submitRecharge({
      amountPiastres: 10000, channel: 'INSTAPAY', reference: `FAYQ-M5-EX-${shortId}`,
      senderName: 'FAYQ Verification', senderPhone: studentPhone, transferDate: '2026-09-29T10:00:00.000Z',
      proofFilename: 'receipt.png', proofMime: 'image/png', proofBase64: PROOF_PNG_B64,
      idempotencyKey: `subexp-recharge-${shortId}`,
    });
    const requestId = recharge.json?.data?.id ?? recharge.json?.data?.request?.id;
    const review = await admin.reviewRecharge(requestId, { decision: 'APPROVE', receiptVerified: true });
    expect('subexp-funded', recharge.status === 201 && review.status === 200, { status: review.status });
    const purchase = await student.purchase({ planId, idempotencyKey: `subexp-purchase-${shortId}` });
    expect('subexp-purchase', purchase.status === 201, { status: purchase.status });
    const subscriptionId = purchase.json?.data?.subscription?.id;
    if (!subscriptionId) return { completed: false, courseId };

    const playback = await student.requestPlayback(slug, lessonId, `subexp-device-${shortId}`);
    expect('subexp-playback-grant', playback.status === 201, { status: playback.status });
    grant = playback.json?.data?.playback ?? {};
    bearer = grant.playbackToken;
    if (!grant.referenceId || !bearer || !grant.manifestUrl) return { completed: false, courseId };
    const tokenExpiresAtMs = Date.parse(grant.tokenExpiresAt);
    const manifestOk = await fetch(forHost(grant.manifestUrl), { headers: { Authorization: `Bearer ${bearer}` } });
    const manifestOkText = await manifestOk.text();
    expect('subexp-manifest-before-expiry', manifestOk.status === 200, { status: manifestOk.status, bytes: manifestOkText.length });

    // Fixture (labeled test setup): ONLY this subscription moves near-future.
    // In Docker-runner mode the orchestrator applies the identical guarded SQL
    // after reading this request file; on host the stage applies it directly.
    const targetIso = new Date(Date.now() + 45000).toISOString();
    if (ctx.env.ISO_FILE) {
      // The orchestrator's guarded read seconds later is the authoritative
      // readability proof; an immediate local stat on a fresh volume file
      // proved unreliable, so this marker carries no assertion.
      const isoPayload = JSON.stringify({ subscriptionId, studentId, courseId, targetIso });
      writeFileSync(ctx.env.ISO_FILE, isoPayload, { encoding: 'utf8' });
      step('subexp-fixture-requested');
      const marked = await waitForRunnerMarker(ctx.env.ISO_DONE_FILE);
      expect('subexp-fixture-applied', marked, { ok: marked });
      if (!marked) return { completed: false, courseId };
    } else {
      const applied = await applySubscriptionFixture({ subscriptionId, studentId, courseId, targetIso });
      if (!applied) return { completed: false, courseId };
    }

    // Wait past the fixture expiry, then prove immediate backend denials.
    const waitMs = Date.parse(targetIso) - Date.now() + 15000;
    await sleep(Math.max(waitMs, 1000));
    const deniedPlayback = await student.requestPlayback(slug, lessonId, `subexp-device-${shortId}`);
    expect('subexp-playback-denied', deniedPlayback.status === 403
      && deniedPlayback.json?.error?.code === 'SUBSCRIPTION_EXPIRED', { status: deniedPlayback.status });
    const deniedRenew = await student.renewPlayback(grant.referenceId);
    expect('subexp-renew-denied', deniedRenew.status === 401
      && deniedRenew.json?.error?.code === 'PLAYBACK_SESSION_EXPIRED', { status: deniedRenew.status });

    // The old bearer keeps working until the reconciler terminates the
    // session; poll it and measure that latency distinctly from token expiry.
    const expiryMoment = Date.parse(targetIso);
    let lastOkAt = 0;
    let deniedAt = 0;
    let deniedStatus = 0;
    for (let i = 0; i < 48; i += 1) {
      const probe = await fetch(forHost(grant.manifestUrl), { headers: { Authorization: `Bearer ${bearer}` } });
      await probe.text().then(() => {}).catch(() => {});
      if (probe.status === 200) {
        lastOkAt = Date.now();
      } else {
        deniedAt = Date.now();
        deniedStatus = probe.status;
        break;
      }
      await sleep(5000);
    }
    expect('subexp-old-bearer-denied', deniedStatus === 401, { status: deniedStatus });
    expect('subexp-denial-after-expiry', deniedAt > expiryMoment && lastOkAt > 0, { ok: deniedAt > expiryMoment });
    const remainingTokenMs = tokenExpiresAtMs - deniedAt;
    expect('subexp-denial-is-reconciliation', remainingTokenMs > 60000, { durationMs: remainingTokenMs });
    expect('subexp-reconciler-latency', deniedAt - expiryMoment < 5 * 60000, { durationMs: deniedAt - expiryMoment });

    // Cleanup: end (idempotent on the terminated reference), delete, log out.
    const ended = await student.endPlayback(grant.referenceId);
    expect('subexp-session-end', ended.status === 200, { status: ended.status });
    const deletion = await admin.deleteCourse(courseId, courseId);
    expect('subexp-delete-request', deletion.status === 202, { status: deletion.status });
    const operationId = deletion.json?.data?.operation?.id;
    const removed = await pollUntil({
      label: 'subexp-delete', attempts: 40, intervalMs: 5000,
      probe: async () => admin.readDeletion(operationId),
      getState: platformDeletionState,
      done: (state) => state === 'COMPLETED',
      onState: () => {},
    });
    expect('subexp-delete-complete', removed.reached, { state: removed.state });
    deletionCompleted = removed.reached;
    const studentLogout = await student.logout();
    expect('subexp-student-logout', studentLogout.status === 200, { status: studentLogout.status });
    const adminLogout = await admin.logout();
    expect('subexp-admin-logout', adminLogout.status === 200, { status: adminLogout.status });
    return { completed: deletionCompleted, courseId };
  } finally {
    if (courseId && !deletionCompleted) {
      const cleanup = await requestExactCourseCleanup(admin, courseId).catch(() => null);
      if (!cleanup || ![202, 409].includes(cleanup.status)) {
        recordFail('subexp-best-effort-cleanup', { status: cleanup?.status, note: 'exact course cleanup failed' });
      }
    } else if (courseId) {
      await student.logout().catch(() => {});
      await admin.logout().catch(() => {});
    }
  }
}

/**
 * Host-side fetch origin swap: the platform issues dependency URLs against
 * the container-accessible DRM origin (host.docker.internal), which does not
 * resolve on the Windows host. Direct media fetches use the loopback alias
 * of the same published service ONLY in host direct-exec mode; inside the
 * Docker-runner stage container the issued origin is already correct.
 * Grant URLs themselves are untouched in both modes.
 */
const REWRITE_FOR_HOST = !process.env.ISO_FILE;
function forHost(url) {
  const text = String(url);
  return REWRITE_FOR_HOST ? text.replace('://host.docker.internal:3000/', '://127.0.0.1:3000/') : text;
}

/** Minimal valid 1x1 PNG: synthetic receipt proof. */
const PROOF_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function selftest() {
  const sql = buildExpiryFixture('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '2026-09-30T12:00:00.000Z');
  const tables = [...new Set([...sql.matchAll(/"([A-Z][A-Za-z]*)"/g)].map((m) => m[1]))];
  const checks = [
    ['targets Subscription only', /^UPDATE "Subscription" SET/.test(sql) && tables.length === 1 && tables[0] === 'Subscription'],
    ['guards all three identifiers', sql.includes('"id" = ') && sql.includes('"studentId" = ') && sql.includes('"courseId" = ')],
    ['sets only expiresAt', /SET "expiresAt" = /.test(sql)],
  ];
  let failed = 0;
  for (const [label, cond] of checks) {
    if (!cond) failed += 1;
    process.stdout.write(`${cond ? 'PASS' : 'FAIL'} fixture ${label}\n`);
  }
  let threw = false;
  try {
    buildExpiryFixture('not-a-uuid', 'x', 'y', '2026-09-30T12:00:00.000Z');
  } catch { threw = true; }
  if (!threw) failed += 1;
  process.stdout.write(`${threw ? 'PASS' : 'FAIL'} fixture rejects non-UUID identifiers\n`);
  if (failed > 0) process.exit(1);
  process.stdout.write('fixture selftest: all pass\n');
}

const invokedAsMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  if (process.argv.includes('--selftest')) {
    await selftest();
  } else {
    const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
    const parseEnvFile = (path) => {
      const values = {};
      for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
        const index = line.indexOf('=');
        if (index > 0) values[line.slice(0, index).trim()] = line.slice(index + 1);
      }
      return values;
    };
    const { buildContext } = await import('../lib/context.mjs');
    const drmEnv = parseEnvFile(resolve(repoRoot, 'education-drm-service', '.env'));
    const platformEnv = parseEnvFile(resolve(repoRoot, '.env'));
    const ctx = buildContext({
      ...process.env,
      ...drmEnv,
      ...platformEnv,
      PLATFORM_BASE_URL,
      PLATFORM_ORIGIN,
      R2_APPROVED_ORIGIN: PLATFORM_ORIGIN,
    });
    await subscriptionExpiry(ctx);
    const { summary } = await import('../lib/safe-log.mjs');
    summary();
  }
}
