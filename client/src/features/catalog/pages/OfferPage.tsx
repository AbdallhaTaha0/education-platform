import { usePublicData } from '../../../seo/publicData';
import { publicHref } from '../../../seo/paths';
import { useEffect, useState } from 'react';
import { ApiError, apiFetch, useAuth } from '../../../auth';
import { fetchMySubscriptions } from '../../purchase/api/client';
import { localizeCode, useLang } from '../../../i18n';
import { Card, Container } from '../../../components/ui/Card';
import { Loading, Notice } from '../../../components/ui/Notice';
import { PriceDisplay } from '../components/PriceDisplay';
import type { PublicCourse } from '../types/models';
import { CoursePlan } from '../../learning/components/CoursePlan';
import { useOutline } from '../../learning/hooks/useLearning';
import { ErrorBlock } from '../../learning/components/Learning';
import { CourseCover } from '../components/CourseCover';
import { gradeLabel } from '../../academic/model';

export function OfferPage({ slug }: { slug: string; onBack: () => void }): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const seed = usePublicData()?.course;
  const initial = seed?.slug === slug ? seed : undefined;
  const [loading, setLoading] = useState(initial === undefined);
  const [course, setCourse] = useState<PublicCourse | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [owned, setOwned] = useState(false);

  useEffect(() => {
    let live = true;
    setOwned(false);
    if (user?.role === 'STUDENT' && course) {
      void fetchMySubscriptions()
        .then((rows) => {
          if (live) {
            setOwned(
              rows.some(
                (s) => s.courseId === course.id && (!s.expiresAt || Date.parse(s.expiresAt) > Date.now()),
              ),
            );
          }
        })
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [user?.id, course?.id]);

  useEffect(() => {
    if (initial !== undefined) {
      setCourse(initial);
      setLoading(false);
      return;
    }
    let live = true;
    (async () => {
      setLoading(true);
      setError(null);
      setCourse(null);
      try {
        const body = await apiFetch<{ data: { course: PublicCourse } }>(
          `/catalog/courses/${encodeURIComponent(slug)}`,
          { retryOnAuth: false },
        );
        if (live) setCourse(body.data.course);
      } catch (err) {
        if (live) setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [slug, initial]);

  const title = course ? (ar ? course.titleAr : course.titleEn) : '';

  return (
    <main id="main">
      <section className="py-7 md:py-10">
        <Container>
          <nav
            aria-label={ar ? 'مسار الصفحة' : 'Breadcrumb'}
            className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted"
          >
            <a href={publicHref('#/courses', lang)} className="footer-discovery hover:text-primary-strong">
              {t.courseDetailBack}
            </a>
            {course ? (
              <span aria-current="page" className="font-semibold text-ink">
                / {title}
              </span>
            ) : null}
          </nav>

          {loading ? <Loading text={t.loading} /> : null}
          {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}

          {course !== null ? (
            <div className="grid items-start gap-7 lg:grid-cols-[1.35fr_0.85fr] lg:gap-8">
              <div className="min-w-0 space-y-6">
                <Card className="rounded-2xl border-border bg-surface !p-5 text-start sm:!p-6">
                  <div className="relative overflow-hidden rounded-xl">
                    <CourseCover path={course.coverUrl} title={title} />
                    {course.academic?.grade ? (
                      <span className="pointer-events-none absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-canvas/95 px-3 py-1 text-xs font-bold text-ink shadow-rest backdrop-blur-md">
                        {gradeLabel(course.academic.grade, lang)}
                        {course.academic.term
                          ? ` · ${ar ? 'ترم' : 'Term'} ${course.academic.term}`
                          : ''}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-5 space-y-3.5">
                    {course.subject || course.teacher ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {course.subject ? (
                          <span className="inline-flex items-center rounded-full border border-primary/35 bg-primary/15 px-3 py-1 text-xs font-bold text-primary-strong">
                            {ar ? course.subject.nameAr : course.subject.nameEn}
                          </span>
                        ) : null}
                        {course.teacher ? (
                          <span className="inline-flex items-center rounded-full border border-border bg-elevated px-3 py-1 text-xs font-semibold text-ink">
                            {ar ? course.teacher.nameAr : course.teacher.nameEn}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <h1 className="text-balance text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
                      {title}
                    </h1>
                    <p className="max-w-[65ch] text-pretty text-base leading-relaxed text-muted">
                      {ar ? course.descriptionAr : course.descriptionEn}
                    </p>
                    {course.teacher && (ar ? course.teacher.bioAr : course.teacher.bioEn) ? (
                      <div className="rounded-xl border border-border bg-elevated/60 px-4 py-3.5 text-sm leading-relaxed text-muted">
                        <strong className="mb-1 block text-ink">{t.teacherBio}</strong>
                        {ar ? course.teacher.bioAr : course.teacher.bioEn}
                      </div>
                    ) : null}
                  </div>
                </Card>

                {owned ? <OwnedCurriculum key={course.id} slug={course.slug} /> : null}
              </div>

              <aside className="min-w-0 lg:sticky lg:top-24">
                <Card className="rounded-2xl border-border-strong bg-surface !p-5 text-start shadow-lift tabular-nums sm:!p-6">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-primary-strong">
                    {owned
                      ? ar
                        ? 'اشتراكك سارٍ'
                        : 'Active subscription'
                      : ar
                        ? 'تفاصيل الاشتراك'
                        : 'Enrollment details'}
                  </p>
                  {owned ? (
                    <div className="mt-4 space-y-4">
                      <p className="text-sm leading-relaxed text-muted">
                        {ar
                          ? 'أنت مشترك في هذا الكورس بالفعل. يمكنك متابعة المشاهدة مباشرة أو اختيار درس من الخطة.'
                          : 'You are subscribed to this course. Jump back into playback or pick a lesson from the plan.'}
                      </p>
                      <a
                        href={`#/learn/${encodeURIComponent(course.slug)}`}
                        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary px-6 py-3 text-base font-extrabold text-primary-ink no-underline shadow-rest transition-colors hover:bg-primary-hover"
                      >
                        {ar ? 'تابع التعلم' : 'Continue learning'}
                      </a>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {course.plans.map((p) => (
                        <div
                          key={p.id}
                          className="space-y-4 rounded-xl border border-border bg-field/80 p-4"
                        >
                          <PriceDisplay
                            current={p.currentPricePiastres}
                            previous={p.previousPricePiastres}
                            durationDays={p.durationDays}
                            accessMode={p.accessMode}
                            accessEndsAt={p.accessEndsAt}
                          />
                          <a
                            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-base font-extrabold text-primary-ink no-underline shadow-rest transition-colors hover:bg-primary-hover"
                            href={`#/purchase/${encodeURIComponent(p.id)}`}
                          >
                            {t.subscribeAction}
                          </a>
                        </div>
                      ))}
                      <p className="text-xs leading-relaxed text-muted sm:text-sm">
                        {ar
                          ? 'بعد الاشتراك ستجد الدروس المسجلة والاختبارات داخل مساحة التعلم الخاصة بك.'
                          : 'After subscribing, you can open the recorded lessons and quizzes in your learning space.'}
                      </p>
                    </div>
                  )}
                </Card>
              </aside>
            </div>
          ) : null}
        </Container>
      </section>
    </main>
  );
}

/** The outline is fetched only for a subscribed student; the API enforces access. */
function OwnedCurriculum({ slug }: { slug: string }): JSX.Element {
  const { t, lang } = useLang();
  const { data, loading, errorCode, reload } = useOutline(slug);
  if (loading) return <Loading text={t.loading} />;
  if (errorCode || !data) {
    return (
      <ErrorBlock
        message={
          lang === 'ar'
            ? 'تعذّر تحميل خطة الكورس. تحقق من الاشتراك وحاول مرة أخرى.'
            : 'Could not load the course plan. Check your subscription and try again.'
        }
        retryLabel={t.retry}
        onRetry={reload}
      />
    );
  }
  return (
    <CoursePlan
      sections={data.sections}
      selectedLessonId={null}
      onSelect={(id) => {
        window.location.hash = `#/learn/${encodeURIComponent(slug)}?lesson=${encodeURIComponent(id)}`;
      }}
    />
  );
}
