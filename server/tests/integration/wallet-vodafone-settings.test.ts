import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createWalletWorld, rechargeBody, studentGet, studentPost, type WalletWorld } from './wallet-helpers.js';
import { TEST_ORIGIN, createWorld } from './identity-helpers.js';

let w: WalletWorld;
const path = '/admin/payment-settings/vodafone-cash';
const details = { enabled: true, accountLabel: '+201001234567', instructionsAr: 'مستلم تجريبي فقط', instructionsEn: 'Synthetic recipient only', version: 0 };
const save = (jar: { header(): string; csrf(): string }, body: object) => request(w.app).put(path).set('Origin', TEST_ORIGIN).set('Cookie', jar.header()).set('X-Csrf-Token', jar.csrf()).send(body);
beforeAll(async () => { w = await createWalletWorld(false); await w.prisma.vodafoneCashSettings.deleteMany(); });
afterAll(async () => { await w?.prisma.vodafoneCashSettings.deleteMany(); await w?.close(); });
describe('ADMIN editable Vodafone Cash', () => {
  it('starts unconfigured and guards reads/writes with admin, origin and CSRF', async () => {
    expect((await studentGet(w.app, '/wallet/instructions', w.studentJar)).status).toBe(503);
    expect((await request(w.app).get(path)).status).toBe(401);
    expect((await studentGet(w.app, path, w.studentJar)).status).toBe(403);
    expect((await save(w.studentJar, details)).status).toBe(403);
    expect((await request(w.app).put(path).set('Origin', TEST_ORIGIN).set('Cookie', w.adminJar.header()).send(details)).status).toBe(403);
    expect((await request(w.app).put(path).set('Origin', 'https://bad.test').set('Cookie', w.adminJar.header()).set('X-Csrf-Token', w.adminJar.csrf()).send(details)).status).toBe(403);
  });
  it('validates both translations, bounds and unknown fields', async () => {
    for (const input of [{ ...details, instructionsAr: '' }, { ...details, instructionsEn: '' }, { ...details, accountLabel: 'x'.repeat(201) }, { ...details, enabled: 'true' }, { ...details, version: -1 }, { ...details, role: 'ADMIN' }]) expect((await save(w.adminJar, input)).status).toBe(400);
    expect(await w.prisma.vodafoneCashSettings.count()).toBe(0);
  });
  it('persists across replicas and fences concurrent creation/updates', async () => {
    const first = await Promise.all([save(w.adminJar, details), save(w.adminJar, { ...details, accountLabel: '+201001234568' })]);
    expect(first.map(r => r.status).sort()).toEqual([200, 409]);
    const edits = await Promise.all([save(w.adminJar, { ...details, version: 1 }), save(w.adminJar, { ...details, version: 1, accountLabel: '+201001234569' })]);
    expect(edits.map(r => r.status).sort()).toEqual([200, 409]);
    const other = await createWorld();
    try { expect((await studentGet(other.app, '/wallet/instructions', w.studentJar)).body.data.channels[0].accountLabel).toBe(edits.find(r => r.status === 200)!.body.data.accountLabel); } finally { await other.close(); }
  });
  it('allows manual submission with zero credit, and disabling blocks new submissions', async () => {
    expect((await studentPost(w.app, '/wallet/recharge-requests', w.studentJar, rechargeBody({ channel: 'MOBILE_WALLET' }))).status).toBe(201);
    expect((await studentGet(w.app, '/wallet', w.studentJar)).body.data.balancePiastres).toBe(0);
    expect((await save(w.adminJar, { ...details, enabled: false, version: 2 })).status).toBe(200);
    expect((await studentGet(w.app, '/wallet/instructions', w.studentJar)).status).toBe(503);
    expect((await studentPost(w.app, '/wallet/recharge-requests', w.studentJar, rechargeBody({ channel: 'MOBILE_WALLET' }))).status).toBe(503);
    expect((await studentGet(w.app, '/wallet/recharge-requests', w.studentJar)).body.data.requests).toHaveLength(1);
  });
});
