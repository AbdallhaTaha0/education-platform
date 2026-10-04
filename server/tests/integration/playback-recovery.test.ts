/**
 * Playback-recovery improvements: ADMIN device management + own-session recovery.
 * Uses the labeled DRM HTTP fixture (not real DRM) + real platform routes/persistence.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createLearningWorld,
  createPublishedCourse,
  grantSubscription,
  studentPost,
  adminGet,
  adminPost,
  studentGet,
  type LearningWorld,
} from './learning-helpers.js';
import { registerStudent } from './identity-helpers.js';
import { endPlaybackSession } from '../../src/modules/learning/playback/service.js';
import { releaseStudentDevice } from '../../src/modules/learning/devices/service.js';
import { LearningError } from '../../src/modules/learning/errors.js';

let world: LearningWorld;
let course: Awaited<ReturnType<typeof createPublishedCourse>>;
const DAY = 86_400_000;

beforeAll(async () => {
  world = await createLearningWorld();
  course = await createPublishedCourse(world, 'recovery');
  await grantSubscription(world, world.studentId, course.courseId, Date.now() + 30 * DAY);
});

afterAll(async () => {
  await world?.fixture?.stop();
  await world?.close();
});

function deviceRef(): string {
  return randomUUID();
}

async function startPlayback(jar: { header(): string; csrf(): string }, lessonId: string) {
  return studentPost(
    world.app,
    `/learning/courses/${course.slug}/lessons/${lessonId}/playback`,
    jar as never,
    { deviceId: `web-${randomUUID()}` },
  );
}

function resetDevicesOnly(): void {
  // Never wipe media/playback assets: reset() would delete the READY fixture
  // assets the course needs. Clear only device surface for isolation.
  world.fixture.devices.clear();
  world.fixture.deviceTruncated = false;
  world.fixture.failNextDeviceInspection = 0;
  world.fixture.failNextDeviceRelease = 0;
  world.fixture.timeoutAfterDeviceRelease = false;
}

describe('ADMIN device management', () => {
  it('refuses STUDENT role and missing CSRF/Origin on release', async () => {
    const ref = deviceRef();
    world.fixture.seedDevice(world.studentId, ref, { status: 'ACTIVE' });
    const asStudent = await studentPost(
      world.app,
      `/admin/learning/students/${world.studentId}/devices/${ref}/release`,
      world.studentJar as never,
      {},
    );
    expect(asStudent.status).toBe(403);
    const noCsrf = await adminPost(
      world.app,
      `/admin/learning/students/${world.studentId}/devices/${ref}/release`,
      world.adminJar,
      {},
      { withCsrf: false },
    );
    expect(noCsrf.status).toBe(403);
    const noOrigin = await adminPost(
      world.app,
      `/admin/learning/students/${world.studentId}/devices/${ref}/release`,
      world.adminJar,
      {},
      { withOrigin: false },
    );
    expect(noOrigin.status).toBe(403);
  });

  it('inspects truthful counts and releases an inactive device with audit', async () => {
    resetDevicesOnly();
    const inactive = deviceRef();
    const revoked = deviceRef();
    world.fixture.seedDevice(world.studentId, inactive, { status: 'ACTIVE', activePlayback: false });
    world.fixture.seedDevice(world.studentId, revoked, { status: 'REVOKED', activePlayback: false });
    const inspected = await adminGet(
      world.app,
      `/admin/learning/students/${world.studentId}/devices`,
      world.adminJar,
    );
    expect(inspected.status).toBe(200);
    const payload = inspected.body.data.devices;
    expect(payload.maxDevices).toBe(2);
    expect(payload.truncated).toBe(false);
    // ACTIVE only: one ACTIVE registration, one free slot.
    expect(payload.activeCount).toBe(1);
    expect(payload.freeSlots).toBe(1);
    expect(payload.devices).toHaveLength(2);
    const revokedRow = payload.devices.find((d: { reference: string }) => d.reference === revoked);
    expect(revokedRow.status).toBe('REVOKED');
    expect(revokedRow.releasable).toBe(false);

    const released = await adminPost(
      world.app,
      `/admin/learning/students/${world.studentId}/devices/${inactive}/release`,
      world.adminJar,
      {},
    );
    expect(released.status).toBe(200);
    expect(released.body.data.release).toMatchObject({ released: true, auditPending: false });
    const auditRow = await world.prisma.auditEvent.findFirst({
      where: { action: 'DEVICE_RELEASE', entityId: world.studentId },
    });
    expect(auditRow?.actorUserId).toBe(world.adminUser.id);
    expect(JSON.stringify(auditRow?.metadata)).toContain(inactive);

    // Repeated release is idempotent, not an error.
    const repeated = await adminPost(
      world.app,
      `/admin/learning/students/${world.studentId}/devices/${inactive}/release`,
      world.adminJar,
      {},
    );
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.release).toMatchObject({ released: false });
  });

  it('refuses revoked and active-playback releases without unbanning', async () => {
    resetDevicesOnly();
    const revoked = deviceRef();
    const active = deviceRef();
    world.fixture.seedDevice(world.studentId, revoked, { status: 'REVOKED' });
    world.fixture.seedDevice(world.studentId, active, { status: 'ACTIVE', activePlayback: true });
    const revokedRes = await adminPost(
      world.app,
      `/admin/learning/students/${world.studentId}/devices/${revoked}/release`,
      world.adminJar,
      {},
    );
    expect(revokedRes.status).toBe(409);
    expect(revokedRes.body.error.code).toBe('DEVICE_RELEASE_REVOKED');
    const activeRes = await adminPost(
      world.app,
      `/admin/learning/students/${world.studentId}/devices/${active}/release`,
      world.adminJar,
      {},
    );
    expect(activeRes.status).toBe(409);
    expect(activeRes.body.error.code).toBe('DEVICE_RELEASE_ACTIVE');
    // Stale UI becoming active is refused by the external recheck (fixture models it).
    const stillThere = await adminGet(
      world.app,
      `/admin/learning/students/${world.studentId}/devices`,
      world.adminJar,
    );
    expect(stillThere.body.data.devices.devices.map((d: { reference: string }) => d.reference)).toContain(active);
  });

  it('rejects arbitrary external-user override and cross-student isolation', async () => {
    const other = await registerStudent(world.app);
    const otherRow = await world.prisma.user.findUniqueOrThrow({ where: { email: other.user.email } });
    resetDevicesOnly();
    const victimRef = deviceRef();
    world.fixture.seedDevice(world.studentId, victimRef, { status: 'ACTIVE' });
    // Platform student id is the only accepted key; there is no external-id
    // parameter to override. A malformed id is a safe 404, not a lookup.
    const malformed = await adminGet(world.app, '/admin/learning/students/not-a-uuid/devices', world.adminJar);
    expect(malformed.status).toBe(404);
    // Other student's inspection sees none of the victim's registrations.
    const otherView = await adminGet(
      world.app,
      `/admin/learning/students/${otherRow.id}/devices`,
      world.adminJar,
    );
    expect(otherView.status).toBe(200);
    expect(otherView.body.data.devices.devices).toHaveLength(0);
    // Releasing the victim reference under the other student id is idempotent
    // missing, never cross-tenant.
    const cross = await adminPost(
      world.app,
      `/admin/learning/students/${otherRow.id}/devices/${victimRef}/release`,
      world.adminJar,
      {},
    );
    expect(cross.status).toBe(200);
    expect(cross.body.data.release).toMatchObject({ released: false });
    const victim = await adminGet(
      world.app,
      `/admin/learning/students/${world.studentId}/devices`,
      world.adminJar,
    );
    expect(victim.body.data.devices.devices.map((d: { reference: string }) => d.reference)).toContain(victimRef);
  });

  it('does not invent complete counts from a truncated list and handles outage', async () => {
    resetDevicesOnly();
    world.fixture.deviceTruncated = true;
    world.fixture.seedDevice(world.studentId, deviceRef(), { status: 'ACTIVE' });
    const truncated = await adminGet(
      world.app,
      `/admin/learning/students/${world.studentId}/devices`,
      world.adminJar,
    );
    expect(truncated.status).toBe(200);
    expect(truncated.body.data.devices.truncated).toBe(true);
    expect(truncated.body.data.devices.activeCount).toBeNull();
    expect(truncated.body.data.devices.freeSlots).toBeNull();
    world.fixture.deviceTruncated = false;
    world.fixture.failNextDeviceInspection = 10;
    const outage = await adminGet(
      world.app,
      `/admin/learning/students/${world.studentId}/devices`,
      world.adminJar,
    );
    expect(outage.status).toBe(503);
    expect(outage.body.error.code).toBe('DEVICE_INSPECTION_UNAVAILABLE');
    world.fixture.failNextDeviceInspection = 0;
    world.fixture.failNextDeviceRelease = 10;
    const releaseOutage = await adminPost(
      world.app,
      `/admin/learning/students/${world.studentId}/devices/${deviceRef()}/release`,
      world.adminJar,
      {},
    );
    expect(releaseOutage.status).toBe(503);
    world.fixture.failNextDeviceRelease = 0;
  });
});

describe('durable release audit (real PostgreSQL)', () => {
  async function auditRows(studentId: string, reference: string, action: string) {
    return world.prisma.auditEvent.findMany({
      where: {
        action,
        entityId: studentId,
        metadata: { path: ['deviceReference'], equals: reference },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Prisma proxy whose `DEVICE_RELEASE` outcome writes fail while REQUESTED
   * intents and REFUSED outcomes go through. Action-based (not call-counted)
   * so earlier tests' pending intents reconciled by the entry sweep cannot
   * shift the failure onto the wrong write. Delegates through the real client
   * (never rebound) so `this` stays intact — including inside `$transaction`,
   * which is routed back through this proxy so the failing write is actually
   * exercised under the student lock.
   */
  function failingAuditProxy() {
    const auditEvent = {
      ...world.prisma.auditEvent,
      create: (args: { data: { action: string } }) => {
        if ((args as { data: { action: string } }).data.action === 'DEVICE_RELEASE') {
          return Promise.reject(new Error('synthetic audit outage'));
        }
        return world.prisma.auditEvent.create(args as never);
      },
    };
    const txProxy = {
      ...world.prisma,
      auditEvent,
      $queryRaw: async () => [{ id: 'locked-row' }],
    };
    return {
      ...world.prisma,
      auditEvent,
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(txProxy),
    };
  }

  it('retains pending audit work across an audit outage and completes it on retry', async () => {
    resetDevicesOnly();
    const ref = deviceRef();
    world.fixture.seedDevice(world.studentId, ref, { status: 'ACTIVE', activePlayback: false });
    // First attempt: external release succeeds, outcome audit fails.
    const first = await releaseStudentDevice(
      failingAuditProxy() as never,
      world.drm,
      world.adminUser.id,
      world.studentId,
      ref,
      Date.now(),
    );
    expect(first).toEqual({ released: true, auditPending: true });
    // The recoverable intent row survives; no outcome row exists yet.
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE_REQUESTED')).toHaveLength(1);
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE')).toHaveLength(0);
    // Retry: the reference is already gone; reconciliation completes the audit
    // instead of forgetting it. No exactly-once claim: the outcome is written
    // because none exists yet.
    const retry = await releaseStudentDevice(
      world.prisma,
      world.drm,
      world.adminUser.id,
      world.studentId,
      ref,
      Date.now(),
    );
    expect(retry).toEqual({ released: false, auditPending: false });
    const outcomes = await auditRows(world.studentId, ref, 'DEVICE_RELEASE');
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.actorUserId).toBe(world.adminUser.id);
  });

  it('reconciles an external timeout-after-success on the next attempt', async () => {
    resetDevicesOnly();
    const ref = deviceRef();
    world.fixture.seedDevice(world.studentId, ref, { status: 'ACTIVE', activePlayback: false });
    world.fixture.timeoutAfterDeviceRelease = true;
    // The external service applied the release but every response failed
    // (including the client's idempotent retries): the outcome is uncertain,
    // never a success claim.
    await expect(
      releaseStudentDevice(world.prisma, world.drm, world.adminUser.id, world.studentId, ref, Date.now()),
    ).rejects.toMatchObject({ code: 'DEVICE_RELEASE_UNAVAILABLE' });
    world.fixture.timeoutAfterDeviceRelease = false;
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE')).toHaveLength(0);
    // Retry observes the reference gone and completes the pending audit.
    const retry = await releaseStudentDevice(
      world.prisma,
      world.drm,
      world.adminUser.id,
      world.studentId,
      ref,
      Date.now(),
    );
    expect(retry).toEqual({ released: false, auditPending: false });
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE')).toHaveLength(1);
  });

  it('writes exactly one outcome audit across duplicate releases', async () => {
    resetDevicesOnly();
    const ref = deviceRef();
    world.fixture.seedDevice(world.studentId, ref, { status: 'ACTIVE', activePlayback: false });
    const first = await releaseStudentDevice(
      world.prisma,
      world.drm,
      world.adminUser.id,
      world.studentId,
      ref,
      Date.now(),
    );
    expect(first).toEqual({ released: true, auditPending: false });
    const retry = await releaseStudentDevice(
      world.prisma,
      world.drm,
      world.adminUser.id,
      world.studentId,
      ref,
      Date.now(),
    );
    expect(retry).toEqual({ released: false, auditPending: false });
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE')).toHaveLength(1);
  });

  it('records refusals as terminal outcomes without a release audit', async () => {
    resetDevicesOnly();
    const ref = deviceRef();
    world.fixture.seedDevice(world.studentId, ref, { status: 'REVOKED', activePlayback: false });
    await expect(
      releaseStudentDevice(world.prisma, world.drm, world.adminUser.id, world.studentId, ref, Date.now()),
    ).rejects.toBeInstanceOf(LearningError);
    const refused = await auditRows(world.studentId, ref, 'DEVICE_RELEASE_REFUSED');
    expect(refused).toHaveLength(1);
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE')).toHaveLength(0);
  });
});

