/**
 * M10 browser-probe seeder (agent 1, Docker-contained, synthetic data only).
 *
 * Runs inside the migrate image (prisma client + argon2 available) against the
 * disposable browser-stack database AFTER `migrate` applied all 25 migrations.
 * Creates one ADMIN, one STUDENT (known passwords), one PUBLISHED course with
 * one READY lesson + plan, and one active purchase-backed subscription, then
 * prints the ids/credentials the Chromium probe needs as JSON.
 */
const { PrismaClient } = require('/srv/server/node_modules/@prisma/client');
const argon2 = require('/srv/server/node_modules/argon2');

const prisma = new PrismaClient();
const SFX = Date.now().toString(36);
const STUDENT_PASSWORD = 'browser probe student password 0123456789abcdef';
const ADMIN_PASSWORD = 'browser probe admin password 0123456789abcdef';

async function main() {
  const tail = String(Date.now()).slice(-8).padStart(8, '0');
  const admin = await prisma.user.create({
    data: {
      email: `probe-admin-${SFX}@example.test`,
      phone: `015${tail.slice(0, 7)}9`,
      displayName: 'Probe Admin',
      passwordHash: await argon2.hash(ADMIN_PASSWORD),
      role: 'ADMIN',
    },
  });
  const student = await prisma.user.create({
    data: {
      email: `probe-student-${SFX}@example.test`,
      phone: `012${tail.slice(0, 7)}8`,
      displayName: 'Probe Student',
      passwordHash: await argon2.hash(STUDENT_PASSWORD),
      role: 'STUDENT',
    },
  });
  await prisma.wallet.create({ data: { userId: student.id, balancePiastres: 0 } });
  // Seeded DRAFT: the probe drives the real media/register/complete/sync and
  // publication-transition APIs so the DRM fixture becomes the authority for
  // the lesson's external asset before any playback grant is minted.
  const course = await prisma.course.create({
    data: {
      slug: `probe-course-${SFX}`,
      titleAr: 'دورة الفحص',
      titleEn: 'Probe course',
      descriptionAr: 'وصف',
      descriptionEn: 'Desc',
      status: 'DRAFT',
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

  const purchase = await prisma.purchase.create({
    data: {
      studentId: student.id,
      planId: plan.id,
      courseId: course.id,
      pricePiastres: 60000,
      durationDays: 90,
      idempotencyKey: `probe-purchase-${SFX}`,
    },
  });
  await prisma.subscription.create({
    data: {
      studentId: student.id,
      courseId: course.id,
      purchaseId: purchase.id,
      startsAt: new Date(Date.now() - 3_600_000),
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  console.log(
    JSON.stringify({
      adminEmail: admin.email,
      adminPassword: ADMIN_PASSWORD,
      studentEmail: student.email,
      studentPassword: STUDENT_PASSWORD,
      courseSlug: course.slug,
      courseId: course.id,
      lessonId: lesson.id,
    }),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
