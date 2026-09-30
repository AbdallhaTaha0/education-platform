import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminPost } from './catalog-helpers.js';
import { registerStudent } from './identity-helpers.js';
import { createWalletWorld, rechargeBody, resetFinancialState, studentGet, studentPost, uniqueKey, type WalletWorld } from './wallet-helpers.js';
import { Prisma } from '@prisma/client';

let world: WalletWorld;

beforeAll(async () => {
  world = await createWalletWorld(true);
});

afterAll(async () => {
  await world.close();
});

async function publishedPlan(pricePiastres = 60000, durationDays = 90): Promise<{ planId: string; courseId: string }> {
  const slug = `buy-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
  const course = await world.prisma.course.create({
    data: {
      slug, titleAr: 'دورة', titleEn: 'Course', descriptionAr: 'وصف', descriptionEn: 'Desc',
      status: 'PUBLISHED', publishedAt: new Date(),
    },
  });
  const plan = await world.prisma.subscriptionPlan.create({
    data: { courseId: course.id, currentPricePiastres: pricePiastres, durationDays },
  });
  return { planId: plan.id, courseId: course.id };
}

async function fundedBalance(piastres: number): Promise<void> {
  const sub = await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, rechargeBody({ amountPiastres: piastres }));
  expect(sub.status).toBe(201);
  const approved = await adminPost(world.app, `/admin/recharge-requests/${sub.body.data.id}/review`, world.adminJar, { decision: 'APPROVE', receiptVerified: true });
  expect(approved.status).toBe(200);
}

async function balance(): Promise<number> {
  const res = await studentGet(world.app, '/wallet', world.studentJar);
  expect(res.status).toBe(200);
  return res.body.data.balancePiastres as number;
}

describe('course purchase', () => {
  it('rejects insufficient funds without creating access', async () => {
    // A zero balance and zero purchase/subscription rows are this test's own
    // precondition, not an accident of running before the funding tests below.
    await resetFinancialState(world);
    const { planId } = await publishedPlan(60000, 90);
    const res = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId, idempotencyKey: uniqueKey('poor') });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(await world.prisma.purchase.count()).toBe(0);
    expect(await world.prisma.subscription.count()).toBe(0);
  });

  it('debits exactly, snapshots terms, and grants dated entitlement', async () => {
    const { planId, courseId } = await publishedPlan(60000, 90);
    await fundedBalance(100000);
    const before = await balance();
    const res = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId, idempotencyKey: uniqueKey('buy') });
    expect(res.status).toBe(201);
    expect(res.body.data.pricePiastres).toBe(60000);
    expect(res.body.data.durationDays).toBe(90);
    expect(res.body.data.courseId).toBe(courseId);
    expect(await balance()).toBe(before - 60000);

    const purchase = await world.prisma.purchase.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(purchase.pricePiastres).toBe(60000);
    expect(purchase.durationDays).toBe(90);
    const sub = await world.prisma.subscription.findUniqueOrThrow({ where: { purchaseId: purchase.id } });
    const days = Math.round((sub.expiresAt.getTime() - sub.startsAt.getTime()) / 86_400_000);
    expect(days).toBe(90);

    const debits = await world.prisma.walletLedgerEntry.findMany({ where: { refType: 'PURCHASE', refId: purchase.id } });
    expect(debits).toHaveLength(1);
    expect(debits[0]?.amountPiastres).toBe(-60000);
  });

  it('idempotent retry returns the same purchase without double debit', async () => {
    const { planId } = await publishedPlan(50000, 30);
    await fundedBalance(200000);
    const key = uniqueKey('idem-buy');
    const first = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId, idempotencyKey: key });
    expect(first.status).toBe(201);
    const before = await balance();
    const second = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId, idempotencyKey: key });
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await balance()).toBe(before);
    expect(await world.prisma.purchase.count({ where: { studentId: world.studentUser.id, idempotencyKey: key } })).toBe(1);
  });

  it('concurrent identical retries converge on one purchase and debit', async () => {
    const racer = await registerStudent(world.app);
    const racerRow = await world.prisma.user.findUniqueOrThrow({ where: { email: racer.user.email } });
    const { planId } = await publishedPlan(60000, 30);
    const sub = await studentPost(world.app, '/wallet/recharge-requests', racer.jar, rechargeBody({ amountPiastres: 100000 }));
    expect((await adminPost(world.app, `/admin/recharge-requests/${sub.body.data.id}/review`, world.adminJar, { decision: 'APPROVE', receiptVerified: true })).status).toBe(200);
    const key = uniqueKey('same-race');
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () => studentPost(world.app, '/wallet/purchases', racer.jar, { planId, idempotencyKey: key })),
    );
    expect(attempts.every((r) => r.status === 201)).toBe(true);
    expect(new Set(attempts.map((r) => r.body.data.id)).size).toBe(1);
    expect(await world.prisma.purchase.count({ where: { studentId: racerRow.id, idempotencyKey: key } })).toBe(1);
    const wallet = await world.prisma.wallet.findUniqueOrThrow({ where: { userId: racerRow.id } });
    expect(wallet.balancePiastres).toBe(40000);
    expect(await world.prisma.walletLedgerEntry.count({ where: { walletId: wallet.id, entryType: 'DEBIT_PURCHASE' } })).toBe(1);
  });

  it('conflicts when the key is reused for a different plan', async () => {
    const first = await publishedPlan(40000, 30);
    const second = await publishedPlan(40000, 30);
    await fundedBalance(200000);
    const key = uniqueKey('clash');
    expect((await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId: first.planId, idempotencyKey: key })).status).toBe(201);
    const clash = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId: second.planId, idempotencyKey: key });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('simultaneous purchases cannot overspend', async () => {
    // A fresh student with exactly one purchase worth of funds: the race
    // outcome is deterministic (exactly 1 success, 3 denials) regardless of
    // balances accumulated by earlier tests in this file.
    const racer = await registerStudent(world.app);
    const { planId } = await publishedPlan(60000, 30);
    const sub = await studentPost(world.app, '/wallet/recharge-requests', racer.jar, rechargeBody({ amountPiastres: 100000 }));
    expect(sub.status).toBe(201);
    expect((await adminPost(world.app, `/admin/recharge-requests/${sub.body.data.id}/review`, world.adminJar, { decision: 'APPROVE', receiptVerified: true })).status).toBe(200);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => studentPost(world.app, '/wallet/purchases', racer.jar, { planId, idempotencyKey: uniqueKey('race') })),
    );
    const ok = results.filter((r) => r.status === 201);
    const denied = results.filter((r) => r.status === 402);
    expect(ok).toHaveLength(1);
    expect(denied).toHaveLength(3);
    const racerRow = await world.prisma.user.findUniqueOrThrow({ where: { email: racer.user.email } });
    const wallet = await world.prisma.wallet.findUniqueOrThrow({ where: { userId: racerRow.id } });
    expect(wallet.balancePiastres).toBe(40000);
    // Ledger reconciliation: cached balance matches summed entries.
    const entries = await world.prisma.walletLedgerEntry.findMany({ where: { walletId: wallet.id } });
    expect(entries.reduce((sum, e) => sum + e.amountPiastres, 0)).toBe(wallet.balancePiastres);
  });

  it('later plan edits never rewrite the purchase snapshot', async () => {
    const { planId } = await publishedPlan(60000, 90);
    await fundedBalance(200000);
    const bought = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId, idempotencyKey: uniqueKey('snap') });
    expect(bought.status).toBe(201);
    await world.prisma.subscriptionPlan.update({
      where: { id: planId },
      data: { currentPricePiastres: 90000, durationDays: 30 },
    });
    const purchase = await world.prisma.purchase.findUniqueOrThrow({ where: { id: bought.body.data.id } });
    expect(purchase.pricePiastres).toBe(60000);
    expect(purchase.durationDays).toBe(90);
  });

  it('active renewal extends from the existing expiry', async () => {
    const { planId } = await publishedPlan(60000, 90);
    await fundedBalance(300000);
    const first = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId, idempotencyKey: uniqueKey('ren1') });
    expect(first.status).toBe(201);
    const firstExpiry = new Date(first.body.data.subscription.expiresAt).getTime();
    const second = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId, idempotencyKey: uniqueKey('ren2') });
    expect(second.status).toBe(201);
    const secondStart = new Date(second.body.data.subscription.startsAt).getTime();
    const secondExpiry = new Date(second.body.data.subscription.expiresAt).getTime();
    expect(Math.abs(secondStart - firstExpiry)).toBeLessThan(5000);
    expect(Math.round((secondExpiry - secondStart) / 86_400_000)).toBe(90);
  });

  it('expired renewal starts immediately', async () => {
    const { planId, courseId } = await publishedPlan(60000, 90);
    await fundedBalance(300000);
    const first = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId, idempotencyKey: uniqueKey('exp1') });
    expect(first.status).toBe(201);
    // Age the existing entitlement into the past, then renew.
    const started = Date.now();
    await world.prisma.subscription.updateMany({
      where: { studentId: world.studentUser.id, courseId },
      data: { startsAt: new Date(started - 100 * 86_400_000), expiresAt: new Date(started - 10 * 86_400_000) },
    });
    const second = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId, idempotencyKey: uniqueKey('exp2') });
    expect(second.status).toBe(201);
    const start = new Date(second.body.data.subscription.startsAt).getTime();
    expect(Math.abs(start - Date.now())).toBeLessThan(15000);
  });

  it('unpublished plans cannot be purchased', async () => {
    const course = await world.prisma.course.create({
      data: {
        slug: `draft-${Date.now().toString(36)}`, titleAr: 'د', titleEn: 'D', descriptionAr: 'و', descriptionEn: 'D', status: 'DRAFT',
      },
    });
    const plan = await world.prisma.subscriptionPlan.create({
      data: { courseId: course.id, currentPricePiastres: 10000, durationDays: 30 },
    });
    await fundedBalance(50000);
    const res = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId: plan.id, idempotencyKey: uniqueKey('draft') });
    expect(res.status).toBe(404);
  });

  it('waits for the course lock and revalidates after an archive wins', async () => {
    const { planId, courseId } = await publishedPlan(30000, 30);
    await fundedBalance(100000);
    const before = await balance();
    let release!: () => void;
    let locked!: () => void;
    const releaseGate = new Promise<void>((resolve) => { release = resolve; });
    const lockedGate = new Promise<void>((resolve) => { locked = resolve; });
    const blocker = world.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT id FROM "Course" WHERE id = ${courseId} FOR UPDATE`);
      locked();
      await releaseGate;
      await tx.course.update({ where: { id: courseId }, data: { status: 'ARCHIVED', priorStatus: 'PUBLISHED', archivedAt: new Date() } });
    });
    await lockedGate;
    const purchase = studentPost(world.app, '/wallet/purchases', world.studentJar, {
      planId,
      idempotencyKey: uniqueKey('archive-race'),
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    release();
    await blocker;
    const response = await purchase;
    expect(response.status).toBe(404);
    expect(await balance()).toBe(before);
    expect(await world.prisma.purchase.count({ where: { planId } })).toBe(0);
  });

  it('rejects unknown purchase fields', async () => {
    const { planId } = await publishedPlan(30000, 30);
    const response = await studentPost(world.app, '/wallet/purchases', world.studentJar, {
      planId,
      idempotencyKey: uniqueKey('unknown'),
      clientPrice: 1,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_FIELD');
  });

  it('purchase history and subscriptions are visible to the owner', async () => {
    const { planId } = await publishedPlan(30000, 30);
    await fundedBalance(100000);
    await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId, idempotencyKey: uniqueKey('hist') });
    const purchases = await studentGet(world.app, '/wallet/purchases', world.studentJar);
    expect(purchases.status).toBe(200);
    expect((purchases.body.data.purchases as unknown[]).length).toBeGreaterThanOrEqual(1);
    const subs = await studentGet(world.app, '/wallet/subscriptions', world.studentJar);
    expect(subs.status).toBe(200);
    expect((subs.body.data.subscriptions as unknown[]).length).toBeGreaterThanOrEqual(1);
  });
});
