import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { PROOF_RETENTION_DAYS } from '../errors.js';
import type { TxClient } from '../types.js';

/** Scheduled proof-deletion date: 180 days after review, else null. */
export function proofDeletionDate(reviewedAt: Date | null): string | null {
  if (!reviewedAt) return null;
  return new Date(reviewedAt.getTime() + PROOF_RETENTION_DAYS * 86_400_000).toISOString();
}

/** Student-safe view: metadata only, never proof bytes. */
export function toStudentView(row: Record<string, unknown>) {
  return {
    id: row['id'],
    amountPiastres: row['amountPiastres'],
    channel: row['channel'],
    status: row['status'],
    createdAt: (row['createdAt'] as Date).toISOString(),
    reviewedAt: row['reviewedAt'] ? (row['reviewedAt'] as Date).toISOString() : null,
    rejectReason: row['rejectReason'] ?? null,
    proofFilename: row['proofFilename'],
    proofDeletionDate: proofDeletionDate(row['reviewedAt'] as Date | null),
  };
}

async function assertOwnRequest(tx: TxClient, studentId: string, requestId: string) {
  const row = await (tx as PrismaClient).rechargeRequest.findUnique({ where: { id: requestId } });
  if (!row || row.studentId !== studentId)
    throw new ApiError(404, 'NOT_FOUND', 'Recharge request not found.');
  return row;
}

export async function getOwnRequest(prisma: PrismaClient, studentId: string, requestId: string) {
  const row = await assertOwnRequest(prisma, studentId, requestId);
  return toStudentView(row as unknown as Record<string, unknown>);
}

export async function listOwnRequests(prisma: PrismaClient, studentId: string, limit = 50) {
  const rows = await prisma.rechargeRequest.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map((r) => toStudentView(r as unknown as Record<string, unknown>));
}

export async function listRequestsForReview(
  prisma: PrismaClient,
  filter: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; channel?: string },
  limit = 50,
) {
  const rows = await prisma.rechargeRequest.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.channel === 'INSTAPAY' ||
      filter.channel === 'BANK_TRANSFER' ||
      filter.channel === 'MOBILE_WALLET'
        ? { channel: filter.channel }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      studentId: true,
      amountPiastres: true,
      channel: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      rejectReason: true,
      proofFilename: true,
      proofSize: true,
      referenceNorm: true,
      senderName: true,
      transferDate: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    transferDate: r.transferDate.toISOString(),
    proofDeletionDate: proofDeletionDate(r.reviewedAt),
  }));
}

/** Admin-only proof bytes with safe preview/download headers. Never for students. */
export async function getProofBytes(prisma: PrismaClient, requestId: string) {
  const proof = await prisma.rechargeProof.findUnique({ where: { requestId } });
  if (!proof || proof.bytes === null)
    throw new ApiError(404, 'NOT_FOUND', 'Proof is no longer available.');
  return { bytes: Buffer.from(proof.bytes), mime: proof.mime, size: proof.size };
}
