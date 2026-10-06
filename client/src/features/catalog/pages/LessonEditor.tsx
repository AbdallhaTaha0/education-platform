import { useEffect, useState, type FormEvent } from 'react';
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
import { useUnsavedChanges, useConfirmNavigation } from '../../../components/ui/UnsavedChanges';

export function LessonList({
  sectionId,
  lessons,
  onChanged,
  blockedReason,
  additionBlockedReason,
  workspaceMode = 'video',
}: {
  sectionId: string;
  lessons: AdminLesson[];
  onChanged: () => Promise<void>;
  blockedReason?: string;
  additionBlockedReason?: string;
  workspaceMode?: 'video' | 'assessments' | 'materials';
}): JSX.Element {
  const { t, lang } = useLang();
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(lessons[0]?.id ?? ''), [search, setSearch] = useState('');
  const confirmLeave = useConfirmNavigation();
  const selectedLesson = lessons.find(l => l.id === selected) ?? lessons[0];
  const selectedId = selectedLesson?.id ?? '';
  useEffect(() => { if (selected !== selectedId) setSelected(selectedId); }, [selected, selectedId]);
  const filtered = lessons.filter(l => `${l.titleAr} ${l.titleEn}`.toLowerCase().includes(search.trim().toLowerCase()));
  useUnsavedChanges(!!(titleAr || titleEn),lang==='ar'?'اسم الدرس الجديد غير محفوظ. هل تريد تركه؟':'The new lesson name is unsaved. Leave without saving?');

  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy || additionBlockedReason || !e.currentTarget.reportValidity()) return;
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
    if (busy || blockedReason) return;
    const ids = lessons.map((l) => l.id);
    const next = index + delta;
    if (next < 0 || next >= ids.length) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved as string);
    setError(null);
    setBusy(true);
    try {
      await reorderLessons(sectionId, reordered as string[]);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
      <label htmlFor={`lesson-search-${sectionId}`} className="mt-4 block text-sm font-semibold">{lang === 'ar' ? 'ابحث عن درس' : 'Find a lesson'}</label>
      <input id={`lesson-search-${sectionId}`} value={search} maxLength={100} onChange={e => setSearch(e.target.value)} className={`${textInputClassName(false)} mt-2 mb-3`} />
      <PaginatedCollection as="ul" id={`lessons-${sectionId}`} resetKey={search} className="grid gap-2 sm:grid-cols-2" disabled={busy}>
        {filtered.map(l => <li key={l.id}><Button unstyled variant="secondary" aria-pressed={l.id === selectedLesson?.id} aria-controls={`lesson-workspace-${sectionId}`} disabled={busy} className={`min-h-[48px] w-full rounded-control border p-3 text-start ${l.id === selectedLesson?.id ? 'border-primary bg-elevated' : 'border-border bg-surface'}`} onClick={() => { if (l.id !== selectedLesson?.id && confirmLeave()) setSelected(l.id); }}><span className="block break-words font-bold">#{l.position} {lang === 'ar' ? l.titleAr : l.titleEn}</span><span className="text-sm text-muted">{t.mediaStatusLabel}: {l.media ? businessState(l.media.status, lang === 'ar') : '—'}</span></Button></li>)}
      </PaginatedCollection>
      {!filtered.length ? <p className="my-3 text-sm text-muted">{lang === 'ar' ? 'لا توجد دروس مطابقة.' : 'No matching lessons.'}</p> : null}
      <ul id={`lesson-workspace-${sectionId}`} className="mt-4 space-y-3" data-testid="selected-lesson-editor">
        {lessons.map((l, i) => l.id === selectedLesson?.id ? (
          <li key={l.id} className="rounded-control border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                #{l.position} {lang === 'ar' ? l.titleAr : l.titleEn}
              </span>
              {workspaceMode === 'video' ? <><EntityRename titleAr={l.titleAr} titleEn={l.titleEn} blockedReason={blockedReason} onSave={async body=>{await patchLesson(l.id,body);await onChanged();}} />
              <OrderingControls
                onMoveUp={() => void move(i, -1)}
                onMoveDown={() => void move(i, 1)}
                upDisabled={i === 0}
                downDisabled={i === lessons.length - 1}
                busy={busy}
                blockedReason={blockedReason}
              /></> : null}
            </div>
            <div className="mt-2 text-sm text-muted">
              {t.mediaStatusLabel}: {l.media ? businessState(l.media.status, lang==='ar') : '—'}
            </div>
            {workspaceMode === 'video' ? <><MediaUploader
              lessonId={l.id}
              mediaStatus={l.media?.status ?? null}
              onChanged={onChanged}
              blockedReason={additionBlockedReason}
              canReplace={!blockedReason}
            />
            <DeletionPanel kind="lessons" targetId={l.id} entityName={lang==='ar'?l.titleAr:l.titleEn} expectedConfirmation={l.id} onChanged={onChanged}/>
            </> : workspaceMode === 'materials' ? <AdminLessonMaterials lessonId={l.id} blockedReason={blockedReason} /> : <AdminAssessmentPanel lessonId={l.id} initiallyOpen />}
          </li>
        ) : null)}
      </ul>
      {workspaceMode === 'video' ? <details className="mt-4 rounded-control border border-border p-4" data-testid="add-lesson-form" open={lessons.length === 0 ? true : undefined}><summary className="cursor-pointer font-bold">{t.actionAddLesson}</summary><form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="mt-3 grid grid-cols-2 gap-3 max-sm:grid-cols-1"
      >
        <Field id={`les-ta-${sectionId}`} label={t.fieldTitleAr}>
          <input
            id={`les-ta-${sectionId}`}
            disabled={busy || !!additionBlockedReason}
            maxLength={300}
            required
            className={textInputClassName(false)}
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
          />
        </Field>
        <Field id={`les-te-${sectionId}`} label={t.fieldTitleEn} dir="ltr">
          <input
            id={`les-te-${sectionId}`}
            disabled={busy || !!additionBlockedReason}
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
            <Button type="submit" disabled={busy || !!additionBlockedReason} disabledReason={additionBlockedReason}>
              {t.actionAddLesson}
            </Button>
          </FormActions>
        </div>
      </form></details> : null}
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
