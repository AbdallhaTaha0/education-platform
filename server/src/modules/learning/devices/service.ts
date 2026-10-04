/**
 * ADMIN device management (playback-recovery improvements).
 *
 * Platform is API-only: it never queries DRM persistence. The platform student
 * id is the opaque external user id (same value used when creating playback
 * sessions); it is resolved from trusted platform records, never from a
 * client-supplied external id. Only safe metadata crosses the boundary; no
 * IP, secret, raw browser identity, token or storage URL.
 *
 * Durable audit design (all inside the existing append-only `AuditEvent`
 * trail — no new table):
 *
 * - `DEVICE_RELEASE_REQUESTED`: recoverable intent, written BEFORE crossing
 *   the external boundary, under a per-student row lock so concurrent
 *   requests/replicas create at most one pending intent per
 *   (student, reference).
 * - `DEVICE_RELEASE`: terminal outcome, written after explicit external
 *   evidence (this call's `released:true`, an idempotent `released:false`
 *   with a pending intent, or absence from a COMPLETE inspection).
 *   Correlated to its intent (`intentId`) and attributed to the originating
 *   ADMIN; a different reconciling ADMIN is recorded separately in metadata
 *   and never silently replaces the requester. Duplicate terminal outcomes
 *   are prevented by re-checking under the same lock before writing.
 * - `DEVICE_RELEASE_REFUSED`: terminal outcome for ACTIVE/REVOKED refusals.
 *
 * Absence in a TRUNCATED inspection proves nothing and never completes an
 * outcome; uncertain work stays pending. A crash, restart,
 * timeout-after-success or audit outage between the external call and the
 * outcome audit never loses the work: the intent row persists in PostgreSQL
 * and later release calls reconcile it. A successful external release is
 * never reversed. No exactly-once external execution is claimed: concurrent
 * external calls remain idempotent at the provider, and duplicate outcome
 * rows are prevented platform-side.
 */
import type { PrismaClient } from '@prisma/client';
import type { DrmClient } from '../../catalog/drmClient.js';
import { getLogger } from '../../../logger.js';
import { LearningError } from '../errors.js';
import { audit } from '../../catalog/audit.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DeviceView {
  reference: string;
  status: string;
  createdAt: string;
  lastSeenAt: string;
  activePlayback: boolean;
  releasable: boolean;
}

export interface DeviceInspection {
  studentId: string;
  maxDevices: number;
  activeCount: number | null;
  freeSlots: number | null;
  truncated: boolean;
  unavailable: boolean;
  devices: DeviceView[];
}

function assertStudentId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new LearningError('LESSON_NOT_FOUND');
  }
  return value;
}

function assertDeviceReference(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new LearningError('VALIDATION_ERROR', 'Device reference is invalid.');
  }
  return value;
}

async function resolveStudentExternalId(
  prisma: PrismaClient,
  studentId: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true },
  });
  if (user === null) throw new LearningError('LESSON_NOT_FOUND');
  if (user.role !== 'STUDENT') {
    throw new LearningError('VALIDATION_ERROR', 'Only STUDENT accounts have devices.');
  }
  // The platform user id is the opaque external user id used at session
  // creation; no client-supplied external id is ever trusted.
  return user.id;
}

function mapInspectionError(err: unknown): never {
  const code = (err as { code?: string }).code;
  if (err instanceof LearningError) throw err;
  if (
    code === 'DRM_TIMEOUT' ||
    code === 'DRM_NETWORK' ||
    code === 'DRM_SERVER' ||
    code === 'DRM_UNKNOWN' ||
    code === 'DRM_MALFORMED' ||
    code === 'DRM_UNAUTHORIZED' ||
    code === 'DRM_NOT_FOUND' ||
    code === 'DRM_VALIDATION' ||
    code === 'DRM_CONFLICT'
  ) {
    throw new LearningError('DEVICE_INSPECTION_UNAVAILABLE');
  }
  throw new LearningError('DEVICE_INSPECTION_UNAVAILABLE');
}

