import { Prisma } from '@prisma/client';
import type { TxClient } from './types.js';

/**
 * Lock-ordered wallet access. All money movements lock the wallet row
 * (`SELECT … FOR UPDATE` via update) before touching ledger rows, so
 * concurrent spenders serialize on the row and cannot overspend.
 */
export async function getOrCreateWallet(tx: TxClient, userId: string) {
  const existing = await tx.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await tx.wallet.create({ data: { userId, balancePiastres: 0 } });
  } catch {
    // Lost a create race: the winner's row is now visible.
    const winner = await tx.wallet.findUnique({ where: { userId } });
    if (!winner) throw new Error('Wallet creation raced without a winner.');
    return winner;
  }
}

/**
 * Lock the wallet row for update and return the POST-LOCK row (deterministic
 * lock order). The returned balance reflects all previously committed
 * movements: concurrent spenders serialize on the row and cannot overspend.
 * Never use a pre-lock read for money decisions.
 */
export async function lockWallet(tx: TxClient, userId: string) {
  const wallet = await getOrCreateWallet(tx, userId);
  // Prisma may optimize an update with an empty data object into a plain read,
  // so it is not a lock. Acquire the PostgreSQL lock explicitly and return
  // the row from that same post-lock statement.
  const rows = await tx.$queryRaw<Array<{ id: string; balancePiastres: number }>>(
    Prisma.sql`SELECT id, "balancePiastres" FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE`,
  );
  const locked = rows[0];
  if (!locked) throw new Error('Wallet disappeared while acquiring its lock.');
  return locked;
}

/** Append one ledger entry and move the cached balance in the same tx. */
export async function postEntry(
  tx: TxClient,
  walletId: string,
  amountPiastres: number,
  entryType: 'CREDIT_RECHARGE' | 'DEBIT_PURCHASE',
  refType: string,
  refId: string,
): Promise<void> {
  await tx.walletLedgerEntry.create({
    data: { walletId, amountPiastres, entryType, refType, refId },
  });
  await tx.wallet.update({
    where: { id: walletId },
    data: { balancePiastres: { increment: amountPiastres } },
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
