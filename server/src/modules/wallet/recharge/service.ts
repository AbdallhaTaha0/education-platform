import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { withEntityLocks } from '../../../infra/locks-do.js';
import { recordRecharge } from '../../notifications/producers.js';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../../catalog/audit.js';
import type { PaymentChannelConfig } from '../../../config.js';
import type { StorageClient } from '../../../infra/storage.js';
import { getOrCreateWallet, lockWallet, postEntry } from '../ledger.js';
import {
  assertIdempotencyKey,
  assertNonEmptyString,
  assertPiastres,
  normalizeReference,
} from '../money.js';
import { validateProof } from '../proof.js';
import type { RechargeReviewInput, RechargeSubmitInput } from '../types.js';
import { rejectUnknownFields } from '../../catalog/validation.js';
import { sameRechargeInput, type RechargeFingerprint } from './idempotency.js';
import { toStudentView } from './queries.js';

const SUBMIT_FIELDS = new Set([
  'amountPiastres',
  'channel',
  'reference',
  'senderName',
  'senderPhone',
  'transferDate',
  'proofFilename',
  'proofMime',
  'proofBase64',
  'idempotencyKey',
]);
const REVIEW_FIELDS = new Set(['decision', 'reason', 'receiptVerified']);

export function assertTransferDate(raw: unknown, nowMs = Date.now()): Date {
  if (typeof raw !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid transferDate.', { field: 'transferDate' });
  }
  const date = new Date(raw);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  let latestAllowed = nowMs;
  if (dateOnly) {
    // The form supplies a calendar day, not a future UTC timestamp.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(nowMs));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
    latestAllowed = Date.parse(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  }
  if (
    Number.isNaN(date.getTime()) ||
    (dateOnly && date.toISOString().slice(0, 10) !== raw) ||
    date.getTime() > latestAllowed ||
    date.getTime() < new Date('2020-01-01').getTime()
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid transferDate.', { field: 'transferDate' });
  }
  return date;
}

function assertSenderPhone(raw: unknown): string {
  if (
    typeof raw !== 'string' ||
    raw.trim().length < 6 ||
    raw.trim().length > 24 ||
    !/^[+0-9][0-9 ()-]*$/.test(raw.trim())
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid senderPhone.', { field: 'senderPhone' });
  }
  return raw.trim();
}

/**
 * Student submits a manual recharge request. Creates zero wallet credit.
 * Idempotent on (studentId, idempotencyKey): identical replays return the
 * existing request; same key with different parameters is a 409 conflict.
 */
export async function submitRecharge(
  prisma: PrismaClient,
  channels: PaymentChannelConfig[],
  studentId: string,
  input: RechargeSubmitInput,
  storage?: StorageClient | null,
) {
  rejectUnknownFields(input, SUBMIT_FIELDS);
  if (channels.length === 0) {
    throw new ApiError(503, 'PAYMENT_UNCONFIGURED', 'Manual funding is not configured.');
  }
  if (
    input.channel !== 'INSTAPAY' &&
    input.channel !== 'BANK_TRANSFER' &&
    input.channel !== 'MOBILE_WALLET'
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid channel.', { field: 'channel' });
  }
  if (!channels.some((c) => c.channel === input.channel)) {
    throw new ApiError(503, 'PAYMENT_UNCONFIGURED', 'This funding channel is not configured.');
  }
  const amountPiastres = assertPiastres(input.amountPiastres, 'amountPiastres');
  const referenceNorm = normalizeReference(input.reference);
  const senderName = assertNonEmptyString(input.senderName, 'senderName', 120);
  const senderPhone = assertSenderPhone(input.senderPhone);
  const transferDate = assertTransferDate(input.transferDate);
  const idempotencyKey = assertIdempotencyKey(input.idempotencyKey);
  const proof = validateProof(input.proofFilename, input.proofMime, input.proofBase64);
  const fingerprint: RechargeFingerprint = {
    amountPiastres,
    channel: input.channel,
    referenceNorm,
    senderName,
    senderPhone,
    transferDate,
    proofFilename: proof.filename,
    proofMime: proof.mime,
    proofSize: proof.bytes.length,
    proofHash: proof.hash,
  };

  // Idempotency gate before insert: the same key returns the same request,
  // a reused key with different parameters conflicts explicitly.
  const prior = await prisma.rechargeRequest.findUnique({
    where: { studentId_idempotencyKey: { studentId, idempotencyKey } },
  });
  if (prior) {
    if (!sameRechargeInput(prior, fingerprint)) {
      throw new ApiError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used with different parameters.',
      );
    }
    return toStudentView(prior as unknown as Record<string, unknown>);
  }

  const requestId = randomUUID();
  const storageKey = storage ? `recharge-proofs/${requestId}` : null;
  if (storage && storageKey) {
    await prisma.materialObject.create({
      data: { storageKey, state: 'PENDING' },
    });
    await storage.putObject(storageKey, Uint8Array.from(proof.bytes), proof.mime);
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      await getOrCreateWallet(tx, studentId);
      const request = await tx.rechargeRequest.create({
        data: {
          id: requestId,
          studentId,
          amountPiastres,
          channel: input.channel,
          referenceNorm,
          senderName,
          senderPhone,
          transferDate,
          proofFilename: proof.filename,
          proofMime: proof.mime,
          proofSize: proof.bytes.length,
          proofHash: proof.hash,
          idempotencyKey,
        },
      });
      await tx.rechargeProof.create({
        data: {
          requestId: request.id,
          bytes: storageKey ? null : Uint8Array.from(proof.bytes),
          storageKey,
          mime: proof.mime,
          size: proof.bytes.length,
          hash: proof.hash,
        },
      });
      if (storageKey) {
        await tx.materialObject.updateMany({
          where: { storageKey, state: 'PENDING' },
          data: { state: 'COMMITTED' },
        });
      }
      await audit(tx, {
        actorUserId: studentId,
        action: 'RECHARGE_SUBMITTED',
        entityType: 'RechargeRequest',
        entityId: request.id,
        metadata: { amountPiastres, channel: input.channel },
      });
      return request;
    });
    return toStudentView(created as unknown as Record<string, unknown>);
  } catch (err) {
    if (storage && storageKey) {
      await storage.deleteObject(storageKey).catch(() => undefined);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined) ?? [];
      if (target.includes('channel') || target.includes('referenceNorm')) {
        throw new ApiError(
          409,
          'DUPLICATE_REFERENCE',
          'This transfer reference was already submitted for the channel.',
        );
      }
      // A concurrent identical submission won the race: return the winner.
      const winner = await prisma.rechargeRequest.findUnique({
        where: { studentId_idempotencyKey: { studentId, idempotencyKey } },
      });
      if (winner) {
        if (!sameRechargeInput(winner, fingerprint)) {
          throw new ApiError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used with different parameters.',
          );
        }
        return toStudentView(winner as unknown as Record<string, unknown>);
      }
    }
    throw err;
  }
}

