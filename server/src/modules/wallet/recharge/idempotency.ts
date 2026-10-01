import type { RechargeRequest } from '@prisma/client';

export interface RechargeFingerprint {
  amountPiastres: number;
  channel: RechargeRequest['channel'];
  referenceNorm: string;
  senderName: string;
  senderPhone: string;
  transferDate: Date;
  proofFilename: string;
  proofMime: string;
  proofSize: number;
  proofHash: string;
}

/** Every business-relevant input must match for an idempotent replay. */
export function sameRechargeInput(row: RechargeRequest, expected: RechargeFingerprint): boolean {
  return (
    row.amountPiastres === expected.amountPiastres &&
    row.channel === expected.channel &&
    row.referenceNorm === expected.referenceNorm &&
    row.senderName === expected.senderName &&
    row.senderPhone === expected.senderPhone &&
    row.transferDate.getTime() === expected.transferDate.getTime() &&
    row.proofFilename === expected.proofFilename &&
    row.proofMime === expected.proofMime &&
    row.proofSize === expected.proofSize &&
    row.proofHash === expected.proofHash
  );
}
