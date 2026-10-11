// Run only inside the isolated production rehearsal, never against owner data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire('/srv/server/package.json');
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const { bootstrapReleaseAdmins, RELEASE_ADMIN_NAMES } = require('/srv/server/dist/modules/identity/bootstrap.js');
const { PRODUCTION_ARGON2 } = require('/srv/server/dist/modules/identity/password.js');
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, 'postgres');
assert.equal(url.pathname, '/deployment_verification');
const prisma = new PrismaClient();
const password = 'Synthetic release bootstrap password only 20261011';
const inputs = [1, 2, 3].map(index => ({ email: `release-${index}@example.test`, phone: `+20100000000${index}`, password }));
const deps = { prisma, argon2: PRODUCTION_ARGON2 };
try {
  assert.equal(await prisma.user.count(), 0, 'Fresh disposable database required');
  await assert.rejects(bootstrapReleaseAdmins(inputs.slice(0, 2), deps));
  await assert.rejects(bootstrapReleaseAdmins(inputs.map(input => ({ ...input, email: inputs[0].email })), deps));
  await assert.rejects(bootstrapReleaseAdmins(inputs.map(input => ({ ...input, phone: inputs[0].phone })), deps));
  await assert.rejects(bootstrapReleaseAdmins(inputs.map(input => ({ ...input, password: 'short' })), deps));
  assert.equal(await prisma.user.count(), 0, 'Invalid setup must create no user');
  const results = await Promise.allSettled([bootstrapReleaseAdmins(inputs, deps), bootstrapReleaseAdmins(inputs, deps)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const users = await prisma.user.findMany({ orderBy: { email: 'asc' } });
  assert.equal(users.length, 3, 'Concurrent bootstrap must create exactly three');
  assert.deepEqual(users.map(user => user.displayName), [...RELEASE_ADMIN_NAMES]);
  for (const user of users) {
    assert.equal(user.role, 'ADMIN');
    assert.equal(await argon2.verify(user.passwordHash, password), true);
  }
  const env = { ...process.env };
  inputs.forEach((input, index) => {
    env[`RELEASE_ADMIN_${index + 1}_EMAIL`] = input.email;
    env[`RELEASE_ADMIN_${index + 1}_PHONE`] = input.phone;
    env[`RELEASE_ADMIN_${index + 1}_PASSWORD`] = input.password;
  });
  const cli = spawnSync('node', ['dist/bootstrap-release-admins.js'], { cwd: '/srv/server', env, encoding: 'utf8' });
  assert.equal(cli.status, 1, 'CLI must refuse a repeat');
  assert.ok(!`${cli.stdout}${cli.stderr}`.includes(password), 'CLI must not disclose credentials');
  assert.equal(await prisma.user.count(), 3);
  console.log('PASS release admin validation, zero partial writes, concurrency, exact names/roles, password verification, repeat refusal and CLI secret silence');
} finally {
  await prisma.$disconnect();
}