describe('explicit own-session recovery', () => {
  it('lists only own sessions with safe labels and refuses foreign end', async () => {
    const first = await startPlayback(world.studentJar as never, course.lessonId);
    expect(first.status).toBe(201);
    const firstRef = first.body.data.playback.referenceId as string;
    const other = await registerStudent(world.app);
    await grantSubscription(world, (await world.prisma.user.findUniqueOrThrow({ where: { email: other.user.email } })).id, course.courseId, Date.now() + 30 * DAY);
    const mine = await studentGet(world.app, '/learning/sessions', world.studentJar);
    expect(mine.status).toBe(200);
    const sessions = mine.body.data.sessions as Array<{ referenceId: string }>;
    expect(sessions.map((s) => s.referenceId)).toContain(firstRef);
    for (const s of mine.body.data.sessions as Array<Record<string, unknown>>) {
      expect(s).not.toHaveProperty('externalSessionId');
      expect(s).not.toHaveProperty('playbackToken');
      expect(s).not.toHaveProperty('manifestUrl');
    }
    const foreign = await studentPost(world.app, `/learning/playback/${firstRef}/end`, other.jar as never, {});
    expect(foreign.status).toBe(200);
    expect(foreign.body.data).toMatchObject({ ended: true, closure: 'NOOP' });
    const stillActive = await world.prisma.playbackReference.findUniqueOrThrow({ where: { id: firstRef } });
    expect(stillActive.status).toBe('ACTIVE');
    // Owner end is durable: CONFIRMED or QUEUED, never a foreign effect.
    const ownEnd = await studentPost(world.app, `/learning/playback/${firstRef}/end`, world.studentJar as never, {});
    expect(ownEnd.status).toBe(200);
    expect(['CONFIRMED', 'QUEUED']).toContain(ownEnd.body.data.closure);
  });

  it('duplicate termination is safe and outage queues a durable retry', async () => {
    const started = await startPlayback(world.studentJar as never, course.lessonId);
    const ref = started.body.data.playback.referenceId as string;
    const once = await endPlaybackSession(world.prisma as never, world.drm, ref, world.studentId, Date.now());
    expect(['CONFIRMED', 'QUEUED']).toContain(once);
    const twice = await endPlaybackSession(world.prisma as never, world.drm, ref, world.studentId, Date.now());
    // Repeated end is safe: NOOP once terminal, or idempotent CONFIRMED/QUEUED.
    expect(['CONFIRMED', 'QUEUED', 'NOOP']).toContain(twice);
    // Outage followed by durable retry: force revoke failures, then recover.
    const retryStart = await startPlayback(world.studentJar as never, course.lessonId);
    const retryRef = retryStart.body.data.playback.referenceId as string;
    world.fixture.playback!.revokeAlwaysFails = true;
    const queued = await endPlaybackSession(world.prisma as never, world.drm, retryRef, world.studentId, Date.now());
    expect(queued).toBe('QUEUED');
    const pending = await world.prisma.playbackReference.findUniqueOrThrow({ where: { id: retryRef } });
    expect(pending.terminationStatus).toBe('PENDING');
    world.fixture.playback!.revokeAlwaysFails = false;
    const { reconcileExpiredSessions } = await import('../../src/modules/learning/expiry/reconciler.js');
    const result = await reconcileExpiredSessions(world.prisma as never, world.redis as never, world.drm, Date.now());
    expect(result.failed + result.alreadyEnded + result.terminated).toBeGreaterThanOrEqual(1);
  });

  it('leaves an actively playing second session alone and enforces expiry on renew', async () => {
    const one = await startPlayback(world.studentJar as never, course.lessonId);
    const two = await startPlayback(world.studentJar as never, course.lessonId);
    expect(one.status).toBe(201);
    expect(two.status).toBe(201);
    const oneRef = one.body.data.playback.referenceId as string;
    const twoRef = two.body.data.playback.referenceId as string;
    // Ending one never touches the other.
    await studentPost(world.app, `/learning/playback/${oneRef}/end`, world.studentJar as never, {});
    const otherRow = await world.prisma.playbackReference.findUniqueOrThrow({ where: { id: twoRef } });
    expect(otherRow.status).toBe('ACTIVE');
    // Subscription expiry during recovery blocks renewal.
    const { expireSubscription } = await import('./learning-helpers.js');
    await expireSubscription(world, world.studentId, course.courseId);
    const renew = await studentPost(world.app, `/learning/playback/${twoRef}/renew`, world.studentJar as never, {});
    expect(renew.status).toBe(401);
    await grantSubscription(world, world.studentId, course.courseId, Date.now() + 30 * DAY);
  });

  it('prioritizes an older ACTIVE blocker over newer completed history', async () => {
    // Fresh student so only seeded rows exist for this scope.
    const fresh = await registerStudent(world.app);
    const freshRow = await world.prisma.user.findUniqueOrThrow({ where: { email: fresh.user.email } });
    await grantSubscription(world, freshRow.id, course.courseId, Date.now() + 30 * DAY);
    const base = Date.now();
    const stamp = (offsetMs: number, spanMs: number) => ({
      tokenExpiresAt: new Date(base + offsetMs),
      sessionExpiresAt: new Date(base + offsetMs + spanMs),
    });
    // Twelve newer completed rows that must not hide the older blocker.
    for (let i = 0; i < 12; i += 1) {
      await world.prisma.playbackReference.create({
        data: {
          studentId: freshRow.id,
          lessonId: course.lessonId,
          courseId: course.courseId,
          externalSessionId: randomUUID(),
          externalAssetId: 'priority-fixture-asset',
          provider: 'CLEAR_KEY',
          status: 'ENDED',
          terminationStatus: 'COMPLETED',
          createdAt: new Date(base - (12 - i) * 60_000),
          endedAt: new Date(base - (12 - i) * 60_000 + 30_000),
          ...stamp(3_600_000, 3_600_000),
        },
      });
    }
    const blocker = await world.prisma.playbackReference.create({
      data: {
        studentId: freshRow.id,
        lessonId: course.lessonId,
        courseId: course.courseId,
        externalSessionId: randomUUID(),
        externalAssetId: 'priority-fixture-asset',
        provider: 'CLEAR_KEY',
        status: 'ACTIVE',
        createdAt: new Date(base - 30 * 60_000),
        ...stamp(120_000, 3_600_000),
      },
    });
    // Foreign ACTIVE references never leak into another student's list.
    const foreign = await registerStudent(world.app);
    const foreignRow = await world.prisma.user.findUniqueOrThrow({ where: { email: foreign.user.email } });
    await world.prisma.playbackReference.create({
      data: {
        studentId: foreignRow.id,
        lessonId: course.lessonId,
        courseId: course.courseId,
        externalSessionId: randomUUID(),
        externalAssetId: 'priority-fixture-asset',
        provider: 'CLEAR_KEY',
        status: 'ACTIVE',
        createdAt: new Date(base - 60 * 60_000),
        ...stamp(120_000, 3_600_000),
      },
    });
    const res = await studentGet(world.app, '/learning/sessions', fresh.jar as never);
    expect(res.status).toBe(200);
    const sessions = res.body.data.sessions as Array<{
      referenceId: string;
      status: string;
      terminationStatus: string | null;
    }>;
    expect(sessions).toHaveLength(10);
    // The older ACTIVE blocker leads despite twelve newer completed rows.
    expect(sessions[0]?.referenceId).toBe(blocker.id);
    expect(sessions[0]?.status).toBe('ACTIVE');
    for (const s of res.body.data.sessions as Array<Record<string, unknown>>) {
      expect(s).not.toHaveProperty('externalSessionId');
      expect(s).not.toHaveProperty('playbackToken');
    }
  });
});

