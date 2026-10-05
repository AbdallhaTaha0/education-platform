import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createWalletWorld, studentGet, type WalletWorld } from './wallet-helpers.js';
import { TEST_ORIGIN } from './identity-helpers.js';
let w: WalletWorld;
const path = '/admin/payment-settings/instapay/qr';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ioAAAAASUVORK5CYII=';
const body = (version: number) => ({ version, filename: 'qr.png', mime: 'image/png', base64: png });
function write(method: 'post' | 'delete', input: object, jar = w.adminJar) { return request(w.app)[method](path).set('Origin', TEST_ORIGIN).set('Cookie', jar.header()).set('X-Csrf-Token', jar.csrf()).send(input); }
beforeAll(async () => { w = await createWalletWorld(false); await w.prisma.instaPaySettings.deleteMany(); await w.prisma.instaPaySettings.create({ data: { id: 1, enabled: true, accountLabel: 'synthetic@instapay', instructionsAr: 'تجريبي', instructionsEn: 'Synthetic only' } }); });
afterAll(async () => { await w?.prisma.instaPaySettings.deleteMany(); await w?.close(); });
describe('InstaPay QR image', () => {
  it('guards uploads/removal/reads and origin/CSRF', async () => {
    expect((await request(w.app).post(path).set('Origin', TEST_ORIGIN).send(body(1))).status).toBe(401);
    expect((await write('post', body(1), w.studentJar)).status).toBe(403);
    expect((await write('delete', { version: 1 }, w.studentJar)).status).toBe(403);
    expect((await request(w.app).post(path).set('Origin', TEST_ORIGIN).set('Cookie', w.adminJar.header()).send(body(1))).status).toBe(403);
    expect((await request(w.app).post(path).set('Origin', 'https://bad.test').set('Cookie', w.adminJar.header()).set('X-Csrf-Token', w.adminJar.csrf()).send(body(1))).status).toBe(403);
    expect((await studentGet(w.app, path, w.studentJar)).status).toBe(403);
  });
  it('rejects spoofed, malformed, empty, oversized images and unsupported types', async () => {
    const hugeDimensions = Buffer.from(png, 'base64'); hugeDimensions.writeUInt32BE(10000, 16);
    for (const input of [{ ...body(1), mime: 'image/svg+xml' }, { ...body(1), filename: 'qr.jpg' }, { ...body(1), base64: '' }, { ...body(1), base64: 'not base64!' }, { ...body(1), base64: Buffer.alloc(131073).toString('base64') }, { ...body(1), base64: Buffer.from('<html/>').toString('base64') }, { ...body(1), base64: hugeDimensions.toString('base64') }, { ...body(1), version: 0 }]) expect((await write('post', input)).status).toBe(400);
    expect((await w.prisma.instaPaySettings.findUniqueOrThrow({ where: { id: 1 } })).qrBytes).toBeNull();
  });
  it('fences concurrent upload, serves exact bytes privately and exposes only the URL in instructions', async () => {
    expect((await Promise.all([write('post', body(1)), write('post', body(1))])).map(r => r.status).sort()).toEqual([200,409]);
    const get = await studentGet(w.app, '/wallet/payment-settings/instapay/qr', w.studentJar);
    expect(get.status).toBe(200); expect(get.headers['content-type']).toContain('image/png'); expect(get.headers['x-content-type-options']).toBe('nosniff'); expect(get.headers['cache-control']).toBe('no-store'); expect(Buffer.from(get.body)).toEqual(Buffer.from(png, 'base64'));
    expect((await request(w.app).get('/wallet/payment-settings/instapay/qr')).status).toBe(401);
    const instructions = await studentGet(w.app, '/wallet/instructions', w.studentJar);
    expect(instructions.body.data.channels[0].qrUrl).toBe('/api/wallet/payment-settings/instapay/qr?v=2');
    expect(JSON.stringify(instructions.body)).not.toContain(png);
  });
  it('replaces the image, fences stale details edits and hides disabled receiving QR from students', async () => {
    expect((await write('post', body(2))).status).toBe(200);
    expect((await write('delete', { version: 2 })).status).toBe(409);
    await w.prisma.instaPaySettings.update({ where: { id: 1 }, data: { enabled: false } });
    expect((await studentGet(w.app, '/wallet/payment-settings/instapay/qr', w.studentJar)).status).toBe(404);
    expect((await studentGet(w.app, path, w.adminJar)).status).toBe(200);
  });
  it('removes only the image and keeps receiving details', async () => {
    expect((await write('delete', { version: 3 })).status).toBe(200);
    const row = await w.prisma.instaPaySettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row.qrBytes).toBeNull(); expect(row.qrMime).toBeNull(); expect(row.accountLabel).toBe('synthetic@instapay'); expect(row.instructionsEn).toBe('Synthetic only');
    expect((await studentGet(w.app, path, w.adminJar)).status).toBe(404);
  });
});
