import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { useLang } from '../../i18n';
import { useCodingIde } from '../../features';
import { PaginatedCollection } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { FormActions } from '../../components/ui/FormActions';
import { Notice, Loading } from '../../components/ui/Notice';
import { textInputClassName } from '../../components/ui/Field';
import { assessmentApi, errorLabel } from './api';
import { modeName, type IDEMode } from '../ide/types';
import { ModeTabs } from '../ide/ModeTabs';
import { ProgramSettings } from './ProgramSettings';
import { AdminSubmissionReview } from './AdminSubmissionReview';
import { useUnsavedChanges } from '../../components/ui/UnsavedChanges';
import { useFocusedWorkspace } from '../../components/ui/useFocusedWorkspace';
import { useSuccessFeedback } from '../../components/ui/ErrorFeedback';
import {
  EditorFieldErrors,
  focusIssue,
  inspectEditor,
  type EditorIssue,
} from './EditorFeedback';
import { AssessmentListRow } from './components/AssessmentListRow';
import { ChoiceOptionsEditor } from './components/ChoiceOptionsEditor';
import { CheckBuilder } from './components/CheckBuilder';
import {
  newQuestion,
  revisionSnapshot,
  type Content,
  type Entry,
  type Question,
  type TransitionFeedback,
} from './components/types';

const WebIDE = lazy(() =>
  import('../ide/WebIDE').then((m) => ({ default: m.WebIDE })),
);

