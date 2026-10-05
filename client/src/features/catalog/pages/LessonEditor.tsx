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
import { createLesson, patchLesson, reorderLessons } from '../api/client';
import type { AdminLesson } from '../types/models';
import { MediaUploader } from './MediaUploader';
import { AdminAssessmentPanel } from '../../assessments/AdminAssessmentPanel';
import { AdminLessonMaterials } from '../../learning/materials/AdminLessonMaterials';
import { DeletionPanel } from './DeletionPanel';
import { businessState } from '../../../components/ui/AdminNavigation';
import { EntityRename } from './EntityRename';
import { useUnsavedChanges } from '../../../components/ui/UnsavedChanges';

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
  useUnsavedChanges(!!(titleAr || titleEn),lang==='ar'?'اسم الدرس الجديد غير محفوظ. هل تريد تركه؟':'The new lesson name is unsaved. Leave without saving?');

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
      <PaginatedCollection as="ul" id={`lessons-${sectionId}`} className="space-y-3" disabled={busy}>
        {lessons.map((l, i) => (
          <li key={l.id} className="rounded-control border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                #{l.position} {lang === 'ar' ? l.titleAr : l.titleEn}
              </span>
              <EntityRename titleAr={l.titleAr} titleEn={l.titleEn} onSave={async body=>{await patchLesson(l.id,body);await onChanged();}} />
              <OrderingControls
                onMoveUp={() => void move(i, -1)}
                onMoveDown={() => void move(i, 1)}
                upDisabled={i === 0}
                downDisabled={i === lessons.length - 1}
                busy={busy}
              />
            </div>
            <div className="mt-2 text-sm text-muted">
              {t.mediaStatusLabel}: {l.media ? businessState(l.media.status, lang==='ar') : '—'}
            </div>
            <MediaUploader
              lessonId={l.id}
              mediaStatus={l.media?.status ?? null}
              onChanged={onChanged}
            />
            <AdminLessonMaterials lessonId={l.id} />
            <AdminAssessmentPanel lessonId={l.id} />
            <DeletionPanel kind="lessons" targetId={l.id} entityName={lang==='ar'?l.titleAr:l.titleEn} expectedConfirmation={l.id} onChanged={onChanged}/>
          </li>
        ))}
      </PaginatedCollection>
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
        <div className="col-span-2 max-sm:col-span-1">
          <FormActions className="mt-0">
            <Button type="submit" disabled={busy}>
              {t.actionAddLesson}
            </Button>
          </FormActions>
        </div>
      </form>
    </div>
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
