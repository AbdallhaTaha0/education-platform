/**
 * Stage: one student playback session issued through the real platform (TEST-ONLY).
 *
 * Admin registers a bilingual course, uploads fresh media through the platform
 * adapter, publishes it, funds a throwaway student through a synthetic manual
 * recharge + admin approval, purchases the plan, and requests playback through
 * the platform learning endpoint. The platform generates the RS256 assertion
 * (only it holds the private key; the DRM verifies through the platform JWKS),
 * so a manifest/segment/license delivered from the platform-issued grant is
 * platform-mediated proof — a harness-signed assertion would not satisfy this
 * gate and is never used here.
 *
 * Money uses synthetic proof/reference data; no real transfer occurs and no
 * database is touched directly. Financial/audit records are retained per
 * policy. The session is ended, the course/media deleted through supported
 * APIs, and both accounts logged out. Disposable users remain in the isolated
 * database until that database is torn down.
 */
import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PlatformClient } from '../lib/platform.mjs';
import { expect, recordBlocked, recordFail, step } from '../lib/safe-log.mjs';
import { mediaPath, pollUntil } from '../lib/context.mjs';
import {
  absolutePlaybackUrl,
  buildClearKeyChallenge,
  extractClearKeyKid,
  resolveSegmentUrl,
} from '../lib/drm.mjs';
import { validClearKeyLicense } from './drm-lifecycle.mjs';
import { platformDeletionState, platformMediaState, requestExactCourseCleanup } from './platform-lifecycle.mjs';

