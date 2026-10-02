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
import { Button } from '../../../components/ui/Button';
import { businessState } from '../../../components/ui/AdminNavigation';
import { useConfirmNavigation } from '../../../components/ui/UnsavedChanges';

export function AdminDetailPage({ courseId }: { courseId: string }): JSX.Element {
  const { t, lang } = useLang();
  const { loading, course, error, reload } = useAdminCourse(courseId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState('outline');
  const confirmLeave = useConfirmNavigation();

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

  async function saveCourse(values: CourseFormValues): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    try {
      await patchAdminCourse(courseId, values);
      await reload();
      return true;
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
      return false;
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
            {course.slug} — {businessState(course.status, lang === 'ar')}
          </p>
          {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
          {saveError !== null ? <Notice kind="error">{localizeCode(t, saveError)}</Notice> : null}
          {course.deletionRequestedAt !== null ? (
            <Notice kind="pending">{t.deleteProgress}</Notice>
          ) : null}

          <nav aria-label={lang === 'ar' ? 'أقسام إدارة الكورس' : 'Course workspace'} className="my-6 flex flex-wrap gap-2" data-testid="course-workspace-tabs">
            {['outline','details','access','publish'].map((id,i) => <Button key={id} variant={workspace===id?'primary':'secondary'} aria-pressed={workspace===id} onClick={() => { if (workspace !== id && confirmLeave()) {setWorkspace(id);setSaveError(null);} }}>{(lang==='ar'?['الدروس والفيديو','بيانات الكورس','الأسعار والوصول','النشر والإجراءات']:['Lessons and video','Course details','Pricing and access','Publishing and actions'])[i]}</Button>)}
          </nav>
          {workspace === 'details' ? <CourseForm
            busy={saving}
            key={course.id}
            initial={{
              slug: course.slug,
              titleAr: course.titleAr,
              titleEn: course.titleEn,
              descriptionAr: course.descriptionAr,
              descriptionEn: course.descriptionEn,
              academic: course.grade
                ? {
                    grade: course.grade,
                    academicYear: course.academicYear ?? null,
                    term: course.term ?? null,
                    courseKind: course.courseKind ?? null,
                    teachingMonth: course.teachingMonth ?? null,
                  }
                : null,
            }}
            onSubmit={saveCourse}
          /> : null}

          {workspace === 'publish' ? <>
          <h2 className="text-xl font-bold">{lang==='ar'?'جاهزية النشر':'Publication readiness'}</h2>
          <ul className="my-4 space-y-2" data-testid="course-readiness">{[
            [!!(course.titleAr.trim() && course.titleEn.trim() && course.descriptionAr.trim() && course.descriptionEn.trim()),lang==='ar'?'عنوان ووصف باللغتين':'Titles and descriptions in both languages'],
            [course.plans.length>0,lang==='ar'?'عرض سعر ووصول واحد على الأقل':'At least one price/access offer'],
            [course.sections.length>0 && course.sections.some(s=>s.lessons.length>0),lang==='ar'?'قسم ودروس':'Sections and lessons'],
            [course.sections.every(s=>s.titleAr.trim() && s.titleEn.trim() && s.lessons.every(l=>l.titleAr.trim() && l.titleEn.trim())),lang==='ar'?'أسماء الأقسام والدروس باللغتين':'Bilingual section and lesson names'],
            [course.sections.some(s=>s.lessons.length>0) && course.sections.every(s=>s.lessons.every(l=>l.media?.status==='READY' && l.media.assetId)),lang==='ar'?'كل فيديو جاهز للمشاهدة':'Every video ready for playback'],
          ].map(([ok,label],i)=><li key={i}>{ok?'✓':'○'} {label} — {ok?(lang==='ar'?'مكتمل':'Complete'):(lang==='ar'?'يحتاج إكمال':'Needs attention')}</li>)}</ul>
          <p className="text-sm text-muted">{lang==='ar'?'توضح القائمة ما يحتاج إكمالًا؛ يتحقق الخادم من الشروط عند كل انتقال.':'This checklist explains what needs attention. The server verifies every transition.'}</p>
          <LifecycleControls courseId={courseId} status={course.status} onChanged={reload} />
          <ArchiveControls
            courseId={courseId}
            archived={course.status === 'ARCHIVED'}
            onChanged={reload}
          />
          <DeletionPanel kind="courses" targetId={course.id} entityName={lang==='ar'?course.titleAr:course.titleEn} expectedConfirmation={course.slug} onChanged={reload} />
          </> : null}

          {workspace === 'access' ? <PlanEditor courseId={courseId} plans={course.plans} onChanged={reload} /> : null}
          {workspace === 'outline' ? <>
          <SectionEditor courseId={courseId} sections={course.sections} onChanged={reload} />

          {course.sections.map((s) => (
            <div
              key={s.id}
              className="mt-4 rounded-card border border-border bg-surface p-6 shadow-rest"
            >
              <h3 className="text-xl font-bold">
                #{s.position} {lang === 'ar' ? s.titleAr : s.titleEn}
              </h3>
              <LessonList sectionId={s.id} lessons={s.lessons} onChanged={reload} />
              <DeletionPanel
                kind="sections"
                targetId={s.id}
                expectedConfirmation={s.id}
                entityName={lang==='ar'?s.titleAr:s.titleEn}
                onChanged={reload}
              />
            </div>
          ))}
          </> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="hidden"
              aria-hidden="true"
              onClick={() => void syncAll()}
              data-testid="sync-all"
            />
          </div>
        </Container>
      </section>
    </main>
  );
}
