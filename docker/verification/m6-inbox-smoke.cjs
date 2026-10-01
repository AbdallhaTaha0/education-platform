/** Run inside the guarded platform server container; synthetic owned fixtures only. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const serverRequire = createRequire('/srv/server/package.json');
const { PrismaClient } = serverRequire('@prisma/client');
const { materializeNotification, NOTIFICATION_RETENTION_MS } = serverRequire('./dist/modules/notifications/store.js');
const prisma = new PrismaClient();
const users = []; const events = [];
const base = 'http://nginx:8080'; const origin = 'http://localhost:8082';
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
async function call(path, jar = new Map(), method = 'GET', body) {
  const headers = { Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') };
  if (method !== 'GET') {
    headers.Origin = origin; headers['Content-Type'] = 'application/json';
    headers['X-Csrf-Token'] = decodeURIComponent(jar.get('edu_csrf') ?? '');
  }
  const res = await fetch(base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  for (const cookie of res.headers.getSetCookie()) {
    const pair = cookie.split(';')[0]; const at = pair.indexOf('=');
    jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
  return { status: res.status, headers: res.headers, body: await res.json() };
}
async function student() {
  const jar = new Map(); await call('/api/auth/csrf', jar);
  const res = await call('/api/auth/register', jar, 'POST', {
    displayName: 'M6 owned smoke student', email: `m6-smoke-${randomUUID()}@example.test`,
    phone: `011${Math.floor(10000000 + Math.random() * 90000000)}`, password: randomUUID() + '!a9A',
  });
  check(res.status === 201, 'registration through Nginx');
  const id = res.body.data.user.id; users.push(id);
  return { jar, id };
}
(async () => {
  try {
    check((await call('/api/health/ready')).status === 200, 'backend readiness through Nginx');
    const home = await fetch(base + '/'); const html = await home.text();
    check(home.status === 200 && html.includes('<div id="root">'), 'frontend document');
    const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/);
    check(asset && (await fetch(base + asset[1])).status === 200, 'frontend static asset');
    for (const path of ['/.well-known/jwks.json', '/api/.well-known/jwks.json']) {
      const jwks = await call(path);
      check(jwks.status === 200 && jwks.body.keys.some((key) => key.kty === 'RSA' && key.n && key.e && !key.d), 'public RSA JWKS');
    }
    check((await call('/api/notifications')).status === 401, 'anonymous inbox denied');
    const a = await student(); const b = await student();
    check((await call('/api/notifications', a.jar)).body.data.items.length === 0, 'new student empty inbox');
    const now = new Date(); const id = randomUUID(); events.push(id);
    await prisma.notificationEvent.create({ data: {
      id, eventKey: `m6-smoke:${id}`, type: 'RECHARGE_REJECTED', recordedAt: now, occurredAt: now,
      expiresAt: new Date(now.getTime() + NOTIFICATION_RETENTION_MS), audience: { create: { recipientId: a.id } },
    } });
    const notice = await materializeNotification(prisma, id, a.id);
    const inbox = await call('/api/notifications', a.jar);
    check(inbox.status === 200 && inbox.body.data.items[0].id === notice.id
      && inbox.body.data.unreadCount === 1 && inbox.headers.get('cache-control') === 'no-store', 'own durable inbox');
    check((await call('/api/notifications', b.jar)).body.data.items.length === 0, 'other student isolation');
    const marked = await call(`/api/notifications/${notice.id}/read-state`, a.jar, 'PUT', { read: true });
    check(marked.status === 200 && marked.body.data.unreadCount === 0, 'CSRF guarded read mutation');
    check((await call(`/api/notifications/${notice.id}/read-state`, b.jar, 'PUT', { read: true })).status === 404, 'foreign read denied');
    const count = await call('/api/notifications/unread-count', a.jar);
    check(count.status === 200 && count.body.data.revision === '2', 'current count and revision');
    const all = await call('/api/notifications/read-all', a.jar, 'POST', { throughSequence: '1' });
    check(all.status === 200 && all.body.data.changedCount === 0, 'idempotent read-all');
    console.log(`M6 NGINX SMOKE PASS: ${checks} checks; event is a synthetic fixture, not a recharge producer.`);
  } catch (err) {
    console.error(`M6 NGINX SMOKE FAIL: ${err instanceof assert.AssertionError ? err.message : 'API or database operation failed'}`);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.notificationEvent.deleteMany({ where: { id: { in: events } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      console.log('M6 smoke-owned users and events removed.');
    } catch { console.error('M6 smoke cleanup failed.'); process.exitCode = 1; }
    await prisma.$disconnect();
  }
})();
