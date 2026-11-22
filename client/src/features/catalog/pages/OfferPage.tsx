import { usePublicData } from '../../../seo/publicData';
import { publicHref } from '../../../seo/paths';
import { useEffect, useState } from 'react';
import { ApiError, apiFetch, useAuth } from '../../../auth';
import { fetchMySubscriptions } from '../../purchase/api/client';
import { localizeCode, useLang } from '../../../i18n';
import { FormActions } from '../../../components/ui/FormActions';
import { Card, Container } from '../../../components/ui/Card';
import { Loading, Notice } from '../../../components/ui/Notice';
import { PriceDisplay } from '../components/PriceDisplay';
import type { PublicCourse } from '../types/models';
import { CoursePlan } from '../../learning/components/CoursePlan';
import { useOutline } from '../../learning/hooks/useLearning';
import { ErrorBlock } from '../../learning/components/Learning';
import { CourseCover } from '../components/CourseCover';

export function OfferPage({ slug }: { slug: string; onBack: () => void }): JSX.Element {
  const { t, lang } = useLang();
  const seed = usePublicData()?.course;
  const initial = seed?.slug === slug ? seed : undefined;
  const [loading, setLoading] = useState(initial === undefined);
  const [course, setCourse] = useState<PublicCourse | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const {user}=useAuth(); const [owned,setOwned]=useState(false);
  useEffect(()=>{let live=true;setOwned(false); if(user?.role==='STUDENT' && course) void fetchMySubscriptions().then(rows=>{if(live)setOwned(rows.some(s=>s.courseId===course.id && (!s.expiresAt || Date.parse(s.expiresAt)>Date.now())));}).catch(()=>undefined);return()=>{live=false;};},[user?.id,course?.id]);

  useEffect(() => {
    if (initial !== undefined) { setCourse(initial); setLoading(false); return; }
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

  return (
    <main id="main">
      <section className="py-8">
        <Container>
          <FormActions className="mt-0">
            <nav aria-label={lang === "ar" ? "مسار الصفحة" : "Breadcrumb"} className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <a href={publicHref("#/courses", lang)} className="footer-discovery hover:text-primary-strong">{t.courseDetailBack}</a>
              {course ? <span aria-current="page" className="text-ink">/ {lang === "ar" ? course.titleAr : course.titleEn}</span> : null}
            </nav>
          </FormActions>
          {loading ? <Loading text={t.loading} /> : null}
          {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
          {course !== null ? (
            <Card className="mx-auto mt-5 max-w-[820px] rounded-2xl border-border bg-surface !p-5 sm:!p-6">
              <div className="overflow-hidden rounded-xl">
                <CourseCover path={course.coverUrl} title={lang === 'ar' ? course.titleAr : course.titleEn} />
              </div>
              <div className="mt-5 space-y-3">
                {(course.subject || course.teacher) ? (
                  <p className="text-sm font-semibold text-primary-strong">
                    {[
                      course.subject ? (lang === 'ar' ? course.subject.nameAr : course.subject.nameEn) : null,
                      course.teacher ? (lang === 'ar' ? course.teacher.nameAr : course.teacher.nameEn) : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
                <h1 className="text-balance text-3xl font-extrabold leading-tight text-ink">
                  {lang === 'ar' ? course.titleAr : course.titleEn}
                </h1>
                <p className="max-w-[65ch] text-pretty leading-relaxed text-muted">
                  {lang === 'ar' ? course.descriptionAr : course.descriptionEn}
                </p>
                {course.teacher && (lang === 'ar' ? course.teacher.bioAr : course.teacher.bioEn) ? (
                  <p className="rounded-xl border border-border bg-elevated/50 px-4 py-3 text-sm leading-relaxed text-muted">
                    <strong className="text-ink">{t.teacherBio}: </strong>
                    {lang === 'ar' ? course.teacher.bioAr : course.teacher.bioEn}
                  </p>
                ) : null}
              </div>
              <div className="mt-6 border-t border-border/60 pt-5 tabular-nums">
                {owned ? (
                  <a href={`#/learn/${encodeURIComponent(course.slug)}`} className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 font-extrabold text-primary-ink transition-colors hover:bg-primary-hover">
                    {lang === 'ar' ? 'تابع التعلم' : 'Continue learning'}
                  </a>
                ) : (
                  <div className="space-y-3">
                    {course.plans.map((p) => (
                      <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-elevated/40 p-4">
                        <PriceDisplay
                          current={p.currentPricePiastres}
                          previous={p.previousPricePiastres}
                          durationDays={p.durationDays}
                          accessMode={p.accessMode}
                          accessEndsAt={p.accessEndsAt}
                        />
                        <a
                          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-6 font-bold text-primary-ink no-underline transition-colors hover:bg-primary-hover"
                          href={`#/purchase/${encodeURIComponent(p.id)}`}
                        >
                          {t.subscribeAction}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                {!owned ? (
                  <p className="mt-4 text-sm text-muted">
                    {lang === 'ar'
                      ? 'بعد الاشتراك ستجد الدروس المسجلة وتمارين البرمجة داخل مساحة التعلم الخاصة بك.'
                      : 'After subscribing, you can open the recorded lessons and programming exercises in your learning space.'}
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}
          {course !== null && owned ? <div className="mx-auto mt-6 max-w-[800px]"><OwnedCurriculum key={course.id} slug={course.slug} /></div> : null}
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
  if (errorCode || !data) return <ErrorBlock message={lang === 'ar' ? 'تعذّر تحميل خطة الكورس. تحقق من الاشتراك وحاول مرة أخرى.' : 'Could not load the course plan. Check your subscription and try again.'} retryLabel={t.retry} onRetry={reload} />;
  return <CoursePlan sections={data.sections} selectedLessonId={null} onSelect={id => { window.location.hash = `#/learn/${encodeURIComponent(slug)}?lesson=${encodeURIComponent(id)}`; }} />;
}