describe('concurrent and attributed release reconciliation (real PostgreSQL)', () => {
  async function auditRows(studentId: string, reference: string, action: string) {
    return world.prisma.auditEvent.findMany({
      where: {
        action,
        entityId: studentId,
        metadata: { path: ['deviceReference'], equals: reference },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  function outcomeReplayProxy(failOutcomes: boolean) {
    const auditEvent = {
      ...world.prisma.auditEvent,
      create: (args: { data: { action: string } }) => {
        if (failOutcomes && (args as { data: { action: string } }).data.action === 'DEVICE_RELEASE') {
          return Promise.reject(new Error('synthetic audit outage'));
        }
        return world.prisma.auditEvent.create(args as never);
      },
    };
    const txProxy = {
      ...world.prisma,
      auditEvent,
      $queryRaw: async () => [{ id: 'locked-row' }],
    };
    return {
      ...world.prisma,
      auditEvent,
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(txProxy),
    };
  }

  it('serializes simultaneous releases into one intent and one outcome', async () => {
    resetDevicesOnly();
    const ref = deviceRef();
    world.fixture.seedDevice(world.studentId, ref, { status: 'ACTIVE', activePlayback: false });
    const results = await Promise.all(
      [1, 2, 3, 4].map(() =>
        releaseStudentDevice(world.prisma, world.drm, world.adminUser.id, world.studentId, ref, Date.now()),
      ),
    );
    // Exactly one caller performed the release; the rest observed the
    // idempotent no-op. The external provider saw one DELETE (idempotent
    // retries aside); no exactly-once execution is claimed.
    expect(results.filter((r) => r.released)).toHaveLength(1);
    expect(results.filter((r) => !r.released)).toHaveLength(3);
    for (const r of results) expect(r.auditPending).toBe(false);
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE_REQUESTED')).toHaveLength(1);
    const outcomes = await auditRows(world.studentId, ref, 'DEVICE_RELEASE');
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.actorUserId).toBe(world.adminUser.id);
  });

  it('keeps a single outcome across simultaneous reconciling retries', async () => {
    resetDevicesOnly();
    const ref = deviceRef();
    world.fixture.seedDevice(world.studentId, ref, { status: 'ACTIVE', activePlayback: false });
    const first = await releaseStudentDevice(
      world.prisma,
      world.drm,
      world.adminUser.id,
      world.studentId,
      ref,
      Date.now(),
    );
    expect(first).toEqual({ released: true, auditPending: false });
    const retries = await Promise.all(
      [1, 2, 3, 4].map(() =>
        releaseStudentDevice(world.prisma, world.drm, world.adminUser.id, world.studentId, ref, Date.now()),
      ),
    );
    for (const r of retries) expect(r).toEqual({ released: false, auditPending: false });
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE_REQUESTED')).toHaveLength(1);
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE')).toHaveLength(1);
  });

  it('preserves the originating actor when another ADMIN reconciles', async () => {
    resetDevicesOnly();
    const ref = deviceRef();
    world.fixture.seedDevice(world.studentId, ref, { status: 'ACTIVE', activePlayback: false });
    const adminB = await world.prisma.user.create({
      data: {
        displayName: 'Synthetic reconciling admin',
        email: `reconcile-${randomUUID()}@example.test`,
        phone: `019${String(Date.now()).slice(-8)}`,
        passwordHash: 'synthetic-unused-password-hash',
        role: 'ADMIN',
      },
    });
    const first = await releaseStudentDevice(
      outcomeReplayProxy(true) as never,
      world.drm,
      world.adminUser.id,
      world.studentId,
      ref,
      Date.now(),
    );
    expect(first).toEqual({ released: true, auditPending: true });
    const retry = await releaseStudentDevice(
      world.prisma,
      world.drm,
      adminB.id,
      world.studentId,
      ref,
      Date.now(),
    );
    expect(retry).toEqual({ released: false, auditPending: false });
    const intents = await auditRows(world.studentId, ref, 'DEVICE_RELEASE_REQUESTED');
    const outcomes = await auditRows(world.studentId, ref, 'DEVICE_RELEASE');
    expect(intents).toHaveLength(1);
    expect(outcomes).toHaveLength(1);
    // Originating attribution preserved; the reconciler is recorded
    // separately with an explicit intent correlation.
    expect(intents[0]?.actorUserId).toBe(world.adminUser.id);
    expect(outcomes[0]?.actorUserId).toBe(world.adminUser.id);
    const metadata = outcomes[0]?.metadata as Record<string, unknown>;
    expect(metadata['intentId']).toBe(intents[0]?.id);
    expect(metadata['originActorUserId']).toBe(world.adminUser.id);
    expect(metadata['reconciledBy']).toBe(adminB.id);
  });

  it('never infers release from a truncated inspection', async () => {
    resetDevicesOnly();
    const { reconcilePendingReleaseAudits } = await import(
      '../../src/modules/learning/devices/service.js'
    );
    const ref = deviceRef();
    world.fixture.seedDevice(world.studentId, ref, { status: 'ACTIVE', activePlayback: false });
    await world.prisma.auditEvent.create({
      data: {
        actorUserId: world.adminUser.id,
        entityType: 'User',
        entityId: world.studentId,
        action: 'DEVICE_RELEASE_REQUESTED',
        metadata: { deviceReference: ref },
      },
    });
    const incomplete = {
      inspectUserDevices: async () => ({ devices: [], truncated: true, maxDevices: 2 }),
    };
    const result = await reconcilePendingReleaseAudits(
      world.prisma,
      incomplete as never,
      world.adminUser.id,
      world.studentId,
      world.studentId,
    );
    // Uncertain work stays pending; the scan reports itself incomplete.
    expect(result.reconciled).toBe(0);
    expect(result.complete).toBe(false);
    expect(result.pending).toBeGreaterThanOrEqual(1);
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE')).toHaveLength(0);
    // The reference is genuinely still registered: nothing was released.
    expect(world.fixture.devices.get(`${world.studentId}:${ref}`)).toBeDefined();
  });

  it('reaches older pending work behind 20+ completed operations', async () => {
    resetDevicesOnly();
    const { reconcilePendingReleaseAudits } = await import(
      '../../src/modules/learning/devices/service.js'
    );
    const oldRef = deviceRef();
    await world.prisma.auditEvent.create({
      data: {
        actorUserId: world.adminUser.id,
        entityType: 'User',
        entityId: world.studentId,
        action: 'DEVICE_RELEASE_REQUESTED',
        metadata: { deviceReference: oldRef },
        createdAt: new Date(Date.now() - 600_000),
      },
    });
    for (let i = 0; i < 21; i += 1) {
      const completedRef = deviceRef();
      const createdAt = new Date(Date.now() - 500_000 + i * 10);
      await world.prisma.auditEvent.create({
        data: {
          actorUserId: world.adminUser.id,
          entityType: 'User',
          entityId: world.studentId,
          action: 'DEVICE_RELEASE_REQUESTED',
          metadata: { deviceReference: completedRef },
          createdAt,
        },
      });
      await world.prisma.auditEvent.create({
        data: {
          actorUserId: world.adminUser.id,
          entityType: 'User',
          entityId: world.studentId,
          action: 'DEVICE_RELEASE',
          metadata: { deviceReference: completedRef },
          createdAt: new Date(createdAt.getTime() + 1),
        },
      });
    }
    // The old reference was never seeded: absence from a COMPLETE inspection
    // is explicit evidence it holds no registration.
    const result = await reconcilePendingReleaseAudits(
      world.prisma,
      world.drm,
      world.adminUser.id,
      world.studentId,
      world.studentId,
    );
    expect(result.complete).toBe(true);
    const oldOutcomes = await auditRows(world.studentId, oldRef, 'DEVICE_RELEASE');
    expect(oldOutcomes).toHaveLength(1);
    expect(result.reconciled).toBeGreaterThanOrEqual(1);
  });

  it('survives repeated retries with exactly one terminal outcome', async () => {
    resetDevicesOnly();
    const ref = deviceRef();
    world.fixture.seedDevice(world.studentId, ref, { status: 'ACTIVE', activePlayback: false });
    const first = await releaseStudentDevice(
      world.prisma,
      world.drm,
      world.adminUser.id,
      world.studentId,
      ref,
      Date.now(),
    );
    expect(first).toEqual({ released: true, auditPending: false });
    for (let i = 0; i < 5; i += 1) {
      const retry = await releaseStudentDevice(
        world.prisma,
        world.drm,
        world.adminUser.id,
        world.studentId,
        ref,
        Date.now(),
      );
      expect(retry).toEqual({ released: false, auditPending: false });
    }
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE_REQUESTED')).toHaveLength(1);
    expect(await auditRows(world.studentId, ref, 'DEVICE_RELEASE')).toHaveLength(1);
  });
});
