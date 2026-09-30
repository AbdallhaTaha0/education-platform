import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminGet, adminPost } from './catalog-helpers.js';
import { registerStudent } from './identity-helpers.js';
import { createWalletWorld, rechargeBody, resetFinancialState, studentGet, studentPost, type WalletWorld } from './wallet-helpers.js';

let world: WalletWorld;

beforeAll(async () => {
  world = await createWalletWorld(true);
});

afterAll(async () => {
  await world.close();
});

async function submit(amountPiastres = 60000): Promise<string> {
  const res = await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, rechargeBody({ amountPiastres }));
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

function review(id: string, body: Record<string, unknown>) {
  return adminPost(world.app, `/admin/recharge-requests/${id}/review`, world.adminJar, body);
}

describe('recharge review', () => {
  it('approval credits exactly once and never auto-purchases', async () => {
    // The exact 60000 balance is this test's own precondition, not an accident
    // of running before the other approvals in this file.
    await resetFinancialState(world);
    const id = await submit(60000);
    const res = await review(id, { decision: 'APPROVE', receiptVerified: true });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');

    const wallet = await world.prisma.wallet.findUniqueOrThrow({ where: { userId: world.studentUser.id } });
    expect(wallet.balancePiastres).toBe(60000);
    const entries = await world.prisma.walletLedgerEntry.findMany({ where: { walletId: wallet.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.amountPiastres).toBe(60000);
    expect(entries[0]?.entryType).toBe('CREDIT_RECHARGE');
    // Approval credits the wallet only; no course access is created.
    expect(await world.prisma.purchase.count({ where: { studentId: world.studentUser.id } })).toBe(0);
    expect(await world.prisma.subscription.count({ where: { studentId: world.studentUser.id } })).toBe(0);
  });

  it('concurrent approvals converge on a single credit', async () => {
    const id = await submit(25000);
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () => review(id, { decision: 'APPROVE', receiptVerified: true })),
    );
    const approved = attempts.filter((r) => r.status === 200);
    const conflicted = attempts.filter((r) => r.status === 409);
    expect(approved).toHaveLength(1);
    expect(conflicted).toHaveLength(5);
    for (const r of conflicted) expect(r.body.error.code).toBe('ALREADY_REVIEWED');

    const credits = await world.prisma.walletLedgerEntry.count({ where: { refType: 'RECHARGE', refId: id } });
    expect(credits).toBe(1);
  });

  it('already-reviewed requests stay immutable', async () => {
    const id = await submit(10000);
    expect((await review(id, { decision: 'APPROVE', receiptVerified: true })).status).toBe(200);
    const again = await review(id, { decision: 'REJECT', receiptVerified: true, reason: 'late' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_REVIEWED');
    const row = await world.prisma.rechargeRequest.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('APPROVED');
  });

  it('rejection requires a reason and resubmission creates a new request', async () => {
    const id = await submit(10000);
    expect((await review(id, { decision: 'REJECT' })).status).toBe(400);
    const rejected = await review(id, { decision: 'REJECT', receiptVerified: false, reason: 'Receipt does not match the amount.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');
    expect(rejected.body.data.rejectReason).toContain('Receipt');

    const wallet = await world.prisma.wallet.findUnique({ where: { userId: world.studentUser.id } });
    const before = wallet?.balancePiastres ?? 0;
    const retry = await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, rechargeBody({ amountPiastres: 10000 }));
    expect(retry.status).toBe(201);
    expect(retry.body.data.id).not.toBe(id);
    expect(retry.body.data.status).toBe('PENDING');
    const after = (await world.prisma.wallet.findUnique({ where: { userId: world.studentUser.id } }))?.balancePiastres ?? 0;
    expect(after).toBe(before);
  });

  it('review requires explicit receipt verification', async () => {
    const id = await submit(10000);
    const res = await review(id, { decision: 'APPROVE', receiptVerified: false });
    expect(res.status).toBe(400);
    expect((await world.prisma.rechargeRequest.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
  });

  it('rejects unknown review fields', async () => {
    const id = await submit(10000);
    const res = await review(id, { decision: 'APPROVE', receiptVerified: true, amountPiastres: 999999 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FIELD');
  });

  it('students cannot review and cannot see other students requests', async () => {
    const id = await submit(10000);
    const studentAttempt = await studentPost(world.app, `/admin/recharge-requests/${id}/review`, world.studentJar, { decision: 'APPROVE', receiptVerified: true });
    expect([401, 403]).toContain(studentAttempt.status);

    const other = await registerStudent(world.app);
    const peek = await studentGet(world.app, `/wallet/recharge-requests/${id}`, other.jar);
    expect(peek.status).toBe(404);
    const proofPeek = await studentGet(world.app, `/admin/recharge-requests/${id}/proof`, other.jar);
    expect([401, 403, 404]).toContain(proofPeek.status);
  });

  it('only admins may open proof bytes', async () => {
    const id = await submit(10000);
    const studentProof = await studentGet(world.app, `/wallet/recharge-requests/${id}`, world.studentJar);
    expect(studentProof.body.data.proofBase64).toBeUndefined();

    const adminProof = await adminGet(world.app, `/admin/recharge-requests/${id}/proof`, world.adminJar);
    expect(adminProof.status).toBe(200);
    expect(adminProof.headers['content-type']).toContain('image/jpeg');
    expect(Number(adminProof.headers['content-length'])).toBeGreaterThan(0);
  });

  it('admin queue filters by status and stays usable', async () => {
    const id = await submit(10000);
    const pending = await adminGet(world.app, '/admin/recharge-requests?status=PENDING', world.adminJar);
    expect(pending.status).toBe(200);
    expect((pending.body.data.requests as Array<{ id: string }>).some((r) => r.id === id)).toBe(true);
    await review(id, { decision: 'APPROVE', receiptVerified: true });
    const pendingAfter = await adminGet(world.app, '/admin/recharge-requests?status=PENDING', world.adminJar);
    expect((pendingAfter.body.data.requests as Array<{ id: string }>).some((r) => r.id === id)).toBe(false);
  });
});

describe('recharge audit trail', () => {
  it('records sanitized submit/approve events without proof bytes', async () => {
    const id = await submit(15000);
    await review(id, { decision: 'APPROVE', receiptVerified: true });
    const events = await world.prisma.auditEvent.findMany({ where: { entityId: id } });
    const actions = events.map((e) => e.action).sort();
    expect(actions).toEqual(['RECHARGE_APPROVED', 'RECHARGE_SUBMITTED']);
    expect(JSON.stringify(events)).not.toContain('base64');
  });
});
