/** Small presentational pieces shared by the learning pages (M5). */
import type { ReactNode } from 'react';
import { FormActions } from '../../../components/ui/FormActions';
import { StatusBadge } from '../../../components/ui/Dialog';
import { BrandMark } from '../../../components/ui/BrandMark';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { formatDuration, formatDurationTotal, sumDurations } from '../materials/duration';
import type { DashboardSubscription, OutlineSection } from '../types/models';

export interface LearningLabels {
  active: string;
  expired: string;
  continueLearning: string;
  renew: string;
  expiresOn: string;
  progress: string;
  completed: string;
  notStarted: string;
  resume: string;
  lessonCount: string;
  emptyActive: string;
  emptyExpired: string;
  noSubscription: string;
  browseCourses: string;
}

export function SubscriptionCard({
  item,
  labels,
  onContinue,
  onRenew,
  lang,
}: {
  item: DashboardSubscription;
  labels: LearningLabels;
  onContinue?: (courseRef: string) => void;
  onRenew?: (courseRef: string) => void;
  lang: 'ar' | 'en';
}): JSX.Element {
  const title = lang === 'ar' ? item.titleAr : item.titleEn;
  const isActive = item.state === 'ACTIVE';
  return (
    <li
      data-testid={`subscription-${item.state.toLowerCase()}`}
      className="rounded-card border border-border bg-surface p-4 shadow-rest"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{title}</h3>
          <p className="mt-1 text-sm text-muted">
            {item.expiresAt
              ? `${labels.expiresOn} ${formatDate(item.expiresAt, lang)} (${lang === 'ar' ? 'القاهرة' : 'Cairo'})`
              : lang === 'ar'
                ? 'بدون انتهاء، حتى الحذف النهائي'
                : 'No expiry, until permanent removal'}
          </p>
        </div>
        <StatusBadge
          text={isActive ? labels.active : labels.expired}
          tone={isActive ? 'success' : 'error'}
        />
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{labels.progress}</span>
          <span>{item.percentComplete}%</span>
        </div>
        <ProgressBar value={item.percentComplete} label={`${title} — ${labels.progress}`} className="mt-1" />
        <p className="mt-1 text-xs text-muted">
          {labels.lessonCount}: {item.completedLessons}/{item.totalLessons}
        </p>
      </div>
      <FormActions className="mt-4">
        {isActive && item.availableForLearning === false ? (
          <p className="w-full text-sm text-muted">
            {lang === 'ar'
              ? 'المشاهدة غير متاحة حاليًا؛ ستظهر بعد نشر الكورس.'
              : 'Viewing is currently unavailable; it opens when the course is published.'}
          </p>
        ) : null}
        {isActive && item.availableForLearning !== false && onContinue ? (
          <button
            type="button"
            className="min-h-[44px] rounded-control bg-primary px-4 py-2 font-bold text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            onClick={() => onContinue(item.slug)}
          >
            {item.lastLessonId ? labels.resume : labels.continueLearning}
                    </button>
        ) : null}
        {!isActive && onRenew ? (
          <button
            type="button"
            className="min-h-[44px] rounded-control border border-primary px-4 py-2 font-bold text-primary-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            onClick={() => onRenew(item.slug)}
          >
            {labels.renew}
          </button>
        ) : null}
      </FormActions>
    </li>
  );
}

