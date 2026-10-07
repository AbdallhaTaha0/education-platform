import { describe, expect, it } from 'vitest';
import { MAX_PART_CHARS, MAX_PART_ENCODED_CHARS, splitParts, toParts, renderShortParentReport, type ParentReportModel } from '../../src/modules/parent-reports/text.js';

describe('M10 bounded WhatsApp text', () => {
  it('summarizes four weeks once, retaining unknown coverage and grading outcomes without repeated details', () => {
    const start = new Date('2026-09-09'), end = new Date('2026-10-07');
    const lessons = [{ title: 'Video A', status: 'viewed' as const }, { title: 'Video B', status: 'trackingUnavailable' as const }];
    const assessments = [{ label: 'اختبار 1 — Very long title', status: 'passed' as const, attemptsInSection: 1 }, { label: 'واجب 2 — Another long title', status: 'serviceError' as const, attemptsInSection: 1 }];
    const model: ParentReportModel = { studentName: 'أحمد', language: 'ar', reportType: 'FOUR_WEEKS', start, end,
      courses: [{ courseId: 'course', titleAr: 'برمجة', titleEn: 'Programming', notes: [], summary: { lessons, assessments },
        sections: [1,2,3,4].map(index => ({ index, total: 4, start, end, lessons, assessments, coverageNote: 'partial' })) }] };
    const text = renderShortParentReport(model);
    expect(text.match(/تقرير ولي الأمر/g)).toHaveLength(1);
    expect(text.match(/الأسبوع [١-٤]/g)).toHaveLength(4);
    expect(text).toContain('اجتاز ١ من ١');
    expect(text).not.toContain('/');
    expect(text).toContain('سبتمبر');
    expect(text).toContain('أكتوبر');
    expect(text.split('\n').filter(Boolean).every(line => line.startsWith('\u200f'))).toBe(true);
    expect(text).not.toMatch(/[\uD800-\uDFFF\uFFFD]/);
    expect(text).toContain('تعذّر التصحيح');
    expect(text).toContain('المشاهدة غير مؤكدة: ١');
    expect(text).not.toContain('غير معروف');
    expect(text).not.toContain('لم تتوفر بيانات المشاهدة');
    expect(text).not.toContain('Very long title');
    expect(text).not.toContain('محاولات الفترة');
    expect(text.length).toBeLessThan(650);
    expect(`https://wa.me/201000000000000?text=${encodeURIComponent(text)}`.length).toBeLessThan(12000);
  });
  it('preserves oversized lines and Unicode code points without silent truncation', () => {
    const text = ('عنوان طويل 🧑‍💻 '.repeat(700)) + '\nEnglish tail';
    const raw = splitParts(text);
    expect(raw.map((p) => p.text).join('')).toBe(text);
    for (const part of raw) {
      expect(part.text.length).toBeLessThanOrEqual(MAX_PART_CHARS);
      expect(encodeURIComponent(part.text).length).toBeLessThanOrEqual(MAX_PART_ENCODED_CHARS);
    }
  });
  it('bounds final numbered Arabic four-week parts including repeated context and URL encoding', () => {
    const text = '*FAYQ | تقرير ولي الأمر*\nالطالب: طالب اختبار\nالفترة: آخر 28 يومًا\n■ دورة اختبار\nالأسبوع 1/4\n' + 'عنوان طويل 🧑‍💻 '.repeat(1000);
    const parts = toParts(text);
    expect(parts.length).toBeGreaterThan(4);
    for (const p of parts) {
      expect(p.text.length).toBeLessThanOrEqual(MAX_PART_CHARS);
      expect(encodeURIComponent(p.text).length).toBeLessThanOrEqual(MAX_PART_ENCODED_CHARS);
      expect(p.text).toContain('الطالب: طالب اختبار');
      expect(p.text).toContain(`${p.index}/${p.total}`);
      expect(`https://wa.me/201000000000000?text=${encodeURIComponent(p.text)}`.length).toBeLessThan(4000);
    }
  });
  it('normalizes isolated surrogate input safely before URL encoding', () => {
    const parts = toParts('FAYQ\nStudent\n\ud800bad\udfff');
    expect(parts[0]!.text).toContain('\uFFFDbad\uFFFD');
    expect(() => encodeURIComponent(parts[0]!.text)).not.toThrow();
  });
});
