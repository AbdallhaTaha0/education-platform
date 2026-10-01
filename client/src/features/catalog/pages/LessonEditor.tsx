import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { OrderingControls } from '../components/OrderingControls';
import { createLesson, patchLesson, reorderLessons } from '../api/client';
import type { AdminLesson } from '../types/models';
import { MediaUploader } from './MediaUploader';

export function LessonList({
  sectionId,
  lessons,
  onChanged,
}: {
  sectionId: string;
  lessons: AdminLesson[];
  onChanged: () => Promise<void>;
}): JSX.Element {
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
      await createLesson(sectionId, { titleAr, titleEn });
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
    const ids = lessons.map((l) => l.id);
    const next = index + delta;
    if (next < 0 || next >= ids.length) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved as string);
    try {
      await reorderLessons(sectionId, reordered as string[]);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    }
  }

  return (
    <div className="mt-2">
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
      <ul className="space-y-3">
        {lessons.map((l, i) => (
          <li key={l.id} className="rounded-control border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                #{l.position} {lang === 'ar' ? l.titleAr : l.titleEn}
              </span>
              <LessonRename lessonId={l.id} onChanged={onChanged} />
              <OrderingControls
                onMoveUp={() => void move(i, -1)}
                onMoveDown={() => void move(i, 1)}
                upDisabled={i === 0}
                downDisabled={i === lessons.length - 1}
                busy={busy}
              />
            </div>
            <div className="mt-2 text-sm text-muted">
              {t.mediaStatusLabel}: {l.media?.status ?? '—'}
            </div>
            <MediaUploader
              lessonId={l.id}
              mediaStatus={l.media?.status ?? null}
              onChanged={onChanged}
            />
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="mt-3 grid grid-cols-2 gap-3 max-sm:grid-cols-1"
      >
        <Field id={`les-ta-${sectionId}`} label={t.fieldTitleAr}>
          <input
            id={`les-ta-${sectionId}`}
            required
            className={textInputClassName(false)}
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
          />
        </Field>
        <Field id={`les-te-${sectionId}`} label={t.fieldTitleEn} dir="ltr">
          <input
            id={`les-te-${sectionId}`}
            dir="ltr"
            required
            className={textInputClassName(false)}
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
          />
        </Field>
        <div className="col-span-2">
          <Button type="submit" disabled={busy}>
            {t.actionAddLesson}
          </Button>
        </div>
      </form>
    </div>
  );
}

function LessonRename({
  lessonId,
  onChanged,
}: {
  lessonId: string;
  onChanged: () => Promise<void>;
}): JSX.Element {
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
      <input
        aria-label={t.fieldTitleAr}
        className={textInputClassName(false)}
        value={titleAr}
        onChange={(e) => setTitleAr(e.target.value)}
      />
      <input
        aria-label={t.fieldTitleEn}
        dir="ltr"
        className={textInputClassName(false)}
        value={titleEn}
        onChange={(e) => setTitleEn(e.target.value)}
      />
      <Button
        variant="primary"
        onClick={() => {
          void (async () => {
            await patchLesson(lessonId, { titleAr, titleEn });
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

export function LessonEditorCard({
  sectionId,
  lessons,
  onChanged,
}: {
  sectionId: string;
  lessons: AdminLesson[];
  onChanged: () => Promise<void>;
}): JSX.Element {
  return (
    <Card className="mt-2">
      <LessonList sectionId={sectionId} lessons={lessons} onChanged={onChanged} />
    </Card>
  );
}