export function CourseOutline({
  sections,
  selectedLessonId,
  onSelect,
  labels,
  lang,
  disabled,
  expanded,
  onToggleSection,
}: {
  sections: OutlineSection[];
  selectedLessonId: string | null;
  onSelect: (lessonId: string) => void;
  labels: LearningLabels;
  lang: 'ar' | 'en';
  disabled?: boolean;
  expanded?: Record<string, boolean>;
  onToggleSection?: (sectionId: string, open: boolean) => void;
}): JSX.Element {
  return (
    <div className="space-y-4" data-testid="course-outline">
      {sections.length === 0 ? <p className="text-muted">{labels.notStarted}</p> : null}
      {sections.map((section) => {
        const controlled = expanded?.[section.sectionId];
        const open = controlled ?? true;
        const sectionTotal = sumDurations(section.lessons.map((l) => l.durationSeconds));
        return (
        <details
          key={section.sectionId}
          open={open}
          onToggle={(e) => onToggleSection?.(section.sectionId, (e.target as HTMLDetailsElement).open)}
          className="rounded-card border border-border bg-surface p-4"
        >
          <summary className="min-h-[44px] cursor-pointer rounded-control py-2 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            {lang === 'ar' ? section.titleAr : section.titleEn}
            <span className="ms-2 text-xs font-medium text-muted">{section.lessons.filter(l => l.completed).length}/{section.lessons.length} {labels.completed}</span>
            <span data-testid="section-duration" dir="ltr" className="ms-2 text-xs font-medium text-muted">{formatDurationTotal(sectionTotal, lang)}</span>
          </summary>
          <ol className="mt-2 space-y-1">
            {section.lessons.map((lesson) => {
              const selected = lesson.lessonId === selectedLessonId;
              const state = lesson.completed
                ? 'completed'
                : lesson.resumePositionSeconds > 0
                  ? 'current'
                  : 'not-started';
              const durationLabel = formatDuration(lesson.durationSeconds ?? null);
              return (
                <li key={lesson.lessonId}>
                  <button
                    type="button"
                    data-testid="lesson-row"
                    data-lesson-state={state}
                    data-playable={lesson.playable ? 'true' : 'false'}
                    aria-current={selected ? 'true' : undefined}
                    disabled={disabled === true || !lesson.playable} aria-describedby={`lesson-status-${lesson.lessonId}`}
                    onClick={() => onSelect(lesson.lessonId)}
                    className={`flex min-h-[64px] w-full items-center gap-3 rounded-control border px-3 py-3 text-start text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${
                      selected
                        ? 'border-primary bg-elevated text-ink'
                        : 'border-border bg-canvas text-ink'
                    } ${lesson.playable ? '' : 'opacity-60'}`}
                  >
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-base">{lesson.locked ? '↳' : lesson.completed ? '✓' : selected ? '▶' : lesson.position}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-semibold">{lang === 'ar' ? lesson.titleAr : lesson.titleEn}</span>
                      <span id={`lesson-status-${lesson.lessonId}`} className="mt-1 block text-xs text-muted">
                      {disabled ? lang === 'ar' ? 'انتظر اكتمال طلب المشاهدة.' : 'Wait for the playback request to finish.' : lesson.locked ? lang === 'ar' ? 'اجتز التقييمات المطلوبة' : 'Pass required assessments' : !lesson.playable ? lang === 'ar' ? 'الفيديو غير متاح حاليًا' : 'Video currently unavailable' : state === 'completed'
                        ? labels.completed
                        : state === 'current'
                          ? labels.resume
                          : labels.notStarted}
                      </span>
                      <span data-testid="lesson-duration" dir="ltr" className="mt-1 block text-xs text-muted">
                        {durationLabel ?? (lang === 'ar' ? 'المدة غير معروفة' : 'Duration unknown')}
                      </span>
                    </span>
                    </button>
                    {lesson.locked && !disabled ? <ul className="mt-2 space-y-1">{lesson.blockingAssessmentIds?.map((id,i)=><li key={id}><a href={`#/assessment/${id}`} className="inline-block min-h-[44px] px-3 py-2 text-sm font-semibold underline">{lang==='ar'?'حل التقييم المطلوب لفتح الدرس':'Solve the required assessment to unlock this lesson'} {i+1}</a></li>)}</ul>:null}
                </li>
              );
            })}
          </ol>
        </details>
        );
      })}
    </div>
  );
}

export function RenewalRequired({
  message,
  action,
  actionLabel,
}: {
  message: string;
  action?: () => void;
  actionLabel?: string;
}): JSX.Element {
  return (
    <div
      data-testid="renewal-required"
      className="rounded-card border border-error-fg bg-error-bg p-4 text-error-fg"
    >
      <p className="font-bold">{message}</p>
      {action && actionLabel ? (
        <button
          type="button"
          className="mt-3 min-h-[44px] rounded-control border border-error-fg px-4 py-2 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          onClick={action}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }): JSX.Element {
  return (
    <div
      data-testid="learning-loading"
      className="rounded-card border border-border bg-surface p-6"
      aria-live="polite"
    >
      <BrandMark size="sm" withSlogan={false} />
      <p className="mt-2 text-muted">{label}</p>
    </div>
  );
}

export function SignInRequired({ lang }: { lang: 'ar' | 'en' }): JSX.Element {
  return <>
    <ErrorBlock message={lang === 'ar' ? 'انتهت جلسة الدخول. سجل الدخول مجددًا لمتابعة التعلّم.' : 'Your sign-in session has ended. Sign in again to continue learning.'} />
    <a href="#/login" className="mt-4 inline-flex min-h-[44px] items-center rounded-control bg-primary px-4 py-2 font-bold text-canvas">
      {lang === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
    </a>
  </>;
}

export function ErrorBlock({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div
      data-testid="learning-error"
      className="rounded-card border border-error-fg bg-error-bg p-6"
      role="alert"
    >
      <BrandMark size="sm" withSlogan={false} />
      <p className="mt-2 font-bold text-error-fg">{message}</p>
      {onRetry && retryLabel ? (
        <button
          type="button"
          className="mt-3 min-h-[44px] rounded-control border border-error-fg px-4 py-2 font-bold text-error-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function formatDate(value: string, lang: 'ar' | 'en'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Cairo',
  }).format(date);
}

export function SectionHeading({ children }: { children: ReactNode }): JSX.Element {
  return <h2 className="mb-3 text-xl font-bold">{children}</h2>;
}
