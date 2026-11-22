import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { loadConfig, type ServerConfig } from '../../src/config.js';
import { InMemoryCache } from '../../src/infra/cache.js';
import { LocalAsyncMutex, MutexDurableObject, setLockProvider } from '../../src/infra/locks-do.js';
import type { StorageClient } from '../../src/infra/storage.js';
import { bootstrapReleaseAdmins } from '../../src/modules/identity/bootstrap.js';
import { hashPassword, verifyPassword } from '../../src/modules/identity/password.js';
import { rotateRefreshCredential, createSessionFamily, newSessionTiming } from '../../src/modules/identity/store.js';
import { submitRecharge } from '../../src/modules/wallet/recharge/service.js';
import { getProofBytes } from '../../src/modules/wallet/recharge/queries.js';
import { cleanupExpiredProofs } from '../../src/modules/wallet/cleanup/service.js';
import { UserRealtimeDurableObject } from '../../src/modules/notifications/realtime-do.js';

const ORIGIN = 'http://localhost:8080';

function parseSetCookies(header: string | string[] | undefined): Record<string, string> {
  const list = Array.isArray(header) ? header : header ? [header] : [];
  const out: Record<string, string> = {};
  for (const item of list) {
    const pair = item.split(';')[0] ?? '';
    const idx = pair.indexOf('=');
    if (idx > 0) {
      out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return out;
}

describe('Cloudflare D1 + Multi-Teacher/Subject + Concurrency Integration', () => {
  let tempDir: string;
  let dbPath: string;
  let prisma: PrismaClient;
  let cache: InMemoryCache;
  let config: ServerConfig;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    setLockProvider(new LocalAsyncMutex());
    tempDir = mkdtempSync(join(tmpdir(), 'fayq-d1-test-'));
    dbPath = join(tempDir, 'test.sqlite');
    const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;
    process.env['DATABASE_URL'] = dbUrl;

    // Apply canonical D1 SQLite migration directly via Prisma db execute
    const migrationSql = resolve(process.cwd(), 'migrations', '0001_init.sql');
    expect(readFileSync(migrationSql, 'utf8').length).toBeGreaterThan(1000);
    const prismaCli = resolve(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
    execFileSync(
      process.execPath,
      [prismaCli, 'db', 'execute', '--file', migrationSql, '--url', dbUrl],
      { cwd: process.cwd(), stdio: 'pipe' },
    );

    config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: dbUrl,
      REDIS_URL: 'cloudflare://kv',
      AUTH_JWT_SECRET: 'test-secret-at-least-thirty-two-characters-long',
      AUTH_ISSUER: 'fayq-test',
      AUTH_AUDIENCE: 'fayq-test',
      ALLOWED_ORIGINS: ORIGIN,
      COOKIE_SECURE: 'false',
      ARGON2_MEMORY_KB: '1024',
      ARGON2_TIME_COST: '1',
      ARGON2_PARALLELISM: '1',
      PAYMENT_CHANNELS: JSON.stringify([
        {
          channel: 'INSTAPAY',
          accountLabel: 'fayq@instapay',
          instructionsAr: 'تحويل إنستاباي',
          instructionsEn: 'InstaPay transfer',
        },
      ]),
    });

    cache = new InMemoryCache();
    prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await prisma.$connect();
    app = createApp({ config, redisClient: cache, prisma });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    cache?.disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  async function loginAs(identifier: string, password: string) {
    const csrfRes = await request(app).get('/auth/csrf').set('Origin', ORIGIN);
    const csrfCookie = parseSetCookies(csrfRes.headers['set-cookie'])['edu_csrf']!;
    const loginRes = await request(app)
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrfCookie)
      .set('Cookie', `edu_csrf=${encodeURIComponent(csrfCookie)}`)
      .send({ identifier, password });
    expect(loginRes.status).toBe(200);
    const cookies = parseSetCookies(loginRes.headers['set-cookie']);
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ');
    return { cookies, cookieHeader, csrf: cookies['edu_csrf']!, user: loginRes.body.data.user };
  }

  it('WP-CF3: hashes and verifies passwords with WebCrypto PBKDF2-SHA256 in constant time', async () => {
    const hash = await hashPassword('CorrectHorseBattery99!', config.argon2);
    expect(hash.startsWith('$pbkdf2-sha256$i=')).toBe(true);
    expect(await verifyPassword(hash, 'CorrectHorseBattery99!')).toBe(true);
    expect(await verifyPassword(hash, 'WrongPassword99!')).toBe(false);
    expect(await verifyPassword('$argon2id$invalid', 'CorrectHorseBattery99!')).toBe(false);
  });

  it('WP-CF7: bootstraps the 3 release admins once and refuses concurrent duplicates', async () => {
    const inputs = [
      { email: 'ali@fayq.test', phone: '+201000000001', password: 'AdminPassword1!' },
      { email: 'seif@fayq.test', phone: '+201000000002', password: 'AdminPassword2!' },
      { email: 'abdallah@fayq.test', phone: '+201000000003', password: 'AdminPassword3!' },
    ];
    const results = await Promise.allSettled([
      bootstrapReleaseAdmins(inputs, { prisma, argon2: config.argon2 }),
      bootstrapReleaseAdmins(inputs, { prisma, argon2: config.argon2 }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(3);
  });

  it('WP-CF1: manages subjects & teachers, guards deletion, propagates working copies, validates 3-course packages, and snapshots purchases', async () => {
    const admin = await loginAs('ali@fayq.test', 'AdminPassword1!');

    // Create 2 subjects and 2 teachers
    const s1Res = await request(app)
      .post('/admin/subjects')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({ slug: 'programming', nameAr: 'البرمجة', nameEn: 'Programming' });
    expect(s1Res.status).toBe(201);
    const subProg = s1Res.body.data.subject;

    const s2Res = await request(app)
      .post('/admin/subjects')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({ slug: 'mathematics', nameAr: 'الرياضيات', nameEn: 'Mathematics' });
    expect(s2Res.status).toBe(201);
    const subMath = s2Res.body.data.subject;

    const t1Res = await request(app)
      .post('/admin/teachers')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({ slug: 'mr-ali', nameAr: 'أ. علي', nameEn: 'Mr. Ali', bioAr: 'مهندس برمجيات', bioEn: 'Software engineer' });
    expect(t1Res.status).toBe(201);
    const teacherAli = t1Res.body.data.teacher;

    const t2Res = await request(app)
      .post('/admin/teachers')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({ slug: 'mr-taha', nameAr: 'أ. طه', nameEn: 'Mr. Taha' });
    expect(t2Res.status).toBe(201);
    const teacherTaha = t2Res.body.data.teacher;

    // Public endpoints list active subjects and teachers
    const pubSub = await request(app).get('/catalog/subjects');
    expect(pubSub.status).toBe(200);
    expect(pubSub.body.data.subjects).toHaveLength(2);
    const pubTea = await request(app).get('/catalog/teachers');
    expect(pubTea.status).toBe(200);
    expect(pubTea.body.data.teachers).toHaveLength(2);

    // Create 3 monthly courses in same grade/subject/teacher + 1 different subject + 1 different teacher
    const makeCourse = async (slug: string, month: string, subjectId: string, teacherId: string) => {
      const c = await prisma.course.create({
        data: {
          slug,
          titleAr: `كورس ${slug}`,
          titleEn: `Course ${slug}`,
          descriptionAr: 'وصف الكورس',
          descriptionEn: 'Course description',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          grade: 'FIRST_SECONDARY',
          academicYear: '2026/2027',
          term: 1,
          courseKind: 'MONTHLY_EXPLANATION',
          teachingMonth: month,
          subjectId,
          teacherId,
          plans: {
            create: { currentPricePiastres: 10000, durationDays: 30, accessMode: 'DURATION' },
          },
          sections: {
            create: {
              titleAr: 'قسم 1',
              titleEn: 'Section 1',
              position: 1,
              lessons: {
                create: {
                  titleAr: 'درس 1',
                  titleEn: 'Lesson 1',
                  position: 1,
                  media: {
                    create: {
                      externalAssetId: `ext-${randomUUID()}`,
                      assetId: `asset-${randomUUID()}`,
                      idempotencyKey: randomUUID(),
                      status: 'READY',
                    },
                  },
                },
              },
            },
          },
        },
        include: { plans: true },
      });
      return c;
    };

    const c1 = await makeCourse('prog-sep', '2026-09', subProg.id, teacherAli.id);
    const c2 = await makeCourse('prog-oct', '2026-10', subProg.id, teacherAli.id);
    const c3 = await makeCourse('prog-nov', '2026-11', subProg.id, teacherAli.id);
    const cMath = await makeCourse('math-sep', '2026-09', subMath.id, teacherAli.id);
    const cTaha = await makeCourse('prog-taha', '2026-09', subProg.id, teacherTaha.id);

    // Guarded delete: subject and teacher in use -> 409
    const delSub = await request(app)
      .delete(`/admin/subjects/${subProg.id}`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader);
    expect(delSub.status).toBe(409);
    expect(delSub.body.error.code).toBe('SUBJECT_IN_USE');

    const delTea = await request(app)
      .delete(`/admin/teachers/${teacherAli.id}`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader);
    expect(delTea.status).toBe(409);
    expect(delTea.body.error.code).toBe('TEACHER_IN_USE');

    // Catalog filters by subjectSlug & teacherSlug
    const filtered = await request(app).get('/catalog/courses?subjectSlug=mathematics&teacherSlug=mr-ali');
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.courses).toHaveLength(1);
    expect(filtered.body.data.courses[0].slug).toBe('math-sep');
    expect(filtered.body.data.courses[0].subject.nameEn).toBe('Mathematics');
    expect(filtered.body.data.courses[0].teacher.nameEn).toBe('Mr. Ali');

    // 3-course package validation: subject mismatch -> 409 PACKAGE_SUBJECT_MISMATCH
    const endsAt = '2027-01-31T23:59:59+02:00';
    const badSubPkg = await request(app)
      .post('/admin/catalog/packages')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({
        titleAr: 'باقة مختلطة',
        titleEn: 'Mixed subject package',
        descriptionAr: 'وصف',
        descriptionEn: 'Desc',
        pricePiastres: 25000,
        endsAt,
        status: 'PUBLISHED',
        courseIds: [c1.id, c2.id, cMath.id],
      });
    expect(badSubPkg.status).toBe(409);
    expect(badSubPkg.body.error.code).toBe('PACKAGE_SUBJECT_MISMATCH');

    // Teacher mismatch -> 409 PACKAGE_TEACHER_MISMATCH
    const badTeaPkg = await request(app)
      .post('/admin/catalog/packages')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({
        titleAr: 'باقة مدرسين',
        titleEn: 'Mixed teacher package',
        descriptionAr: 'وصف',
        descriptionEn: 'Desc',
        pricePiastres: 25000,
        endsAt,
        status: 'PUBLISHED',
        courseIds: [c1.id, c2.id, cTaha.id],
      });
    expect(badTeaPkg.status).toBe(409);
    expect(badTeaPkg.body.error.code).toBe('PACKAGE_TEACHER_MISMATCH');

    // Valid homogeneous package succeeds
    const goodPkg = await request(app)
      .post('/admin/catalog/packages')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({
        titleAr: 'باقة البرمجة',
        titleEn: 'Programming package',
        descriptionAr: 'وصف',
        descriptionEn: 'Desc',
        pricePiastres: 25000,
        endsAt,
        status: 'PUBLISHED',
        courseIds: [c1.id, c2.id, c3.id],
      });
    expect(goodPkg.status).toBe(201);

    // Working copy creation & publication preserves and swaps subjectId & teacherId
    const draftRes = await request(app)
      .post(`/admin/catalog/courses/${cMath.id}/transitions`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({ to: 'DRAFT' });
    expect(draftRes.status).toBe(200);
    const draftId = draftRes.body.data.course.id;
    expect(draftRes.body.data.course.subjectId).toBe(subMath.id);
    expect(draftRes.body.data.course.teacherId).toBe(teacherAli.id);

    const patchDraft = await request(app)
      .patch(`/admin/catalog/courses/${draftId}`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({ teacherId: teacherTaha.id });
    expect(patchDraft.status).toBe(200);

    for (const to of ['PROCESSING', 'READY', 'PUBLISHED']) {
      const tr = await request(app)
        .post(`/admin/catalog/courses/${draftId}/transitions`)
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', admin.csrf)
        .set('Cookie', admin.cookieHeader)
        .send({ to });
      expect(tr.status).toBe(200);
    }
    const swappedLive = await prisma.course.findUniqueOrThrow({ where: { id: cMath.id } });
    expect(swappedLive.teacherId).toBe(teacherTaha.id);

    // Student registers, gets credited, purchases c1, then admin renames subject & teacher -> snapshot immutable
    const studentHash = await hashPassword('StudentPass123!', config.argon2);
    const student = await prisma.user.create({
      data: {
        email: 'student1@fayq.test',
        phone: '+201000000010',
        displayName: 'Student One',
        passwordHash: studentHash,
        role: 'STUDENT',
        wallet: { create: { balancePiastres: 10000 } },
      },
      include: { wallet: true },
    });
    await prisma.walletLedgerEntry.create({
      data: {
        walletId: student.wallet!.id,
        amountPiastres: 10000,
        entryType: 'CREDIT_RECHARGE',
        refType: 'TEST_SEED',
        refId: randomUUID(),
      },
    });
    const stAuth = await loginAs('student1@fayq.test', 'StudentPass123!');

    const buyRes = await request(app)
      .post('/wallet/purchases')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', stAuth.csrf)
      .set('Cookie', stAuth.cookieHeader)
      .send({ planId: c1.plans[0]!.id, idempotencyKey: randomUUID() });
    expect(buyRes.status).toBe(201);
    expect(buyRes.body.data.subjectNameEn).toBe('Programming');
    expect(buyRes.body.data.teacherNameEn).toBe('Mr. Ali');

    // Rename subject and teacher
    await request(app)
      .patch(`/admin/subjects/${subProg.id}`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({ nameEn: 'Computer Science' });
    await request(app)
      .patch(`/admin/teachers/${teacherAli.id}`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .set('Cookie', admin.cookieHeader)
      .send({ nameEn: 'Prof. Ali' });

    const history = await request(app)
      .get('/wallet/purchases')
      .set('Cookie', stAuth.cookieHeader);
    expect(history.status).toBe(200);
    expect(history.body.data.purchases[0].subjectNameEn).toBe('Programming');
    expect(history.body.data.purchases[0].teacherNameEn).toBe('Mr. Ali');
  });

  it('WP-CF4: 4-way concurrent spending race yields exactly 1 x 201, 3 x 402, 1 debit, and reconciled 0 balance', async () => {
    const studentHash = await hashPassword('RacePass123!', config.argon2);
    const student = await prisma.user.create({
      data: {
        email: 'racer@fayq.test',
        phone: '+201000000099',
        displayName: 'Racer',
        passwordHash: studentHash,
        role: 'STUDENT',
        wallet: { create: { balancePiastres: 10000 } },
      },
      include: { wallet: true },
    });
    await prisma.walletLedgerEntry.create({
      data: {
        walletId: student.wallet!.id,
        amountPiastres: 10000,
        entryType: 'CREDIT_RECHARGE',
        refType: 'TEST_SEED',
        refId: randomUUID(),
      },
    });
    const stAuth = await loginAs('racer@fayq.test', 'RacePass123!');

    const plans = await Promise.all(
      [1, 2, 3, 4].map(async (i) => {
        const c = await prisma.course.create({
          data: {
            slug: `race-course-${i}-${randomUUID().slice(0, 6)}`,
            titleAr: `سباق ${i}`,
            titleEn: `Race ${i}`,
            descriptionAr: 'وصف',
            descriptionEn: 'Desc',
            status: 'PUBLISHED',
            publishedAt: new Date(),
            plans: { create: { currentPricePiastres: 10000, durationDays: 30, accessMode: 'DURATION' } },
          },
          include: { plans: true },
        });
        return c.plans[0]!.id;
      }),
    );

    const responses = await Promise.all(
      plans.map((planId) =>
        request(app)
          .post('/wallet/purchases')
          .set('Origin', ORIGIN)
          .set('X-CSRF-Token', stAuth.csrf)
          .set('Cookie', stAuth.cookieHeader)
          .send({ planId, idempotencyKey: randomUUID() }),
      ),
    );

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 402, 402, 402]);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: student.id } });
    expect(wallet.balancePiastres).toBe(0);
    const entries = await prisma.walletLedgerEntry.findMany({ where: { walletId: wallet.id } });
    expect(entries.reduce((sum, e) => sum + e.amountPiastres, 0)).toBe(0);
    expect(entries.filter((e) => e.entryType === 'DEBIT_PURCHASE')).toHaveLength(1);
  });

  it('WP-CF4: concurrent refresh token rotation detects reuse and revokes the session family', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'racer@fayq.test' } });
    const timing = newSessionTiming(Date.now());
    await createSessionFamily(prisma, {
      sessionId: timing.sessionId,
      userId: user.id,
      csrfHash: null,
      absoluteExpiresAt: timing.absoluteExpiresAt,
      refreshSecret: timing.refreshSecret,
    });

    const [a, b] = await Promise.all([
      rotateRefreshCredential(prisma, { refreshSecret: timing.refreshSecret, csrfHash: 'h1' }),
      rotateRefreshCredential(prisma, { refreshSecret: timing.refreshSecret, csrfHash: 'h2' }),
    ]);
    const outcomes = [a.status, b.status].sort();
    expect(outcomes).toEqual(['reused', 'rotated']);

    const session = await prisma.authSession.findUniqueOrThrow({ where: { id: timing.sessionId } });
    expect(session.revokedAt).not.toBeNull();
    expect(session.revokeReason).toBe('reuse');
  });

  it('WP-CF3: offloads recharge proof bytes to R2 storageKey and cleans up after 180 days', async () => {
    const bucket = new Map<string, { body: Uint8Array; contentType: string }>();
    const fakeStorage = {
      async putObject(key: string, body: Uint8Array, contentType: string) {
        bucket.set(key, { body: new Uint8Array(body), contentType });
      },
      async getObject(key: string) {
        const obj = bucket.get(key);
        if (!obj) throw new Error('missing');
        return { body: obj.body, contentType: obj.contentType, contentLength: obj.body.length };
      },
      async deleteObject(key: string) {
        bucket.delete(key);
      },
    } as unknown as StorageClient;

    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'racer@fayq.test' } });
    const pngMagic = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const submitted = await submitRecharge(
      prisma,
      config.paymentChannels,
      student.id,
      {
        amountPiastres: 5000,
        channel: 'INSTAPAY',
        reference: 'REF-R2-001',
        senderName: 'Racer',
        senderPhone: '+201000000099',
        transferDate: '2026-10-01',
        proofFilename: 'receipt.png',
        proofMime: 'image/png',
        proofBase64: pngMagic.toString('base64'),
        idempotencyKey: randomUUID(),
      },
      fakeStorage,
    );

    const proofRow = await prisma.rechargeProof.findUniqueOrThrow({
      where: { requestId: String(submitted.id) },
    });
    expect(proofRow.bytes).toBeNull();
    expect(proofRow.storageKey).toBe(`recharge-proofs/${submitted.id}`);
    expect(bucket.has(proofRow.storageKey!)).toBe(true);

    const loaded = await getProofBytes(prisma, String(submitted.id), fakeStorage);
    expect(Buffer.compare(loaded.bytes, pngMagic)).toBe(0);

    // Mark reviewed 200 days ago and run cleanup
    await prisma.rechargeRequest.update({
      where: { id: String(submitted.id) },
      data: { status: 'APPROVED', reviewedAt: new Date(Date.now() - 200 * 86_400_000) },
    });
    const summary = await cleanupExpiredProofs(prisma, 100, 'system', fakeStorage);
    expect(summary.cleared).toBe(1);
    expect(bucket.has(proofRow.storageKey!)).toBe(false);
    const cleaned = await prisma.rechargeProof.findUniqueOrThrow({
      where: { requestId: String(submitted.id) },
    });
    expect(cleaned.storageKey).toBeNull();
    expect(cleaned.cleanedAt).not.toBeNull();
  });

  it('WP-CF5: MutexDurableObject enforces mutual exclusion and fixed-window rate limits; UserRealtimeDurableObject broadcasts and revokes sockets', async () => {
    const mutex = new MutexDurableObject({}, {});
    const r1 = await mutex.fetch(
      new Request('https://mutex.internal/acquire', {
        method: 'POST',
        body: JSON.stringify({ ttlMs: 5000 }),
      }),
    );
    expect(r1.status).toBe(200);
    const { token } = (await r1.json()) as { token: string };

    const r2 = await mutex.fetch(
      new Request('https://mutex.internal/acquire', {
        method: 'POST',
        body: JSON.stringify({ ttlMs: 5000 }),
      }),
    );
    expect(r2.status).toBe(423);

    await mutex.fetch(
      new Request('https://mutex.internal/release', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    );
    const r3 = await mutex.fetch(
      new Request('https://mutex.internal/acquire', {
        method: 'POST',
        body: JSON.stringify({ ttlMs: 5000 }),
      }),
    );
    expect(r3.status).toBe(200);

    // Fixed-window rate limit
    const rl1 = await mutex.fetch(
      new Request('https://mutex.internal/ratelimit', {
        method: 'POST',
        body: JSON.stringify({ windowSec: 60, max: 1 }),
      }),
    );
    expect(((await rl1.json()) as { allowed: boolean }).allowed).toBe(true);
    const rl2 = await mutex.fetch(
      new Request('https://mutex.internal/ratelimit', {
        method: 'POST',
        body: JSON.stringify({ windowSec: 60, max: 1 }),
      }),
    );
    expect(((await rl2.json()) as { allowed: boolean }).allowed).toBe(false);

    // UserRealtimeDurableObject broadcast + client-message close + session revocation
    const sent: string[] = [];
    const closed: Array<{ code?: number; reason?: string }> = [];
    const fakeWs = {
      send: (d: string) => sent.push(d),
      close: (code?: number, reason?: string) => closed.push({ code, reason }),
    };
    const fakeCtx = {
      acceptWebSocket: () => undefined,
      getWebSockets: (tag?: string) => (tag === undefined || tag === 'sess-1' ? [fakeWs] : []),
      getTags: () => ['sess-1', `exp:${Date.now() - 1000}`],
      storage: { setAlarm: async () => undefined },
    };
    const hub = new UserRealtimeDurableObject(fakeCtx, {});
    await hub.fetch(
      new Request('https://realtime.internal/publish', {
        method: 'POST',
        body: JSON.stringify({ revision: '42' }),
      }),
    );
    expect(sent.some((m) => m.includes('"revision":"42"'))).toBe(true);

    await hub.fetch(
      new Request('https://realtime.internal/publish', {
        method: 'POST',
        body: JSON.stringify({ revokedSessionId: 'sess-1' }),
      }),
    );
    expect(closed.some((c) => c.code === 1008)).toBe(true);
  });
});
