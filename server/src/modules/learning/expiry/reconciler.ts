/**
 * Expiry reconciliation for active playback sessions (M5).
 *
 * When a subscription lapses while a DRM session is still active, the platform
 * must ask the external service to terminate it. That request can fail, so it
 * is retried with bounded exponential backoff and an attempt ceiling.
 *
 * Replica safety: exactly one replica may act on a given reference at a time.
 * Ownership is a token-checked Redis lease (the convention already used by the
 * catalog deletion reconciler), released with a compare-and-set delete. The
 * durable state transition is a conditional `updateMany`, so a crash between
 * the external call and the commit cannot produce a duplicate harmful effect
 * on the next pass: the row is re-read and only still-eligible rows move.
 *
 * The same machinery also guarantees closure of a normally-ended session, so a
 * viewer who simply closes the tab cannot leave an external session dangling.
 *
 * Nothing secret is persisted: only the opaque external session id is stored,
 * and the bearer token is never held server-side.
 */
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { getLogger } from '../../../logger.js';
import type { DrmClient } from '../../catalog/drmClient.js';

export const MAX_TERMINATION_ATTEMPTS = 6;
export const LEASE_TTL_SEC = 30;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 15 * 60_000;

/** Bounded exponential backoff, deterministic for tests. */
export function backoffMs(attempt: number, jitter = 0): number {
  const base = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1), MAX_BACKOFF_MS);
  return Math.min(base + jitter, MAX_BACKOFF_MS);
}

export function leaseKey(referenceId: string): string {
  return `edu:learning:expiry-lease:${referenceId}`;
}

async function acquire(
  redis: Redis,
  referenceId: string,
  token: string,
  nowMs: number,
): Promise<boolean> {
  const result = await redis.set(leaseKey(referenceId), token, 'PX', LEASE_TTL_SEC * 1000, 'NX');
  void nowMs;
  return result === 'OK';
}

async function release(redis: Redis, referenceId: string, token: string): Promise<void> {
  const key = leaseKey(referenceId);
  // Token-checked release: a stale owner can never drop a newer owner's lease.
  await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1,
    key,
    token,
  );
}

export interface EligibleReference {
  id: string;
  externalSessionId: string;
  terminationAttempts: number;
  pendingEndReason: 'VIEWER_END' | 'SUBSCRIPTION_EXPIRED' | null;
  /**
   * Keyset cursor. `nextTerminationAt` alone is not unique, so the row id breaks
   * ties; without it a full page can return the same rows forever and later
   * references would starve.
   */
  nextTerminationAt: Date;
}

/** Default rows pulled from the database per page. */
export const ELIGIBLE_PAGE_SIZE = 25;
/** Upper bound on pages walked in one pass, so a pass cannot run unbounded. */
export const MAX_PAGES_PER_PASS = 40;

/**
 * One bounded page of eligible references, ordered by the keyset cursor.
 *
 * Pagination is by `(nextTerminationAt, id)` rather than a bare offset, so a
 * page boundary cannot skip or repeat rows while other replicas are mutating
 * the same table.
 */
export async function findEligiblePage(
  prisma: PrismaClient,
  nowMs: number,
  cursor: { nextTerminationAt: Date; id: string } | null,
  limit = ELIGIBLE_PAGE_SIZE,
): Promise<EligibleReference[]> {
  const rows = await prisma.playbackReference.findMany({
    where: {
      // An ENDED reference can still owe a confirmation call: the viewer closed
      // the player and the DRM never acknowledged the end.
      status: { in: ['ACTIVE', 'ENDED'] },
      terminationStatus: { in: ['PENDING', 'FAILED'] },
      // A non-null cursor is part of the filter, so a returned row always has one.
      nextTerminationAt: { lte: new Date(nowMs) },
      ...(cursor === null
        ? {}
        : {
            OR: [
              { nextTerminationAt: { gt: cursor.nextTerminationAt } },
              { nextTerminationAt: cursor.nextTerminationAt, id: { gt: cursor.id } },
            ],
          }),
    },
    orderBy: [{ nextTerminationAt: 'asc' }, { id: 'asc' }],
    take: limit,
    select: {
      id: true,
      externalSessionId: true,
      terminationAttempts: true,
      pendingEndReason: true,
      nextTerminationAt: true,
    },
  });
  return rows
    .filter(
      (row): row is typeof row & { nextTerminationAt: Date } => row.nextTerminationAt !== null,
    )
    .map((row) => ({
      id: row.id,
      externalSessionId: row.externalSessionId,
      terminationAttempts: row.terminationAttempts,
      pendingEndReason: row.pendingEndReason,
      nextTerminationAt: row.nextTerminationAt,
    }));
}

