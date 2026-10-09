import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n';
import { Pagination, type PageInfo } from '../../components/ui/Pagination';
import { Container } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormActions } from '../../components/ui/FormActions';
import { Notice, Loading } from '../../components/ui/Notice';
import { assessmentApi, errorLabel } from './api';
import { modeName, type IDEMode, type SourceFiles } from '../ide/types';
import { useDraftSave } from './useDraftSave';
import { unansweredChoices } from './choiceValidation';
const WebIDE = lazy(() => import('../ide/WebIDE').then((m) => ({ default: m.WebIDE })));
interface Question {
  id: string;
  type: 'CODING' | 'CHOICE' | 'PROGRAM';
  program?: {
    inputAr: string;
    inputEn: string;
    outputAr: string;
    outputEn: string;
    comparison: string;
    samples: Array<{ input: string; output: string }>;
  };
  titleAr: string;
  titleEn: string;
  starter?: SourceFiles;
  choices?: Array<{ id: string; textAr: string; textEn: string }>;
}
interface Answer {
  questionId: string;
  source?: SourceFiles;
  choiceId?: string;
}
interface Assessment {
  id: string;
  version: number;
  lessonId: string;
  courseId: string;
  required: boolean;
  passed: boolean;
  content: {
    ide?: IDEMode;
    titleAr: string;
    titleEn: string;
    instructionsAr: string;
    instructionsEn: string;
    questions: Question[];
  };
  draft: { revision: number; content: Answer[] } | null;
}
interface Result {
  id: string;
  state: string;
  result: {
    error?: string;
    questions?: Array<{
      questionId: string;
      correct: boolean;
      checksPassed: number;
      checksTotal: number;
    }>;
  } | null;
}
export function AssessmentPage({ id }: { id: string }): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const label = (a: string, e: string): string => (ar ? a : e);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [error, setError] = useState('');
  const [unanswered, setUnanswered] = useState<string[]>([]);
  const questionRefs = useRef(new Map<string, HTMLElement>());
  const [dirty, setDirty] = useState(false);
  const revision = useRef(0);
  const saveStatus = useDraftSave({
    value: answers,
    dirty,
    enabled: !!assessment,
    endpoint: `/assessments/${id}/draft`,
    revision,
    extra: { version: assessment?.version },
    ar,
    clearDirty: () => setDirty(false),
  });
  const [checking, setChecking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<Array<{ id: string; state: string; createdAt: string }>>(
    [],
  );
  const [historyPage, setHistoryPage] = useState(1),
    [historySize, setHistorySize] = useState(10),
    [historyRetry, setHistoryRetry] = useState(0);
  const [historyPaging, setHistoryPaging] = useState<PageInfo>({ page: 1, pageSize: 10, total: 0 });
  const [historyError, setHistoryError] = useState(false),
    [historyLoading, setHistoryLoading] = useState(false);
  // A saved pass is progression evidence, not a reconstructed grading result.
  const persistedPass = assessment?.passed === true && !result && !checking;
  useEffect(() => {
    if ((!persistedPass && result?.state !== 'CORRECT') || !assessment) return;
    resultRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [persistedPass, result?.id, result?.state, assessment?.courseId, assessment?.lessonId, lang]);
  useEffect(() => {
    let live = true;
    setHistoryLoading(true);
    setHistoryError(false);
    void assessmentApi<{ submissions: typeof history; pagination: PageInfo }>(
      `/assessments/${id}/history?page=${historyPage}&pageSize=${historySize}`,
    )
      .then((data) => {
        if (!live) return;
        setHistory(data.submissions);
        setHistoryPaging(data.pagination);
        setHistoryPage(data.pagination.page);
        const pending =
          historyPage === 1
            ? data.submissions.find((s) => s.state === 'PENDING' || s.state === 'RUNNING')
            : undefined;
        if (pending) setChecking((current) => current ?? pending.id);
      })
      .catch(() => {
        if (live) setHistoryError(true);
      })
      .finally(() => {
        if (live) setHistoryLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, historyPage, historySize, historyRetry]);
  useEffect(() => {
    let active = true;
    setAssessment(null);
    setHistoryPage(1);
    setDirty(false);
    setResult(null);
    setChecking(null);
    setError('');
    setUnanswered([]);
    void assessmentApi<Assessment>(`/assessments/${id}`)
      .then((data) => {
        if (!active) return;
        setAssessment(data);
        revision.current = data.draft?.revision ?? 0;
        setAnswers(
          data.content.questions.map((q) => {
            const saved = data.draft?.content.find((a) => a.questionId === q.id);
            return q.type !== 'CHOICE'
              ? { questionId: q.id, source: saved?.source ?? q.starter! }
              : { questionId: q.id, choiceId: saved?.choiceId ?? '' };
          }),
        );
      })
      .catch((e) => {
        if (active) setError(errorLabel(e, ar));
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    if (!checking) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    let inFlight = false;
    const poll = async (): Promise<void> => {
      if (inFlight || !active) return;
      inFlight = true;
      clearTimeout(timer);
      try {
        const response = await assessmentApi<Result>(`/assessments/submissions/${checking}`);
        if (!active) return;
        if (!['PENDING', 'RUNNING'].includes(response.state)) {
          setResult(response);
          setChecking(null);
          setHistoryPage(1);
          setHistoryRetry((v) => v + 1);
          if (response.state === 'CORRECT')
            setAssessment((old) => (old ? { ...old, passed: true } : old));
          return;
        }
      } catch (e) {
        if (active) setError(errorLabel(e, ar));
      }
      inFlight = false;
      if (active)
        timer = setTimeout(
          () => {
            void poll();
          },
          (++attempts < 5 ? 1500 + attempts * 700 : 30000) + Math.random() * 1000,
        );
    };
    const hint = (event: Event): void => {
      if ((event as CustomEvent<unknown>).detail === checking) void poll();
    };
    window.addEventListener('fayq-assessment-completed', hint);
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('fayq-assessment-completed', hint);
    };
  }, [checking, ar]);
  function change(id: string, patch: Partial<Answer>): void {
    setAnswers((old) => old.map((a) => (a.questionId === id ? { ...a, ...patch } : a)));
    if (patch.choiceId) setUnanswered((old) => old.filter((questionId) => questionId !== id));
    setDirty(true);
  }
  async function submit(): Promise<void> {
    if (!assessment || busy || checking || result?.state === 'CORRECT') return;
    const missing = unansweredChoices(assessment.content.questions, answers);
    setUnanswered(missing);
    if (missing.length) {
      const index = assessment.content.questions.findIndex((question) => question.id === missing[0]);
      setError(label(`اختر إجابة للسؤال ${index + 1} قبل إرسال الحل.`, `Choose an answer for question ${index + 1} before submitting.`));
      const first = questionRefs.current.get(missing[0]);
      first?.focus({ preventScroll: true });
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await assessmentApi<{ id: string }>(`/assessments/${id}/submit`, 'POST', {
        version: assessment.version,
        answers,
        idempotencyKey: crypto.randomUUID(),
      });
      setResult(null);
      setChecking(response.id);
    } catch (e) {
      setError(errorLabel(e, ar));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Container id="main">
      <main className="py-8">
        {error ? <Notice kind="error">{error}</Notice> : null}
        {!assessment ? (
          !error ? (
            <Loading text={label('جارٍ التحميل…', 'Loading…')} />
          ) : null
        ) : (
          <>
            {assessment.content.questions.some((q) => q.type !== 'CHOICE') ? (
              <p className="mb-2 font-semibold" dir="ltr">
                {modeName(assessment.content.ide ?? 'javascript')}
              </p>
            ) : null}
            <h1 className="mb-2 text-3xl font-bold">
              {ar ? assessment.content.titleAr : assessment.content.titleEn}
            </h1>
            <p className="mb-3 whitespace-pre-wrap text-muted">
              {ar ? assessment.content.instructionsAr : assessment.content.instructionsEn}
            </p>
            <a
              className="mb-4 inline-block min-h-[44px] text-primary-strong underline"
              href={`#/learn/${assessment.courseId}`}
            >
              {label('العودة إلى دروس الكورس', 'Return to course lessons')}
            </a>
            <p className="mb-4">
              {assessment.required
                ? label('مطلوب للمتابعة', 'Required to continue')
                : label('تدريب اختياري', 'Optional practice')}
              {assessment.passed ? ` · ${label('تم الاجتياز', 'Passed')}` : ''}
            </p>
            <Notice kind="info">
              {assessment.content.questions.every((q) => q.type === 'CHOICE')
                ? label(
                    'اختر إجابة لكل سؤال ثم أرسلها. يمكنك إعادة المحاولة؛ اجتياز الاختبار المطلوب يفتح الدروس التالية.',
                    'Select an answer for each question, then submit. You can retry; passing a required quiz unlocks later lessons.',
                  )
                : label(
                    'تشغيل الكود للتجربة ولا يمنح درجة. إرسال الحل هو التقييم الرسمي. يمكنك إعادة المحاولة؛ اجتياز التقييم المطلوب يفتح الدروس التالية.',
                    'Run is for experimenting and awards no grade. Submit is the official check. You can retry; passing a required assessment unlocks later lessons.',
                  )}
            </Notice>
            {assessment.content.questions.map((q) => {
              const answer = answers.find((a) => a.questionId === q.id);
              return (
                <section key={q.id} className="mb-6" tabIndex={-1}
                  ref={(element) => { if (element) questionRefs.current.set(q.id, element); else questionRefs.current.delete(q.id); }}>
                  <h2 className="mb-3 text-xl font-semibold">{ar ? q.titleAr : q.titleEn}</h2>
                  {q.type === 'PROGRAM' && q.program ? (
                    <div className="mb-4 space-y-3" data-testid="program-instructions">
                      {assessment.content.ide === 'python' ? (
                        <p>
                          {label(
                            'اقرأ باستخدام input() واطبع باستخدام print(). لا تطبع رسائل إضافية.',
                            'Read with input() and print with print(). Do not print extra prompts.',
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-muted">
                          {label(
                            'اقرأ سطور المدخلات باستخدام readline() واطبع الإجابة فقط باستخدام console.log(). التشغيل يستخدم المدخل المحلي؛ الإرسال يراجع اختبارات خاصة.',
                            'Read input lines with readline() and print only the answer using console.log(). Run uses local input; Submit checks private tests.',
                          )}
                        </p>
                      )}
                      <h3 className="font-semibold">{label('تنسيق المدخلات', 'Input format')}</h3>
                      <p className="whitespace-pre-wrap">
                        {ar ? q.program.inputAr : q.program.inputEn}
                      </p>
                      <h3 className="font-semibold">{label('تنسيق المخرجات', 'Output format')}</h3>
                      <p className="whitespace-pre-wrap">
                        {ar ? q.program.outputAr : q.program.outputEn}
                      </p>
                      {q.program.comparison === 'json' && assessment.content.ide !== 'python' ? (
                        <p className="text-sm text-muted">
                          {label(
                            'اطبع JSON باستخدام console.log(JSON.stringify(value)).',
                            'Print JSON with console.log(JSON.stringify(value)).',
                          )}
                        </p>
                      ) : null}
                      {q.program.samples.map((sample, i) => (
                        <div
                          key={i}
                          className="grid gap-3 rounded-control border border-border p-3 md:grid-cols-2"
                        >
                          <div>
                            <h4 className="font-semibold">
                              {label('مدخل المثال', 'Sample input')} {i + 1}
                            </h4>
                            <pre dir="ltr" className="overflow-auto whitespace-pre-wrap">
                              {sample.input}
                            </pre>
                          </div>
                          <div>
                            <h4 className="font-semibold">
                              {label('مخرج المثال', 'Sample output')} {i + 1}
                            </h4>
                            <pre dir="ltr" className="overflow-auto whitespace-pre-wrap">
                              {sample.output}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {q.type !== 'CHOICE' ? (
                    <Suspense
                      fallback={<Loading text={label('جارٍ تحميل المحرر…', 'Loading editor…')} />}
                    >
                      <WebIDE
                        mode={assessment.content.ide ?? 'javascript'}
                        assessmentId={id}
                        defaultInput={q.program?.samples[0]?.input ?? ''}
                        starter={q.starter!}
                        value={answer?.source ?? q.starter!}
                        onChange={(source) => change(q.id, { source })}
                      />
                    </Suspense>
                  ) : (
                    <fieldset className="space-y-2" aria-invalid={unanswered.includes(q.id) || undefined}
                      aria-describedby={unanswered.includes(q.id) ? `question-error-${q.id}` : undefined}>
                      <legend className="sr-only">{ar ? q.titleAr : q.titleEn}</legend>
                      {unanswered.includes(q.id) ? <p id={`question-error-${q.id}`} role="alert" className="text-sm text-error-fg">
                        {label('اختر إجابة لهذا السؤال.', 'Choose an answer for this question.')}
                      </p> : null}
                      {q.choices?.map((c) => (
                        <label
                          key={c.id}
                          className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-control border border-border bg-surface p-3"
                        >
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            value={c.id}
                            checked={answer?.choiceId === c.id}
                            onChange={() => change(q.id, { choiceId: c.id })}
                          />
                          {ar ? c.textAr : c.textEn}
                        </label>
                      ))}
                    </fieldset>
                  )}
                </section>
              );
            })}
            <p className="mb-3 text-sm text-muted" aria-live="polite">
              {saveStatus}
            </p>
            <FormActions>
              <Button
                data-testid="assessment-submit"
                disabled={busy || !!checking || result?.state === 'CORRECT'}
                disabledReason={
                  busy
                    ? undefined
                    : result?.state === 'CORRECT'
                      ? label('تم الاجتياز بنجاح.', 'Passed successfully.')
                      : {
                          ar: 'يجري تصحيح الحل الحالي. انتظر النتيجة قبل إرسال حل آخر.',
                          en: 'Your current submission is being graded. Wait for its result before submitting again.',
                        }
                }
                onClick={() => void submit()}
              >
                {checking
                  ? label('جارٍ التقييم…', 'Checking…')
                  : label('إرسال الحل', 'Submit answer')}
              </Button>
            </FormActions>
            {result || persistedPass ? (
              <div
                ref={resultRef}
                tabIndex={-1}
                data-testid="assessment-result"
                className="mt-4"
                role="status"
              >
                <Notice
                  inline
                  kind={
                    persistedPass || result?.state === 'CORRECT'
                      ? 'success'
                      : result?.state === 'ERROR'
                        ? 'error'
                        : 'info'
                  }
                >
                  {persistedPass
                    ? label(
                        'لقد اجتزت هذا التقييم سابقًا. يمكنك المتابعة إلى الدرس، أو إرسال محاولة أخرى للتدريب.',
                        'You previously passed this assessment. You can continue to the lesson, or submit another attempt for practice.',
                      )
                    : result?.state === 'CORRECT'
                    ? label(
                        'أحسنت! اجتزت التقييم بنجاح.',
                        'Well done! You passed.',
                      )
                    : result?.state === 'ERROR'
                      ? label(
                          'تعذر التقييم. يمكنك المحاولة مجددًا.',
                          'Checking failed. You can retry.',
                        )
                      : label(
                          'إجابة غير صحيحة بعد. عدّل الحل وحاول مجددًا.',
                          'Not correct yet. Edit your answer and retry.',
                        )}
                </Notice>
                {result?.result?.questions?.map((q) => (
                  <p key={q.questionId} className="mt-2 text-sm">
                    {ar
                      ? assessment.content.questions.find((x) => x.id === q.questionId)?.titleAr
                      : assessment.content.questions.find((x) => x.id === q.questionId)?.titleEn}
                    : {q.checksPassed}/{q.checksTotal} {label('اختبارات ناجحة', 'checks passed')}
                  </p>
                ))}
                {persistedPass || result?.state === 'CORRECT' ? (
                  <FormActions>
                    <Button
                      data-testid="assessment-continue"
                      onClick={() =>
                        window.location.replace(
                          `#/learn/${encodeURIComponent(assessment.courseId)}?lesson=${encodeURIComponent(assessment.lessonId)}&resume=1`,
                        )
                      }
                    >
                      {label('المتابعة إلى الدرس', 'Continue to lesson')}
                    </Button>
                  </FormActions>
                ) : null}
              </div>
            ) : null}
            <details className="mt-6">
              <summary className="cursor-pointer font-semibold">
                {label('سجل المحاولات', 'Submission history')}
              </summary>
              <ul className="mt-2 space-y-2">
                {history.map((h) => (
                  <li key={h.id}>
                    {new Date(h.createdAt).toLocaleString(ar ? 'ar-EG' : 'en')} ·{' '}
                    {h.state === 'CORRECT'
                      ? label('صحيح', 'Correct')
                      : h.state === 'INCORRECT'
                        ? label('غير صحيح', 'Incorrect')
                        : ['PENDING', 'RUNNING'].includes(h.state)
                          ? label('جارٍ التقييم', 'Checking')
                          : label('تعذر التقييم', 'Checking failed')}
                  </li>
                ))}
              </ul>
              {historyError ? (
                <Notice kind="error">
                  <p>{label('تعذر تحميل سجل المحاولات.', 'Could not load submission history.')}</p>
                  <Button onClick={() => setHistoryRetry((v) => v + 1)}>
                    {label('إعادة المحاولة', 'Retry')}
                  </Button>
                </Notice>
              ) : null}
              <Pagination
                {...historyPaging}
                id="submission-history"
                disabled={historyLoading}
                onPage={setHistoryPage}
                onSize={(size) => {
                  setHistorySize(size);
                  setHistoryPage(1);
                }}
              />
            </details>
          </>
        )}
      </main>
    </Container>
  );
}
