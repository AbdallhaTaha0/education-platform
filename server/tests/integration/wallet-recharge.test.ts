import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createWalletWorld,
  rechargeBody,
  studentGet,
  studentPost,
  uniqueKey,
  type WalletWorld,
} from './wallet-helpers.js';

let world: WalletWorld;

beforeAll(async () => {
  world = await createWalletWorld(true);
});

afterAll(async () => {
  await world.close();
});

describe('recharge submission', () => {
  it('creates a pending request with zero wallet credit', async () => {
    const res = await studentPost(
      world.app,
      '/wallet/recharge-requests',
      world.studentJar,
      rechargeBody(),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.proofFilename).toBe('receipt.jpg');
    expect(res.body.data.proofDeletionDate).toBeNull();

    const wallet = await world.prisma.wallet.findUniqueOrThrow({
      where: { userId: world.studentUser.id },
    });
    expect(wallet.balancePiastres).toBe(0);
    expect(await world.prisma.walletLedgerEntry.count({ where: { walletId: wallet.id } })).toBe(0);
  });

  it('rejects a duplicate normalized reference within the channel', async () => {
    const reference = `dup-ref-${Date.now().toString(36)}`;
    const first = await studentPost(
      world.app,
      '/wallet/recharge-requests',
      world.studentJar,
      rechargeBody({ reference }),
    );
    expect(first.status).toBe(201);
    const second = await studentPost(
      world.app,
      '/wallet/recharge-requests',
      world.studentJar,
      rechargeBody({ reference: ` ${reference.toLowerCase()} ` }),
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DUPLICATE_REFERENCE');
  });

  it('allows the same reference on a different channel', async () => {
    const reference = `shared-ref-${Date.now().toString(36)}`;
    const first = await studentPost(
      world.app,
      '/wallet/recharge-requests',
      world.studentJar,
      rechargeBody({ reference, channel: 'INSTAPAY' }),
    );
    expect(first.status).toBe(201);
    const second = await studentPost(
      world.app,
      '/wallet/recharge-requests',
      world.studentJar,
      rechargeBody({ reference, channel: 'BANK_TRANSFER' }),
    );
    expect(second.status).toBe(201);
  });

  it('replays the same idempotency key without a second request', async () => {
    const key = uniqueKey('replay');
    const reference = `replay-ref-${Date.now().toString(36)}`;
    const body = rechargeBody({ idempotencyKey: key, reference });
    const first = await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, body);
    expect(first.status).toBe(201);
    const second = await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, {
      ...body,
    });
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    const count = await world.prisma.rechargeRequest.count({
      where: { studentId: world.studentUser.id, idempotencyKey: key },
    });
    expect(count).toBe(1);
  });

  it('conflicts when the same key carries different parameters', async () => {
    const key = uniqueKey('conflict');
    const first = await studentPost(
      world.app,
      '/wallet/recharge-requests',
      world.studentJar,
      rechargeBody({ idempotencyKey: key, amountPiastres: 60000 }),
    );
    expect(first.status).toBe(201);
    const second = await studentPost(
      world.app,
      '/wallet/recharge-requests',
      world.studentJar,
      rechargeBody({ idempotencyKey: key, amountPiastres: 90000 }),
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('compares every business field and proof hash on an idempotent replay', async () => {
    const key = uniqueKey('full-conflict');
    const reference = `full-ref-${Date.now().toString(36)}`;
    const body = rechargeBody({ idempotencyKey: key, reference });
    expect(
      (await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, body)).status,
    ).toBe(201);
    const changedProof = Buffer.from([0xff, 0xd8, 0x01, 0xff, 0xd9]).toString('base64');
    const replay = await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, {
      ...body,
      senderName: 'Different Sender',
      proofBase64: changedProof,
    });
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('concurrent mismatched uses of one idempotency key do not converge', async () => {
    const key = uniqueKey('concurrent-conflict');
    const attempts = await Promise.all([
      studentPost(
        world.app,
        '/wallet/recharge-requests',
        world.studentJar,
        rechargeBody({ idempotencyKey: key, reference: uniqueKey('ref-a') }),
      ),
      studentPost(
        world.app,
        '/wallet/recharge-requests',
        world.studentJar,
        rechargeBody({ idempotencyKey: key, reference: uniqueKey('ref-b') }),
      ),
    ]);
    expect(attempts.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(attempts.find((r) => r.status === 409)?.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('accepts proof payloads above the ordinary 256 KiB route limit', async () => {
    const bytes = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.alloc(300_000, 0x41),
      Buffer.from([0xff, 0xd9]),
    ]);
    const res = await studentPost(
      world.app,
      '/wallet/recharge-requests',
      world.studentJar,
      rechargeBody({
        proofBase64: bytes.toString('base64'),
      }),
    );
    expect(res.status).toBe(201);
    const stored = await world.prisma.rechargeProof.findUniqueOrThrow({
      where: { requestId: res.body.data.id },
    });
    expect(stored.size).toBe(bytes.length);
  });

  it('retains the 256 KiB ceiling on non-proof JSON routes', async () => {
    const res = await studentPost(world.app, '/wallet/purchases', world.studentJar, {
      planId: '00000000-0000-4000-8000-000000000000',
      idempotencyKey: uniqueKey('ordinary-limit'),
      padding: 'x'.repeat(300_000),
    });
    expect(res.status).toBe(413);
  });

  it('rejects unknown mutation fields', async () => {
    const res = await studentPost(
      world.app,
      '/wallet/recharge-requests',
      world.studentJar,
      rechargeBody({ unexpected: true }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FIELD');
  });

  it('validates amount, channel, dates, and proof strictly', async () => {
    const cases: Array<[string, Record<string, unknown>, number]> = [
      ['float amount', { amountPiastres: 10.5 }, 400],
      ['tiny amount', { amountPiastres: 50 }, 400],
      ['unknown channel', { channel: 'CASH' }, 400],
      ['future transfer', { transferDate: new Date(Date.now() + 86_400_000).toISOString() }, 400],
      ['spoofed proof', { proofFilename: 'evil.pdf', proofMime: 'image/jpeg' }, 400],
      // The transport permits a 5 MiB proof after base64 expansion, then the
      // proof validator enforces the exact decoded-byte ceiling.
      ['oversize proof', { proofBase64: 'A'.repeat(7_100_001) }, 400],
    ];
    for (const [name, override, status] of cases) {
      const res = await studentPost(
        world.app,
        '/wallet/recharge-requests',
        world.studentJar,
        rechargeBody(override),
      );
      expect(res.status, name).toBe(status);
    }
  });

  it('fails closed when payments are unconfigured', async () => {
    const bare = await createWalletWorld(false);
    try {
      const instructions = await studentGet(bare.app, '/wallet/instructions', bare.studentJar);
      expect(instructions.status).toBe(503);
      const submit = await studentPost(
        bare.app,
        '/wallet/recharge-requests',
        bare.studentJar,
        rechargeBody(),
      );
      expect(submit.status).toBe(503);
      expect(submit.body.error.code).toBe('PAYMENT_UNCONFIGURED');
    } finally {
      await bare.close();
    }
  });

  it('serves configured instructions without secrets', async () => {
    const res = await studentGet(world.app, '/wallet/instructions', world.studentJar);
    expect(res.status).toBe(200);
    expect(res.body.data.channels).toHaveLength(2);
    const dumped = JSON.stringify(res.body);
    expect(dumped).not.toMatch(/secret|password|private/i);
  });

  it('lists only the owning student requests without proof bytes', async () => {
    await studentPost(world.app, '/wallet/recharge-requests', world.studentJar, rechargeBody());
    const list = await studentGet(world.app, '/wallet/recharge-requests', world.studentJar);
    expect(list.status).toBe(200);
    expect(list.body.data.requests.length).toBeGreaterThanOrEqual(1);
    for (const row of list.body.data.requests as Array<Record<string, unknown>>) {
      expect(row['proofBase64']).toBeUndefined();
    }
  });
});
