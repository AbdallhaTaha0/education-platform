import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { PaginatedCollection } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Card } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { OrderingControls } from '../components/OrderingControls';
import { createSection, patchSection, reorderSections } from '../api/client';
import type { AdminSection } from '../types/models';
import { EntityRename } from './EntityRename';
import { useUnsavedChanges } from '../../../components/ui/UnsavedChanges';

export function SectionEditor({
  courseId,
  sections,
  onChanged,
  blockedReason,
}: {
  courseId: string;
  sections: AdminSection[];
  onChanged: () => Promise<void>;
  blockedReason?: string;
}): JSX.Element {
  const { t, lang } = useLang();
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useUnsavedChanges(!!(titleAr || titleEn),lang==='ar'?'اسم القسم الجديد غير محفوظ. هل تريد تركه؟':'The new section name is unsaved. Leave without saving?');

  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy || blockedReason || !e.currentTarget.reportValidity()) return;
    setBusy(true);
    setError(null);
    try {
      await createSection(courseId, { titleAr, titleEn });
      setTitleAr('');
      setTitleEn('');
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, delta: -1 | 1): Promise<void> {
    if (busy || blockedReason) return;
    const ids = sections.map((s) => s.id);
    const next = index + delta;
    if (next < 0 || next >= ids.length) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved as string);
    setError(null);
    setBusy(true);
    try {
      await reorderSections(courseId, reordered as string[]);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="text-xl font-bold">{lang==='ar'?'الأقسام':'Sections'}</h2>
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
      <PaginatedCollection as="ul" id="section-ordering" className="mt-2 space-y-3">
        {sections.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              #{s.position} {lang === 'ar' ? s.titleAr : s.titleEn}
            </span>
            <EntityRename titleAr={s.titleAr} titleEn={s.titleEn} blockedReason={blockedReason} onSave={async body=>{await patchSection(s.id,body);await onChanged();}} />
            <OrderingControls
              onMoveUp={() => void move(i, -1)}
              onMoveDown={() => void move(i, 1)}
              upDisabled={i === 0}
              downDisabled={i === sections.length - 1}
              busy={busy}
              blockedReason={blockedReason}
            />
          </li>
        ))}
      </PaginatedCollection>
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1"
      >
        <Field id="sec-ta" label={t.fieldTitleAr}>
          <input
            id="sec-ta"
            disabled={busy || !!blockedReason}
            maxLength={300}
            required
            className={textInputClassName(false)}
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
          />
        </Field>
        <Field id="sec-te" label={t.fieldTitleEn} dir="ltr">
          <input
            id="sec-te"
            disabled={busy || !!blockedReason}
            maxLength={300}
            dir="ltr"
            required
            className={textInputClassName(false)}
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
          />
        </Field>
        <div className="col-span-2 max-sm:col-span-1">
          <FormActions className="mt-0">
            <Button type="submit" disabled={busy || !!blockedReason} disabledReason={blockedReason}>
              {t.actionAddSection}
            </Button>
          </FormActions>
        </div>
      </form>
    </Card>
  );
}
