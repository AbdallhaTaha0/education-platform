import { useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Container } from '../../../components/ui/Card';
import { Loading, Notice } from '../../../components/ui/Notice';
import { useAdminCourse } from '../hooks/useAdminCourse';
import { patchAdminCourse, syncCourseMedia } from '../api/client';
import { CourseForm, type CourseFormValues } from './CourseForm';
import { PlanEditor } from './PlanEditor';
import { CourseContentWorkspace } from './CourseContentWorkspace';
import { AdminCourseTabs } from '../components/AdminCourseTabs';
import { LifecycleControls } from './LifecycleControls';
import { ArchiveControls } from './ArchiveControls';
import { DeletionPanel } from './DeletionPanel';
import { businessState } from '../../../components/ui/AdminNavigation';
import { useConfirmNavigation } from '../../../components/ui/UnsavedChanges';
import { SectionTabs, SectionPanel, type SectionTab } from '../../../components/ui/SectionTabs';
import { lessonAdditionBlockCode, structuralBlockCode } from '../editability';
import { AdminCourseStudentsPanel } from '../../parent-reports/components/AdminCourseStudentsPanel';

const courseTabs: SectionTab[] = [
  {
    id: 'outline',
    ar: 'الأقسام والدروس',
    en: 'Sections & lessons',
    descriptionAr:
      'اختَر قسمًا ودرسًا لتعديل الفيديو أو الاسم. إضافة الأقسام والدروس وترتيبها لها أدوات مستقلة.',
    descriptionEn:
      'Choose a section and lesson to edit its video or title. Adding and ordering content has separate controls.',
  },
  {
    id: 'students',
    ar: 'طلاب الكورس وتقارير أولياء الأمور',
    en: 'Students & parent reports',
    descriptionAr:
      'تصفّح طلاب هذا الكورس وأعداد المشاهدة لأغراض المتابعة، ثم ولّد تقريرًا مؤقتًا لولي الأمر وافتح محادثة واتساب. التوليد يتم عند الضغط فقط.',
    descriptionEn:
      'Browse this course roster and tracking view counts, then generate a temporary parent report and open a WhatsApp chat. Generation happens only when you press the button.',
  },
  {
    id: 'assessments',
    ar: 'الاختبارات والواجبات',
    en: 'Assessments',
    descriptionAr:
      'اختَر القسم والدرس ثم أدر الاختبارات والواجبات وحلول الطلاب، دون ازدحام أدوات الفيديو.',
    descriptionEn:
      'Choose the section and lesson, then manage quizzes, assignments and submissions in a dedicated area.',
  },
  {
    id: 'materials',
    ar: 'ملفات الدروس',
    en: 'Lesson files',
    descriptionAr: 'اختَر درسًا لإرفاق الملفات أو إزالتها. الملفات متاحة للمشتركين فقط.',
    descriptionEn:
      'Choose a lesson to upload or remove files. Files are available only to entitled students.',
  },
  {
    id: 'details',
    ar: 'تعديل بيانات الكورس',
    en: 'Edit course details',
    descriptionAr: 'عدّل العنوان والوصف والتصنيف الدراسي باللغتين، ثم احفظ بيانات الكورس.',
    descriptionEn:
      'Edit bilingual titles, descriptions and academic classification, then save the course details.',
  },
  {
    id: 'access',
    ar: 'الأسعار ومدة الاشتراك',
    en: 'Prices & subscription access',
    descriptionAr: 'أضف أو عدّل عروض السعر ومدة أو نهاية الوصول. تغييرات كل عرض تُحفظ من نموذجه.',
    descriptionEn:
      'Add or edit price offers and access duration/deadline. Save each offer using its own form.',
  },
  {
    id: 'publish',
    ar: 'النشر والأرشفة والحذف',
    en: 'Publish, archive & delete',
    descriptionAr:
      'راجع جاهزية النشر. الأرشفة قابلة للتراجع؛ الحذف النهائي يزيل المحتوى عبر التأكيد المطلوب.',
    descriptionEn:
      'Review publication readiness. Archiving can be reversed; permanent deletion removes content through the required confirmation.',
  },
];

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

  const structuralBlock = structuralBlockCode(course);
  const structuralReason = structuralBlock ? localizeCode(t, structuralBlock) : undefined;
  const additionBlock = lessonAdditionBlockCode(course);
  const additionReason = additionBlock ? localizeCode(t, additionBlock) : undefined;

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
          <AdminCourseTabs
            current={course.revisionOwnerId ?? courseId}
            currentTitle={{ ar: course.titleAr, en: course.titleEn }}
          />
          <h1 className="text-3xl font-bold">{lang === 'ar' ? course.titleAr : course.titleEn}</h1>
          <p className="text-muted" dir="ltr">
            {course.slug} — {businessState(course.status, lang === 'ar')}
          </p>
          {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
          {course.revisionOwnerId ? (
            <Notice kind="info">
              {lang === 'ar'
                ? 'أنت تعدّل مسودة مستقلة. النسخة المنشورة ما زالت متاحة للطلاب حتى نشر هذه المسودة.'
                : 'You are editing a separate draft. Students keep the published version until you publish this draft.'}{' '}
              <a className="underline" href={`#/admin/courses/${course.revisionOwnerId}`}>
                {lang === 'ar' ? 'النسخة المنشورة' : 'Published version'}
              </a>
            </Notice>
          ) : course.workingCopyId ? (
            <Notice kind="info">
              {lang === 'ar'
                ? 'هذا هو الإصدار المنشور. تابع التعديل في المسودة.'
                : 'This is the published version. Continue editing in its draft.'}{' '}
              <a className="underline" href={`#/admin/courses/${course.workingCopyId}`}>
                {lang === 'ar' ? 'فتح المسودة' : 'Open draft'}
              </a>
            </Notice>
          ) : null}
          {saveError !== null ? <Notice kind="error">{localizeCode(t, saveError)}</Notice> : null}
          {course.deletionRequestedAt !== null ? (
            <Notice kind="pending">{t.deleteProgress}</Notice>
          ) : null}

          <SectionTabs
            tabs={courseTabs}
            value={workspace}
            prefix="course-workspace"
            label={lang === 'ar' ? 'أقسام إدارة الكورس' : 'Course workspace'}
            disabled={saving}
            onChange={(id) => {
              if (workspace === id) return true;
              if (!confirmLeave()) return false;
              setWorkspace(id);
              setSaveError(null);
              return true;
            }}
          />
          {courseTabs.map((tab) => (
            <SectionPanel
              key={tab.id}
              tab={tab}
              prefix="course-workspace"
              active={workspace === tab.id}
            >
              {workspace === tab.id ? (
                <>
                  {workspace === 'details' ? (
                    <CourseForm
                      busy={saving || !!course.workingCopyId}
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
                    />
                  ) : null}

                  {workspace === 'publish' ? (
                    <>
                      <h2 className="text-xl font-bold">
                        {lang === 'ar' ? 'جاهزية النشر' : 'Publication readiness'}
                      </h2>
                      <ul className="my-4 space-y-2" data-testid="course-readiness">
                        {[
                          [
                            !!(
                              course.titleAr.trim() &&
                              course.titleEn.trim() &&
                              course.descriptionAr.trim() &&
                              course.descriptionEn.trim()
                            ),
                            lang === 'ar'
                              ? 'عنوان ووصف باللغتين'
                              : 'Titles and descriptions in both languages',
                          ],
                          [
                            course.plans.length > 0,
                            lang === 'ar'
                              ? 'عرض سعر ووصول واحد على الأقل'
                              : 'At least one price/access offer',
                          ],
                          [
                            course.sections.length > 0 &&
                              course.sections.some((s) => s.lessons.length > 0),
                            lang === 'ar' ? 'قسم ودروس' : 'Sections and lessons',
                          ],
                          [
                            course.sections.every(
                              (s) =>
                                s.titleAr.trim() &&
                                s.titleEn.trim() &&
                                s.lessons.every((l) => l.titleAr.trim() && l.titleEn.trim()),
                            ),
                            lang === 'ar'
                              ? 'أسماء الأقسام والدروس باللغتين'
                              : 'Bilingual section and lesson names',
                          ],
                          [
                            course.sections.some((s) => s.lessons.length > 0) &&
                              course.sections.every((s) =>
                                s.lessons.every(
                                  (l) => l.media?.status === 'READY' && l.media.assetId,
                                ),
                              ),
                            lang === 'ar'
                              ? 'كل فيديو جاهز للمشاهدة'
                              : 'Every video ready for playback',
                          ],
                        ].map(([ok, label], i) => (
                          <li key={i}>
                            {ok ? '✓' : '○'} {label} —{' '}
                            {ok
                              ? lang === 'ar'
                                ? 'مكتمل'
                                : 'Complete'
                              : lang === 'ar'
                                ? 'يحتاج إكمال'
                                : 'Needs attention'}
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm text-muted">
                        {lang === 'ar'
                          ? 'توضح القائمة ما يحتاج إكمالًا؛ يتحقق الخادم من الشروط عند كل انتقال.'
                          : 'This checklist explains what needs attention. The server verifies every transition.'}
                      </p>
                      <LifecycleControls
                        courseId={courseId}
                        status={course.status}
                        onChanged={reload}
                      />
                      <ArchiveControls
                        courseId={courseId}
                        archived={course.status === 'ARCHIVED'}
                        onChanged={reload}
                      />
                      <DeletionPanel
                        kind="courses"
                        targetId={course.id}
                        entityName={lang === 'ar' ? course.titleAr : course.titleEn}
                        expectedConfirmation={course.slug}
                        onChanged={reload}
                      />
                    </>
                  ) : null}

                  {workspace === 'access' ? (
                    <fieldset disabled={!!course.workingCopyId}>
                      <PlanEditor courseId={courseId} plans={course.plans} onChanged={reload} />
                    </fieldset>
                  ) : null}
                  {workspace === 'outline' ? (
                    <>
                      {structuralReason ? <Notice kind="info">{structuralReason}</Notice> : null}
                      <CourseContentWorkspace
                        key={courseId}
                        course={course}
                        mode="video"
                        onChanged={reload}
                        blockedReason={structuralReason}
                        additionBlockedReason={additionReason}
                      />
                    </>
                  ) : null}
                  {workspace === 'assessments' && !course.workingCopyId ? (
                    <CourseContentWorkspace
                      key={courseId}
                      course={course}
                      mode="assessments"
                      onChanged={reload}
                      blockedReason={structuralReason}
                      additionBlockedReason={additionReason}
                    />
                  ) : null}
                  {workspace === 'materials' ? (
                    <CourseContentWorkspace
                      key={courseId}
                      course={course}
                      mode="materials"
                      onChanged={reload}
                      blockedReason={
                        course.workingCopyId
                          ? lang === 'ar'
                            ? 'افتح مسودة التعديل لإدارة الملفات؛ الإصدار المنشور محفوظ.'
                            : 'Open the working draft to manage files; the published version is retained.'
                          : course.status === 'ARCHIVED' || course.deletionRequestedAt
                            ? lang === 'ar'
                              ? 'إدارة الملفات غير متاحة أثناء الأرشفة أو الحذف.'
                              : 'File changes are unavailable while archived or deleting.'
                            : undefined
                      }
                    />
                  ) : null}
                  {workspace === 'students' ? (
                    course.revisionOwnerId ? (
                      <Notice kind="info">
                        {lang === 'ar'
                          ? 'الطلاب والاشتراكات وتقارير أولياء الأمور تخص النسخة المنشورة؛ افتحها من الشريط أعلى الصفحة.'
                          : 'Students, memberships and parent reports belong to the published version; open it from the switcher above.'}{' '}
                        <a className="underline" href={`#/admin/courses/${course.revisionOwnerId}`}>
                          {lang === 'ar' ? 'فتح النسخة المنشورة' : 'Open published version'}
                        </a>
                      </Notice>
                    ) : (
                      <AdminCourseStudentsPanel key={courseId} courseId={courseId} />
                    )
                  ) : null}
                </>
              ) : null}
            </SectionPanel>
          ))}
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
