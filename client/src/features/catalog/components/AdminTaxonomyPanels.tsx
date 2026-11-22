import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { StatusBadge } from '../../../components/ui/Dialog';
import {
  createAdminSubject,
  createAdminTeacher,
  deleteAdminSubject,
  deleteAdminTeacher,
  fetchAdminSubjects,
  fetchAdminTeachers,
  patchAdminSubject,
  patchAdminTeacher,
} from '../api/client';
import type { AdminSubject, AdminTeacher } from '../types/models';

export function AdminTaxonomyPanels({ onChanged }: { onChanged?: () => void }): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [openTab, setOpenTab] = useState<'none' | 'subjects' | 'teachers'>('none');
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [teachers, setTeachers] = useState<AdminTeacher[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subForm, setSubForm] = useState({ slug: '', nameAr: '', nameEn: '' });
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [editSub, setEditSub] = useState({ slug: '', nameAr: '', nameEn: '' });

  const [tForm, setTForm] = useState({ slug: '', nameAr: '', nameEn: '', bioAr: '', bioEn: '' });
  const [editTeacherId, setEditTeacherId] = useState<string | null>(null);
  const [editTeacher, setEditTeacher] = useState({ slug: '', nameAr: '', nameEn: '', bioAr: '', bioEn: '' });

  const load = useCallback(async () => {
    try {
      const [s, te] = await Promise.all([fetchAdminSubjects(), fetchAdminTeachers()]);
      setSubjects(s);
      setTeachers(te);
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addSubject(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await createAdminSubject({
        slug: subForm.slug.trim().toLowerCase(),
        nameAr: subForm.nameAr.trim(),
        nameEn: subForm.nameEn.trim(),
      });
      setSubForm({ slug: '', nameAr: '', nameEn: '' });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function saveSubjectEdit(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await patchAdminSubject(id, {
        slug: editSub.slug.trim().toLowerCase(),
        nameAr: editSub.nameAr.trim(),
        nameEn: editSub.nameEn.trim(),
      });
      setEditSubId(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function toggleSubjectActive(s: AdminSubject) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await patchAdminSubject(s.id, { active: !s.active });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function removeSubject(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminSubject(id);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function addTeacher(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await createAdminTeacher({
        slug: tForm.slug.trim().toLowerCase(),
        nameAr: tForm.nameAr.trim(),
        nameEn: tForm.nameEn.trim(),
        bioAr: tForm.bioAr.trim() || null,
        bioEn: tForm.bioEn.trim() || null,
      });
      setTForm({ slug: '', nameAr: '', nameEn: '', bioAr: '', bioEn: '' });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function saveTeacherEdit(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await patchAdminTeacher(id, {
        slug: editTeacher.slug.trim().toLowerCase(),
        nameAr: editTeacher.nameAr.trim(),
        nameEn: editTeacher.nameEn.trim(),
        bioAr: editTeacher.bioAr.trim() || null,
        bioEn: editTeacher.bioEn.trim() || null,
      });
      setEditTeacherId(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function toggleTeacherActive(te: AdminTeacher) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await patchAdminTeacher(te.id, { active: !te.active });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function removeTeacher(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminTeacher(id);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="my-6 space-y-4" aria-label={ar ? 'إدارة المواد والمدرسين' : 'Manage subjects and teachers'}>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={openTab === 'subjects' ? 'primary' : 'secondary'}
          aria-expanded={openTab === 'subjects'}
          onClick={() => setOpenTab(openTab === 'subjects' ? 'none' : 'subjects')}
        >
          {t.manageSubjects} ({subjects.length})
        </Button>
        <Button
          type="button"
          variant={openTab === 'teachers' ? 'primary' : 'secondary'}
          aria-expanded={openTab === 'teachers'}
          onClick={() => setOpenTab(openTab === 'teachers' ? 'none' : 'teachers')}
        >
          {t.manageTeachers} ({teachers.length})
        </Button>
      </div>

      {error ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}

      {openTab === 'subjects' ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold">{t.manageSubjects}</h2>
          <form onSubmit={(e) => void addSubject(e)} className="grid gap-3 sm:grid-cols-4 items-end">
            <Field id="sub-slug" label={t.fieldSlug} dir="ltr">
              <input id="sub-slug" dir="ltr" required className={textInputClassName(false)} value={subForm.slug} onChange={(e) => setSubForm({ ...subForm, slug: e.target.value })} />
            </Field>
            <Field id="sub-ar" label={ar ? 'اسم المادة بالعربية' : 'Subject name (Arabic)'}>
              <input id="sub-ar" required className={textInputClassName(false)} value={subForm.nameAr} onChange={(e) => setSubForm({ ...subForm, nameAr: e.target.value })} />
            </Field>
            <Field id="sub-en" label={ar ? 'اسم المادة بالإنجليزية' : 'Subject name (English)'} dir="ltr">
              <input id="sub-en" dir="ltr" required className={textInputClassName(false)} value={subForm.nameEn} onChange={(e) => setSubForm({ ...subForm, nameEn: e.target.value })} />
            </Field>
            <Button type="submit" disabled={busy || !subForm.slug.trim() || !subForm.nameAr.trim() || !subForm.nameEn.trim()} disabledReason={busy ? undefined : { ar: 'أدخل المعرّف والاسم باللغتين لإضافة مادة.', en: 'Enter slug and bilingual names to add a subject.' }}>
              {t.addSubject}
            </Button>
          </form>

          <ul className="space-y-2">
            {subjects.map((s) => {
              const inUse = (s._count?.courses ?? 0) > 0;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-field p-3">
                  {editSubId === s.id ? (
                    <div className="flex flex-wrap items-end gap-2 w-full">
                      <input aria-label={t.fieldSlug} dir="ltr" className={textInputClassName(false)} value={editSub.slug} onChange={(e) => setEditSub({ ...editSub, slug: e.target.value })} />
                      <input aria-label={ar ? 'الاسم بالعربية' : 'Arabic name'} className={textInputClassName(false)} value={editSub.nameAr} onChange={(e) => setEditSub({ ...editSub, nameAr: e.target.value })} />
                      <input aria-label={ar ? 'الاسم بالإنجليزية' : 'English name'} dir="ltr" className={textInputClassName(false)} value={editSub.nameEn} onChange={(e) => setEditSub({ ...editSub, nameEn: e.target.value })} />
                      <Button type="button" disabled={busy} onClick={() => void saveSubjectEdit(s.id)}>{t.submitSave}</Button>
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditSubId(null)}>{t.cancel}</Button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-bold">
                          {ar ? s.nameAr : s.nameEn}{' '}
                          <StatusBadge text={s.active ? (ar ? 'نشط' : 'Active') : (ar ? 'معطّل' : 'Inactive')} tone={s.active ? 'success' : 'info'} />
                        </p>
                        <p className="text-xs text-muted" dir="ltr">
                          {s.slug} • {s._count?.courses ?? 0} {ar ? 'كورس' : 'courses'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="secondary" disabled={busy} onClick={() => { setEditSubId(s.id); setEditSub({ slug: s.slug, nameAr: s.nameAr, nameEn: s.nameEn }); }}>
                          {t.actionEdit}
                        </Button>
                        <Button type="button" variant="secondary" disabled={busy} onClick={() => void toggleSubjectActive(s)}>
                          {s.active ? (ar ? 'تعطيل' : 'Deactivate') : (ar ? 'تفعيل' : 'Activate')}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={busy || inUse}
                          disabledReason={inUse ? { ar: t.subjectInUseReason, en: 'Cannot delete a subject assigned to courses. Deactivate it instead.' } : undefined}
                          onClick={() => void removeSubject(s.id)}
                        >
                          {ar ? 'حذف' : 'Delete'}
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {openTab === 'teachers' ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold">{t.manageTeachers}</h2>
          <form onSubmit={(e) => void addTeacher(e)} className="grid gap-3 sm:grid-cols-3 items-end">
            <Field id="teacher-slug" label={t.fieldSlug} dir="ltr">
              <input id="teacher-slug" dir="ltr" required className={textInputClassName(false)} value={tForm.slug} onChange={(e) => setTForm({ ...tForm, slug: e.target.value })} />
            </Field>
            <Field id="teacher-ar" label={ar ? 'اسم المدرس بالعربية' : 'Teacher name (Arabic)'}>
              <input id="teacher-ar" required className={textInputClassName(false)} value={tForm.nameAr} onChange={(e) => setTForm({ ...tForm, nameAr: e.target.value })} />
            </Field>
            <Field id="teacher-en" label={ar ? 'اسم المدرس بالإنجليزية' : 'Teacher name (English)'} dir="ltr">
              <input id="teacher-en" dir="ltr" required className={textInputClassName(false)} value={tForm.nameEn} onChange={(e) => setTForm({ ...tForm, nameEn: e.target.value })} />
            </Field>
            <Field id="teacher-bio-ar" label={ar ? 'نبذة بالعربية (اختياري)' : 'Bio in Arabic (optional)'}>
              <input id="teacher-bio-ar" className={textInputClassName(false)} value={tForm.bioAr} onChange={(e) => setTForm({ ...tForm, bioAr: e.target.value })} />
            </Field>
            <Field id="teacher-bio-en" label={ar ? 'نبذة بالإنجليزية (اختياري)' : 'Bio in English (optional)'} dir="ltr">
              <input id="teacher-bio-en" dir="ltr" className={textInputClassName(false)} value={tForm.bioEn} onChange={(e) => setTForm({ ...tForm, bioEn: e.target.value })} />
            </Field>
            <Button type="submit" disabled={busy || !tForm.slug.trim() || !tForm.nameAr.trim() || !tForm.nameEn.trim()} disabledReason={busy ? undefined : { ar: 'أدخل المعرّف والاسم باللغتين لإضافة مدرس.', en: 'Enter slug and bilingual names to add a teacher.' }}>
              {t.addTeacher}
            </Button>
          </form>

          <ul className="space-y-2">
            {teachers.map((te) => {
              const inUse = (te._count?.courses ?? 0) > 0;
              return (
                <li key={te.id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-field p-3">
                  {editTeacherId === te.id ? (
                    <div className="grid gap-2 sm:grid-cols-3 w-full">
                      <input aria-label={t.fieldSlug} dir="ltr" className={textInputClassName(false)} value={editTeacher.slug} onChange={(e) => setEditTeacher({ ...editTeacher, slug: e.target.value })} />
                      <input aria-label={ar ? 'الاسم بالعربية' : 'Arabic name'} className={textInputClassName(false)} value={editTeacher.nameAr} onChange={(e) => setEditTeacher({ ...editTeacher, nameAr: e.target.value })} />
                      <input aria-label={ar ? 'الاسم بالإنجليزية' : 'English name'} dir="ltr" className={textInputClassName(false)} value={editTeacher.nameEn} onChange={(e) => setEditTeacher({ ...editTeacher, nameEn: e.target.value })} />
                      <input aria-label={ar ? 'نبذة بالعربية' : 'Arabic bio'} className={textInputClassName(false)} value={editTeacher.bioAr} onChange={(e) => setEditTeacher({ ...editTeacher, bioAr: e.target.value })} />
                      <input aria-label={ar ? 'نبذة بالإنجليزية' : 'English bio'} dir="ltr" className={textInputClassName(false)} value={editTeacher.bioEn} onChange={(e) => setEditTeacher({ ...editTeacher, bioEn: e.target.value })} />
                      <div className="flex gap-2">
                        <Button type="button" disabled={busy} onClick={() => void saveTeacherEdit(te.id)}>{t.submitSave}</Button>
                        <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditTeacherId(null)}>{t.cancel}</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-bold">
                          {ar ? te.nameAr : te.nameEn}{' '}
                          <StatusBadge text={te.active ? (ar ? 'نشط' : 'Active') : (ar ? 'معطّل' : 'Inactive')} tone={te.active ? 'success' : 'info'} />
                        </p>
                        <p className="text-xs text-muted" dir="ltr">
                          {te.slug} • {te._count?.courses ?? 0} {ar ? 'كورس' : 'courses'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="secondary" disabled={busy} onClick={() => { setEditTeacherId(te.id); setEditTeacher({ slug: te.slug, nameAr: te.nameAr, nameEn: te.nameEn, bioAr: te.bioAr ?? '', bioEn: te.bioEn ?? '' }); }}>
                          {t.actionEdit}
                        </Button>
                        <Button type="button" variant="secondary" disabled={busy} onClick={() => void toggleTeacherActive(te)}>
                          {te.active ? (ar ? 'تعطيل' : 'Deactivate') : (ar ? 'تفعيل' : 'Activate')}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={busy || inUse}
                          disabledReason={inUse ? { ar: t.teacherInUseReason, en: 'Cannot delete a teacher assigned to courses. Deactivate the teacher instead.' } : undefined}
                          onClick={() => void removeTeacher(te.id)}
                        >
                          {ar ? 'حذف' : 'Delete'}
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
