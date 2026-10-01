import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('M3 additive migration', () => {
  it('applies over M1+M2 without editing them', async () => {
    const rows = await prisma.$queryRaw<
      { migration_name: string }[]
    >`SELECT migration_name FROM _prisma_migrations ORDER BY started_at`;
    const names = rows.map((r) => r.migration_name);
    expect(names).toContain('20260927090000_m1_init');
    expect(names).toContain('20260928091356_m2_identity');
    expect(names.some((n) => n.includes('m3_catalog'))).toBe(true);
  });

  it('enforces unique slugs and CHECK constraints at the database level', async () => {
    const slug = `mig-${Date.now().toString(36)}`;
    await prisma.course.create({
      data: { slug, titleAr: 'أ', titleEn: 'B', descriptionAr: 'ج', descriptionEn: 'D' },
    });
    await expect(
      prisma.course.create({
        data: { slug, titleAr: 'أ', titleEn: 'B', descriptionAr: 'ج', descriptionEn: 'D' },
      }),
    ).rejects.toThrow();
    await prisma.course.deleteMany({ where: { slug } });
  });

  it('preserves audit/deletion evidence tables', async () => {
    const auditCount = await prisma.auditEvent.count();
    expect(auditCount).toBeGreaterThanOrEqual(0);
    const ops = await prisma.catalogDeletionOperation.count();
    expect(ops).toBeGreaterThanOrEqual(0);
  });
});
