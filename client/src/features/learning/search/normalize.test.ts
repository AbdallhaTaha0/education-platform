import { describe, expect, it } from 'vitest';
import { filterOutlineByTitle, normalizeSearchText, titleMatches } from './normalize';

describe('course-learning title search normalization', () => {
  it('ignores Arabic diacritics', () => {
    expect(normalizeSearchText('الدرس')).toBe(normalizeSearchText('اَلدَّرْسُ'));
  });

  it('ignores case in English and Arabic-adjacent latin', () => {
    expect(titleMatches('الدرس الأول', 'Introduction to Variables', 'variables')).toBe(true);
    expect(titleMatches('الدرس الأول', 'Introduction to Variables', 'VARIABLES')).toBe(true);
    expect(titleMatches('مقدمة', 'Lesson', 'مُقَدِّمَة')).toBe(true);
  });

  it('trims whitespace and matches empty query to everything', () => {
    expect(titleMatches('أ', 'b', '   ')).toBe(true);
  });

  it('keeps section-title matches whole and lesson matches narrow', () => {
    const sections = [
      {
        sectionId: 's1',
        titleAr: 'أساسيات',
        titleEn: 'Basics',
        lessons: [
          { lessonId: 'l1', titleAr: 'المتغيرات', titleEn: 'Variables' },
          { lessonId: 'l2', titleAr: 'الدوال', titleEn: 'Functions' },
        ],
      },
      {
        sectionId: 's2',
        titleAr: 'متقدم',
        titleEn: 'Advanced',
        lessons: [{ lessonId: 'l3', titleAr: 'المتغيرات المتقدمة', titleEn: 'Advanced vars' }],
      },
    ];
    const bySection = filterOutlineByTitle(sections, 'أساسيات');
    expect(bySection.sections).toHaveLength(1);
    expect(bySection.sections[0]?.lessons).toHaveLength(2);
    expect(bySection.matchCount).toBe(2);

    const byLesson = filterOutlineByTitle(sections, 'variables');
    expect(byLesson.sections).toHaveLength(1);
    expect(byLesson.sections[0]?.sectionId).toBe('s1');
    expect(byLesson.sections[0]?.lessons.map((l) => l.lessonId)).toEqual(['l1']);
    expect(byLesson.matchingSectionIds).toEqual(['s1']);
  });

  it('returns an empty state with zero matches', () => {
    const sections = [
      {
        sectionId: 's1',
        titleAr: 'أساسيات',
        titleEn: 'Basics',
        lessons: [{ lessonId: 'l1', titleAr: 'أ', titleEn: 'b' }],
      },
    ];
    const result = filterOutlineByTitle(sections, 'zzz-no-match');
    expect(result.sections).toHaveLength(0);
    expect(result.matchCount).toBe(0);
    expect(result.matchingSectionIds).toEqual([]);
  });

  it('matches locked-lesson titles without changing their identity', () => {
    const sections = [
      {
        sectionId: 's1',
        titleAr: 'قسم',
        titleEn: 'Section',
        lessons: [
          { lessonId: 'locked-1', titleAr: 'درس مقفل', titleEn: 'Locked lesson' },
        ],
      },
    ];
    const result = filterOutlineByTitle(sections, 'locked');
    expect(result.sections[0]?.lessons[0]?.lessonId).toBe('locked-1');
  });
});