/** First page only; convenience for callers that do not paginate. */
export async function findEligible(
  prisma: PrismaClient,
  nowMs: number,
  limit = ELIGIBLE_PAGE_SIZE,
): Promise<EligibleReference[]> {
  return findEligiblePage(prisma, nowMs, null, limit);
}

export type TerminationOutcome = 'TERMINATED' | 'ALREADY_ENDED' | 'FAILED';

/**
 * Terminate one reference. Returns the durable outcome. Never throws for an
 * expected dependency refusal; the retry schedule encodes the failure.
 */
export async function terminateReference(
  prisma: PrismaClient,
  drm: DrmClient | null,
  reference: EligibleReference,
  nowMs: number,
): Promise<TerminationOutcome> {
  if (drm === null) {
    await scheduleRetry(prisma, reference, 'DRM_UNCONFIGURED', nowMs);
    return 'FAILED';
  }
  const reason = reference.pendingEndReason ?? 'SUBSCRIPTION_EXPIRED';
  try {
    // The platform never holds the playback bearer token, so the only
    // server-capable closure is the idempotent application-credentialed
    // revoke. It is used for both reasons; the recorded reason decides the
    // durable status, so a normal viewer end is not recorded as a termination.
    const result = await drm.revokePlaybackSession(reference.externalSessionId, reason);
    const status = result.status;
    if (status === 'revoked' || status === 'ended') {
      // A normal viewer end stays ENDED; only an entitlement lapse becomes
      // TERMINATED, so the two histories remain distinguishable.
      const finalStatus = reason === 'SUBSCRIPTION_EXPIRED' ? 'TERMINATED' : 'ENDED';
      await prisma.playbackReference.updateMany({
        where: { id: reference.id, status: { in: ['ACTIVE', 'ENDED'] } },
        data: {
          status: finalStatus,
          terminationStatus: 'COMPLETED',
          pendingEndReason: null,
          endedAt: new Date(nowMs),
          nextTerminationAt: null,
          lastErrorCategory: null,
        },
      });
      return reason === 'SUBSCRIPTION_EXPIRED' ? 'TERMINATED' : 'ALREADY_ENDED';
    }
    await scheduleRetry(prisma, reference, 'DRM_DEPENDENCY_FAILED', nowMs);
    return 'FAILED';
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'DRM_DEPENDENCY_FAILED';
    await scheduleRetry(prisma, reference, code, nowMs);
    return 'FAILED';
  }
}

async function scheduleRetry(
  prisma: PrismaClient,
  reference: EligibleReference,
  category: string,
  nowMs: number,
): Promise<void> {
  const attempts = reference.terminationAttempts + 1;
  const exhausted = attempts >= MAX_TERMINATION_ATTEMPTS;
  await prisma.playbackReference.updateMany({
    where: { id: reference.id },
    data: {
      terminationAttempts: attempts,
      lastErrorCategory: category,
      // An exhausted row stops being retried but keeps the reason for an
      // operator, and its status leaves the active set.
      ...(exhausted
        ? {
            status: 'TERMINATION_FAILED',
            terminationStatus: 'FAILED',
            nextTerminationAt: null,
          }
        : {
            terminationStatus: 'PENDING',
            nextTerminationAt: new Date(nowMs + backoffMs(attempts)),
          }),
    },
  });
}

/**
 * Mark a reference as owing the DRM a termination call.
 * `reason` decides the durable end state once the dependency confirms.
 */
export async function scheduleTermination(
  prisma: PrismaClient,
  referenceId: string,
  nowMs: number,
  reason: 'VIEWER_END' | 'SUBSCRIPTION_EXPIRED' = 'SUBSCRIPTION_EXPIRED',
): Promise<void> {
  await prisma.playbackReference.updateMany({
    where: { id: referenceId, status: { in: ['ACTIVE', 'ENDED'] } },
    data: {
      terminationStatus: 'PENDING',
      pendingEndReason: reason,
      nextTerminationAt: new Date(nowMs),
    },
  });
}

export interface ReconcilerResult {
  scanned: number;
  /** References newly queued because their subscription crossed the boundary. */
  queued: number;
  terminated: number;
  alreadyEnded: number;
  failed: number;
  /** Keyset pages walked in this pass. */
  pages: number;
  /**
   * True when the pass stopped at its page budget with rows still pending. The
   * next pass resumes from the start, so nothing starves; the flag is for
   * operators, not for correctness.
   */
  pageBudgetExhausted: boolean;
}

