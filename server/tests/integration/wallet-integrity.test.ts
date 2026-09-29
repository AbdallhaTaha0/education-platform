import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWalletWorld, type WalletWorld } from './wallet-helpers.js';

let world: WalletWorld;

beforeAll(async () => {
  world = await createWalletWorld(true);
});

afterAll(async () => {
  await world.close();
});

describe('M4 database integrity constraints', () => {
  it('deploys every M4 correction constraint', async () => {
    const rows = await world.prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname
      FROM pg_constraint
      WHERE conname = ANY (ARRAY[
        'Wallet_balance_nonnegative_check',
        'WalletLedgerEntry_signed_amount_check',
        'WalletLedgerEntry_reference_check',
        'RechargeRequest_amount_check',
        'RechargeRequest_reference_check',
        'RechargeRequest_proof_metadata_check',
        'RechargeRequest_review_state_check',
        'RechargeProof_content_check',
        'Purchase_snapshot_check',
        'Subscription_interval_check'
      ]::text[])
      ORDER BY conname
    `;
    expect(rows.map((row) => row.conname)).toHaveLength(10);
  });

  it('rejects a negative wallet balance at the database boundary', async () => {
    await world.prisma.wallet.upsert({
      where: { userId: world.studentUser.id },
      create: { userId: world.studentUser.id, balancePiastres: 0 },
      update: {},
    });
    await expect(world.prisma.wallet.update({
      where: { userId: world.studentUser.id },
      data: { balancePiastres: -1 },
    })).rejects.toThrow();

    const wallet = await world.prisma.wallet.findUniqueOrThrow({
      where: { userId: world.studentUser.id },
    });
    expect(wallet.balancePiastres).toBe(0);
  });
});
