/** Lesson/section title search normalization (course-learning UI).
 *
 * Matches Arabic and English ignoring case and Arabic diacritics. Only the
 * authorized outline data already returned to the subscriber is searched;
 * this creates no public index and never touches assessment data.
 */

const ARABIC_DIACRITICS =
  // eslint-disable-next-line no-misleading-character-class
  /[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u0670]+/g;

/** Normalize for search: strip Arabic diacritics, trim, lowercase. */
export function normalizeSearchText(value: string): string {
  return value.replace(ARABIC_DIACRITICS, '').toLowerCase().trim();
}

/** True when a haystack title matches the raw query. Empty query matches all. */
export function titleMatches(titleAr: string, titleEn: string, rawQuery: string): boolean {
  const query = normalizeSearchText(rawQuery);
  if (query.length === 0) return true;
  const ar = normalizeSearchText(titleAr);
  const en = titleEn.toLowerCase().trim();
  return ar.includes(query) || en.includes(query);
}

export interface SearchableLesson {
  lessonId: string;
  titleAr: string;
  titleEn: string;
}

export interface SearchableSection {
  sectionId: string;
  titleAr: string;
  titleEn: string;
  lessons: SearchableLesson[];
}

export interface SearchResult {
  /** Sections to render: matching lessons only, or the whole section on section-title match. */
  sections: SearchableSection[];
  /** Total matching lessons across all sections. */
  matchCount: number;
  /** Section ids that contain at least one match (to expand). */
  matchingSectionIds: string[];
}

/**
 * Filter authorized outline sections by lesson/section titles.
 * - Section-title match includes every lesson in that section.
 * - Lesson-title match includes only matching lessons.
 * - Never reorders, never changes progress, never triggers playback.
 */
export function filterOutlineByTitle<TLesson extends SearchableLesson, TSection extends SearchableSection & { lessons: TLesson[] }>(
  sections: TSection[],
  rawQuery: string,
): SearchResult & { sections: TSection[] } {
  const query = normalizeSearchText(rawQuery);
  if (query.length === 0) {
    return {
      sections,
      matchCount: sections.reduce((sum, s) => sum + s.lessons.length, 0),
      matchingSectionIds: [],
    };
  }
  const out: TSection[] = [];
  const matchingSectionIds: string[] = [];
  let matchCount = 0;
  for (const section of sections) {
    const sectionHit =
      normalizeSearchText(section.titleAr).includes(query) ||
      section.titleEn.toLowerCase().trim().includes(query);
    if (sectionHit) {
      out.push(section);
      matchingSectionIds.push(section.sectionId);
      matchCount += section.lessons.length;
      continue;
    }
    const lessons = section.lessons.filter((lesson) =>
      titleMatches(lesson.titleAr, lesson.titleEn, rawQuery),
    );
    if (lessons.length > 0) {
      out.push({ ...section, lessons });
      matchingSectionIds.push(section.sectionId);
      matchCount += lessons.length;
    }
  }
  return { sections: out, matchCount, matchingSectionIds };
}
