import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Card } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { AcademicFields } from '../../academic/AcademicFields';
import type { Academic } from '../../academic/model';
import { useUnsavedChanges } from '../../../components/ui/UnsavedChanges';
import { prepareCoursePhoto, type CoursePhoto } from '../api/coursePhoto';
import { fetchAdminSubjects, fetchAdminTeachers } from '../api/client';
import type { AdminSubject, AdminTeacher } from '../types/models';
import { CourseCover } from '../components/CourseCover';
import { useSuccessFeedback } from '../../../components/ui/ErrorFeedback';

export interface CourseFormValues {
  coverImage?: CoursePhoto;
  coverPath?: string | null;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  subjectId?: string | null;
  teacherId?: string | null;
  academic?: Academic | null;
}

export function CourseForm({
  busy,
  initial,
  onSubmit,
}: {
  busy: boolean;
  initial?: CourseFormValues;
  onSubmit: (v: CourseFormValues) => void | Promise<boolean>;
}): JSX.Element {
  const { t, lang } = useLang();
  const showSuccess = useSuccessFeedback();
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugError, setSlugError] = useState(false);
  const slugHint = lang === 'ar'
    ? 'استخدم من 3 إلى 120 حرفًا إنجليزيًا أو رقمًا، مع شرطات بين الكلمات؛ مثل aim أو a-i-m. النقاط والمسافات غير مسموحة.'
    : 'Use 3-120 English letters or digits, with hyphens between words, e.g. aim or a-i-m. Dots and spaces are not allowed.';
  const [titleAr, setTitleAr] = useState(initial?.titleAr ?? '');
  const [titleEn, setTitleEn] = useState(initial?.titleEn ?? '');
  const [descAr, setDescAr] = useState(initial?.descriptionAr ?? '');
  const [descEn, setDescEn] = useState(initial?.descriptionEn ?? '');
  const [subjectId, setSubjectId] = useState<string>(initial?.subjectId ?? '');
  const [teacherId, setTeacherId] = useState<string>(initial?.teacherId ?? '');
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [teachers, setTeachers] = useState<AdminTeacher[]>([]);
  const [academic, setAcademic] = useState<Academic | null>(initial?.academic ?? null);
  useEffect(() => {
    let live = true;
    void Promise.all([fetchAdminSubjects(), fetchAdminTeachers()])
      .then(([s, te]) => {
        if (live) {
          setSubjects(s);
          setTeachers(te);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const selectedSubject = subjects.find((s) => s.id === subjectId) ?? null;
  const selectedTeacher = teachers.find((te) => te.id === teacherId) ?? null;
  const taxonomyReason =
    !subjectId
      ? { ar: t.subjectRequiredReason, en: 'Select a subject first to continue.' }
      : selectedSubject && !selectedSubject.active
        ? { ar: t.subjectInactiveReason, en: 'The selected subject is inactive. Select an active subject first.' }
        : !teacherId
          ? { ar: t.teacherRequiredReason, en: 'Select a teacher first to continue.' }
          : selectedTeacher && !selectedTeacher.active
            ? { ar: t.teacherInactiveReason, en: 'The selected teacher is inactive. Select an active teacher first.' }
            : undefined;
  const [coverImage, setCoverImage] = useState<CoursePhoto>();
  const [savedPhoto, setSavedPhoto] = useState<CoursePhoto>();
  const photoInput = useRef<HTMLInputElement>(null);
  const hasSavedPhoto = Boolean(savedPhoto || initial?.coverPath);
  const previewPhoto = coverImage ?? savedPhoto;
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const values: CourseFormValues = {
    slug,
    titleAr,
    titleEn,
    descriptionAr: descAr,
    descriptionEn: descEn,
    subjectId: subjectId || null,
    teacherId: teacherId || null,
    academic,
    ...(coverImage ? { coverImage } : {}),
  };
  const [baseline,setBaseline] = useState(JSON.stringify(values));
  const dirty = JSON.stringify(values)!==baseline;
  useUnsavedChanges(dirty,lang==='ar'?'لديك بيانات كورس غير محفوظة. هل تريد تركها؟':'You have unsaved course details. Leave without saving?');

  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy || photoBusy || photoError) return;
    const normalizedSlug = slug.trim().toLowerCase();
    if (normalizedSlug.length < 3 || normalizedSlug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
      setSlugError(true);
      const field = e.currentTarget.querySelector<HTMLInputElement>('#cf-slug');
      field?.focus();
      field?.scrollIntoView({ block: 'center' });
      return;
    }
    setSlugError(false);
    if (initial === undefined && !coverImage) { setPhotoError(true); return; }
    if (!e.currentTarget.reportValidity()) return;
    const result = await onSubmit(values);
    if (result !== true) return;
    showSuccess(initial === undefined ? (lang === 'ar' ? 'تم إنشاء الدورة بنجاح.' : 'Course created successfully.') : coverImage ? (lang === 'ar' ? 'تم حفظ صورة الدورة وبياناتها.' : 'Course photo and details saved.') : (lang === 'ar' ? 'تم حفظ بيانات الدورة.' : 'Course details saved.'));
    if (photoInput.current) photoInput.current.value = '';
    if (initial !== undefined && coverImage) setSavedPhoto(coverImage);
    setCoverImage(undefined);
    setBaseline(JSON.stringify({ ...values, coverImage: undefined }));
    if (initial === undefined) {
      setSlug('');
      setTitleAr('');
      setTitleEn('');
      setDescAr('');
      setDescEn('');
      setAcademic(null);
      setCoverImage(undefined);
      setBaseline(JSON.stringify({slug:'',titleAr:'',titleEn:'',descriptionAr:'',descriptionEn:'',academic:null}));
    }
  }

  return (
    <Card className="mx-auto mt-4 max-w-[640px]">
      <h2 className="text-xl font-bold">
        {initial === undefined ? t.courseCreateTitle : t.courseEditTitle}
      </h2>
      <p role="status" className="mt-2 text-sm text-muted">{dirty?(lang==='ar'?'تعديلات غير محفوظة':'Unsaved changes'):(lang==='ar'?'لا توجد تعديلات غير محفوظة':'No unsaved changes')}</p>
      <form onSubmit={(e)=>void submit(e)} noValidate className="mt-4">
        <Field id="cf-photo" label={initial === undefined ? (lang === 'ar' ? 'صورة الدورة' : 'Course photo') : hasSavedPhoto ? (lang === 'ar' ? 'تغيير صورة الدورة' : 'Change course photo') : (lang === 'ar' ? 'إضافة صورة للدورة' : 'Add course photo')}>
          {initial !== undefined && !hasSavedPhoto && !coverImage ? <p className="mb-2 text-sm text-muted">{lang === 'ar' ? 'لم تتم إضافة صورة لهذه الدورة بعد.' : 'This course has no photo yet.'}</p> : null}
          <input ref={photoInput} id="cf-photo" type="file" accept="image/jpeg,image/png,image/webp" required={initial === undefined && !coverImage} disabled={busy || photoBusy}
            aria-invalid={photoError} aria-describedby="cf-photo-help" className={textInputClassName(photoError)}
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              setPhotoBusy(true); setPhotoError(false); setCoverImage(undefined);
              void prepareCoursePhoto(file).then(setCoverImage).catch(() => setPhotoError(true)).finally(() => setPhotoBusy(false));
            }} />
          <p id="cf-photo-help" className="mt-2 text-sm text-muted">{lang === 'ar' ? 'اختر صورة JPG أو PNG أو WebP حتى 10 ميجابايت. سنجهزها تلقائيًا لعرضها على الموقع.' : 'Choose a JPG, PNG or WebP photo up to 10 MB. We’ll optimize it for the website.'}</p>
          {photoBusy ? <p role="status">{lang === 'ar' ? 'جارٍ تجهيز الصورة…' : 'Preparing photo…'}</p> : null}
          {photoError ? <p role="alert" className="mt-2 text-sm text-error-fg">{lang === 'ar' ? 'اختر صورة صالحة للدورة قبل الحفظ.' : 'Choose a valid course photo before saving.'}</p> : null}
          {previewPhoto ? <img data-testid="course-photo-preview" className="mt-3 max-h-[260px] w-full rounded-xl bg-elevated object-contain" src={`data:${previewPhoto.mime};base64,${previewPhoto.base64}`} alt={lang === 'ar' ? 'معاينة صورة الدورة' : 'Course photo preview'} /> : initial?.coverPath ? <CourseCover path={initial.coverPath} title={lang === 'ar' ? titleAr : titleEn} /> : null}
          {(coverImage || photoError) && !photoBusy ? <Button type="button" disabled={busy} onClick={() => {
            setCoverImage(undefined); setPhotoError(false);
            if (photoInput.current) photoInput.current.value = '';
          }}>{lang === 'ar' ? 'إلغاء اختيار الصورة' : 'Cancel photo selection'}</Button> : null}
        </Field>
        <Field id="cf-slug" label={t.fieldSlug} dir="ltr" hint={slugHint} error={slugError ? (lang === 'ar' ? 'المعرّف غير صحيح. ' : 'Invalid slug. ') + slugHint : undefined}>
          <input
            id="cf-slug"
            dir="ltr"
            required
            aria-invalid={slugError}
            aria-describedby={`cf-slug-hint${slugError ? ' cf-slug-error' : ''}`}
            className={textInputClassName(slugError)}
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugError(false); }}
          />
        </Field>
        <Field id="cf-ta" label={t.fieldTitleAr}>
          <input
            id="cf-ta"
            required
            className={textInputClassName(false)}
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
          />
        </Field>
        <Field id="cf-te" label={t.fieldTitleEn} dir="ltr">
          <input
            id="cf-te"
            dir="ltr"
            required
            className={textInputClassName(false)}
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
          />
        </Field>
        <Field id="cf-da" label={t.fieldDescAr}>
          <textarea
            id="cf-da"
            required
            className={textInputClassName(false)}
            value={descAr}
            onChange={(e) => setDescAr(e.target.value)}
          />
        </Field>
        <Field id="cf-de" label={t.fieldDescEn} dir="ltr">
          <textarea
            id="cf-de"
            dir="ltr"
            required
            className={textInputClassName(false)}
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cf-subject" label={t.subject}>
            <select
              id="cf-subject"
              required
              className={textInputClassName(false)}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">{lang === 'ar' ? 'اختَر المادة' : 'Select subject'}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.active && s.id !== subjectId}>
                  {lang === 'ar' ? s.nameAr : s.nameEn}
                  {!s.active ? (lang === 'ar' ? ' (معطّل)' : ' (inactive)') : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field id="cf-teacher" label={t.teacher}>
            <select
              id="cf-teacher"
              required
              className={textInputClassName(false)}
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">{lang === 'ar' ? 'اختَر المدرس' : 'Select teacher'}</option>
              {teachers.map((te) => (
                <option key={te.id} value={te.id} disabled={!te.active && te.id !== teacherId}>
                  {lang === 'ar' ? te.nameAr : te.nameEn}
                  {!te.active ? (lang === 'ar' ? ' (معطّل)' : ' (inactive)') : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <AcademicFields value={academic} onChange={setAcademic} />
        <FormActions>
          <Button type="submit" disabled={busy || photoBusy || Boolean(taxonomyReason)} disabledReason={busy || photoBusy ? undefined : taxonomyReason}>
            {initial === undefined ? t.submitCreate : t.submitSave}
          </Button>
        </FormActions>
      </form>
    </Card>
  );
}
