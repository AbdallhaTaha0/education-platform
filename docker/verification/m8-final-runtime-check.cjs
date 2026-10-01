const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const r = createRequire('/srv/server/package.json');
const { PrismaClient } = r('@prisma/client');
const argon2 = r('argon2');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(new URL(process.env.DATABASE_URL).hostname, 'postgres');
for (const p of ['prisma', '@prisma/config', 'deepmerge-ts'])
  assert(!fs.existsSync(`/srv/server/node_modules/${p}`));
assert(!fs.existsSync('/srv/server/tests'));
assert(
  fs.readdirSync('/srv/server/node_modules/.prisma/client').some((p) => p.endsWith('.so.node')),
);
const db = new PrismaClient();
(async () => {
  const hash = await argon2.hash('synthetic-native-smoke');
  assert(await argon2.verify(hash, 'synthetic-native-smoke'));
  const f = JSON.parse(fs.readFileSync('/tmp/m8-final-fixtures.json'));
  const studentId = f.users.find((u) => u.role === 'STUDENT').id;
  const wallet = await db.wallet.findUniqueOrThrow({ where: { userId: studentId } });
  const sum = await db.walletLedgerEntry.aggregate({
    where: { walletId: wallet.id },
    _sum: { amountPiastres: true },
  });
  assert.equal(wallet.balancePiastres, 465000);
  assert.equal(sum._sum.amountPiastres, 465000);
  const purchases = await db.purchase.findMany({ where: { studentId } });
  assert.equal(purchases.length, 1);
  assert.equal(purchases[0].accessMode, 'UNTIL_REMOVAL');
  assert.equal(purchases[0].durationDays, null);
  const bundles = await db.packagePurchase.findMany({
    where: { studentId },
    include: { items: true, subscriptions: true },
  });
  assert.equal(bundles.length, 1);
  assert.equal(bundles[0].pricePiastres, 25000);
  assert.equal(bundles[0].items.length, 3);
  assert.equal(bundles[0].subscriptions.length, 3);
  assert(
    bundles[0].subscriptions.every((s) => s.expiresAt?.getTime() === bundles[0].endsAt.getTime()),
  );
  assert.equal(
    await db.walletLedgerEntry.count({
      where: { walletId: wallet.id, entryType: 'DEBIT_PURCHASE' },
    }),
    2,
  );
  assert.equal(await db.subscription.count({ where: { studentId, expiresAt: null } }), 1);
  console.log(
    'PASS: final non-root serving image, CLI exclusion, native Prisma/Argon2; exact 10000 + 25000 debits, 465000 wallet/ledger balance, immutable indefinite purchase and three common-deadline package grants.',
  );
})()
  .finally(() => db.$disconnect())
  .catch((e) => {
    console.error(e instanceof assert.AssertionError ? e.message : 'Runtime verification failed');
    process.exitCode = 1;
  });
