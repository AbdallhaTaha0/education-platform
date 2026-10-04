import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createLearningWorld, type LearningWorld } from './learning-helpers.js';
import { reconcilePendingReleaseAudits, releaseStudentDevice } from '../../src/modules/learning/devices/service.js';

let world: LearningWorld;
beforeAll(async () => { world = await createLearningWorld(); });
afterAll(async () => { await world?.fixture.stop(); await world?.close(); });
const rows = (reference: string, action: string) => world.prisma.auditEvent.findMany({ where: { entityId: world.studentId, action, metadata: { path: ['deviceReference'], equals: reference } } });

it('finds pending work after more than the old 100-row completed-history ceiling', async () => {
  const base = Date.now() - 600_000;
  const data = Array.from({ length: 130 }, (_, i) => {
    const reference = randomUUID();
    const intentId = randomUUID();
    return [
      { id: intentId, actorUserId: world.adminUser.id, entityType: 'User', entityId: world.studentId, action: 'DEVICE_RELEASE_REQUESTED', metadata: { deviceReference: reference }, createdAt: new Date(base + i * 10) },
      { id: randomUUID(), actorUserId: world.adminUser.id, entityType: 'User', entityId: world.studentId, action: 'DEVICE_RELEASE', metadata: { deviceReference: reference, intentId }, createdAt: new Date(base + i * 10 + 1) },
    ];
  }).flat();
  await world.prisma.auditEvent.createMany({ data });
  const reference = randomUUID();
  await world.prisma.auditEvent.create({ data: { actorUserId: world.adminUser.id, entityType: 'User', entityId: world.studentId, action: 'DEVICE_RELEASE_REQUESTED', metadata: { deviceReference: reference } } });
  const result = await reconcilePendingReleaseAudits(world.prisma, world.drm, world.adminUser.id, world.studentId, world.studentId);
  expect(await rows(reference, 'DEVICE_RELEASE')).toHaveLength(1);
  expect(result.complete).toBe(true);
});

// A real PostgreSQL statement error aborts its transaction. A rejected JS
// proxy promise cannot reproduce this behavior. Trigger exists only in the
// disposable test database and is removed even when assertions fail.
async function withAuditFailure(reference: string, action: string, run: () => Promise<void>) {
  await world.prisma.$executeRawUnsafe(`CREATE FUNCTION coordinator_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = '${action}' AND NEW.metadata->>'deviceReference' = '${reference}' THEN RAISE EXCEPTION 'synthetic coordinator audit write failure'; END IF; RETURN NEW; END $$`);
  await world.prisma.$executeRawUnsafe('CREATE TRIGGER coordinator_reject_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION coordinator_reject_audit()');
  try { await run(); }
  finally {
    await world.prisma.$executeRawUnsafe('DROP TRIGGER coordinator_reject_audit ON "AuditEvent"');
    await world.prisma.$executeRawUnsafe('DROP FUNCTION coordinator_reject_audit()');
  }
}

it('reports applied release with pending audit after a real database statement failure, then recovers', async () => {
  const reference = randomUUID();
  world.fixture.seedDevice(world.studentId, reference, { status: 'ACTIVE', activePlayback: false });
  await withAuditFailure(reference, 'DEVICE_RELEASE', async () => {
    await expect(releaseStudentDevice(world.prisma, world.drm, world.adminUser.id, world.studentId, reference, Date.now())).resolves.toEqual({ released: true, auditPending: true });
    expect(await rows(reference, 'DEVICE_RELEASE_REQUESTED')).toHaveLength(1);
    expect(await rows(reference, 'DEVICE_RELEASE')).toHaveLength(0);
  });
  await expect(releaseStudentDevice(world.prisma, world.drm, world.adminUser.id, world.studentId, reference, Date.now())).resolves.toEqual({ released: false, auditPending: false });
  expect(await rows(reference, 'DEVICE_RELEASE')).toHaveLength(1);
});

it('preserves the active-playback refusal when its audit insert fails in PostgreSQL', async () => {
  const reference = randomUUID();
  world.fixture.seedDevice(world.studentId, reference, { status: 'ACTIVE', activePlayback: true });
  await withAuditFailure(reference, 'DEVICE_RELEASE_REFUSED', async () => {
    await expect(releaseStudentDevice(world.prisma, world.drm, world.adminUser.id, world.studentId, reference, Date.now())).rejects.toMatchObject({ code: 'DEVICE_RELEASE_ACTIVE' });
    expect(await rows(reference, 'DEVICE_RELEASE_REQUESTED')).toHaveLength(1);
  });
  expect((await world.drm.inspectUserDevices(world.studentId)).devices.some(d => d.reference === reference)).toBe(true);
});

it('does not let still-present pending devices hide later absent references', async () => {
  const base = Date.now() - 300_000;
  for (let i = 0; i < 11; i++) {
    const reference = randomUUID();
    world.fixture.seedDevice(world.studentId, reference, { status: 'ACTIVE', activePlayback: true });
    await world.prisma.auditEvent.create({ data: { actorUserId: world.adminUser.id, entityType: 'User', entityId: world.studentId, action: 'DEVICE_RELEASE_REQUESTED', metadata: { deviceReference: reference }, createdAt: new Date(base + i) } });
  }
  const reference = randomUUID();
  await world.prisma.auditEvent.create({ data: { actorUserId: world.adminUser.id, entityType: 'User', entityId: world.studentId, action: 'DEVICE_RELEASE_REQUESTED', metadata: { deviceReference: reference } } });
  const result = await reconcilePendingReleaseAudits(world.prisma, world.drm, world.adminUser.id, world.studentId, world.studentId);
  expect(await rows(reference, 'DEVICE_RELEASE')).toHaveLength(1);
  expect(result.complete).toBe(false);
  expect(result.pending).toBeGreaterThan(0);
});
