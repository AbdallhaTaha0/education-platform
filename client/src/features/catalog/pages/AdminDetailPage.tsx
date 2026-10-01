import { useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Container } from '../../../components/ui/Card';
import { Loading, Notice } from '../../../components/ui/Notice';
import { useAdminCourse } from '../hooks/useAdminCourse';
import { patchAdminCourse, syncCourseMedia } from '../api/client';
import { CourseForm, type CourseFormValues } from './CourseForm';
import { PlanEditor } from './PlanEditor';
import { SectionEditor } from './SectionEditor';
import { LessonList } from './LessonEditor';
import { LifecycleControls } from './LifecycleControls';
import { ArchiveControls } from './ArchiveControls';
import { DeletionPanel } from './DeletionPanel';

export function AdminDetailPage({ courseId }: { courseId: string }): JSX.Element {
  const { t, lang } = useLang();
  const { loading, course, error, reload } = useAdminCourse(courseId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (loading) {
    return (
      <Container>
        <Loading text={t.loading} />
      </Container>
    );
  }
  if (error !== null && course === null) {
    return (
      <Container>
        <Notice kind="error">{localizeCode(t, error)}</Notice>
      </Container>
    );
  }
  if (course === null) {
    return (
      <Container>
        <Notice kind="info">{t.empty}</Notice>
      </Container>
    );
  }

  async function saveCourse(values: CourseFormValues): Promise<void> {
    setSaving(true);
    setSaveError(null);
    try {
      await patchAdminCourse(courseId, values);
      await reload();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setSaving(false);
    }
  }

  async function syncAll(): Promise<void> {
    await syncCourseMedia(courseId);
    await reload();
  }

  return (
    <main id="main">
      <section className="py-8">
        <Container>
          <h1 className="text-3xl font-bold">{lang === 'ar' ? course.titleAr : course.titleEn}</h1>
          <p className="text-muted" dir="ltr">
            {course.slug} — {course.status}
          </p>
          {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
          {saveError !== null ? <Notice kind="error">{localizeCode(t, saveError)}</Notice> : null}
          {course.deletionRequestedAt !== null ? <Notice kind="pending">{t.deleteProgress}</Notice> : null}

          <CourseForm
            busy={saving}
            key={course.id}
            initial={{ slug: course.slug, titleAr: course.titleAr, titleEn: course.titleEn, descriptionAr: course.descriptionAr, descriptionEn: course.descriptionEn, academic: course.grade ? { grade: course.grade, academicYear: course.academicYear ?? null, term: course.term ?? null, courseKind: course.courseKind ?? null, teachingMonth: course.teachingMonth ?? null } : null }}
            onSubmit={(v) => void saveCourse(v)}
          />

          <LifecycleControls courseId={courseId} status={course.status} onChanged={reload} />
          <ArchiveControls courseId={courseId} archived={course.status === 'ARCHIVED'} onChanged={reload} />

          <PlanEditor courseId={courseId} plans={course.plans} onChanged={reload} />
          <SectionEditor courseId={courseId} sections={course.sections} onChanged={reload} />

          {course.sections.map((s) => (
            <div key={s.id} className="mt-4 rounded-card border border-border bg-surface p-6 shadow-rest">
              <h3 className="text-xl font-bold">
                #{s.position} {lang === 'ar' ? s.titleAr : s.titleEn}
              </h3>
              <LessonList sectionId={s.id} lessons={s.lessons} onChanged={reload} />
              <DeletionPanel kind="sections" targetId={s.id} expectedConfirmation={s.id} onChanged={reload} />
              {s.lessons.map((l) => (
                <DeletionPanel key={l.id} kind="lessons" targetId={l.id} expectedConfirmation={l.id} onChanged={reload} />
              ))}
            </div>
          ))}

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="hidden" aria-hidden="true" onClick={() => void syncAll()} data-testid="sync-all" />
          </div>
          <DeletionPanel kind="courses" targetId={course.id} expectedConfirmation={course.slug} onChanged={reload} />
        </Container>
      </section>
    </main>
  );
}
