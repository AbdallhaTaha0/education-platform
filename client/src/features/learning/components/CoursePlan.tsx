import { useMemo, useRef, useState } from 'react';
import { useTranslate, useLang } from '../../../i18n';
import { CourseOutline, type LearningLabels } from './Learning';
import { filterOutlineByTitle } from '../search/normalize';
import { formatDurationTotal, sumDurations } from '../materials/duration';
import type { OutlineSection } from '../types/models';
import { ProgressBar } from '../../../components/ui/ProgressBar';

export function useLearningLabels(): LearningLabels {
  const t = useTranslate();
  return {
    active: t('learningActive'), expired: t('learningExpired'),
    continueLearning: t('learningContinue'), renew: t('learningRenew'),
    expiresOn: t('learningExpiresOn'), progress: t('learningProgress'),
    completed: t('learningCompleted'), notStarted: t('learningNotStarted'),
    resume: t('learningResume'), lessonCount: t('learningLessonCount'),
    emptyActive: t('learningEmptyActive'), emptyExpired: t('learningEmptyExpired'),
    noSubscription: t('learningNoSubscription'), browseCourses: t('learningBrowse'),
  };
}

export function CoursePlan({ sections, selectedLessonId, onSelect, disabled = false }: {
  sections: OutlineSection[];
  selectedLessonId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const labels = useLearningLabels();
  const lessons = sections.flatMap(section => section.lessons);
  const completed = lessons.filter(lesson => lesson.completed).length;
  const percent = lessons.length ? Math.round(completed / lessons.length * 100) : 0;
  const courseTotal = useMemo(
    () => sumDurations(lessons.map((lesson) => lesson.durationSeconds)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections],
  );

  // Lesson/section-title search over the already-authorized outline only.
  // Filtering never triggers playback, progress writes or access changes:
  // it only narrows the rendered rows and expands matching sections.
  const [query, setQuery] = useState('');
  const [userExpanded, setUserExpanded] = useState<Record<string, boolean> | null>(null);
  const savedExpanded = useRef<Record<string, boolean> | null>(null);
  const filtering = query.trim().length > 0;

  const filtered = useMemo(
    () => filterOutlineByTitle(sections, query),
    [sections, query],
  );

  const expanded: Record<string, boolean> | undefined = filtering
    ? Object.fromEntries(filtered.matchingSectionIds.map((id) => [id, true]))
    : (userExpanded ?? undefined);

  function handleQueryChange(value: string): void {
    if (!filtering && value.trim().length > 0) {
      // Remember the browsing expand state so clearing restores it.
      savedExpanded.current = userExpanded;
    }
    if (value.trim().length === 0 && savedExpanded.current !== undefined) {
      setUserExpanded(savedExpanded.current);
      savedExpanded.current = null;
    }
    setQuery(value);
  }

  function clearSearch(): void {
    setQuery('');
    if (savedExpanded.current !== undefined) {
      setUserExpanded(savedExpanded.current);
      savedExpanded.current = null;
    }
  }

  return (
    <nav aria-label={ar ? 'خطة الكورس' : 'Course plan'} className="course-plan" data-testid="course-plan">
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{ar ? 'خطة الكورس' : 'Course plan'}</h2>
          <span className="rounded-full bg-elevated px-3 py-1 text-sm font-bold" dir="ltr">{percent}%</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          {ar ? `${completed} من ${lessons.length} درس مكتمل · الأقسام: ${sections.length}` : `${completed} of ${lessons.length} lessons completed · ${sections.length} ${sections.length === 1 ? 'section' : 'sections'}`}
        </p>
        <p data-testid="course-duration" dir="ltr" className="mt-1 text-sm text-muted">
          {formatDurationTotal(courseTotal, lang)}
        </p>
        <ProgressBar value={percent} label={labels.progress} className="mt-3" />
        <p className="mt-2 text-xs text-muted">{ar ? 'نسبة الدروس المكتملة؛ مشاهدة جزء من الدرس تحفظ موضع المتابعة.' : 'Percentage of completed lessons; partial viewing saves your resume position.'}</p>
        <div className="mt-4">
          <label htmlFor="course-plan-search" className="mb-2 block text-sm font-semibold">
            {ar ? 'بحث في دروس الكورس' : 'Search course lessons'}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="course-plan-search"
              data-testid="course-plan-search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={ar ? 'ابحث بعنوان الدرس أو القسم…' : 'Search lesson or section titles…'}
              className="min-h-[44px] w-full rounded-control border border-border bg-canvas px-3 py-2 text-sm text-ink"
            />
            {filtering ? (
              <button
                type="button"
                data-testid="course-plan-search-clear"
                onClick={clearSearch}
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-control border border-border px-3 text-sm font-semibold"
              >
                {ar ? 'مسح البحث' : 'Clear search'}
              </button>
            ) : null}
          </div>
          <p data-testid="course-plan-search-count" role="status" aria-live="polite" className="mt-2 text-sm text-muted">
            {filtering
              ? ar
                ? `${filtered.matchCount} نتيجة بحث`
                : `${filtered.matchCount} search results`
              : ar
                ? `${lessons.length} درس`
                : `${lessons.length} lessons`}
          </p>
        </div>
        <p className="mt-3 text-sm text-muted">{ar ? 'اختر درسًا لبدء المشاهدة. اجتز التقييمات المطلوبة لفتح الدروس التالية.' : 'Choose a lesson to watch. Pass required assessments to unlock the following lessons.'}</p>
      </div>
      <div className="course-plan__sections mt-3">
        {filtering && filtered.sections.length === 0 ? (
          <p data-testid="course-plan-search-empty" role="status" className="rounded-card border border-border bg-surface p-4 text-sm text-muted">
            {ar ? 'لا توجد دروس مطابقة لبحثك.' : 'No lessons match your search.'}
          </p>
        ) : (
          <CourseOutline
            sections={filtering ? filtered.sections : sections}
            selectedLessonId={selectedLessonId}
            onSelect={onSelect}
            labels={labels}
            lang={lang}
            disabled={disabled}
            expanded={expanded}
            onToggleSection={(sectionId, open) => {
              if (filtering) return;
              setUserExpanded((prev) => ({ ...(prev ?? {}), [sectionId]: open }));
            }}
          />
        )}
      </div>
    </nav>
  );
}
