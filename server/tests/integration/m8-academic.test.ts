import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWalletWorld, rechargeBody, studentGet, studentPost, uniqueKey, type WalletWorld } from './wallet-helpers.js';
import { adminPost, adminPatch } from './catalog-helpers.js';
import { TEST_ORIGIN, uniqueIp } from './identity-helpers.js';
import { purchaseCourse } from '../../src/modules/wallet/purchase/service.js';
import { purchasePackage } from '../../src/modules/wallet/purchase/packages.js';
import { evaluateEntitlement } from '../../src/modules/learning/access/entitlement.js';
import { recordExpiry } from '../../src/modules/notifications/producers.js';

let world: WalletWorld;
const ids: string[] = [];
const packages: string[] = [];
const endsAt = '2027-07-15T18:00:00+03:00';
beforeAll(async () => {
  world = await createWalletWorld(true);
  // Synthetic catalog fixtures live ONLY in the disposable automated-test DB.
  for (let i = 0; i < 3; i++) {
    const row = await world.prisma.course.create({ data: { slug: `m8-${randomUUID()}`, titleAr: `دورة شهر ${i}`, titleEn: `Month ${i}`,
      descriptionAr: 'اختبار', descriptionEn: 'Test only', status: 'PUBLISHED', publishedAt: new Date(),
      grade: 'FIRST_SECONDARY', academicYear: '2026/2027', term: 1, courseKind: 'MONTHLY_EXPLANATION', teachingMonth: `2026-${10 + i}` } });
    ids.push(row.id);
  }
  const recharge = await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, rechargeBody({ amountPiastres: 2000000 }));
  expect(recharge.status).toBe(201);
  expect((await adminPost(world.app, `/admin/recharge-requests/${recharge.body.data.id}/review`, world.adminJar, { decision: 'APPROVE', receiptVerified: true })).status).toBe(200);
});
afterAll(async () => {
  await world.prisma.packagePurchase.deleteMany({ where: { studentId: world.studentUser.id } });
  await world.prisma.coursePackage.deleteMany({ where: { id: { in: packages } } });
  await world.prisma.course.deleteMany({ where: { id: { in: ids } } });
  await world.close();
});
async function pkg() {
  const res = await adminPost(world.app, '/admin/catalog/packages', world.adminJar, { titleAr: 'باقة اختبار', titleEn: 'Test package', descriptionAr: 'ثلاثة كورسات', descriptionEn: 'Three monthly courses', pricePiastres: 90000, endsAt, courseIds: ids, status: 'PUBLISHED' });
  expect(res.status).toBe(201);
  packages.push(res.body.data.package.id);
  return res.body.data.package as { id: string; version: number };
}
async function balance() { return (await world.prisma.wallet.findUniqueOrThrow({ where: { userId: world.studentUser.id } })).balancePiastres; }

