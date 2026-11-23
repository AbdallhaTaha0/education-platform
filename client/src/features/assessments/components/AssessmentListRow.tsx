import { Button } from '../../../components/ui/Button';
import { PreparationPanel } from '../ProgramSettings';
import { revisionSnapshot, type Entry, type TransitionFeedback } from './types';

export function AssessmentListRow({
  entry,
  ar,
  busy,
  publishedSnapshot,
  transitionFeedback,
  onEdit,
  onTransition,
  onReview,
}: {
  entry: Entry;
  ar: boolean;
  busy: boolean;
  publishedSnapshot?: string;
  transitionFeedback: TransitionFeedback | null;
  onEdit: (entry: Entry) => void;
  onTransition: (id: string, action: string) => void;
  onReview: (entry: Entry) => void;
}): JSX.Element {
  const label = (a: string, e: string): string => (ar ? a : e);
  const alreadyPublished =
    entry.status === 'PUBLISHED' && publishedSnapshot === revisionSnapshot(entry);
  const hasProgram = entry.content.questions.some((q) => q.type === 'PROGRAM');

  return (
    <div
      data-admin-assessment={entry.id}
      className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-surface p-3.5 text-start"
    >
      <strong className="text-ink">{ar ? entry.content.titleAr : entry.content.titleEn}</strong>
      <span className="text-xs text-muted">
        {label('النسخة', 'Revision')} {entry.version} ·{' '}
        {label(
          'تبقى النسخة المنشورة متاحة أثناء تعديل المسودة',
          'The published revision stays available while the draft changes',
        )}
      </span>
      <span className="inline-flex items-center rounded-full border border-border bg-field px-2.5 py-0.5 text-xs font-semibold text-muted">
        {entry.status === 'PUBLISHED'
          ? label('منشور', 'Published')
          : entry.status === 'ARCHIVED'
            ? label('مؤرشف', 'Archived')
            : label('مسودة', 'Draft')}{' '}
        · {entry.required ? label('مطلوب', 'Required') : label('اختياري', 'Optional')}
      </span>
      <Button variant="secondary" onClick={() => onEdit(entry)}>
        {label('تعديل', 'Edit')}
      </Button>
      {!hasProgram ? (
        <Button
          data-testid={`assessment-publish-${entry.id}`}
          disabled={busy || alreadyPublished}
          disabledReason={
            busy
              ? undefined
              : label(
                  'هذه التعديلات منشورة بالفعل. احفظ تعديلات جديدة قبل نشرها.',
                  'These changes are already published. Save new changes before publishing again.',
                )
          }
          onClick={() => onTransition(entry.id, 'publish')}
        >
          {alreadyPublished ? label('تم النشر', 'Published') : label('نشر النسخة', 'Publish revision')}
        </Button>
      ) : null}
      <Button disabled={busy} variant="secondary" onClick={() => onTransition(entry.id, 'archive')}>
        {label('أرشفة', 'Archive')}
      </Button>
      <Button variant="secondary" onClick={() => onReview(entry)}>
        {label('الحلول المرسلة', 'Submissions')}
      </Button>
      {hasProgram ? (
        <PreparationPanel
          key={JSON.stringify(entry.content)}
          assessmentId={entry.id}
          onPublish={() => onTransition(entry.id, 'publish')}
        />
      ) : null}
      {transitionFeedback?.id === entry.id ? (
        <p
          role={transitionFeedback.kind === 'error' ? 'alert' : 'status'}
          className={`w-full text-sm font-semibold ${
            transitionFeedback.kind === 'error' ? 'text-error-fg' : 'text-success-fg'
          }`}
        >
          {transitionFeedback.message}
        </p>
      ) : null}
    </div>
  );
}
