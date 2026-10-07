/**
 * M10 upgrade-drill seeder (agent 1, Docker-contained, synthetic data only).
 *
 * Runs inside the migrate image against the PRE-M10 schema (migrations 01..24
 * applied). Inserts representative rows across identity, wallet, purchase,
 * catalog/media, progress, playback and audit tables, then records exact
 * counts and spot values to /drill-out/counts.json for the post-migration
 * verifier. Never touches M10 models (their tables do not exist yet).
 */
const { PrismaClient } = require('/srv/server/node_modules/@prisma/client');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');

const prisma = new PrismaClient();
const SFX = Date.now().toString(36);

async function main() {
  const tail = String(Date.now()).slice(-8).padStart(8, '0');
  const admin = await prisma.user.create({
    data: {
      email: `drill-admin-${SFX}@example.test`,
      phone: `010${tail.slice(0, 7)}1`,
      displayName: 'Drill Admin',
      passwordHash: 'drill-not-a-real-hash',
      role: 'ADMIN',
    },
  });
  const student = await prisma.user.create({
    data: {
      email: `drill-student-${SFX}@example.test`,
      phone: `011${tail.slice(0, 7)}2`,
      displayName: 'Drill Student',
      passwordHash: 'drill-not-a-real-hash',
      role: 'STUDENT',
    },
  });
  const wallet = await prisma.wallet.create({
    data: { userId: student.id, balancePiastres: 40000 },
  });
  await prisma.walletLedgerEntry.create({
    data: {
      walletId: wallet.id,
      amountPiastres: 100000,
      entryType: 'CREDIT_RECHARGE',
      refType: 'RECHARGE',
      refId: `drill-credit-${SFX}`,
    },
  });
  await prisma.walletLedgerEntry.create({
    data: {
      walletId: wallet.id,
      amountPiastres: -60000,
      entryType: 'DEBIT_PURCHASE',
      refType: 'PURCHASE',
      refId: `drill-debit-${SFX}`,
    },
  });
  await prisma.rechargeRequest.create({
    data: {
      studentId: student.id,
      amountPiastres: 100000,
      channel: 'INSTAPAY',
      referenceNorm: `DRILL${SFX.toUpperCase()}001`,
      senderName: 'Drill Sender',
      senderPhone: '0100000003',
      transferDate: new Date('2026-09-20T10:00:00Z'),
      proofFilename: 'drill.png',
      proofMime: 'image/png',
      proofSize: 1234,
      proofHash: require('node:crypto').createHash('sha256').update(`drill-${SFX}`).digest('hex'),
      idempotencyKey: `drill-recharge-${SFX}`,
    },
  });
  const course = await prisma.course.create({
    data: {
      slug: `drill-course-${SFX}`,
      titleAr: 'دورة تجربة',
      titleEn: 'Drill course',
      descriptionAr: 'وصف',
      descriptionEn: 'Desc',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-09-25T00:00:00Z'),
      firstPublicationAt: new Date('2026-09-25T00:00:00Z'),
    },
  });
  const section = await prisma.courseSection.create({
    data: { courseId: course.id, titleAr: 'قسم', titleEn: 'Section', position: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: { sectionId: section.id, titleAr: 'درس', titleEn: 'Lesson', position: 1 },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: { courseId: course.id, currentPricePiastres: 60000, durationDays: 90 },
  });
  const mapping = await prisma.mediaMapping.create({
    data: {
      lessonId: lesson.id,
      externalAssetId: `drill-external-${SFX}`,
      assetId: `drill-asset-${SFX}`,
      status: 'READY',
      idempotencyKey: `drill-media-${SFX}`,
      durationSeconds: 600,
    },
  });
  const purchase = await prisma.purchase.create({
    data: {
      studentId: student.id,
      planId: plan.id,
      courseId: course.id,
      pricePiastres: 60000,
      durationDays: 90,
      idempotencyKey: `drill-purchase-${SFX}`,
    },
  });
  const subscription = await prisma.subscription.create({
    data: {
      studentId: student.id,
      courseId: course.id,
      purchaseId: purchase.id,
      startsAt: new Date('2026-09-26T00:00:00Z'),
      expiresAt: new Date('2026-12-25T00:00:00Z'),
    },
  });
  const progress = await prisma.lessonProgress.create({
    data: {
      studentId: student.id,
      lessonId: lesson.id,
      courseId: course.id,
      positionSeconds: 120,
      durationSeconds: 600,
    },
  });
  const playback = await prisma.playbackReference.create({
    data: {
      studentId: student.id,
      lessonId: lesson.id,
      courseId: course.id,
      externalSessionId: randomUUID(),
      externalAssetId: mapping.externalAssetId,
      provider: 'CLEAR_KEY',
      status: 'ACTIVE',
      tokenExpiresAt: new Date(Date.now() + 300_000),
      sessionExpiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  const audit = await prisma.auditEvent.create({
    data: {
      actorUserId: admin.id,
      action: 'DRILL_SEED',
      entityType: 'Course',
      entityId: course.id,
    },
  });

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
  const evidence = {
    counts,
    spot: {
      walletBalance: wallet.balancePiastres,
      progressPosition: progress.positionSeconds,
      playbackStatus: playback.status,
      subscriptionExpiresAt: subscription.expiresAt.toISOString(),
      auditAction: audit.action,
      courseSlug: course.slug,
      mediaStatus: mapping.status,
    },
  };
  fs.mkdirSync('/drill-out', { recursive: true });
  fs.writeFileSync('/drill-out/counts.json', JSON.stringify(evidence, null, 2));
  console.log(`drill seed ok: ${JSON.stringify(counts)}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