/** Minimal valid 1x1 PNG (magic bytes, IHDR, IEND): synthetic receipt proof. */
const PROOF_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export async function platformRs256(ctx) {
  step('platform-rs256');
  if (!ctx.platform) {
    recordBlocked('platform-rs256', { note: 'platform URL and origin are required' });
    return { completed: false };
  }
  const admin = ctx.platform;
  const student = new PlatformClient(admin.config);
  let second = null;
  const runId = ctx.runId;
  const shortId = runId.replace(/[^a-z0-9]/gi, '').slice(-10).toLowerCase();

  const adminId = ctx.env.VERIFY_ADMIN_IDENTIFIER;
  const adminPw = ctx.env.VERIFY_ADMIN_PASSWORD;
  if (!adminId || !adminPw) {
    recordBlocked('platform-rs256-admin', { note: 'verification admin credentials are required' });
    return { completed: false };
  }
  const adminLogin = await admin.login(adminId, adminPw);
  expect('platform-rs256-admin-login', adminLogin.status === 200, { status: adminLogin.status });
  if (adminLogin.status !== 200) return { completed: false };

  // 1. Throwaway student through the normal registration flow.
  const studentEmail = `fayq-m5-student-${shortId}@example.test`;
  const studentPhone = `+201${randomInt(100000000, 999999999)}`;
  const studentPassword = `Fayq-student-${shortId}-pw12`;
  const registered = await student.register({
    displayName: 'FAYQ Verification Student',
    email: studentEmail,
    phone: studentPhone,
    password: studentPassword,
  });
  expect('platform-rs256-student-register', registered.status === 201, { status: registered.status });
  if (registered.status !== 201) {
    await admin.logout().catch(() => {});
    return { completed: false };
  }

  let courseId;
  let deletionCompleted = false;
  try {
    // 2. Bilingual course, section, lesson, integer-day plan.
    const slug = `fayq-m5-rs256-${shortId}`;
    const course = await admin.createCourse({
      slug,
      titleAr: `تحقق منصة ${shortId}`,
      titleEn: `Platform verification ${shortId}`,
      descriptionAr: `وصف التحقق ${shortId}`,
      descriptionEn: `Verification description ${shortId}`,
    });
    expect('platform-rs256-course', course.status === 201, { status: course.status });
    courseId = course.json?.data?.course?.id;
    if (!courseId) return { completed: false, courseId: null };
    const section = await admin.createSection(courseId, {
      titleAr: `قسم ${shortId}`, titleEn: `Section ${shortId}`, position: 1,
    });
    expect('platform-rs256-section', section.status === 201, { status: section.status });
    const sectionId = section.json?.data?.section?.id;
    if (!sectionId) return { completed: false, courseId };
    const lesson = await admin.createLesson(sectionId, {
      titleAr: `درس ${shortId}`, titleEn: `Lesson ${shortId}`, position: 1,
    });
    expect('platform-rs256-lesson', lesson.status === 201, { status: lesson.status });
    const lessonId = lesson.json?.data?.lesson?.id;
    if (!lessonId) return { completed: false, courseId };
    const plan = await admin.createPlan(courseId, { currentPricePiastres: 6000, durationDays: 30 });
    expect('platform-rs256-plan', plan.status === 201, { status: plan.status });
    const planId = plan.json?.data?.plan?.id;
    if (!planId) return { completed: false, courseId };

    // 3. Fresh media through the platform adapter, processed to READY.
    const video = await readFile(mediaPath(ctx.env));
    const registration = await admin.registerLessonMedia(lessonId, { contentType: 'video/mp4', title: 'RS256 verification' });
    expect('platform-rs256-media-register', registration.status === 201, { status: registration.status });
    const uploadUrl = registration.json?.data?.uploadUrl;
    if (!uploadUrl) return { completed: false, courseId };
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: video });
    expect('platform-rs256-upload', put.status === 200, { status: put.status, bytes: video.length });
    const complete = await admin.completeLessonMedia(lessonId);
    expect('platform-rs256-complete', complete.status === 200, { status: complete.status });
    const ready = await pollUntil({
      label: 'platform-rs256-ready', attempts: 40, intervalMs: 5000,
      probe: async () => admin.syncLessonMedia(lessonId),
      getState: platformMediaState,
      done: (state) => state === 'READY',
      onState: (attempt, state) => expect('platform-rs256-ready-state', true, { state, attempts: attempt }),
    });
    expect('platform-rs256-ready', ready.reached, { state: ready.state, attempts: ready.attempts });
    if (!ready.reached) return { completed: false, courseId };

    // 4. Publish through the supported lifecycle.
    for (const to of ['PROCESSING', 'READY', 'PUBLISHED']) {
      const transition = await admin.transitionCourse(courseId, to);
      expect(`platform-rs256-publish-${to.toLowerCase()}`, transition.status === 200, { status: transition.status });
      if (transition.status !== 200) return { completed: false, courseId };
    }

    // 5. Synthetic manual recharge + admin approval, then balance check.
    const recharge = await student.submitRecharge({
      amountPiastres: 10000,
      channel: 'INSTAPAY',
      reference: `FAYQ-M5-${shortId}`,
      senderName: 'FAYQ Verification',
      senderPhone: studentPhone,
      transferDate: '2026-09-29T10:00:00.000Z',
      proofFilename: 'receipt.png',
      proofMime: 'image/png',
      proofBase64: PROOF_PNG_B64,
      idempotencyKey: `rs256-recharge-${shortId}`,
    });
    expect('platform-rs256-recharge-submit', recharge.status === 201, { status: recharge.status });
    const requestId = recharge.json?.data?.id ?? recharge.json?.data?.request?.id;
    if (!requestId) return { completed: false, courseId };
    const review = await admin.reviewRecharge(requestId, { decision: 'APPROVE', receiptVerified: true });
    expect('platform-rs256-recharge-approve', review.status === 200, { status: review.status });
    const wallet = await student.walletBalance();
    expect('platform-rs256-wallet-funded', wallet.status === 200 && wallet.json?.data?.balancePiastres === 10000, {
      status: wallet.status,
    });

    // 6. Purchase through the platform, then prove entitlement via outline.
    const purchase = await student.purchase({ planId, idempotencyKey: `rs256-purchase-${shortId}` });
    expect('platform-rs256-purchase', purchase.status === 201, { status: purchase.status });
    const outline = await student.outline(slug);
    expect('platform-rs256-outline', outline.status === 200, { status: outline.status });

    // 7. Platform-issued playback: the grant carries the platform-generated
    // assertion result (manifest/license/session) without exposing it.
    const playback = await student.requestPlayback(slug, lessonId, `platform-rs256-device-${shortId}`);
    expect('platform-rs256-playback-grant', playback.status === 201, { status: playback.status });
    const grant = playback.json?.data?.playback ?? {};
    const hasSession = typeof grant.referenceId === 'string' && grant.referenceId.length > 0
      && typeof grant.playbackToken === 'string' && grant.playbackToken.length > 0;
    const hasMedia = typeof grant.manifestUrl === 'string' && grant.manifestUrl.length > 0
      && typeof grant.licenseUrl === 'string' && grant.licenseUrl.length > 0;
    expect('platform-rs256-grant-complete', hasSession && hasMedia, { ok: hasSession && hasMedia });
    if (!hasSession || !hasMedia) return { completed: false, courseId };
    const bearer = grant.playbackToken;

    // 8. Manifest, authenticated segment, ClearKey license from the grant.
    const manifestRes = await fetch(grant.manifestUrl, { headers: { Authorization: `Bearer ${bearer}` } });
    const manifestText = await manifestRes.text();
    expect('platform-rs256-manifest', manifestRes.status === 200, {
      status: manifestRes.status, bytes: manifestText.length,
    });
    const segmentUrl = resolveSegmentUrl(grant.manifestUrl, manifestText);
    if (!segmentUrl) {
      expect('platform-rs256-segment', false, { note: 'no concrete segment resolved' });
    } else {
      const segment = await fetch(segmentUrl, { headers: { Authorization: `Bearer ${bearer}`, Range: 'bytes=0-1023' } });
      const segmentBytes = Buffer.from(await segment.arrayBuffer());
      expect('platform-rs256-segment', (segment.status === 200 || segment.status === 206) && segmentBytes.length > 0, {
        status: segment.status, bytes: segmentBytes.length,
      });
    }
    const kid = extractClearKeyKid(manifestText);
    if (!kid) {
      expect('platform-rs256-license', false, { note: 'no ClearKey KID published' });
    } else {
      const license = await fetch(grant.licenseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${bearer}` },
        body: Buffer.from(JSON.stringify(buildClearKeyChallenge(kid))),
      });
      const licenseText = await license.text();
      let licenseJson = {};
      try { licenseJson = JSON.parse(licenseText); } catch { /* raw shape checked below */ }
      expect('platform-rs256-license', license.status === 200 && validClearKeyLicense(licenseJson, kid), {
        status: license.status, bytes: licenseText.length,
      });
    }

    // 9. Platform-mediated renewal: same session, rotated bearer, advancing
    // expiry. A second throwaway student (no purchase needed: the ownership
    // lookup fails first) proves cross-student denial.
    const secondPassword = `Fayq-second-${shortId}-pw12`;
    second = new PlatformClient(admin.config);
    const secondReg = await second.register({
      displayName: 'FAYQ Verification Student Two',
      email: `fayq-m5-second-${shortId}@example.test`,
      phone: `+201${randomInt(100000000, 999999999)}`,
      password: secondPassword,
    });
    expect('platform-rs256-second-register', secondReg.status === 201, { status: secondReg.status });
    const oldExpiryMs = Date.parse(grant.tokenExpiresAt);
    const renewed = await student.renewPlayback(grant.referenceId);
    expect('platform-rs256-renew', renewed.status === 200, { status: renewed.status });
    const renewal = renewed.json?.data?.renewal ?? {};
    const newBearer = renewal.playbackToken;
    const rotated = typeof newBearer === 'string' && newBearer.length > 0 && newBearer !== bearer;
    const newExpiryMs = Date.parse(renewal.tokenExpiresAt);
    expect('platform-rs256-renew-rotates', renewal.renewed === true && rotated, { ok: renewal.renewed === true && rotated });
    expect('platform-rs256-renew-expiry-advances', Number.isFinite(newExpiryMs) && newExpiryMs >= oldExpiryMs, {
      ok: Number.isFinite(newExpiryMs) && newExpiryMs >= oldExpiryMs,
    });
    expect('platform-rs256-renew-session-preserved', typeof renewal.sessionExpiresAt === 'string', {
      ok: typeof renewal.sessionExpiresAt === 'string',
    });
    if (!rotated) return { completed: false, courseId };

    // 10. Renewed bearer delivers manifest, segment and license.
    const manifestRes2 = await fetch(grant.manifestUrl, { headers: { Authorization: `Bearer ${newBearer}` } });
    const manifestText2 = await manifestRes2.text();
    expect('platform-rs256-renewed-manifest', manifestRes2.status === 200, {
      status: manifestRes2.status, bytes: manifestText2.length,
    });
    const segmentUrl2 = resolveSegmentUrl(grant.manifestUrl, manifestText2);
    if (segmentUrl2) {
      const segment2 = await fetch(segmentUrl2, { headers: { Authorization: `Bearer ${newBearer}`, Range: 'bytes=0-1023' } });
      const segmentBytes2 = Buffer.from(await segment2.arrayBuffer());
      expect('platform-rs256-renewed-segment', (segment2.status === 200 || segment2.status === 206) && segmentBytes2.length > 0, {
        status: segment2.status, bytes: segmentBytes2.length,
      });
    }
    const kid2 = extractClearKeyKid(manifestText2);
    if (kid2) {
      const license2 = await fetch(grant.licenseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${newBearer}` },
        body: Buffer.from(JSON.stringify(buildClearKeyChallenge(kid2))),
      });
      const licenseText2 = await license2.text();
      let licenseJson2 = {};
      try { licenseJson2 = JSON.parse(licenseText2); } catch { /* checked below */ }
      expect('platform-rs256-renewed-license', license2.status === 200 && validClearKeyLicense(licenseJson2, kid2), {
        status: license2.status, bytes: licenseText2.length,
      });
    }

    // 11. Previous bearer is rejected on the protected manifest after rotation.
    const staleManifest = await fetch(grant.manifestUrl, { headers: { Authorization: `Bearer ${bearer}` } });
    await staleManifest.text().then(() => {}).catch(() => {});
    expect('platform-rs256-stale-bearer-rejected', staleManifest.status === 401, { status: staleManifest.status });

    // 12. Cross-student renewal is denied; the owner session stays usable.
    const strangerRenew = await second.renewPlayback(grant.referenceId);
    expect('platform-rs256-stranger-renew-denied', strangerRenew.status === 401
      && strangerRenew.json?.error?.code === 'PLAYBACK_SESSION_EXPIRED', {
      status: strangerRenew.status,
    });
    const stillUsable = await fetch(grant.manifestUrl, { headers: { Authorization: `Bearer ${newBearer}` } });
    await stillUsable.text().then(() => {}).catch(() => {});
    expect('platform-rs256-usable-after-denial', stillUsable.status === 200, { status: stillUsable.status });

    // 13. End the session through the platform and verify renewal is denied.
    const ended = await student.endPlayback(grant.referenceId);
    expect('platform-rs256-session-end', ended.status === 200, { status: ended.status });
    const renewAfterEnd = await student.renewPlayback(grant.referenceId);
    expect('platform-rs256-renew-after-end-denied', renewAfterEnd.status === 401
      && renewAfterEnd.json?.error?.code === 'PLAYBACK_SESSION_EXPIRED', {
      status: renewAfterEnd.status,
    });
    const deletion = await admin.deleteCourse(courseId, courseId);
    expect('platform-rs256-delete-request', deletion.status === 202, { status: deletion.status });
    const operationId = deletion.json?.data?.operation?.id;
    if (!operationId) return { completed: false, courseId };
    const removed = await pollUntil({
      label: 'platform-rs256-delete', attempts: 40, intervalMs: 5000,
      probe: async () => admin.readDeletion(operationId),
      getState: platformDeletionState,
      done: (state) => state === 'COMPLETED',
      onState: (attempt, state) => expect('platform-rs256-delete-state', true, { state, attempts: attempt }),
    });
    expect('platform-rs256-delete-complete', removed.reached, { state: removed.state, attempts: removed.attempts });
    deletionCompleted = removed.reached;

    // 14. Log out all three test accounts.
    const studentLogout = await student.logout();
    expect('platform-rs256-student-logout', studentLogout.status === 200, { status: studentLogout.status });
    const secondLogout = await second.logout();
    expect('platform-rs256-second-logout', secondLogout.status === 200, { status: secondLogout.status });
    const adminLogout = await admin.logout();
    expect('platform-rs256-admin-logout', adminLogout.status === 200, { status: adminLogout.status });
    return { completed: deletionCompleted, courseId };
  } finally {
    if (courseId && !deletionCompleted) {
      const cleanup = await requestExactCourseCleanup(admin, courseId).catch(() => null);
      if (!cleanup || ![202, 409].includes(cleanup.status)) {
        recordFail('platform-rs256-best-effort-cleanup', {
          status: cleanup?.status,
          note: 'exact verification course cleanup could not be scheduled',
        });
      }
    } else {
      await student.logout().catch(() => {});
      if (second) await second.logout().catch(() => {});
      await admin.logout().catch(() => {});
    }
  }
}
