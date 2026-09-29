import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { OrderingControls } from '../components/OrderingControls';
import { createSection, patchSection, reorderSections } from '../api/client';
import type { AdminSection } from '../types/models';

export function SectionEditor({ courseId, sections, onChanged }: { courseId: string; sections: AdminSection[]; onChanged: () => Promise<void> }): JSX.Element {
  const { t, lang } = useLang();
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy) return;
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
    const ids = sections.map((s) => s.id);
    const next = index + delta;
    if (next < 0 || next >= ids.length) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved as string);
    setError(null);
    try {
      await reorderSections(courseId, reordered as string[]);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="text-xl font-bold">Sections</h2>
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
      <ul className="mt-2 space-y-3">
        {sections.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              #{s.position} {lang === 'ar' ? s.titleAr : s.titleEn}
            </span>
            <SectionRename sectionId={s.id} onChanged={onChanged} />
            <OrderingControls onMoveUp={() => void move(i, -1)} onMoveDown={() => void move(i, 1)} upDisabled={i === 0} downDisabled={i === sections.length - 1} busy={busy} />
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => void submit(e)} noValidate className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field id="sec-ta" label={t.fieldTitleAr}>
          <input id="sec-ta" required className={textInputClassName(false)} value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
        </Field>
        <Field id="sec-te" label={t.fieldTitleEn} dir="ltr">
          <input id="sec-te" dir="ltr" required className={textInputClassName(false)} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Button type="submit" disabled={busy}>
            {t.actionAddSection}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SectionRename({ sectionId, onChanged }: { sectionId: string; onChanged: () => Promise<void> }): JSX.Element {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  if (!editing) {
    return (
      <Button variant="secondary" onClick={() => setEditing(true)}>
        {t.actionEdit}
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-end gap-2">
      <input aria-label={t.fieldTitleAr} className={textInputClassName(false)} value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
      <input aria-label={t.fieldTitleEn} dir="ltr" className={textInputClassName(false)} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
      <Button
        variant="primary"
        onClick={() => {
          void (async () => {
            await patchSection(sectionId, { titleAr, titleEn });
            setEditing(false);
            await onChanged();
          })();
        }}
      >
        {t.submitSave}
      </Button>
    </span>
  );
}
