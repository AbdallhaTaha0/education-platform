import { Prisma } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import type { TxClient } from './types.js';

/**
 * Lock-ordered wallet access. Callers acquire the `wallet:<userId>` entity lock
 * via `withEntityLocks` (MutexDurableObject / LocalAsyncMutex) before entering
 * any money movement so concurrent spenders serialize cleanly on D1/SQLite.
 */
export async function getOrCreateWallet(tx: TxClient, userId: string) {
  return tx.wallet.upsert({
    where: { userId },
    create: { userId, balancePiastres: 0 },
    update: {},
  });
}

/**
 * Return the authoritative post-lock wallet row. Callers must hold
 * `wallet:<userId>` via `withEntityLocks`.
 */
export async function lockWallet(tx: TxClient, userId: string) {
  const wallet = await getOrCreateWallet(tx, userId);
  const fresh = await tx.wallet.findUnique({
    where: { id: wallet.id },
    select: { id: true, balancePiastres: true },
  });
  if (!fresh) throw new Error('Wallet disappeared while acquiring its lock.');
  return fresh;
}

/**
 * Append one ledger entry and apply an atomic non-negative balance update.
 * Enforces `balancePiastres + amountPiastres >= 0` directly at the SQLite
 * engine level so a wallet balance can never go negative.
 */
export async function postEntry(
  tx: TxClient,
  walletId: string,
  amountPiastres: number,
  entryType: 'CREDIT_RECHARGE' | 'DEBIT_PURCHASE',
  refType: string,
  refId: string,
): Promise<void> {
  const now = new Date();
  const affected = await tx.$executeRaw(
    Prisma.sql`UPDATE "Wallet" SET "balancePiastres" = "balancePiastres" + ${amountPiastres}, "updatedAt" = ${now} WHERE "id" = ${walletId} AND ("balancePiastres" + ${amountPiastres}) >= 0`,
  );
  if (affected !== 1) {
    throw new ApiError(402, 'INSUFFICIENT_FUNDS', 'Wallet balance is insufficient.');
  }
  await tx.walletLedgerEntry.create({
    data: { walletId, amountPiastres, entryType, refType, refId },
  });
}

/** Reconcile the cached balance against the append-only ledger. */
export async function reconciledBalance(tx: TxClient, walletId: string): Promise<number> {
  const rows = await tx.walletLedgerEntry.findMany({
    where: { walletId },
    select: { amountPiastres: true },
  });
  return rows.reduce((sum, r) => sum + r.amountPiastres, 0);
}