export function AdminAssessmentPanel({
  lessonId,
  initiallyOpen = false,
}: {
  lessonId: string;
  initiallyOpen?: boolean;
}): JSX.Element {
  const { lang, setLang } = useLang();
  const codingEnabled = useCodingIde();
  const ar = lang === 'ar';
  const label = (a: string, e: string): string => (ar ? a : e);
  const [mode, setMode] = useState<IDEMode>('javascript');
  const [open, setOpen] = useState(initiallyOpen);
  const [list, setList] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<string | null | false>(false);
  const [content, setContent] = useState<Content>({
    titleAr: '',
    titleEn: '',
    instructionsAr: '',
    instructionsEn: '',
    questions: [],
  });
  const [kind, setKind] = useState('ASSIGNMENT');
  const [required, setRequired] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [transitionFeedback, setTransitionFeedback] = useState<TransitionFeedback | null>(null);
  const [publishedSnapshots, setPublishedSnapshots] = useState<Record<string, string>>({});
  const success = useSuccessFeedback();
  const [review, setReview] = useState<Entry | null>(null);
  const [errorOccurrence, setErrorOccurrence] = useState(0);
  const editor = useRef<HTMLDivElement>(null);
  const requirementGroup = useId();
  const [issues, setIssues] = useState<EditorIssue[]>([]);
  const [baseline, setBaseline] = useState('');
  const [rawEdited, setRawEdited] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const questionVersions = useRef(
    new Map<string, Partial<Record<Question['type'], Question>>>(),
  );
  const snapshot = JSON.stringify({ content, kind, required });
  const latestSnapshot = useRef(snapshot);
  latestSnapshot.current = snapshot;
  const dirty = editing !== false && (snapshot !== baseline || rawEdited);

  useEffect(() => {
    if (editor.current) editor.current.inert = busy;
  }, [busy, editing]);

  const discard = useUnsavedChanges(
    dirty,
    label(
      'لديك تعديلات غير محفوظة في التقييم. هل تريد تركها والمتابعة؟',
      'You have unsaved assessment changes. Discard them and continue?',
    ),
  );

  function clearFeedback(): void {
    setError('');
    setIssues([]);
  }

  function closeEditor(): boolean {
    if (busy || !discard()) return false;
    setEditing(false);
    clearFeedback();
    return true;
  }

  useFocusedWorkspace(editing !== false, editor, () => {
    closeEditor();
  });

  const reload = async (): Promise<void> => {
    const r = await assessmentApi<{ assessments: Entry[] }>(
      `/admin/assessments/lessons/${lessonId}`,
    );
    setList(r.assessments);
  };

  useEffect(() => {
    if (open) void reload().catch((e) => setError(errorLabel(e, ar)));
  }, [open, lessonId]);

  function edit(entry?: Entry): void {
    if (busy || !discard()) return;
    if (!codingEnabled && entry?.content.questions.some((q) => q.type !== 'CHOICE')) return;
    const nextContent = entry?.content ?? {
      titleAr: '',
      titleEn: '',
      instructionsAr: '',
      instructionsEn: '',
      ide: mode,
      questions: [
        codingEnabled
          ? newQuestion(mode === 'web' ? 'CODING' : 'PROGRAM', mode)
          : {
              id: crypto.randomUUID(),
              type: 'CHOICE' as const,
              titleAr: '',
              titleEn: '',
              choices: [
                { id: 'a', textAr: '', textEn: '' },
                { id: 'b', textAr: '', textEn: '' },
              ],
              correctChoiceId: '',
            },
      ],
    };
    const nextKind = entry?.kind ?? 'ASSIGNMENT';
    const nextRequired = entry ? String(entry.draftRequired ?? entry.required) : '';
    setEditing(entry?.id ?? null);
    setContent(nextContent);
    setKind(nextKind);
    setRequired(nextRequired);
    setReview(null);
    setBaseline(
      JSON.stringify({
        content: nextContent,
        kind: nextKind,
        required: nextRequired,
      }),
    );
    setRawEdited(false);
    setSaved(false);
    clearFeedback();
    questionVersions.current.clear();
    setActiveQuestion(nextContent.questions[0]?.id ?? null);
  }

  function updateQuestion(index: number, q: Question): void {
    clearFeedback();
    setSaved(false);
    setContent((c) => ({
      ...c,
      questions: c.questions.map((old, i) => (i === index ? q : old)),
    }));
  }

  function changeQuestionType(index: number, type: Question['type']): void {
    if (!codingEnabled && type !== 'CHOICE') return;
    const current = content.questions[index]!;
    if (current.type === type) return;
    const versions = questionVersions.current.get(current.id) ?? {};
    versions[current.type] = current;
    questionVersions.current.set(current.id, versions);
    const next =
      versions[type] ??
      (type === 'CHOICE'
        ? {
            id: current.id,
            type,
            titleAr: '',
            titleEn: '',
            choices: [
              { id: 'a', textAr: '', textEn: '' },
              { id: 'b', textAr: '', textEn: '' },
            ],
            correctChoiceId: '',
          }
        : newQuestion(type, content.ide ?? 'javascript'));
    updateQuestion(index, {
      ...next,
      id: current.id,
      titleAr: current.titleAr,
      titleEn: current.titleEn,
    });
  }

  async function save(): Promise<void> {
    if (busy || !editor.current) return;
    const invalid = inspectEditor(editor.current, ar);
    setIssues(invalid);
    setErrorOccurrence((n) => n + 1);
    if (invalid.length) {
      setError('');
      const questionIndex = Number(
        invalid[0]!.control
          .closest('[data-admin-question]')
          ?.getAttribute('data-admin-question'),
      );
      if (questionIndex) setActiveQuestion(content.questions[questionIndex - 1]!.id);
      requestAnimationFrame(() => focusIssue(invalid[0]!.control));
      return;
    }
    const submitted = snapshot;
    setBusy(true);
    setError('');
    try {
      const result = await assessmentApi<Entry>(
        editing
          ? `/admin/assessments/${editing}`
          : `/admin/assessments/lessons/${lessonId}`,
        editing ? 'PUT' : 'POST',
        { kind, required: required === 'true', content },
      );
      setBaseline(submitted);
      setSaved(true);
      setRawEdited(false);
      if (latestSnapshot.current === submitted) setEditing(false);
      else if (!editing) setEditing(result.id);
      await reload().catch(() =>
        setError(
          label(
            'تم حفظ المسودة، لكن تعذر تحديث القائمة. أعد فتح الصفحة لتحديثها.',
            'Draft saved, but the list could not refresh. Reopen the page to refresh it.',
          ),
        ),
      );
    } catch (e) {
      setError(`${label('حفظ المسودة', 'Save draft')}: ${errorLabel(e, ar)}`);
    } finally {
      setBusy(false);
    }
  }

  async function transition(id: string, action: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    setTransitionFeedback(null);
    try {
      const result = await assessmentApi<Entry>(`/admin/assessments/${id}/${action}`, 'POST', {});
      const message =
        action === 'publish'
          ? label(
              `تم نشر النسخة ${result.version} بنجاح.`,
              `Revision ${result.version} published successfully.`,
            )
          : label('تمت أرشفة التقييم.', 'Assessment archived.');
      // The mutation response is authoritative even if the subsequent list fetch fails.
      setList((current) => current.map((entry) => (entry.id === id ? result : entry)));
      if (action === 'publish') {
        setPublishedSnapshots((current) => ({ ...current, [id]: revisionSnapshot(result) }));
      }
      setTransitionFeedback({ id, message, kind: 'success' });
      success(message);
      await reload().catch(() =>
        setTransitionFeedback({
          id,
          kind: 'success',
          message: `${message} ${label(
            'تعذر تحديث القائمة؛ أعد فتحها لتحديثها.',
            'The list could not refresh; reopen it to refresh.',
          )} `,
        }),
      );
    } catch (e) {
      const message = errorLabel(e, ar);
      setErrorOccurrence((n) => n + 1);
      setError(message);
      setTransitionFeedback({ id, message, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const input = (
    name: string,
    value: string,
    onChange: (v: string) => void,
    dir?: 'rtl' | 'ltr',
    maxLength = 2000,
  ) => (
    <label className="block text-start">
      <span className="text-sm font-semibold">{name}</span>
      <input
        required
        maxLength={maxLength}
        dir={dir}
        className={`${textInputClassName(false)} mt-1`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );

  return (
    <section
      data-testid={`assessment-admin-${lessonId}`}
      className="mt-4 border-t border-border pt-3"
    >
      <Button
        variant="secondary"
        onClick={() => {
          if (open && !closeEditor()) return;
          setOpen(!open);
        }}
      >
        {label('الواجبات والاختبارات', 'Assignments and quizzes')}
      </Button>
      {open ? (
        <div className="mt-3 space-y-4">
          {codingEnabled ? (
            <ModeTabs
              value={mode}
              onChange={(next) => {
                if (closeEditor()) {
                  setMode(next);
                  setReview(null);
                }
              }}
              label={label('نوع المحرر', 'IDE type')}
            />
          ) : (
            <Notice kind="info">
              {label(
                'تقييمات البرمجة متوقفة مؤقتًا. الاختيار من متعدد متاح؛ جميع الأعمال السابقة محفوظة.',
                'Coding assessments are temporarily disabled. Multiple-choice quizzes remain available; existing work is preserved.',
              )}
            </Notice>
          )}

          {error && editing === false ? (
            <Notice kind="error" key={errorOccurrence}>
              <p>{error}</p>
              {issues.length ? (
                <ul className="mt-2 space-y-2">
                  {issues.map((issue, index) => (
                    <li key={index}>
                      <button
                        type="button"
                        className="min-h-[44px] text-start underline"
                        onClick={() => focusIssue(issue.control)}
                      >
                        {issue.message}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Notice>
          ) : null}

          {saved ? (
            <Notice kind="success">
              {label('تم حفظ المسودة على الخادم.', 'Draft saved on the server.')}
            </Notice>
          ) : null}

          <PaginatedCollection
            id="assessment-list"
            resetKey={mode}
            disabled={busy}
            className="space-y-3"
          >
            {list
              .filter((a) =>
                codingEnabled
                  ? (a.content.ide ?? 'javascript') === mode
                  : a.content.questions.every((q) => q.type === 'CHOICE'),
              )
              .map((a) => (
                <AssessmentListRow
                  key={a.id}
                  entry={a}
                  ar={ar}
                  busy={busy}
                  publishedSnapshot={publishedSnapshots[a.id]}
                  transitionFeedback={transitionFeedback}
                  onEdit={edit}
                  onTransition={(id, action) => void transition(id, action)}
                  onReview={(entry) => {
                    if (closeEditor()) setReview(entry);
                  }}
                />
              ))}
          </PaginatedCollection>

          <Button variant="secondary" onClick={() => edit()}>
            {label('إضافة تقييم', 'Add assessment')}
          </Button>

          {editing !== false ? (
            <div
              ref={editor}
              data-testid="assessment-editor"
              onInvalid={(event) => event.preventDefault()}
              onInput={(event) => {
                /* Native selects fire input before change: rerendering here restores the old controlled value. */
                if (
                  !(event.target instanceof HTMLSelectElement) &&
                  (event.target as HTMLElement).closest('[data-testid="typed-value"]')
                ) {
                  setRawEdited(true);
                }
              }}
              onChange={() => {
                clearFeedback();
                setSaved(false);
              }}
              className="admin-focused-workspace !m-0 space-y-4 text-start"
              aria-label={label('مساحة تحرير التقييم', 'Assessment workspace')}
            >
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-canvas py-3">
                <h2 className="text-xl font-extrabold text-ink">
                  {label('تحرير التقييم', 'Edit assessment')} ·{' '}
                  {codingEnabled
                    ? modeName(content.ide ?? 'javascript')
                    : label('اختيار من متعدد', 'Multiple choice')}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setLang(ar ? 'en' : 'ar')}
                    aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}
                  >
                    {ar ? 'EN' : 'ع'}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => closeEditor()}>
                    {label('العودة إلى الدروس', 'Back to lessons')}
                  </Button>
                </div>
              </div>

              <p className="rounded-xl border border-border bg-surface p-3.5 text-sm text-muted">
                {codingEnabled
                  ? label(
                      '١. احفظ المسودة ← ٢. حضّر الاختبارات ← ٣. راجعها ← ٤. انشر. النسخة المنشورة الحالية تبقى متاحة حتى نشر التعديل.',
                      '1. Save draft → 2. Prepare tests → 3. Review → 4. Publish. The current published revision remains available until you publish the changes.',
                    )
                  : label(
                      '١. أضف الأسئلة والخيارات وحدد الإجابات الصحيحة ← ٢. احفظ المسودة ← ٣. انشر. النسخة المنشورة تبقى متاحة أثناء التحرير.',
                      '1. Add questions and choices; select correct answers → 2. Save draft → 3. Publish. The published revision remains available while editing.',
                    )}
              </p>

              <p role="status" data-testid="admin-draft-status" className="text-sm font-semibold">
                {busy
                  ? label('جارٍ حفظ المسودة…', 'Saving draft…')
                  : dirty
                    ? label('تعديلات غير محفوظة', 'Unsaved changes')
                    : editing
                      ? label('المسودة المحفوظة — لم تُعدّل بعد', 'Saved draft — no new changes')
                      : label('مسودة جديدة — لم تُحفظ بعد', 'New draft — not saved yet')}
              </p>

              {error ? (
                <div
                  role="alert"
                  className="rounded-control border border-error-fg bg-error-bg p-3 text-error-fg"
                  key={errorOccurrence}
                >
                  <p>{error}</p>
                </div>
              ) : null}

              <EditorFieldErrors issues={issues} />

              <div className="grid gap-3 md:grid-cols-2">
                {input(
                  'العنوان بالعربية',
                  content.titleAr,
                  (v) => setContent({ ...content, titleAr: v }),
                  'rtl',
                  200,
                )}
                {input(
                  'Title in English',
                  content.titleEn,
                  (v) => setContent({ ...content, titleEn: v }),
                  'ltr',
                  200,
                )}
                <label className="block text-start">
                  <span className="text-sm font-semibold">
                    {label('التعليمات بالعربية', 'Arabic instructions')}
                  </span>
                  <textarea
                    required
                    maxLength={16000}
                    dir="rtl"
                    className={`${textInputClassName(false)} mt-1`}
                    value={content.instructionsAr}
                    onChange={(e) => setContent({ ...content, instructionsAr: e.target.value })}
                  />
                </label>
                <label className="block text-start">
                  <span className="text-sm font-semibold">English instructions</span>
                  <textarea
                    required
                    maxLength={16000}
                    dir="ltr"
                    className={`${textInputClassName(false)} mt-1`}
                    value={content.instructionsEn}
                    onChange={(e) => setContent({ ...content, instructionsEn: e.target.value })}
                  />
                </label>
                <label className="block text-start">
                  <span className="text-sm font-semibold">
                    {label('نوع التقييم', 'Assessment type')}
                  </span>
                  <select
                    className={`${textInputClassName(false)} mt-1`}
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="ASSIGNMENT">{label('واجب', 'Assignment')}</option>
                    <option value="QUIZ">{label('اختبار', 'Quiz')}</option>
                  </select>
                </label>
                <fieldset data-testid="assessment-requirement" className="min-w-0 space-y-2">
                  <legend className="text-sm font-semibold">
                    {label('هل يلزم اجتيازه للمتابعة؟', 'Required to continue?')}
                  </legend>
                  {[
                    [
                      'true',
                      'مطلوب',
                      'Required',
                      'يجب اجتيازه لفتح الدرس التالي.',
                      'Must be passed to unlock the next lesson.',
                    ],
                    [
                      'false',
                      'اختياري',
                      'Optional',
                      'يمكن متابعة الدروس دون اجتيازه.',
                      'Students can continue without passing it.',
                    ],
                  ].map(([value, titleAr, titleEn, helpAr, helpEn]) => (
                    <label
                      key={value}
                      className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-control border border-border bg-surface p-3"
                    >
                      <input
                        type="radio"
                        required
                        name={`assessment-required-${requirementGroup}`}
                        value={value}
                        checked={required === value}
                        onChange={() => setRequired(value!)}
                        data-testid={`assessment-required-${value}`}
                        data-missing-message={label(
                          'اختر مطلوب أو اختياري قبل حفظ التقييم.',
                          'Choose Required or Optional before saving the assessment.',
                        )}
                        className="mt-1 accent-primary"
                      />
                      <span>
                        <strong>{label(titleAr!, titleEn!)}</strong>
                        <span className="block text-sm text-muted">
                          {label(helpAr!, helpEn!)}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </div>

              <section
                className="space-y-1.5"
                aria-label={label('أسئلة التقييم', 'Assessment questions')}
              >
                <h3 className="text-lg font-extrabold text-ink">
                  {label('الأسئلة', 'Questions')} · {content.questions.length}/10
                </h3>
                <p className="text-sm text-muted">
                  {label(
                    'افتح سؤالًا واحدًا لتحريره. جميع الأسئلة تُراجع عند الحفظ.',
                    'Open one question to edit. All questions are checked when you save.',
                  )}
                </p>
              </section>

              {content.questions.map((q, index) => (
                <details
                  key={q.id}
                  open={activeQuestion === q.id}
                  data-admin-question={index + 1}
                  className="rounded-xl border border-border bg-surface"
                >
                  <summary
                    className="cursor-pointer p-4 font-semibold"
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveQuestion(activeQuestion === q.id ? null : q.id);
                    }}
                  >
                    {label('السؤال', 'Question')} {index + 1} ·{' '}
                    {(ar ? q.titleAr : q.titleEn) || label('سؤال جديد', 'New question')}{' '}
                    <span className="text-sm font-normal text-muted">
                      ·{' '}
                      {q.type === 'CHOICE'
                        ? label('اختيار من متعدد', 'Multiple choice')
                        : q.type === 'PROGRAM'
                          ? label('مدخلات ومخرجات', 'Input/output')
                          : label('اختبارات سلوك', 'Behavior checks')}
                    </span>
                  </summary>
                  <div className="space-y-4 border-t border-border p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <h3 className="font-bold">
                        {label('السؤال', 'Question')} {index + 1}
                      </h3>
                      <label className="block flex-1 text-start">
                        <span className="text-sm font-semibold">
                          {label('نوع السؤال', 'Question type')}
                        </span>
                        <select
                          data-testid="question-type"
                          aria-label={label('نوع السؤال', 'Question type')}
                          className={`${textInputClassName(false)} mt-1`}
                          value={q.type}
                          onChange={(e) =>
                            changeQuestionType(index, e.target.value as Question['type'])
                          }
                        >
                          {codingEnabled ? (
                            <option value="PROGRAM">
                              {label('مسألة مدخلات ومخرجات', 'Input/output problem')}
                            </option>
                          ) : null}
                          {codingEnabled && content.ide !== 'python' ? (
                            <option value="CODING">
                              {label('اختبارات سلوك', 'Behavior checks')}
                            </option>
                          ) : null}
                          <option value="CHOICE">
                            {label('اختيار من متعدد', 'Multiple choice')}
                          </option>
                        </select>
                      </label>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          clearFeedback();
                          setSaved(false);
                          setContent((c) => ({
                            ...c,
                            questions: c.questions.filter((old) => old.id !== q.id),
                          }));
                          questionVersions.current.delete(q.id);
                          setActiveQuestion(
                            content.questions.find((old) => old.id !== q.id)?.id ?? null,
                          );
                        }}
                      >
                        {label('حذف السؤال', 'Remove question')}
                      </Button>
                      <p className="basis-full text-sm text-muted">
                        {label(
                          'يمكن تغيير النوع دون فقد العناوين. إعدادات كل نوع تبقى خلال جلسة التحرير؛ يُحفظ النوع المختار فقط.',
                          'Switch freely without losing titles. Each type’s settings stay in this editing session; only the selected type is saved.',
                        )}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {input(
                        'السؤال بالعربية',
                        q.titleAr,
                        (v) => updateQuestion(index, { ...q, titleAr: v }),
                        'rtl',
                      )}
                      {input(
                        'Question in English',
                        q.titleEn,
                        (v) => updateQuestion(index, { ...q, titleEn: v }),
                        'ltr',
                      )}
                    </div>

                    {q.type !== 'CHOICE' ? (
                      <>
                        {q.type === 'PROGRAM' ? (
                          <ProgramSettings
                            mode={content.ide ?? 'javascript'}
                            value={q.program!}
                            onChange={(program) => updateQuestion(index, { ...q, program })}
                          />
                        ) : null}
                        <details>
                          <summary className="cursor-pointer">
                            {q.type === 'PROGRAM'
                              ? label(
                                  'كود ابتدائي اختياري للطالب — لا تضع الحل المرجعي هنا',
                                  'Optional student starter — keep the reference solution separate',
                                )
                              : label('كود الإدارة الخاص', 'Private admin code')}
                          </summary>
                          <Suspense
                            fallback={
                              <Loading text={label('تحميل المحرر…', 'Loading editor…')} />
                            }
                          >
                            <WebIDE
                              mode={content.ide ?? 'javascript'}
                              value={q.starter!}
                              onChange={(starter) => updateQuestion(index, { ...q, starter })}
                            />
                          </Suspense>
                        </details>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={q.shareStarter === true}
                            onChange={(e) =>
                              updateQuestion(index, {
                                ...q,
                                shareStarter: e.target.checked,
                              })
                            }
                          />
                          {label(
                            'مشاركة هذا الكود ككود ابتدائي مع الطالب (لا تضع الحل الصحيح)',
                            'Share this code as student starter code (do not include the solution)',
                          )}
                        </label>
                        <p className="text-sm text-muted">
                          {label(
                            'الكود خاص بالإدارة افتراضيًا. الطالب يبدأ بمحرر فارغ؛ التقييم يعتمد على الاختبارات الخاصة.',
                            'Admin code is private by default. Students start with an empty editor; grading uses your private tests.',
                          )}
                        </p>
                        {q.type === 'CODING' ? (
                          <CheckBuilder
                            mode={content.ide ?? 'javascript'}
                            checks={q.checks!}
                            onChange={(checks) => updateQuestion(index, { ...q, checks })}
                          />
                        ) : null}
                      </>
                    ) : (
                      <ChoiceOptionsEditor
                        question={q}
                        ar={ar}
                        onChange={(next) => updateQuestion(index, next)}
                      />
                    )}
                  </div>
                </details>
              ))}

              <FormActions className="mt-4">
                <Button
                  variant="secondary"
                  data-admin-add-question
                  disabled={busy || content.questions.length >= 10}
                  disabledReason={
                    busy
                      ? undefined
                      : {
                          ar: 'الحد الأقصى ١٠ أسئلة للتقييم.',
                          en: 'Maximum: 10 questions per assessment.',
                        }
                  }
                  onClick={() => {
                    clearFeedback();
                    setSaved(false);
                    const next = codingEnabled
                      ? newQuestion(
                          content.ide === 'web' ? 'CODING' : 'PROGRAM',
                          content.ide ?? 'javascript',
                        )
                      : {
                          id: crypto.randomUUID(),
                          type: 'CHOICE' as const,
                          titleAr: '',
                          titleEn: '',
                          choices: [
                            { id: 'a', textAr: '', textEn: '' },
                            { id: 'b', textAr: '', textEn: '' },
                          ],
                          correctChoiceId: '',
                        };
                    setContent((c) => ({
                      ...c,
                      questions: [...c.questions, next],
                    }));
                    setActiveQuestion(next.id);
                  }}
                >
                  {label('إضافة سؤال', 'Add question')}
                </Button>
                <Button type="button" disabled={busy} onClick={() => void save()}>
                  {label('حفظ مسودة', 'Save draft')}
                </Button>
                <Button disabled={busy} variant="secondary" onClick={() => closeEditor()}>
                  {label('إلغاء', 'Cancel')}
                </Button>
              </FormActions>
            </div>
          ) : null}

          {review ? (
            <AdminSubmissionReview
              key={review.id}
              assessmentId={review.id}
              title={ar ? review.content.titleAr : review.content.titleEn}
              onClose={() => setReview(null)}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
