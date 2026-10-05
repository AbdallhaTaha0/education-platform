import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWalletWorld, studentGet, type WalletWorld } from './wallet-helpers.js';
let w: WalletWorld;
beforeAll(async () => {
  w = await createWalletWorld(false);
  await w.prisma.rechargeRequest.createMany({ data: Array.from({ length: 115 }, (_, i) => ({ studentId: w.studentUser.id, amountPiastres: 10000, channel: 'INSTAPAY' as const, referenceNorm: `PAGINATIONFIXTURE${i}`, senderName: `Pagination sender ${i}`, senderPhone: '+201000000001', transferDate: new Date('2026-10-01T12:00:00Z'), proofFilename: 'synthetic.png', proofMime: 'image/png', proofSize: 1, proofHash: 'a'.repeat(64), reviewerId: w.adminUser.id, reviewedAt: new Date('2026-10-01T12:00:00Z'), status: i < 105 ? 'REJECTED' as const : 'APPROVED' as const, rejectReason: i < 105 ? 'Synthetic display fixture' : null, idempotencyKey: `pagination-${i}`, createdAt: new Date('2026-10-01T12:00:00Z') })) });
});
afterAll(async () => { await w?.close(); });
describe('Bounded record pagination', () => {
  it('rejects malformed and oversized paging', async () => {
    for (const query of ['page=0','page=-1','page=1.5','page=1&pageSize=1000','page=1&date=2026-02-31','page=1&search='+'x'.repeat(101)]) expect((await studentGet(w.app, '/admin/recharge-requests?'+query, w.adminJar)).status).toBe(400);
  });
  it('reaches rejected records beyond the old 50/100 caps with stable, disjoint tied-timestamp pages', async () => {
    const first = await studentGet(w.app, '/admin/recharge-requests?status=REJECTED&page=1&pageSize=10', w.adminJar);
    const second = await studentGet(w.app, '/admin/recharge-requests?status=REJECTED&page=2&pageSize=10', w.adminJar);
    const last = await studentGet(w.app, '/admin/recharge-requests?status=REJECTED&page=11&pageSize=10', w.adminJar);
    expect(first.body.data.pagination).toEqual({ page: 1, pageSize: 10, total: 105 });
    expect(first.body.data.requests).toHaveLength(10); expect(last.body.data.requests).toHaveLength(5);
    const ids = new Set(first.body.data.requests.map((r: { id: string }) => r.id));
    expect(second.body.data.requests.every((r: { id: string }) => !ids.has(r.id))).toBe(true);
    expect((await studentGet(w.app, '/admin/recharge-requests?status=REJECTED&page=1&pageSize=10', w.adminJar)).body.data.requests).toEqual(first.body.data.requests);
  });
  it('searches the complete filtered scope and clamps pages after scope changes', async () => {
    const result = await studentGet(w.app, '/admin/recharge-requests?status=REJECTED&search=FIXTURE104&page=9&pageSize=10&date=2026-10-01', w.adminJar);
    expect(result.body.data.pagination).toEqual({ page: 1, pageSize: 10, total: 1 }); expect(result.body.data.requests[0].referenceNorm).toBe('PAGINATIONFIXTURE104');
    const approved = await studentGet(w.app, '/admin/recharge-requests?status=APPROVED&page=1&pageSize=20', w.adminJar);
    expect(approved.body.data.pagination.total).toBe(10); expect(approved.body.data.requests.every((r: { status: string }) => r.status === 'APPROVED')).toBe(true);
  });
  it('keeps STUDENT scopes and ADMIN authorization enforced', async () => {
    expect((await studentGet(w.app, '/admin/recharge-requests?page=1', w.studentJar)).status).toBe(403);
    const own = await studentGet(w.app, '/wallet/recharge-requests?page=12&pageSize=10', w.studentJar);
    expect(own.body.data.pagination.total).toBe(115); expect(own.body.data.requests).toHaveLength(5);
    expect(own.body.data.requests[0]).not.toHaveProperty('studentId'); expect(own.body.data.requests[0]).not.toHaveProperty('proofHash');
    expect((await studentGet(w.app, '/wallet/recharge-requests?page=1', w.adminJar)).body.data.pagination.total).toBe(0);
  });
  it('bounds receipt and practice directory pages and preserves legacy arrays', async () => {
    for (const path of ['/wallet/purchases','/wallet/package-purchases']) {
      const result = await studentGet(w.app, `${path}?page=1&pageSize=10`, w.studentJar); expect(result.status).toBe(200); expect(result.body.data.pagination.pageSize).toBe(10); expect(result.body.data.purchases.length).toBeLessThanOrEqual(10);
    }
    const directory = await studentGet(w.app, '/admin/assessments/students?page=1&pageSize=10', w.adminJar); expect(directory.status).toBe(200); expect(directory.body.data.students.length).toBeLessThanOrEqual(10);
    const legacy = await studentGet(w.app, '/wallet/recharge-requests', w.studentJar); expect(legacy.body.data.requests).toHaveLength(50); expect(legacy.body.data.pagination).toBeUndefined();
  });
  it('pages submission history beyond 30 while excluding foreign submissions and answer code', async () => {
    const course = await w.prisma.course.create({ data: { slug: 'pagination-history', titleAr: 'اختبار', titleEn: 'Test', descriptionAr: 'اختبار', descriptionEn: 'Test', sections: { create: { position: 1, titleAr: 'قسم', titleEn: 'Section', lessons: { create: { position: 1, titleAr: 'درس', titleEn: 'Lesson' } } } } }, include: { sections: { include: { lessons: true } } } });
    const assessment = await w.prisma.assessment.create({ data: { lessonId: course.sections[0]!.lessons[0]!.id, kind: 'QUIZ', required: false, content: {} } });
    const version = await w.prisma.assessmentVersion.create({ data: { assessmentId: assessment.id, version: 1, content: {} } });
    await w.prisma.assessmentSubmission.createMany({ data: Array.from({ length: 36 }, (_, i) => ({ studentId: i === 35 ? w.adminUser.id : w.studentUser.id, assessmentId: assessment.id, versionId: version.id, idempotencyKey: `history-${i}`, inputHash: 'a'.repeat(64), state: 'INCORRECT', answers: [{ source: 'private-answer' }], createdAt: new Date('2026-10-01T12:00:00Z') })) });
    const first = await studentGet(w.app, `/assessments/${assessment.id}/history?page=1&pageSize=10`, w.studentJar);
    const last = await studentGet(w.app, `/assessments/${assessment.id}/history?page=4&pageSize=10`, w.studentJar);
    expect(first.status).toBe(200); expect(first.body.data.pagination.total).toBe(35); expect(first.body.data.submissions).toHaveLength(10); expect(last.body.data.submissions).toHaveLength(5);
    expect(JSON.stringify(first.body)).not.toContain('private-answer');
    expect((await studentGet(w.app, `/assessments/${assessment.id}/history`, w.studentJar)).body.data.submissions).toHaveLength(30);
    await w.prisma.course.delete({ where: { id: course.id } });
  });
});