/**
 * One reconciliation pass. Safe to run on every replica: the Redis lease means
 * only one replica performs the external call for a given reference.
 *
 * Eligible rows are walked in bounded keyset pages rather than a single
 * `take N`. A single page repeatedly returned the same oldest rows, so a newer
 * expired reference behind them could stay unprocessed forever. Every pass
 * therefore advances a cursor until the table is exhausted or the page budget
 * is spent, and rows are never all held in memory at once.
 */
export async function reconcileExpiredSessions(
  prisma: PrismaClient,
  redis: Redis,
  drm: DrmClient | null,
  nowMs: number,
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<ReconcilerResult> {
  const pageSize = options.pageSize ?? ELIGIBLE_PAGE_SIZE;
  const maxPages = options.maxPages ?? MAX_PAGES_PER_PASS;

  // Detect first: a subscription that crossed its boundary while a DRM session
  // was open is otherwise invisible to this pass, because such a reference has
  // no termination scheduled yet. Without this, a session could stay active
  // indefinitely for a student who never opens the dashboard again.
  const queued = await detectCrossedSubscriptions(prisma, nowMs);
  const result: ReconcilerResult = {
    scanned: 0,
    queued,
    terminated: 0,
    alreadyEnded: 0,
    failed: 0,
    pages: 0,
    pageBudgetExhausted: false,
  };

  let cursor: { nextTerminationAt: Date; id: string } | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const eligible = await findEligiblePage(prisma, nowMs, cursor, pageSize);
    result.pages += 1;
    if (eligible.length === 0) break;
    result.scanned += eligible.length;

    for (const reference of eligible) {
      const token = `${reference.id}:${nowMs}`;
      const owned = await acquire(redis, reference.id, token, nowMs);
      if (!owned) continue;
      try {
        const outcome = await terminateReference(prisma, drm, reference, nowMs);
        if (outcome === 'TERMINATED') result.terminated += 1;
        else if (outcome === 'ALREADY_ENDED') result.alreadyEnded += 1;
        else result.failed += 1;
      } catch (err) {
        result.failed += 1;
        getLogger().warn(
          { category: 'expiry-reconcile', code: (err as { code?: string }).code ?? 'unknown' },
          'expiry reconciliation pass failed for a reference',
        );
      } finally {
        await release(redis, reference.id, token).catch(() => undefined);
      }
    }

    const last = eligible[eligible.length - 1]!;
    cursor = { nextTerminationAt: last.nextTerminationAt, id: last.id };
    if (eligible.length < pageSize) break;
  }
  if (result.pages >= maxPages) result.pageBudgetExhausted = true;
  return result;
}

/**
 * Detect sessions that outlived their subscription and queue them.
 * Called opportunistically so a lapse is acted on without waiting for the
 * periodic pass.
 *
 * Walks ACTIVE references in bounded keyset pages on `id`. A fixed `take` cap
 * would re-inspect the same oldest rows on every call and never reach a newer
 * one, which is exactly the starvation this replaces.
 */
export async function detectCrossedSubscriptions(
  prisma: PrismaClient,
  nowMs: number,
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<number> {
  const pageSize = options.pageSize ?? 200;
  const maxPages = options.maxPages ?? MAX_PAGES_PER_PASS;
  let cursor: string | null = null;
  let queued = 0;
  type ActiveRow = { id: string; studentId: string; courseId: string };

  for (let page = 0; page < maxPages; page += 1) {
    const active: ActiveRow[] = await prisma.playbackReference.findMany({
      where: {
        status: 'ACTIVE',
        terminationStatus: null,
        ...(cursor === null ? {} : { id: { gt: cursor } }),
      },
      select: { id: true, studentId: true, courseId: true },
      orderBy: { id: 'asc' },
      take: pageSize,
    });
    if (active.length === 0) break;

    const courseIds = [...new Set(active.map((r) => r.courseId))];
    const subscriptions = await prisma.subscription.findMany({
      where: { courseId: { in: courseIds } },
      select: { studentId: true, courseId: true, expiresAt: true },
    });
    const latest = new Map<string, Date | null>();
    for (const sub of subscriptions) {
      const key = `${sub.studentId}:${sub.courseId}`;
      const current = latest.get(key);
      if (
        current === undefined ||
        sub.expiresAt === null ||
        (current !== null && sub.expiresAt > current)
      )
        latest.set(key, sub.expiresAt);
    }
    for (const reference of active) {
      const expiry = latest.get(`${reference.studentId}:${reference.courseId}`);
      if (expiry === undefined || (expiry !== null && expiry.getTime() <= nowMs)) {
        await scheduleTermination(prisma, reference.id, nowMs);
        queued += 1;
      }
    }

    cursor = active[active.length - 1]!.id;
    if (active.length < pageSize) break;
  }
  return queued;
}