/**
 * Admin reviews a pending request. APPROVE atomically flips exactly one
 * PENDING row, credits once (unique ledger ref guards concurrency), and
 * audits. Credit uses the STORED amount — reviewers cannot alter it.
 * REJECT requires a reason and is immutable.
 */
export async function reviewRecharge(
  prisma: PrismaClient,
  reviewerId: string,
  requestId: string,
  input: RechargeReviewInput,
) {
  rejectUnknownFields(input, REVIEW_FIELDS);
  if (input.decision === 'APPROVE' && input.receiptVerified !== true) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Independent receipt verification must be confirmed.',
      { field: 'receiptVerified' },
    );
  }
  if (input.decision !== 'APPROVE' && input.decision !== 'REJECT') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid decision.', { field: 'decision' });
  }
  if (input.decision === 'APPROVE' && input.reason !== undefined) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'reason is only valid for rejection.', {
      field: 'reason',
    });
  }
  const reason =
    input.decision === 'REJECT' ? assertNonEmptyString(input.reason, 'reason', 500) : undefined;

  const preCheck = await prisma.rechargeRequest.findUnique({
    where: { id: requestId },
    select: { studentId: true },
  });
  const lockKeys = preCheck ? [`recharge:${requestId}`, `wallet:${preCheck.studentId}`] : [`recharge:${requestId}`];
  const outcome = await withEntityLocks(lockKeys, () => prisma.$transaction(async (tx) => {
    // Atomic compare-and-set: exactly one PENDING row flips, losers see 0.
    const flipped = await tx.rechargeRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data:
        input.decision === 'APPROVE'
          ? { status: 'APPROVED', reviewerId, reviewedAt: new Date() }
          : {
              status: 'REJECTED',
              reviewerId,
              reviewedAt: new Date(),
              rejectReason: reason as string,
            },
    });
    if (flipped.count === 0) {
      const current = await tx.rechargeRequest.findUnique({ where: { id: requestId } });
      if (!current) throw new ApiError(404, 'NOT_FOUND', 'Recharge request not found.');
      throw new ApiError(409, 'ALREADY_REVIEWED', `Request was already ${current.status}.`, {
        status: current.status,
      });
    }
    const request = await tx.rechargeRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (input.decision === 'APPROVE') {
      const wallet = await lockWallet(tx, request.studentId);
      await postEntry(
        tx,
        wallet.id,
        request.amountPiastres,
        'CREDIT_RECHARGE',
        'RECHARGE',
        request.id,
      );
    }
    await audit(tx, {
      actorUserId: reviewerId,
      action: input.decision === 'APPROVE' ? 'RECHARGE_APPROVED' : 'RECHARGE_REJECTED',
      entityType: 'RechargeRequest',
      entityId: request.id,
      metadata:
        input.decision === 'APPROVE'
          ? { amountPiastres: request.amountPiastres, channel: request.channel }
          : { channel: request.channel },
    });
    await recordRecharge(tx, request.id);
    return request;
  }));
  return toStudentView(outcome as unknown as Record<string, unknown>);
}
