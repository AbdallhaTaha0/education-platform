import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, useAuth } from '../../auth';
import { useLang } from '../../i18n';
import { Card, Container } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormActions } from '../../components/ui/FormActions';
import { PaginatedCollection } from '../../components/ui/Pagination';
import { Field, textInputClassName } from '../../components/ui/Field';
import { Loading, Notice } from '../../components/ui/Notice';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { useUnsavedChanges } from '../../components/ui/UnsavedChanges';
import { fetchAdminCourses } from '../catalog/api/client';
import type { AdminCourseSummary } from '../catalog/types/models';
import { adminPackages, saveSchoolPackage, type AdminPackage } from './api';
import {
  cairoDeadlineInput,
  cairoWallTime,
  displayDeadline,
  moneyInput,
  gradeLabel,
} from './model';

const blank = {
  titleAr: '',
  titleEn: '',
  descriptionAr: '',
  descriptionEn: '',
  price: '',
  deadline: '',
  status: 'DRAFT',
  courseIds: ['', '', ''],
};
export function AdminPackagesPage(): JSX.Element {
  const { lang, t } = useLang();
  const ar = lang === 'ar';
  const { status, user } = useAuth();
  const [rows, setRows] = useState<AdminPackage[]>([]);
  const [courses, setCourses] = useState<AdminCourseSummary[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<AdminPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<'courseIds' | 'deadline' | 'price' | 'titleAr' | 'titleEn' | 'descriptionAr' | 'descriptionEn' | null>(null);
  const [showForm,setShowForm]=useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AdminPackage | null>(null);
  const baseline = useRef(blank);
  const confirmDiscard = useUnsavedChanges(showForm && JSON.stringify(form) !== JSON.stringify(baseline.current), ar ? 'تعديلات الباقة غير محفوظة. هل تريد تركها؟' : 'Package changes are unsaved. Leave without saving?');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, c] = await Promise.all([adminPackages(), fetchAdminCourses()]);
      setRows(p);
      setCourses(c);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'SERVICE_ERROR');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (status === 'authenticated' && user?.role === 'ADMIN') void load();
  }, [status, user?.role, load]);
  function edit(p: AdminPackage) {
    if (!confirmDiscard()) return;
    setShowForm(true);
    setEditing(p);
    setError('');
    setFieldError(null);
    const next = {
      titleAr: p.titleAr,
      titleEn: p.titleEn,
      descriptionAr: p.descriptionAr,
      descriptionEn: p.descriptionEn,
      price: (p.pricePiastres / 100).toFixed(2),
      deadline: cairoWallTime(p.endsAt),
      status: p.status,
      courseIds: [...p.members].sort((a, b) => a.position - b.position).map((m) => m.courseId),
    };
    baseline.current = next;
    setForm(next);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (form.courseIds.some(id => !id) || new Set(form.courseIds).size !== 3) {
      setFieldError('courseIds');
      document.getElementById('pkg-member-0')?.focus();
      return;
    }
    setBusy(true);
    setError('');
    setFieldError(null);
    try {
      const body = {
        titleAr: form.titleAr,
        titleEn: form.titleEn,
        descriptionAr: form.descriptionAr,
        descriptionEn: form.descriptionEn,
        pricePiastres: moneyInput(form.price),
        endsAt: cairoDeadlineInput(form.deadline),
        status: form.status,
        courseIds: form.courseIds,
        ...(editing ? { expectedVersion: editing.version } : {}),
      };
      await saveSchoolPackage(editing?.id ?? null, body);
      setEditing(null);
      setForm(blank);
      baseline.current = blank;
      setShowForm(false);
      await load();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'VALIDATION_ERROR';
      setError(code);
      const apiField = e instanceof ApiError ? e.details?.['field'] : null;
      const target = code === 'PACKAGE_UNAVAILABLE' || code === 'PACKAGE_GRADE_MISMATCH' ? 'courseIds'
        : code === 'OFFER_EXPIRED' ? 'deadline'
        : apiField === 'pricePiastres' ? 'price'
        : apiField === 'titleAr' || apiField === 'titleEn' || apiField === 'descriptionAr' || apiField === 'descriptionEn' ? apiField
        : apiField === 'courseIds' ? 'courseIds'
        : apiField === 'endsAt' ? 'deadline' : null;
      setFieldError(target);
      if (target) document.getElementById(target === 'courseIds' ? 'pkg-member-0' : `pkg-${target}`)?.focus();
    } finally {
      setBusy(false);
    }
  }
  async function archive(p: AdminPackage) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await saveSchoolPackage(p.id, { expectedVersion: p.version, status: 'ARCHIVED' });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
      setArchiveTarget(null);
    }
  }
  const eligible = courses.filter(
    (c) =>
      c.courseKind === 'MONTHLY_EXPLANATION' &&
      c.status !== 'ARCHIVED' &&
      !c.deletionRequestedAt &&
      Boolean(c.grade && c.academicYear && c.teachingMonth),
  );
  const firstSelectedCourse = eligible.find((course) => course.id === form.courseIds[0]);
  const packageCourseOptions = (index: number) => {
    const compatible = index === 0 || !firstSelectedCourse
      ? eligible
      : eligible.filter((course) => course.grade === firstSelectedCourse.grade);
    const options = compatible.filter(
      (course) => !form.courseIds.some((id, otherIndex) => otherIndex !== index && id === course.id),
    );
    const current = eligible.find((course) => course.id === form.courseIds[index]);
    return current && !options.some((course) => course.id === current.id)
      ? [current, ...options]
      : options;
  };
  const hasThreeInSameGrade = eligible.some(
    (course) => eligible.filter((candidate) => candidate.grade === course.grade).length >= 3,
  );
  return (
    <main id="main">
      <Container>
        <section className="py-10">
          <a className="footer-discovery" href="#/admin/catalog">
            ← {t.navCatalog}
          </a>
          <h1 className="mt-4 section-title">{ar ? 'باقات الشهور' : 'Monthly packages'}</h1>
          {status === 'loading' ? (
            <Loading text={t.loading} />
          ) : status !== 'authenticated' ? (
            <Notice kind="info">{t.needLogin}</Notice>
          ) : user?.role !== 'ADMIN' ? (
            <Notice kind="error">{t.forbiddenBody}</Notice>
          ) : (
            <>
              <p className="mt-3 text-muted">
                {ar
                  ? 'اختَر ٣ كورسات شرح شهرية محددة، وسعرًا واحدًا، وموعد انتهاء واحدًا بتوقيت القاهرة. التعديل يؤثر على المشتريات الجديدة فقط.'
                  : 'Choose three specific monthly courses, one price and one Cairo deadline. Changes apply to new purchases only.'}
              </p>
              {error ? (
                <Notice kind="error">
                  {error === 'OFFER_CHANGED'
                    ? ar
                      ? 'الباقة اتغيّرت. أعد التحميل ثم اخترها من جديد.'
                      : 'The package changed. Reload and select it again.'
                    : error === 'PACKAGE_GRADE_MISMATCH'
                      ? ar
                        ? 'اختَر ثلاثة كورسات من نفس الصف الدراسي.'
                        : 'Choose three courses from the same grade.'
                    : error === 'PACKAGE_UNAVAILABLE'
                      ? ar ? 'راجع الكورسات الثلاثة: يجب أن تكون كورسات شهرية متاحة ومصنفة للصف نفسه.' : 'Review all three courses: they must be available monthly courses in the same grade.'
                    : error === 'OFFER_EXPIRED'
                      ? ar ? 'موعد انتهاء الباقة مضى. اختَر موعدًا لاحقًا.' : 'The package deadline has passed. Choose a later time.'
                      : ar
                        ? 'تعذّر الحفظ أو التحميل. راجع البيانات وحاول مجددًا.'
                        : 'Could not save or load. Check the fields and retry.'}
                </Notice>
              ) : null}
              <Button variant="secondary" onClick={() => void load()} disabled={busy}>
                {error ? t.retryLabel : ar?'تحديث الباقات':'Refresh packages'}
              </Button>
              {loading ? <Loading text={t.loading} /> : null}
              {!loading && !hasThreeInSameGrade ? <Notice kind="info">{ar?'تحتاج الباقة إلى ٣ كورسات شرح شهرية مختلفة ومصنفة لنفس الصف الدراسي. صنّف الكورسات من إدارة الكورسات أولًا.':'A package needs three distinct monthly courses classified for the same grade. Set their academic classification in course management first.'} <a href="#/admin/catalog" className="underline">{ar?'إدارة الكورسات':'Manage courses'}</a></Notice>:null}
              <FormActions>
                <Button disabled={busy || !hasThreeInSameGrade} disabledReason={busy ? undefined : { ar: "تحتاج الباقة إلى ٣ كورسات مؤهلة من نفس الصف الدراسي.", en: "A package needs 3 eligible courses from the same grade." }} onClick={()=>{if (!confirmDiscard()) return; setEditing(null); baseline.current = blank; setForm(blank); setFieldError(null); setError(''); setShowForm(true);}}>{ar?'إنشاء باقة':'Create package'}</Button>
              </FormActions>
              {showForm ? <Card className="mt-6">
                <h2 className="text-xl font-bold">
                  {editing
                    ? ar
                      ? 'تعديل الباقة'
                      : 'Edit package'
                    : ar
                      ? 'باقة جديدة'
                      : 'New package'}
                </h2>
                <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
                  <fieldset disabled={busy} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(['titleAr', 'titleEn', 'descriptionAr', 'descriptionEn'] as const).map(
                        (k) => (
                          <Field
                            key={k}
                            id={`pkg-${k}`}
                            label={
                              k === 'titleAr'
                                ? 'اسم الباقة بالعربية'
                                : k === 'titleEn'
                                  ? ar ? 'اسم الباقة بالإنجليزية' : 'Package name in English'
                                  : k === 'descriptionAr'
                                    ? 'الوصف بالعربية'
                                    : ar ? 'الوصف بالإنجليزية' : 'Description in English'
                            }
                          >
                            <input
                              id={`pkg-${k}`}
                              aria-invalid={fieldError === k || undefined}
                              aria-describedby={fieldError === k ? `pkg-${k}-error` : undefined}
                              required
                              maxLength={k.startsWith('title') ? 200 : 5000}
                              dir={k.endsWith('Ar') ? 'rtl' : 'ltr'}
                              className={textInputClassName(false)}
                              value={form[k]}
                              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                            />
                            {fieldError === k ? <p id={`pkg-${k}-error`} className="text-sm text-error-fg">{ar ? 'راجع هذا الحقل وأعد المحاولة.' : 'Check this field and try again.'}</p> : null}
                          </Field>
                        ),
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id="pkg-price" label={ar ? 'السعر بالجنيه المصري' : 'Price in EGP'}>
                        <input
                          id="pkg-price"
                          aria-invalid={fieldError === 'price' || undefined}
                          aria-describedby={fieldError === 'price' ? 'pkg-price-error' : undefined}
                          inputMode="decimal"
                          required
                          className={textInputClassName(false)}
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                        />
                        {fieldError === 'price' ? <p id="pkg-price-error" className="text-sm text-error-fg">{ar ? 'أدخل سعرًا صحيحًا بالجنيه المصري.' : 'Enter a valid price in EGP.'}</p> : null}
                      </Field>
                      <Field
                        id="pkg-deadline"
                        label={ar ? 'موعد الانتهاء بتوقيت القاهرة' : 'Deadline — Cairo'}
                      >
                        <input
                          id="pkg-deadline"
                          type="datetime-local"
                          aria-invalid={fieldError === 'deadline' || undefined}
                          aria-describedby={fieldError === 'deadline' ? 'pkg-deadline-error' : undefined}
                          step="1"
                          required
                          className={textInputClassName(false)}
                          value={form.deadline}
                          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                        />
                        {fieldError === 'deadline' ? <p id="pkg-deadline-error" className="text-sm text-error-fg">{ar ? 'اختَر موعدًا لاحقًا.' : 'Choose a later deadline.'}</p> : null}
                      </Field>
                    </div>
                    {[0, 1, 2].map((i) => (
                      <Field
                        key={i}
                        id={`pkg-member-${i}`}
                        label={`${ar ? 'الكورس' : 'Course'} ${i + 1}`}
                      >
                        <select
                          id={`pkg-member-${i}`}
                          required
                          aria-invalid={fieldError === 'courseIds' || undefined}
                          aria-describedby={fieldError === 'courseIds' && i === 0 ? 'pkg-members-error' : undefined}
                          className={textInputClassName(false)}
                          value={form.courseIds[i] ?? ''}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              courseIds: form.courseIds.map((id, j) => {
                                if (j === i) return e.target.value;
                                if (i !== 0 || j === 0 || !e.target.value) return id;
                                const selected = eligible.find((course) => course.id === id);
                                const nextFirst = eligible.find((course) => course.id === e.target.value);
                                return selected?.grade === nextFirst?.grade ? id : '';
                              }),
                            })
                          }
                        >
                          <option value="">
                            {ar ? 'اختَر كورسًا شهريًا' : 'Choose a monthly course'}
                          </option>
                          {packageCourseOptions(i).map((c) => (
                            <option key={c.id} value={c.id}>
                              {gradeLabel(c.grade, lang)} • {c.teachingMonth} •{' '}
                              {ar ? c.titleAr : c.titleEn}
                              {c.status !== 'PUBLISHED'
                                ? ar
                                  ? ' (لم يُنشر بعد)'
                                  : ' (not published yet)'
                                : ''}
                            </option>
                          ))}
                          {editing &&
                          form.courseIds[i] &&
                          !eligible.some((c) => c.id === form.courseIds[i]) ? (
                            <option value={form.courseIds[i]}>
                              {ar
                                ? 'كورس غير متاح؛ اختر بديلًا قبل النشر'
                                : 'Unavailable course; replace before publication'}
                            </option>
                          ) : null}
                        </select>
                        {fieldError === 'courseIds' && i === 0 ? <p id="pkg-members-error" className="text-sm text-error-fg">{ar ? 'اختَر ثلاثة كورسات شهرية مختلفة ومتاحة من نفس الصف.' : 'Choose three distinct, available monthly courses from the same grade.'}</p> : null}
                      </Field>
                    ))}
                    <Field id="pkg-status" label={ar ? 'حالة الباقة' : 'Package status'}>
                      <select
                        id="pkg-status"
                        className={textInputClassName(false)}
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        {['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((s) => (
                          <option key={s} value={s}>
                            {s === 'DRAFT'
                              ? ar
                                ? 'مسودة'
                                : 'Draft'
                              : s === 'PUBLISHED'
                                ? ar
                                  ? 'منشورة'
                                  : 'Published'
                                : ar
                                  ? 'مؤرشفة'
                                  : 'Archived'}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Notice kind="info">
                      {ar
                        ? 'يمكن إضافة كورس لم يُنشر بعد. سيرى الطالب تنبيهًا، ولن يستطيع مشاهدته قبل النشر. موعد الباقة لا يتغيّر.'
                        : 'Unpublished courses are allowed. Students see a notice and cannot watch until publication. The deadline stays the same.'}
                    </Notice>
                    <FormActions>
                      <Button type="submit" disabled={busy}>
                        {busy ? t.loading : ar ? 'حفظ الباقة' : 'Save package'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          if (!confirmDiscard()) return;
                          setEditing(null);
                          setForm(blank);
                          baseline.current = blank;
                          setFieldError(null);
                          setShowForm(false); setError('');
                        }}
                      >
                        {t.cancel}
                      </Button>
                    </FormActions>
                  </fieldset>
                </form>
              </Card> : null}
              {!loading && !rows.length ? <p className="my-6 text-muted">{ar?'لا توجد باقات بعد. جهّز الكورسات الشهرية ثم أنشئ أول باقة.':'No packages yet. Prepare the monthly courses, then create your first package.'}</p>:null}
              <PaginatedCollection as="ul" id="admin-packages" disabled={busy} className="mt-6 grid gap-4 md:grid-cols-2">
                {rows.map((p) => (
                  <li key={p.id}>
                    <Card>
                      <h2 className="text-xl font-bold">{ar ? p.titleAr : p.titleEn}</h2>
                      <p className="mt-2">
                        {(p.pricePiastres / 100).toFixed(2)} {ar ? 'ج.م' : 'EGP'} •{' '}
                        {displayDeadline(p.endsAt, lang)}
                      </p>
                      <p className="my-3 text-muted">
                        {p.status === 'PUBLISHED'
                          ? ar
                            ? 'منشورة'
                            : 'Published'
                          : p.status === 'ARCHIVED'
                            ? ar
                              ? 'مؤرشفة'
                              : 'Archived'
                            : ar
                              ? 'مسودة'
                              : 'Draft'}
                      </p>
                      <Button variant="secondary" onClick={() => edit(p)} disabled={busy}>
                        {ar ? 'تعديل' : 'Edit'}
                      </Button>
                      {p.status !== 'ARCHIVED' ? (
                        <Button variant="secondary" onClick={() => setArchiveTarget(p)} disabled={busy}>
                          {ar ? 'أرشفة' : 'Archive'}
                        </Button>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </PaginatedCollection>
              <ConfirmDialog open={archiveTarget !== null} title={ar ? 'أرشفة الباقة؟' : 'Archive package?'} body={ar ? `ستُؤرشف «${archiveTarget?.titleAr ?? ''}» ولن تظهر للمشتريات الجديدة. يمكن استعادة الباقة لاحقًا.` : `“${archiveTarget?.titleEn ?? ''}” will be archived and unavailable for new purchases. You can restore it later.`} confirmLabel={ar ? 'تأكيد الأرشفة' : 'Confirm archive'} cancelLabel={t.cancel} onConfirm={() => { if (archiveTarget) void archive(archiveTarget); }} onCancel={() => { if (!busy) setArchiveTarget(null); }} />
            </>
          )}
        </section>
      </Container>
    </main>
  );
}
