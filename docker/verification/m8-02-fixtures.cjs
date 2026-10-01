// Isolated UI fixtures only. No media, publication, grants, balances or subscriptions.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID, randomInt } = require('node:crypto');
const { createRequire } = require('node:module');
const r = createRequire('/srv/server/package.json');
const { PrismaClient } = r('@prisma/client');
const { hashPassword, PRODUCTION_ARGON2 } = r('./dist/modules/identity/password.js');
const db = new PrismaClient();
const receipt = '/tmp/m8-02-fixtures.json';
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(new URL(process.env.DATABASE_URL).hostname, 'postgres');
assert.equal(process.env.ALLOWED_ORIGINS, 'http://localhost:8082');
(async () => {
  if (process.argv[2] === 'cleanup') {
    const f = JSON.parse(fs.readFileSync(receipt));
    assert.match(f.run, /^[a-f0-9-]{36}$/);
    const prefix = `m8-02-${f.run}-`;
    await db.course.deleteMany({ where: { slug: { startsWith: prefix }, status: 'DRAFT' } });
    const result = await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    fs.unlinkSync(receipt);
    console.log(`M8 fixture cleanup: users=${result.count}`);
    return;
  }
  assert.equal(process.argv[2], 'seed');
  assert(!fs.existsSync(receipt));
  const f = { run: randomUUID(), users: [] };
  const prefix = `m8-02-${f.run}-`;
  fs.writeFileSync(receipt, JSON.stringify(f), { mode: 0o600 });
  const input = JSON.parse(fs.readFileSync('/tmp/m8-demo-content.json'));
  for (const role of ['STUDENT', 'ADMIN']) {
    const credentials = {
      role,
      email: `${prefix}${role.toLowerCase()}@example.test`,
      password: randomUUID() + 'aA9!',
    };
    f.users.push(credentials);
    fs.writeFileSync(receipt, JSON.stringify(f), { mode: 0o600 });
    // Admin bootstrap fixture uses the real password implementation, no public bypass.
    await db.user.create({
      data: {
        role,
        email: credentials.email,
        displayName: role === 'STUDENT' ? 'طالب تجريبي — M8' : 'إدارة تجريبية — M8',
        phone: `011${randomInt(10000000, 100000000)}`,
        passwordHash: await hashPassword(credentials.password, PRODUCTION_ARGON2),
      },
    });
  }
  for (const course of input.courses)
    await db.course.create({
      data: {
        slug: prefix + course.slug,
        titleAr: course.titleAr,
        titleEn: course.titleEn,
        descriptionAr: course.descriptionAr,
        descriptionEn: course.descriptionEn,
        status: 'DRAFT',
      },
    });
  assert.equal(
    await db.course.count({ where: { slug: { startsWith: prefix }, status: 'PUBLISHED' } }),
    0,
  );
  console.log(
    'M8 fixtures: two synthetic accounts; three DRAFT courses; no media/publication/access fixtures.',
  );
})()
  .catch((e) => {
    console.error(e instanceof assert.AssertionError ? e.message : 'M8 fixture operation failed');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
