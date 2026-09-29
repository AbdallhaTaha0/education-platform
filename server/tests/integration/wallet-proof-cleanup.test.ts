import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminGet, adminPost } from './catalog-helpers.js';
import { createWalletWorld, rechargeBody, studentGet, studentPost, type WalletWorld } from './wallet-helpers.js';
import { PROOF_RETENTION_DAYS } from '../../src/modules/wallet/errors.js';
import { startProofCleanupScheduler } from '../../src/modules/wallet/cleanup/scheduler.js';

let world: WalletWorld;

beforeAll(async () => {
  world = await createWalletWorld(true);
});

afterAll(async () => {
  await world.close();
});

describe('proof retention cleanup', () => {
  it('clears expired proof bytes while retaining metadata and audit trail', async () => {
    const sub = await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, rechargeBody({ amountPiastres: 20000 }));
    expect(sub.status).toBe(201);
    const id = sub.body.data.id as string;
    expect((await adminPost(world.app, `/admin/recharge-requests/${id}/review`, world.adminJar, { decision: 'APPROVE', receiptVerified: true })).status).toBe(200);

    // Age the review beyond the retention deadline.
    const past = new Date(Date.now() - (PROOF_RETENTION_DAYS + 1) * 86_400_000);
    await world.prisma.rechargeRequest.update({ where: { id }, data: { reviewedAt: past } });

    const run = await adminPost(world.app, '/admin/maintenance/proof-cleanup', world.adminJar, {});
    expect(run.status).toBe(200);
    expect(run.body.data.cleared).toBeGreaterThanOrEqual(1);

    const proof = await world.prisma.rechargeProof.findUniqueOrThrow({ where: { requestId: id } });
    expect(proof.bytes).toBeNull();
    expect(proof.cleanedAt).not.toBeNull();
    // Metadata survives: filename, hash, size, and the request row.
    expect(proof.hash).toMatch(/^[0-9a-f]{64}$/);
    const request = await world.prisma.rechargeRequest.findUniqueOrThrow({ where: { id } });
    expect(request.status).toBe('APPROVED');
    expect(request.proofFilename).toBe('receipt.jpg');
    // Download now reports the bytes as gone.
    expect((await adminGet(world.app, `/admin/recharge-requests/${id}/proof`, world.adminJar)).status).toBe(404);
    // Student view still shows filename + deletion date, never bytes.
    const view = await studentGet(world.app, `/wallet/recharge-requests/${id}`, world.studentJar);
    expect(view.body.data.proofFilename).toBe('receipt.jpg');
    expect(view.body.data.proofBase64).toBeUndefined();
    // Sanitized cleanup audit exists.
    const audits = await world.prisma.auditEvent.findMany({ where: { entityId: id, action: 'RECHARGE_PROOF_CLEANED' } });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(audits)).not.toContain('base64');
  });

  it('leaves fresh proofs untouched and reruns idempotently', async () => {
    const sub = await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, rechargeBody({ amountPiastres: 20000 }));
    const id = sub.body.data.id as string;
    await adminPost(world.app, `/admin/recharge-requests/${id}/review`, world.adminJar, { decision: 'APPROVE', receiptVerified: true });

    const first = await adminPost(world.app, '/admin/maintenance/proof-cleanup', world.adminJar, {});
    expect(first.status).toBe(200);
    expect((await world.prisma.rechargeProof.findUniqueOrThrow({ where: { requestId: id } })).bytes).not.toBeNull();
    expect((await adminGet(world.app, `/admin/recharge-requests/${id}/proof`, world.adminJar)).status).toBe(200);

    const second = await adminPost(world.app, '/admin/maintenance/proof-cleanup', world.adminJar, {});
    expect(second.status).toBe(200);
    expect(second.body.data.cleared).toBe(0);
  });

  it('automatically clears expired proof bytes without an admin request', async () => {
    const sub = await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, rechargeBody({ amountPiastres: 20000 }));
    const id = sub.body.data.id as string;
    await adminPost(world.app, `/admin/recharge-requests/${id}/review`, world.adminJar, { decision: 'APPROVE', receiptVerified: true });
    await world.prisma.rechargeRequest.update({
      where: { id },
      data: { reviewedAt: new Date(Date.now() - (PROOF_RETENTION_DAYS + 1) * 86_400_000) },
    });
    const scheduler = startProofCleanupScheduler(world.prisma, 20, 10);
    try {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const proof = await world.prisma.rechargeProof.findUniqueOrThrow({ where: { requestId: id } });
        if (proof.bytes === null) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect((await world.prisma.rechargeProof.findUniqueOrThrow({ where: { requestId: id } })).bytes).toBeNull();
      expect(await world.prisma.auditEvent.count({ where: { entityId: id, action: 'RECHARGE_PROOF_CLEANED' } })).toBe(1);
    } finally {
      scheduler.stop();
    }
  });
});