export async function inspectStudentDevices(
  prisma: PrismaClient,
  drm: DrmClient | null,
  studentIdRaw: unknown,
): Promise<DeviceInspection> {
  const studentId = assertStudentId(studentIdRaw);
  const externalUserId = await resolveStudentExternalId(prisma, studentId);
  if (drm === null) throw new LearningError('DEVICE_INSPECTION_UNAVAILABLE');
  let inspected;
  try {
    inspected = await drm.inspectUserDevices(externalUserId);
  } catch (err) {
    mapInspectionError(err);
  }
  const active = inspected.devices.filter((d) => d.status === 'ACTIVE');
  // Never invent a complete slot count from a truncated list.
  const truncated = inspected.truncated;
  return {
    studentId,
    maxDevices: inspected.maxDevices,
    activeCount: truncated ? null : active.length,
    freeSlots: truncated ? null : Math.max(0, inspected.maxDevices - active.length),
    truncated,
    unavailable: false,
    devices: inspected.devices.map((d) => ({
      reference: d.reference,
      status: d.status,
      createdAt: d.createdAt,
      lastSeenAt: d.lastSeenAt,
      activePlayback: d.activePlayback,
      // REVOKED rows stay visible as banned and are never releasable here;
      // active playback cannot be released either.
      releasable: d.releasable && d.status === 'ACTIVE' && !d.activePlayback,
    })),
  };
}

export interface ReleaseOutcome {
  released: boolean;
  auditPending: boolean;
}

export const DEVICE_RELEASE_INTENT_ACTION = 'DEVICE_RELEASE_REQUESTED';
export const DEVICE_RELEASE_OUTCOME_ACTION = 'DEVICE_RELEASE';
export const DEVICE_RELEASE_REFUSED_ACTION = 'DEVICE_RELEASE_REFUSED';

/** How the release was evidenced. Recorded in outcome metadata. */
export type ReleaseEvidence = 'direct' | 'idempotent-retry' | 'sweep';

interface ReleaseIntent {
  id: string;
  actorUserId: string;
  createdAt: Date;
}

type Db = PrismaClient;

/**
 * Serialize concurrent release work for one student across replicas by
 * locking that student's User row. The external HTTP call itself always runs
 * outside the lock; only the check-then-write audit transitions hold it.
 * Synthetic doubles without `$transaction` run unlocked (unit scope only).
 */
async function withStudentLock<T>(prisma: Db, studentId: string, fn: (tx: Db) => Promise<T>): Promise<T> {
  const transactional = prisma as Db & {
    $transaction?: (fn: (tx: Db) => Promise<T>) => Promise<T>;
  };
  if (typeof transactional.$transaction !== 'function') {
    getLogger().warn({ module: 'device-release', studentId }, 'student lock unavailable; proceeding unlocked');
    return fn(prisma);
  }
  return transactional.$transaction(async (tx) => {
    const scoped = tx as Db & { $queryRaw?: unknown };
    if (typeof scoped.$queryRaw === 'function') {
      await (tx as PrismaClient).$queryRaw`SELECT id FROM "User" WHERE id = ${studentId} FOR UPDATE`;
    }
    return fn(tx as Db);
  });
}

function intentReferenceOf(row: { metadata: unknown }): string | null {
  const metadata = row.metadata as unknown;
  const ref =
    typeof metadata === 'object' && metadata !== null
      ? (metadata as Record<string, unknown>)['deviceReference']
      : null;
  return typeof ref === 'string' && UUID_RE.test(ref) ? ref : null;
}

