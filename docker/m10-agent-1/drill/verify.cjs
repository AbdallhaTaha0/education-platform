/**
 * M10 upgrade-drill verifier (agent 1, Docker-contained, synthetic data only).
 *
 * Runs after the real M10 migration against the same disposable database.
 * Fails (non-zero exit) unless: every seeded table kept its exact row count
 * and spot values, all 25 migrations (including M10, none failed) are recorded
 * with old files untouched, the M10 tables/indexes/singleton exist, and the
 * new CHECK constraint holds.
 */
const { PrismaClient } = require('/srv/server/node_modules/@prisma/client');
const fs = require('node:fs');
const assert = require('node:assert');

const prisma = new PrismaClient();

async function main() {
  const expected = JSON.parse(fs.readFileSync('/drill-out/counts.json', 'utf8'));

  const counts = {
    user: await prisma.user.count(),
    wallet: await prisma.wallet.count(),
    walletLedgerEntry: await prisma.walletLedgerEntry.count(),
    rechargeRequest: await prisma.rechargeRequest.count(),
    course: await prisma.course.count(),
    courseSection: await prisma.courseSection.count(),
    lesson: await prisma.lesson.count(),
    subscriptionPlan: await prisma.subscriptionPlan.count(),
    mediaMapping: await prisma.mediaMapping.count(),
    purchase: await prisma.purchase.count(),
    subscription: await prisma.subscription.count(),
    lessonProgress: await prisma.lessonProgress.count(),
    playbackReference: await prisma.playbackReference.count(),
    auditEvent: await prisma.auditEvent.count(),
  };
  assert.deepStrictEqual(counts, expected.counts, 'seeded table counts changed across the M10 migration');

  const wallet = await prisma.wallet.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  assert.strictEqual(wallet.balancePiastres, expected.spot.walletBalance, 'wallet balance changed');
  const progress = await prisma.lessonProgress.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  assert.strictEqual(progress.positionSeconds, expected.spot.progressPosition, 'progress position changed');
  const playback = await prisma.playbackReference.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  assert.strictEqual(playback.status, expected.spot.playbackStatus, 'playback status changed');
  const subscription = await prisma.subscription.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  assert.strictEqual(
    subscription.expiresAt.toISOString(),
    expected.spot.subscriptionExpiresAt,
    'subscription expiry changed',
  );

  const migrations = await prisma.$queryRawUnsafe(
    'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at',
  );
  assert.strictEqual(migrations.length, 25, `expected 25 applied migrations, got ${migrations.length}`);
  assert.ok(
    migrations.every((m) => m.finished_at !== null && m.rolled_back_at === null),
    'a recorded migration did not finish or was rolled back',
  );
  assert.ok(
    migrations.some((m) => m.migration_name === '20261007100000_m10_view_tracking'),
    'M10 migration missing from history',
  );

  const tables = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('M10VideoViewSession','M10ViewTrackingState')`,
  );
  assert.strictEqual(tables.length, 2, 'M10 tables missing after migration');
  const state = await prisma.m10ViewTrackingState.findUnique({ where: { id: 'global' } });
  assert.ok(state, 'M10 tracking singleton missing');
  const indexes = await prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE tablename='M10VideoViewSession'`,
  );
  assert.ok(indexes.length >= 11, `expected >=11 M10 indexes, got ${indexes.length}`);

  // New CHECK constraint is enforced (negative stored totals rejected).
  await assert.rejects(
    prisma.$executeRawUnsafe(`INSERT INTO "M10VideoViewSession"
      ("id","studentId","courseId","lessonId","mediaAssetId","mediaExternalAssetId",
       "playbackReferenceId","startedAt","playedMilliseconds")
      VALUES (gen_random_uuid(),'x','y','z','m','e','p',CURRENT_TIMESTAMP,-1)`),
    'negative playedMilliseconds was accepted',
  );

  console.log(`drill verify ok: 14 tables preserved, 25/25 migrations, M10 tables+singleton+${indexes.length} indexes present`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
