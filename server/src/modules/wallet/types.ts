import type { Prisma, PrismaClient } from '@prisma/client';
import type { PaymentChannelId } from '../../config.js';

/** Prisma client or transaction client (services run inside $transaction). */
export type TxClient = Prisma.TransactionClient | PrismaClient;

export type { PaymentChannelId };

export type RechargeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PaymentInstruction {
  channel: PaymentChannelId;
  accountLabel: string;
  instructionsAr: string;
  instructionsEn: string;
}

export interface WalletView {
  balancePiastres: number;
  updatedAt: string;
}

export interface RechargeSubmitInput {
  amountPiastres: number;
  channel: PaymentChannelId;
  reference: string;
  senderName: string;
  senderPhone: string;
  transferDate: string;
  proofFilename: string;
  proofMime: string;
  proofBase64: string;
  idempotencyKey: string;
}

export interface RechargeReviewInput {
  decision: 'APPROVE' | 'REJECT';
  /** Required when decision is REJECT; forbidden otherwise. */
  reason?: string;
  /** Admin's explicit confirmation of independent receipt verification; required only for approval. */
  receiptVerified?: boolean;
}

export interface PurchaseInput {
  planId: string;
  idempotencyKey: string;
}