/** Pending intent: REQUESTED without a later terminal outcome. */
export async function findPendingReleaseIntent(
  prisma: Db,
  studentId: string,
  reference: string,
): Promise<ReleaseIntent | null> {
  const intent = await prisma.auditEvent.findFirst({
    where: {
      action: DEVICE_RELEASE_INTENT_ACTION,
      entityId: studentId,
      metadata: { path: ['deviceReference'], equals: reference },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, actorUserId: true, createdAt: true },
  });
  if (intent === null) return null;
  const outcome = await prisma.auditEvent.findFirst({
    where: {
      action: { in: [DEVICE_RELEASE_OUTCOME_ACTION, DEVICE_RELEASE_REFUSED_ACTION] },
      entityId: studentId,
      OR: [
        { metadata: { path: ['intentId'], equals: intent.id } },
        {
          metadata: { path: ['deviceReference'], equals: reference },
          createdAt: { gte: intent.createdAt },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return outcome === null ? { id: intent.id, actorUserId: intent.actorUserId, createdAt: intent.createdAt } : null;
}

/**
 * True when a completed RELEASE outcome already exists for the reference,
 * regardless of intent correlation (covers pre-correlation rows). A deleted
 * registration never returns under the same reference, so this short-circuits
 * retries without new rows or external calls. REFUSED outcomes never match:
 * a refused device may become releasable later.
 */
async function hasReleaseOutcome(
  prisma: Db,
  studentId: string,
  reference: string,
): Promise<boolean> {
  const outcome = await prisma.auditEvent.findFirst({
    where: {
      action: DEVICE_RELEASE_OUTCOME_ACTION,
      entityId: studentId,
      metadata: { path: ['deviceReference'], equals: reference },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return outcome !== null;
}

/** True when a terminal outcome already exists for the intent (dedup read). */
async function hasTerminalOutcome(
  prisma: Db,
  studentId: string,
  reference: string,
  intentId: string,
  since: Date,
): Promise<boolean> {
  const outcome = await prisma.auditEvent.findFirst({
    where: {
      action: { in: [DEVICE_RELEASE_OUTCOME_ACTION, DEVICE_RELEASE_REFUSED_ACTION] },
      entityId: studentId,
      OR: [
        { metadata: { path: ['intentId'], equals: intentId } },
        {
          metadata: { path: ['deviceReference'], equals: reference },
          createdAt: { gte: since },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return outcome !== null;
}

interface OutcomeWrite {
  intent: ReleaseIntent;
  writerId: string;
  studentId: string;
  reference: string;
  action: typeof DEVICE_RELEASE_OUTCOME_ACTION | typeof DEVICE_RELEASE_REFUSED_ACTION;
  evidence: ReleaseEvidence | 'refusal';
  reason?: string;
}

/**
 * Idempotent terminal-outcome write, always under the student lock held by
 * the caller: re-checks for an existing outcome (by intent correlation or
 * legacy reference+time match) and skips the insert when one exists.
 * Attribution stays with the originating ADMIN; a different reconciling
 * ADMIN is recorded separately and never silently replaces the requester.
 */
async function recordTerminalOutcome(
  prisma: Db,
  write: OutcomeWrite,
): Promise<{ written: boolean }> {
  if (await hasTerminalOutcome(prisma, write.studentId, write.reference, write.intent.id, write.intent.createdAt)) {
    return { written: false };
  }
  const metadata: Record<string, unknown> = {
    deviceReference: write.reference,
    intentId: write.intent.id,
    originActorUserId: write.intent.actorUserId,
    confirmedBy: write.evidence,
  };
  if (write.writerId !== write.intent.actorUserId) metadata['reconciledBy'] = write.writerId;
  if (write.reason !== undefined) metadata['reason'] = write.reason;
  // Let statement errors escape the transaction. PostgreSQL aborts the whole
  // transaction after such an error; catching here cannot make later reads
  // or its commit safe. Recovery is handled after rollback below.
  await audit(prisma as never, {
    actorUserId: write.intent.actorUserId,
    action: write.action,
    entityType: 'User',
    entityId: write.studentId,
    metadata,
  });
  return { written: true };
}

async function persistOutcome(prisma: Db, write: OutcomeWrite): Promise<{ written: boolean; pending: boolean }> {
  try {
    return await withStudentLock(prisma, write.studentId, async (tx) => {
      const outcome = await recordTerminalOutcome(tx, write);
      const pending = (await findPendingReleaseIntent(tx, write.studentId, write.reference)) !== null;
      return { written: outcome.written, pending };
    });
  } catch {
    // The intent was committed before the external call. A failed outcome
    // transaction leaves it recoverable and must not erase an applied release.
    getLogger().warn({ module: 'device-release', studentId: write.studentId, intentId: write.intent.id }, 'outcome transaction failed; audit remains pending');
    return { written: false, pending: true };
  }
}

/**
 * Complete the outcome for a reference the external service reports as
 * already gone (`released:false`, unknown id, or same-path 404): explicit
 * API evidence, reconciled against the pending intent. Returns the pending
 * flag: false when no work remains, true when the audit write failed and the
 * intent row is retained for a later retry.
 */
async function reconcileReleasedReference(
  prisma: Db,
  writerId: string,
  studentId: string,
  reference: string,
): Promise<boolean> {
  const pending = await findPendingReleaseIntent(prisma, studentId, reference);
  if (pending === null) return false;
  return (await persistOutcome(prisma, {
    intent: pending, writerId, studentId, reference,
    action: DEVICE_RELEASE_OUTCOME_ACTION, evidence: 'idempotent-retry',
  })).pending;
}

export interface SweepResult {
  reconciled: number;
  /** Pending intents actually observed in the scanned pages (never global). */
  pending: number;
  /** True only when all pending work fit in the observed batch. */
  complete: boolean;
}

const SWEEP_MAX_RECONCILE = 10;

type IntentRow = ReleaseIntent & { metadata: unknown };

async function pendingIntentBatch(prisma: Db, studentId: string, present: string[] = []): Promise<IntentRow[]> {
  if (typeof prisma.$queryRaw !== 'function') {
    // Synthetic unit doubles only; real Prisma always filters in PostgreSQL.
    const rows = await prisma.auditEvent.findMany({
      where: { action: DEVICE_RELEASE_INTENT_ACTION, entityId: studentId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, actorUserId: true, createdAt: true, metadata: true },
    });
    return rows.filter(row => !present.includes(intentReferenceOf(row) ?? ''));
  }
  return prisma.$queryRaw<IntentRow[]>`
    SELECT i.id, i."actorUserId", i."createdAt", i.metadata
    FROM "AuditEvent" i
    WHERE i.action = ${DEVICE_RELEASE_INTENT_ACTION} AND i."entityId" = ${studentId}
      AND i.metadata->>'deviceReference' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND NOT (i.metadata->>'deviceReference' = ANY(${present}::text[]))
      AND NOT EXISTS (
        SELECT 1 FROM "AuditEvent" o
        WHERE o."entityId" = i."entityId"
          AND o.action IN (${DEVICE_RELEASE_OUTCOME_ACTION}, ${DEVICE_RELEASE_REFUSED_ACTION})
          AND (o.metadata->>'intentId' = i.id OR (
            o.metadata->>'intentId' IS NULL
            AND o.metadata->>'deviceReference' = i.metadata->>'deviceReference'
            AND o."createdAt" >= i."createdAt"
          ))
      )
      AND NOT EXISTS (
        SELECT 1 FROM "AuditEvent" newer
        WHERE newer."entityId" = i."entityId" AND newer.action = ${DEVICE_RELEASE_INTENT_ACTION}
          AND newer.metadata->>'deviceReference' = i.metadata->>'deviceReference'
          AND (newer."createdAt", newer.id) > (i."createdAt", i.id)
      )
    ORDER BY i."createdAt", i.id
    LIMIT ${SWEEP_MAX_RECONCILE + 1}
  `;
}

/**
 * Bounded, fair student-scope sweep. Filter completed history in PostgreSQL
 * BEFORE limiting the oldest pending work; a fixed history-page ceiling with
 * a fresh cursor on each call would permanently starve later pending rows.
 * Absence is
 * reconciled only against a COMPLETE inspection — a truncated or failed
 * inspection leaves work pending and marks the scan incomplete. The returned
 * pending count covers scanned pages only and `complete:false` means more
 * work may exist outside the scanned subset.
 */
export async function reconcilePendingReleaseAudits(
  prisma: Db,
  drm: DrmClient | null,
  writerId: string,
  studentId: string,
  externalUserId: string,
): Promise<SweepResult> {
  // Phase 1: bound pending results, not the amount of completed history.
  const pending: Array<{ intent: ReleaseIntent; reference: string }> = [];
  const intents = await pendingIntentBatch(prisma, studentId);
  for (const intent of intents) {
    const reference = intentReferenceOf(intent);
    if (reference === null || pending.some(p => p.reference === reference)) continue;
    const stillPending = await findPendingReleaseIntent(prisma, studentId, reference);
    if (stillPending !== null) pending.push({ intent: stillPending, reference });
  }
  const complete = pending.length <= SWEEP_MAX_RECONCILE;
  if (pending.length === 0) return { reconciled: 0, pending: 0, complete };
  if (drm === null) return { reconciled: 0, pending: pending.length, complete: false };
  // Phase 2: one complete inspection decides absence-based outcomes.
  let inspection;
  try {
    inspection = await drm.inspectUserDevices(externalUserId);
  } catch {
    return { reconciled: 0, pending: pending.length, complete: false };
  }
  if (inspection.truncated) {
    // An incomplete list cannot prove absence: keep everything pending.
    return { reconciled: 0, pending: pending.length, complete: false };
  }
  const present = new Set(inspection.devices.map((d) => d.reference));
  // Still-present references cannot be settled by an absence sweep. Exclude
  // them BEFORE limiting candidates, so ten old uncertain devices cannot
  // permanently hide an absent device whose audit is recoverable now.
  const absent = await pendingIntentBatch(prisma, studentId, [...present]);
  const candidates: Array<{ intent: ReleaseIntent; reference: string }> = [];
  for (const intent of absent) {
    const reference = intentReferenceOf(intent);
    if (reference === null || candidates.some(p => p.reference === reference)) continue;
    const stillPending = await findPendingReleaseIntent(prisma, studentId, reference);
    if (stillPending === null) continue;
    candidates.push({ intent: stillPending, reference });
    if (!pending.some(p => p.reference === reference)) pending.push({ intent: stillPending, reference });
  }
  let reconciled = 0;
  let remaining = pending.length;
  for (const { intent, reference } of candidates.slice(0, SWEEP_MAX_RECONCILE)) {
    if (present.has(reference)) continue;
    const outcome = await persistOutcome(prisma, {
        intent,
        writerId,
        studentId,
        reference,
        action: DEVICE_RELEASE_OUTCOME_ACTION,
        evidence: 'sweep',
      });
    if (outcome.written) reconciled += 1;
    if (!outcome.pending) remaining -= 1;
  }
  return { reconciled, pending: remaining, complete };
}

export async function releaseStudentDevice(
  prisma: Db,
  drm: DrmClient | null,
  adminId: string,
  studentIdRaw: unknown,
  referenceRaw: unknown,
  nowMs: number,
): Promise<ReleaseOutcome> {
  void nowMs;
  const studentId = assertStudentId(studentIdRaw);
  const reference = assertDeviceReference(referenceRaw);
  const externalUserId = await resolveStudentExternalId(prisma, studentId);
  if (drm === null) throw new LearningError('DEVICE_RELEASE_UNAVAILABLE');
  // Recover crashed/uncertain work for this student before acting. A failed
  // sweep never blocks the requested release; the per-reference paths below
  // reconcile the selected reference exactly.
  await reconcilePendingReleaseAudits(prisma, drm, adminId, studentId, externalUserId).catch(
    () => undefined,
  );
  // Durable intent first, atomically: at most one pending intent per
  // (student, reference) even under concurrent replicas, and no new rows at
  // all once a terminal RELEASE outcome exists (a deleted registration never
  // returns under the same reference). A write failure here aborts BEFORE
  // the external boundary is crossed.
  // Returns null when the reference is already durably released.
  const intent = await withStudentLock(prisma, studentId, async (tx) => {
    if (await hasReleaseOutcome(tx, studentId, reference)) return null;
    const existing = await findPendingReleaseIntent(tx, studentId, reference);
    if (existing !== null) return existing;
    try {
      await audit(tx as never, {
        actorUserId: adminId,
        action: DEVICE_RELEASE_INTENT_ACTION,
        entityType: 'User',
        entityId: studentId,
        metadata: { deviceReference: reference },
      });
    } catch {
      throw new LearningError('DEVICE_RELEASE_UNAVAILABLE');
    }
    const created = await findPendingReleaseIntent(tx, studentId, reference);
    if (created === null) throw new LearningError('DEVICE_RELEASE_UNAVAILABLE');
    return created;
  });
  if (intent === null) return { released: false, auditPending: false };
  let released = false;
  try {
    const result = await drm.releaseUserDevice(externalUserId, reference);
    released = result.released;
  } catch (err) {
    const code = (err as { code?: string; status?: number }).code;
    const status = (err as { status?: number }).status;
    if (code === 'DRM_DEVICE_ACTIVE' || code === 'DRM_DEVICE_REVOKED') {
      await persistOutcome(prisma, {
          intent,
          writerId: adminId,
          studentId,
          reference,
          action: DEVICE_RELEASE_REFUSED_ACTION,
          evidence: 'refusal',
          reason: code === 'DRM_DEVICE_ACTIVE' ? 'DEVICE_ACTIVE' : 'DEVICE_REVOKED',
        });
      throw new LearningError(
        code === 'DRM_DEVICE_ACTIVE' ? 'DEVICE_RELEASE_ACTIVE' : 'DEVICE_RELEASE_REVOKED',
      );
    }
    if (
      code === 'DRM_TIMEOUT' ||
      code === 'DRM_NETWORK' ||
      code === 'DRM_SERVER' ||
      code === 'DRM_UNKNOWN' ||
      code === 'DRM_MALFORMED' ||
      code === 'DRM_UNAUTHORIZED' ||
      code === 'DRM_VALIDATION' ||
      code === 'DRM_CONFLICT' ||
      code === 'DRM_NOT_FOUND' ||
      status === 404
    ) {
      // Absent/unknown references reconcile like an idempotent no-op; every
      // other transport failure keeps the intent row: the outcome is
      // uncertain and a later retry reconciles it.
      if (status === 404) {
        const auditPending = await reconcileReleasedReference(prisma, adminId, studentId, reference);
        return { released: false, auditPending };
      }
      throw new LearningError('DEVICE_RELEASE_UNAVAILABLE');
    }
    throw new LearningError('DEVICE_RELEASE_UNAVAILABLE');
  }
  if (!released) {
    // The reference is already gone. Complete the outcome audit when this
    // admin's intent is still pending; otherwise another actor released it
    // and there is nothing of ours to reconcile.
    const auditPending = await reconcileReleasedReference(prisma, adminId, studentId, reference);
    return { released: false, auditPending };
  }
  const outcome = await persistOutcome(prisma, {
      intent,
      writerId: adminId,
      studentId,
      reference,
      action: DEVICE_RELEASE_OUTCOME_ACTION,
      evidence: 'direct',
    });
  return { released: true, auditPending: outcome.pending };
}
