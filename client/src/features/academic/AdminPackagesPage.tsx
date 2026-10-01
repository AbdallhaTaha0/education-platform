import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, useAuth } from '../../auth';
import { useLang } from '../../i18n';
import { Card, Container } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, textInputClassName } from '../../components/ui/Field';
import { Loading, Notice } from '../../components/ui/Notice';
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
    setEditing(p);
    setError('');
    setForm({
      titleAr: p.titleAr,
      titleEn: p.titleEn,
      descriptionAr: p.descriptionAr,
      descriptionEn: p.descriptionEn,
      price: (p.pricePiastres / 100).toFixed(2),
      deadline: cairoWallTime(p.endsAt),
      status: p.status,
      courseIds: [...p.members].sort((a, b) => a.position - b.position).map((m) => m.courseId),
    });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
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
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'VALIDATION_ERROR');
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
    }
  }
  const eligible = courses.filter(
    (c) =>
      c.courseKind === 'MONTHLY_EXPLANATION' && c.status !== 'ARCHIVED' && !c.deletionRequestedAt,
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
                    : ar
                      ? 'تعذّر الحفظ أو التحميل. راجع البيانات وحاول مجددًا.'
                      : 'Could not save or load. Check the fields and retry.'}
                </Notice>
              ) : null}
              <Button variant="secondary" onClick={() => void load()} disabled={busy}>
                {t.retryLabel}
              </Button>
              {loading ? <Loading text={t.loading} /> : null}
              <Card className="mt-6">
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
                                  ? 'Package name in English'
                                  : k === 'descriptionAr'
                                    ? 'الوصف بالعربية'
                                    : 'Description in English'
                            }
                          >
                            <input
                              id={`pkg-${k}`}
                              required
                              maxLength={k.startsWith('title') ? 200 : 5000}
                              dir={k.endsWith('Ar') ? 'rtl' : 'ltr'}
                              className={textInputClassName(false)}
                              value={form[k]}
                              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                            />
                          </Field>
                        ),
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id="pkg-price" label={ar ? 'السعر بالجنيه المصري' : 'Price in EGP'}>
                        <input
                          id="pkg-price"
                          inputMode="decimal"
                          required
                          className={textInputClassName(false)}
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                        />
                      </Field>
                      <Field
                        id="pkg-deadline"
                        label={ar ? 'موعد الانتهاء بتوقيت القاهرة' : 'Deadline — Cairo'}
                      >
                        <input
                          id="pkg-deadline"
                          type="datetime-local"
                          step="1"
                          required
                          className={textInputClassName(false)}
                          value={form.deadline}
                          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                        />
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
                          className={textInputClassName(false)}
                          value={form.courseIds[i] ?? ''}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              courseIds: form.courseIds.map((id, j) =>
                                j === i ? e.target.value : id,
                              ),
                            })
                          }
                        >
                          <option value="">
                            {ar ? 'اختَر كورسًا شهريًا' : 'Choose a monthly course'}
                          </option>
                          {eligible.map((c) => (
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
                    <Button type="submit" disabled={busy}>
                      {busy ? t.loading : ar ? 'حفظ الباقة' : 'Save package'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditing(null);
                        setForm(blank);
                      }}
                    >
                      {t.cancel}
                    </Button>
                  </fieldset>
                </form>
              </Card>
              <ul className="mt-6 grid gap-4 md:grid-cols-2">
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
                        <Button variant="secondary" onClick={() => void archive(p)} disabled={busy}>
                          {ar ? 'أرشفة' : 'Archive'}
                        </Button>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </Container>
    </main>
  );
}
