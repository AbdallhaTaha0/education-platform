import { useEffect, useState } from 'react';
import { ApiError, apiFetch, useAuth } from '../../../auth';
import { fetchMySubscriptions } from '../../purchase/api/client';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Card, Container } from '../../../components/ui/Card';
import { Loading, Notice } from '../../../components/ui/Notice';
import { PriceDisplay } from '../components/PriceDisplay';
import type { PublicCourse } from '../types/models';
import { CoursePlan } from '../../learning/components/CoursePlan';
import { useOutline } from '../../learning/hooks/useLearning';
import { ErrorBlock } from '../../learning/components/Learning';

export function OfferPage({ slug, onBack }: { slug: string; onBack: () => void }): JSX.Element {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<PublicCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {user}=useAuth(); const [owned,setOwned]=useState(false);
  useEffect(()=>{let live=true;setOwned(false); if(user?.role==='STUDENT' && course) void fetchMySubscriptions().then(rows=>{if(live)setOwned(rows.some(s=>s.courseId===course.id && (!s.expiresAt || Date.parse(s.expiresAt)>Date.now())));}).catch(()=>undefined);return()=>{live=false;};},[user?.id,course?.id]);

  useEffect(() => {
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
  }, [slug]);

  return (
    <main id="main">
      <section className="py-8">
        <Container>
          <FormActions className="mt-0">
            <Button variant="secondary" onClick={onBack}>
              {t.courseDetailBack}
            </Button>
          </FormActions>
          {loading ? <Loading text={t.loading} /> : null}
          {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
          {course !== null ? (
            <Card className="mx-auto mt-4 max-w-[800px]">
              <h1 className="text-3xl font-bold">
                {lang === 'ar' ? course.titleAr : course.titleEn}
              </h1>
              <p className="mt-2">{lang === 'ar' ? course.descriptionAr : course.descriptionEn}</p>
              {owned ? <a href={`#/learn/${encodeURIComponent(course.slug)}`} className="my-4 inline-flex min-h-[44px] items-center rounded-control bg-primary px-5 py-3 font-bold text-primary-ink">{lang==='ar'?'تابع التعلم':'Continue learning'}</a> : course.plans.map((p) => (
                <div key={p.id} className="mt-3 flex flex-wrap items-center gap-3">
                  <PriceDisplay
                    current={p.currentPricePiastres}
                    previous={p.previousPricePiastres}
                    durationDays={p.durationDays}
                    accessMode={p.accessMode}
                    accessEndsAt={p.accessEndsAt}
                  />
                  <a
                    className="inline-flex min-h-[44px] items-center justify-center rounded-control bg-primary px-6 font-semibold text-primary-ink no-underline hover:bg-primary-hover"
                    href={`#/purchase/${encodeURIComponent(p.id)}`}
                  >
                    {t.subscribeAction}
                  </a>
                </div>
              ))}
              {!owned ? <p className="mt-4 text-muted">
                {lang === 'ar'
                  ? 'بعد الاشتراك ستجد الدروس المسجلة وتمارين البرمجة داخل مساحة التعلم الخاصة بك.'
                  : 'After subscribing, you can open the recorded lessons and programming exercises in your learning space.'}
              </p> : null}
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