describe('M8 academic and atomic package purchase', () => {
  it('guards aggregate reporting and counts effective access without exposing identities', async () => {
    expect((await studentGet(world.app, '/admin/catalog/summary', world.studentJar)).status).toBe(403);
    const view = await studentGet(world.app, '/admin/catalog/summary', world.adminJar);
    expect(view.status).toBe(200); expect(view.body.data.students).toBeGreaterThan(0);
    expect(view.body.data.pendingRecharges).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(view.body)).not.toMatch(/email|phone|password|receiptUrl/);
  });
  it('creates academic metadata via guarded admin API and filters safe public results', async () => {
    const created = await adminPost(world.app, '/admin/catalog/courses', world.adminJar, { slug: `metadata-${randomUUID()}`, titleAr: 'مراجعة', titleEn: 'Revision', descriptionAr: 'اختبار', descriptionEn: 'Test', academic: { grade: 'SECOND_SECONDARY', academicYear: '2026/2027', term: 2, courseKind: 'REVISION' } });
    expect(created.status).toBe(201); ids.push(created.body.data.course.id);
    const filtered = await request(world.app).get('/catalog/courses?grade=FIRST_SECONDARY&term=1&teachingMonth=2026-10');
    // Router mount is /catalog; no private outline/media fields are serialized.
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.courses.every((c: { academic: { grade: string } }) => c.academic.grade === 'FIRST_SECONDARY')).toBe(true);
    expect(JSON.stringify(filtered.body)).not.toContain('externalAssetId');
    ids.pop(); await world.prisma.course.delete({ where: { id: created.body.data.course.id } });
  });
  it('rejects invalid member counts, duplicate IDs and unauthorized writes', async () => {
    const p = { titleAr: 'باقة', titleEn: 'Package', descriptionAr: 'وصف', descriptionEn: 'Description', pricePiastres: 1, endsAt, courseIds: [ids[0], ids[0], ids[1]] };
    expect((await adminPost(world.app, '/admin/catalog/packages', world.adminJar, p)).status).toBe(400);
    expect((await adminPost(world.app, '/admin/catalog/packages', world.adminJar, { ...p, courseIds: ids.slice(0, 2) })).status).toBe(400);
    expect((await studentPost(world.app, '/admin/catalog/packages', world.studentJar, p)).status).toBe(403);
    expect((await request(world.app).post('/wallet/package-purchases').send({})).status).not.toBe(201);
  });
  it('charges once, creates exactly three grants and converges concurrent retries', async () => {
    const p = await pkg(); const before = await balance();
    const input = { packageId: p.id, expectedVersion: p.version, idempotencyKey: uniqueKey('m8-concurrent') };
    const [a, b] = await Promise.all([purchasePackage(world.prisma, world.studentUser.id, input), purchasePackage(world.prisma, world.studentUser.id, input)]);
    expect(a.id).toBe(b.id); expect(a.items).toHaveLength(3); expect(a.subscriptions).toHaveLength(3);
    expect(await balance()).toBe(before - 90000);
    expect(await world.prisma.walletLedgerEntry.count({ where: { refType: 'PACKAGE_PURCHASE', refId: a.id } })).toBe(1);
    for (const sub of a.subscriptions) {
      expect(sub.expiresAt!.toISOString()).toBe('2027-07-15T15:00:00.000Z');
      expect(evaluateEntitlement([sub], sub.courseId, sub.expiresAt!.getTime() - 1).allowed).toBe(true);
      expect(evaluateEntitlement([sub], sub.courseId, sub.expiresAt!.getTime()).allowed).toBe(false);
    }
  });
  it('warns for active overlapping courses but permits another package purchase', async () => {
    const p = await pkg();
    const review = await studentGet(world.app, `/wallet/packages/${p.id}/review`, world.studentJar);
    expect(review.status).toBe(200); expect(review.body.data.warnings[0].code).toBe('EXISTING_ACCESS');
    const bought = await studentPost(world.app, '/wallet/package-purchases', world.studentJar, { packageId: p.id, expectedVersion: p.version, idempotencyKey: uniqueKey('m8-overlap') });
    expect(bought.status).toBe(201);
    expect(bought.body.data.items).toHaveLength(3);
  });
  it('rejects changed offers before payment and replays stored terms after archive', async () => {
    const p = await pkg(); const key = uniqueKey('m8-version');
    const old = await purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: key });
    const changed = await adminPatch(world.app, `/admin/catalog/packages/${p.id}`, world.adminJar, { expectedVersion: p.version, status: 'ARCHIVED', pricePiastres: 100000 });
    expect(changed.status).toBe(200);
    const before = await balance();
    const replay = await purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: key });
    expect(replay.id).toBe(old.id); expect(replay.pricePiastres).toBe(90000); expect(await balance()).toBe(before);
    await expect(purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: uniqueKey('m8-stale') })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE' });
  });
  it('keeps the common purchase deadline after live package edits', async () => {
    const p = await pkg();
    const bought = await purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: uniqueKey('m8-snapshot') });
    expect((await adminPatch(world.app, `/admin/catalog/packages/${p.id}`, world.adminJar, { expectedVersion: p.version, endsAt: '2027-08-15T18:00:00+03:00' })).status).toBe(200);
    const stored = await world.prisma.packagePurchase.findUniqueOrThrow({ where: { id: bought.id }, include: { subscriptions: true } });
    expect(stored.endsAt.toISOString()).toBe('2027-07-15T15:00:00.000Z');
    expect(stored.subscriptions.every(s => s.expiresAt!.getTime() === stored.endsAt.getTime())).toBe(true);
  });
  it('rolls back all grant/items/debit writes on a database failure', async () => {
    const p = await pkg(); const key = uniqueKey('m8-fail'); const before = await balance();
    await world.prisma.$executeRawUnsafe(`CREATE FUNCTION m8_fail_item() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN IF NEW.position = 3 THEN RAISE EXCEPTION ''m8 injected failure''; END IF; RETURN NEW; END'`);
    await world.prisma.$executeRawUnsafe('CREATE TRIGGER m8_fail_item BEFORE INSERT ON "PackagePurchaseItem" FOR EACH ROW EXECUTE FUNCTION m8_fail_item()');
    try {
      await expect(purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: key })).rejects.toThrow();
      expect(await balance()).toBe(before);
      expect(await world.prisma.packagePurchase.count({ where: { idempotencyKey: key } })).toBe(0);
    } finally { await world.prisma.$executeRawUnsafe('DROP TRIGGER m8_fail_item ON "PackagePurchaseItem"'); await world.prisma.$executeRawUnsafe('DROP FUNCTION m8_fail_item()'); }
  });
  it('enforces course and package idempotency in the same student namespace', async () => {
    const p = await pkg(); const key = uniqueKey('m8-cross');
    await purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: key });
    const plan = await world.prisma.subscriptionPlan.create({ data: { courseId: ids[0]!, currentPricePiastres: 100, durationDays: 30 } });
    expect((await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId: plan.id, idempotencyKey: key })).status).toBe(409);
  });
  it('converges a concurrent cross-kind race on one debit without duplication', async () => {
    const p = await pkg();
    const plan = await world.prisma.subscriptionPlan.create({ data: { courseId: ids[0]!, currentPricePiastres: 5000, durationDays: 30 } });
    const key = uniqueKey('m8-cross-race');
    const before = await balance();
    const [a, b] = await Promise.allSettled([
      purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: key }),
      purchaseCourse(world.prisma, world.studentUser.id, { planId: plan.id, idempotencyKey: key }),
    ]);
    const fulfilled = [a, b].filter(r => r.status === 'fulfilled');
    const rejected = [a, b].filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    // Exactly one debit: the winner's price only, never both and never none.
    const winnerIsPackage = a.status === 'fulfilled';
    expect(await balance()).toBe(before - (winnerIsPackage ? 90000 : 5000));
    expect(await world.prisma.packagePurchase.count({ where: { studentId: world.studentUser.id, idempotencyKey: key } })
      + await world.prisma.purchase.count({ where: { studentId: world.studentUser.id, idempotencyKey: key } })).toBe(1);
  });
  it('enforces HTTP role/guards and refuses expired or deletion-pending package offers', async () => {
    const p = await pkg();
    const input = { packageId: p.id, expectedVersion: p.version, idempotencyKey: uniqueKey('m8-http-guard') };
    const adminAttempt = await request(world.app).post('/wallet/package-purchases').set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp()).set('Cookie', world.adminJar.header()).set('X-Csrf-Token', world.adminJar.csrf()).send(input);
    expect(adminAttempt.status).toBe(403);
    const noCsrf = await request(world.app).post('/wallet/package-purchases').set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp()).set('Cookie', world.studentJar.header()).send(input);
    expect(noCsrf.status).toBe(403);
    await world.prisma.coursePackage.update({ where: { id: p.id }, data: { endsAt: new Date('2020-01-01T00:00:00Z') } });
    const before = await balance();
    const expired = await studentPost(world.app, '/wallet/package-purchases', world.studentJar, input);
    expect(expired.status).toBe(409);
    expect(await balance()).toBe(before);
    await world.prisma.coursePackage.update({ where: { id: p.id }, data: { endsAt: new Date(endsAt) } });
    await world.prisma.course.update({ where: { id: ids[0] }, data: { deletionRequestedAt: new Date() } });
    try {
      const blocked = await studentPost(world.app, '/wallet/package-purchases', world.studentJar, { ...input, idempotencyKey: uniqueKey('m8-http-guard-2') });
      expect(blocked.status).toBe(409);
      expect(await balance()).toBe(before);
    } finally {
      await world.prisma.course.update({ where: { id: ids[0] }, data: { deletionRequestedAt: null } });
    }
  });
  it('grants fixed-date course access and refuses an already expired offer', async () => {
    const res = await adminPost(world.app, `/admin/catalog/courses/${ids[0]}/plans`, world.adminJar, { currentPricePiastres: 100, accessMode: 'TERM_END', accessEndsAt: '2027-09-15T18:00:00+03:00' });
    expect(res.status).toBe(201);
    const plan = res.body.data.plan;
    const bought = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId: plan.id, idempotencyKey: uniqueKey('m8-fixed') });
    expect(bought.status).toBe(201); expect(bought.body.data.durationDays).toBeNull();
    expect(bought.body.data.subscription.expiresAt).toBe('2027-09-15T15:00:00.000Z');
    await world.prisma.subscriptionPlan.update({ where: { id: plan.id }, data: { accessEndsAt: new Date('2020-01-01') } });
    const before = await balance();
    const expired = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId: plan.id, idempotencyKey: uniqueKey('m8-expired') });
    expect(expired.status).toBe(409); expect(await balance()).toBe(before);
  });
  it('preserves longer standalone access when purchasing an overlapping package', async () => {
    const plan = await world.prisma.subscriptionPlan.create({ data: { courseId: ids[0]!, currentPricePiastres: 100, durationDays: 90 } });
    const standalone = await studentPost(world.app, '/wallet/purchases', world.studentJar, { planId: plan.id, idempotencyKey: uniqueKey('m8-long') });
    expect(standalone.status).toBe(201);
    const longExpiry = new Date(standalone.body.data.subscription.expiresAt).getTime();
    const p = await pkg();
    const bought = await purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: uniqueKey('m8-short') });
    expect(bought.endsAt.getTime()).toBeLessThan(longExpiry);
    const rows = await world.prisma.subscription.findMany({ where: { studentId: world.studentUser.id, courseId: ids[0] } });
    expect(evaluateEntitlement(rows, ids[0]!, bought.endsAt.getTime() + 1)).toEqual({ allowed: true, expiresAt: new Date(longExpiry) });
    expect(await recordExpiry(world.prisma, world.studentUser.id, ids[0]!, () => bought.endsAt.getTime() + 1)).toBe(false);
  });
  it('only charges for a fixed deadline when it extends existing access', async () => {
    const res = await adminPost(world.app, `/admin/catalog/courses/${ids[1]}/plans`, world.adminJar, { currentPricePiastres: 100, accessMode: 'YEAR_END', accessEndsAt: '2027-07-15T18:00:00+03:00' });
    expect(res.status).toBe(201);
    const before = await balance();
    const input = { planId: res.body.data.plan.id, idempotencyKey: uniqueKey('m8-no-extension') };
    expect((await studentPost(world.app, '/wallet/purchases', world.studentJar, input)).body.error.code).toBe('NO_ACCESS_EXTENSION');
    expect(await balance()).toBe(before);
    expect((await adminPatch(world.app, `/admin/catalog/plans/${input.planId}`, world.adminJar, { accessEndsAt: '2028-01-15T18:00:00+02:00' })).status).toBe(200);
    const extended = await studentPost(world.app, '/wallet/purchases', world.studentJar, { ...input, idempotencyKey: uniqueKey('m8-extension') });
    expect(extended.status).toBe(201); expect(extended.body.data.subscription.expiresAt).toBe('2028-01-15T16:00:00.000Z');
    expect(await balance()).toBe(before - 100);
  });
  it('offers unpublished monthly members with a clear label but no learning access', async () => {
    await world.prisma.course.update({ where: { id: ids[2] }, data: { status: 'DRAFT' } });
    try {
      const p = await pkg();
      const view = await request(world.app).get(`/catalog/packages/${p.id}`);
      expect(view.body.data.package.available).toBe(true);
      expect(view.body.data.package.courses.find((c: { id: string }) => c.id === ids[2]).published).toBe(false);
      const bought = await purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: uniqueKey('m8-unpublished') });
      expect(bought.subscriptions).toHaveLength(3);
      expect((await studentGet(world.app, `/learning/courses/${ids[2]}/outline`, world.studentJar)).status).toBe(404);
      expect((await request(world.app).get(`/catalog/courses/m8-nonexistent`)).status).toBe(404);
    } finally { await world.prisma.course.update({ where: { id: ids[2] }, data: { status: 'PUBLISHED' } }); }
  });
  it('preserves indefinite snapshots and suppresses expiry despite older finite grants', async () => {
    const res = await adminPost(world.app, `/admin/catalog/courses/${ids[2]}/plans`, world.adminJar, { currentPricePiastres: 100, accessMode: 'UNTIL_REMOVAL' });
    expect(res.status).toBe(201);
    const input = { planId: res.body.data.plan.id, idempotencyKey: uniqueKey('m8-indefinite') }; const before = await balance();
    const bought = await studentPost(world.app, '/wallet/purchases', world.studentJar, input);
    expect(bought.status).toBe(201); expect(bought.body.data.subscription.expiresAt).toBeNull();
    expect(bought.body.data.accessMode).toBe('UNTIL_REMOVAL'); expect(await balance()).toBe(before - 100);
    expect((await studentPost(world.app, '/wallet/purchases', world.studentJar, input)).body.data.id).toBe(bought.body.data.id);
    expect((await adminPatch(world.app, `/admin/catalog/plans/${input.planId}`, world.adminJar, { accessMode: 'DURATION', durationDays: 30 })).status).toBe(200);
    const stored = await world.prisma.subscription.findMany({ where: { studentId: world.studentUser.id, courseId: ids[2] } });
    const future = new Date('2090-01-01').getTime();
    expect(evaluateEntitlement(stored, ids[2]!, future)).toEqual({ allowed: true, expiresAt: null });
    expect(await recordExpiry(world.prisma, world.studentUser.id, ids[2]!, () => future)).toBe(false);
    const repeat = await studentPost(world.app, '/wallet/purchases', world.studentJar, { ...input, idempotencyKey: uniqueKey('m8-indefinite-repeat') });
    expect(repeat.body.error.code).toBe('NO_ACCESS_EXTENSION'); expect(await balance()).toBe(before - 100);
  });
  it('refuses stale versions, insufficient funds and archived members without debit', async () => {
    const p = await pkg(); const before = await balance();
    await expect(purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version + 1, idempotencyKey: uniqueKey('m8-stale-version') })).rejects.toMatchObject({ code: 'OFFER_CHANGED' });
    await world.prisma.coursePackage.update({ where: { id: p.id }, data: { pricePiastres: 2000000000 } });
    await expect(purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: uniqueKey('m8-poor') })).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
    await world.prisma.course.update({ where: { id: ids[0] }, data: { status: 'ARCHIVED' } });
    try {
      await expect(purchasePackage(world.prisma, world.studentUser.id, { packageId: p.id, expectedVersion: p.version, idempotencyKey: uniqueKey('m8-unavailable') })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE' });
      const publicView = await request(world.app).get(`/catalog/packages/${p.id}`);
      expect(publicView.status).toBe(200); expect(publicView.body.data.package.available).toBe(false);
      expect(publicView.body.data.package.courses.some((c: { id: string }) => c.id === ids[0])).toBe(false);
      expect((await adminPatch(world.app, `/admin/catalog/packages/${p.id}`, world.adminJar, { expectedVersion: p.version, status: 'ARCHIVED' })).status).toBe(200);
      expect(await balance()).toBe(before);
    } finally { await world.prisma.course.update({ where: { id: ids[0] }, data: { status: 'PUBLISHED' } }); }
  });
  it('keeps own package history private and enforces database access shape', async () => {
    expect((await studentGet(world.app, '/wallet/package-purchases', world.adminJar)).status).toBe(403);
    const history = await studentGet(world.app, '/wallet/package-purchases', world.studentJar);
    expect(history.status).toBe(200);
    expect(history.body.data.purchases.every((p: { studentId: string; items: unknown[] }) => p.studentId === world.studentUser.id && p.items.length === 3)).toBe(true);
    await expect(world.prisma.subscriptionPlan.create({ data: { courseId: ids[0]!, currentPricePiastres: 100, durationDays: null } })).rejects.toThrow();
  });
});
