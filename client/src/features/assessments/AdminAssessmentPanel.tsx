import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { useLang } from "../../i18n";
import { useCodingIde } from "../../features";
import { PaginatedCollection } from "../../components/ui/Pagination";
import { Button } from "../../components/ui/Button";
import { FormActions } from "../../components/ui/FormActions";
import { Notice, Loading } from "../../components/ui/Notice";
import { textInputClassName } from "../../components/ui/Field";
import { assessmentApi, errorLabel } from "./api";
import {
  EMPTY_SOURCE,
  modeName,
  type IDEMode,
  type SourceFiles,
} from "../ide/types";
import { ModeTabs } from "../ide/ModeTabs";
import {
  ProgramSettings,
  PreparationPanel,
  newProgram,
  type ProgramSettingsValue,
} from "./ProgramSettings";
import { TypedValueEditor } from "./TypedValueEditor";
import { AdminSubmissionReview } from "./AdminSubmissionReview";
import { useUnsavedChanges } from "../../components/ui/UnsavedChanges";
import { useFocusedWorkspace } from "../../components/ui/useFocusedWorkspace";
import { useSuccessFeedback } from "../../components/ui/ErrorFeedback";
import {
  EditorFieldErrors,
  focusIssue,
  inspectEditor,
  type EditorIssue,
} from "./EditorFeedback";
const WebIDE = lazy(() =>
  import("../ide/WebIDE").then((m) => ({ default: m.WebIDE })),
);
interface Check {
  type: string;
  selector?: string;
  name?: string;
  expected?: unknown;
  args?: unknown[];
  steps?: Array<{ action: string; selector: string; value?: string }>;
}
interface Question {
  id: string;
  type: "CODING" | "CHOICE" | "PROGRAM";
  program?: ProgramSettingsValue;
  titleAr: string;
  titleEn: string;
  starter?: SourceFiles;
  shareStarter?: boolean;
  checks?: Check[];
  choices?: Array<{ id: string; textAr: string; textEn: string }>;
  correctChoiceId?: string;
}
interface Content {
  ide?: IDEMode;
  titleAr: string;
  titleEn: string;
  instructionsAr: string;
  instructionsEn: string;
  questions: Question[];
}
interface Entry {
  id: string;
  lessonId: string;
  kind: string;
  required: boolean;
  draftRequired: boolean | null;
  status: string;
  content: Content;
  version: number;
}
const newQuestion = (
  type: "CODING" | "PROGRAM" = "PROGRAM",
  mode: IDEMode = "javascript",
): Question => ({
  id: crypto.randomUUID(),
  type,
  titleAr: "",
  titleEn: "",
  starter: {
    ...EMPTY_SOURCE,
    javascript: "",
    ...(mode === "python" ? { python: "" } : {}),
  },
  shareStarter: false,
  ...(type === "PROGRAM"
    ? { program: newProgram(mode) }
    : {
        checks:
          mode === "web"
            ? [{ type: "exists", selector: "#result" }]
            : [{ type: "console", expected: "" }],
      }),
});
export function AdminAssessmentPanel({
  lessonId,
  initiallyOpen = false,
}: {
  lessonId: string;
  initiallyOpen?: boolean;
}): JSX.Element {
  const { lang, setLang } = useLang();
  const codingEnabled = useCodingIde();
  const ar = lang === "ar";
  const label = (a: string, e: string): string => (ar ? a : e);
  const [mode, setMode] = useState<IDEMode>("javascript");
  const [open, setOpen] = useState(initiallyOpen);
  const [list, setList] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<string | null | false>(false);
  const [content, setContent] = useState<Content>({
    titleAr: "",
    titleEn: "",
    instructionsAr: "",
    instructionsEn: "",
    questions: [],
  });
  const [kind, setKind] = useState("ASSIGNMENT");
  const [required, setRequired] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [transitionFeedback, setTransitionFeedback] = useState<{ id: string; message: string; kind: 'success' | 'error' } | null>(null);
  const [publishedSnapshots, setPublishedSnapshots] = useState<Record<string, string>>({});
  const success = useSuccessFeedback();
  const revisionSnapshot = (entry: Entry): string => JSON.stringify({ content: entry.content, required: entry.draftRequired ?? entry.required, kind: entry.kind });
  const [review, setReview] = useState<Entry | null>(null);
  const [errorOccurrence, setErrorOccurrence] = useState(0);
  const editor = useRef<HTMLDivElement>(null);
  const requirementGroup = useId();
  const [issues, setIssues] = useState<EditorIssue[]>([]);
  const [baseline, setBaseline] = useState("");
  const [rawEdited, setRawEdited] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const questionVersions = useRef(
    new Map<string, Partial<Record<Question["type"], Question>>>(),
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
      "لديك تعديلات غير محفوظة في التقييم. هل تريد تركها والمتابعة؟",
      "You have unsaved assessment changes. Discard them and continue?",
    ),
  );
  function clearFeedback(): void {
    setError("");
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
      titleAr: "",
      titleEn: "",
      instructionsAr: "",
      instructionsEn: "",
      ide: mode,
      questions: [codingEnabled ? newQuestion(mode === "web" ? "CODING" : "PROGRAM", mode) : { id: crypto.randomUUID(), type: 'CHOICE' as const, titleAr: '', titleEn: '', choices: [{ id: 'a', textAr: '', textEn: '' }, { id: 'b', textAr: '', textEn: '' }], correctChoiceId: '' }],
    };
    const nextKind = entry?.kind ?? "ASSIGNMENT";
    const nextRequired = entry
      ? String(entry.draftRequired ?? entry.required)
      : "";
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
  function changeQuestionType(index: number, type: Question["type"]): void {
    if (!codingEnabled && type !== 'CHOICE') return;
    const current = content.questions[index]!;
    if (current.type === type) return;
    const versions = questionVersions.current.get(current.id) ?? {};
    versions[current.type] = current;
    questionVersions.current.set(current.id, versions);
    const next =
      versions[type] ??
      (type === "CHOICE"
        ? {
            id: current.id,
            type,
            titleAr: "",
            titleEn: "",
            choices: [
              { id: "a", textAr: "", textEn: "" },
              { id: "b", textAr: "", textEn: "" },
            ],
            correctChoiceId: "",
          }
        : newQuestion(type, content.ide ?? "javascript"));
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
      setError("");
      const questionIndex = Number(
        invalid[0]!.control
          .closest("[data-admin-question]")
          ?.getAttribute("data-admin-question"),
      );
      if (questionIndex)
        setActiveQuestion(content.questions[questionIndex - 1]!.id);
      requestAnimationFrame(() => focusIssue(invalid[0]!.control));
      return;
    }
    const submitted = snapshot;
    setBusy(true);
    setError("");
    try {
      const result = await assessmentApi<Entry>(
        editing
          ? `/admin/assessments/${editing}`
          : `/admin/assessments/lessons/${lessonId}`,
        editing ? "PUT" : "POST",
        { kind, required: required === "true", content },
      );
      setBaseline(submitted);
      setSaved(true);
      setRawEdited(false);
      if (latestSnapshot.current === submitted) setEditing(false);
      else if (!editing) setEditing(result.id);
      await reload().catch(() =>
        setError(
          label(
            "تم حفظ المسودة، لكن تعذر تحديث القائمة. أعد فتح الصفحة لتحديثها.",
            "Draft saved, but the list could not refresh. Reopen the page to refresh it.",
          ),
        ),
      );
    } catch (e) {
      setError(`${label("حفظ المسودة", "Save draft")}: ${errorLabel(e, ar)}`);
    } finally {
      setBusy(false);
    }
  }
  async function transition(id: string, action: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    setTransitionFeedback(null);
    try {
      const result = await assessmentApi<Entry>(`/admin/assessments/${id}/${action}`, "POST", {});
      const message = action === 'publish'
        ? label(`تم نشر النسخة ${result.version} بنجاح.`, `Revision ${result.version} published successfully.`)
        : label('تمت أرشفة التقييم.', 'Assessment archived.');
      // The mutation response is authoritative even if the subsequent list fetch fails.
      setList(current => current.map(entry => entry.id === id ? result : entry));
      if (action === 'publish') setPublishedSnapshots(current => ({ ...current, [id]: revisionSnapshot(result) }));
      setTransitionFeedback({ id, message, kind: 'success' });
      success(message);
      await reload().catch(() => setTransitionFeedback({ id, kind: 'success', message: `${message} ${label('تعذر تحديث القائمة؛ أعد فتحها لتحديثها.', 'The list could not refresh; reopen it to refresh.')} ` }));
    } catch (e) {
      const message = errorLabel(e, ar);
      setErrorOccurrence(n => n + 1);
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
    dir?: "rtl" | "ltr",
    maxLength = 2000,
  ) => (
    <label className="block">
      <span className="text-sm">{name}</span>
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
        {label("الواجبات والاختبارات", "Assignments and quizzes")}
      </Button>
      {open ? (
        <div className="mt-3 space-y-4">
          {codingEnabled ? <ModeTabs
            value={mode}
            onChange={(next) => {
              if (closeEditor()) {
                setMode(next);
                setReview(null);
              }
            }}
            label={label("نوع المحرر", "IDE type")}
          /> : <Notice kind="info">{label('تقييمات البرمجة متوقفة مؤقتًا. الاختيار من متعدد متاح؛ جميع الأعمال السابقة محفوظة.', 'Coding assessments are temporarily disabled. Multiple-choice quizzes remain available; existing work is preserved.')}</Notice>}
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
              {label(
                "تم حفظ المسودة على الخادم.",
                "Draft saved on the server.",
              )}
            </Notice>
          ) : null}
          <PaginatedCollection
            id="assessment-list"
            resetKey={mode}
            disabled={busy}
          >
            {list
              .filter((a) => codingEnabled ? (a.content.ide ?? "javascript") === mode : a.content.questions.every((q) => q.type === 'CHOICE'))
              .map((a) => (
                <div
                  key={a.id}
                  data-admin-assessment={a.id}
                  className="flex flex-wrap items-center gap-2 rounded-control border border-border p-3"
                >
                  <strong>{ar ? a.content.titleAr : a.content.titleEn}</strong>
                  <span className="text-xs text-muted">
                    {label("النسخة", "Revision")} {a.version} ·{" "}
                    {label(
                      "تبقى النسخة المنشورة متاحة أثناء تعديل المسودة",
                      "The published revision stays available while the draft changes",
                    )}
                  </span>
                  <span className="text-sm text-muted">
                    {a.status === "PUBLISHED"
                      ? label("منشور", "Published")
                      : a.status === "ARCHIVED"
                        ? label("مؤرشف", "Archived")
                        : label("مسودة", "Draft")}{" "}
                    ·{" "}
                    {a.required
                      ? label("مطلوب", "Required")
                      : label("اختياري", "Optional")}
                  </span>
                  <Button variant="secondary" onClick={() => edit(a)}>
                    {label("تعديل", "Edit")}
                  </Button>
                  {!a.content.questions.some((q) => q.type === "PROGRAM") ? (
                    <Button
                      data-testid={`assessment-publish-${a.id}`}
                      disabled={busy || (a.status === 'PUBLISHED' && publishedSnapshots[a.id] === revisionSnapshot(a))}
                      disabledReason={busy ? undefined : label('هذه التعديلات منشورة بالفعل. احفظ تعديلات جديدة قبل نشرها.', 'These changes are already published. Save new changes before publishing again.')}
                      onClick={() => void transition(a.id, "publish")}
                    >
                      {a.status === 'PUBLISHED' && publishedSnapshots[a.id] === revisionSnapshot(a)
                        ? label('تم النشر', 'Published') : label("نشر النسخة", "Publish revision")}
                    </Button>
                  ) : null}
                  <Button
                    disabled={busy}
                    variant="secondary"
                    onClick={() => void transition(a.id, "archive")}
                  >
                    {label("أرشفة", "Archive")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (closeEditor()) setReview(a);
                    }}
                  >
                    {label("الحلول المرسلة", "Submissions")}
                  </Button>
                  {a.content.questions.some((q) => q.type === "PROGRAM") ? (
                    <PreparationPanel
                      key={JSON.stringify(a.content)}
                      assessmentId={a.id}
                      onPublish={() => void transition(a.id, "publish")}
                    />
                  ) : null}
                  {transitionFeedback?.id === a.id ? <p role={transitionFeedback.kind === 'error' ? 'alert' : 'status'} className={`w-full text-sm font-semibold ${transitionFeedback.kind === 'error' ? 'text-error-fg' : 'text-success-fg'}`}>
                    {transitionFeedback.message}
                  </p> : null}
                </div>
              ))}
          </PaginatedCollection>
          <Button variant="secondary" onClick={() => edit()}>
            {label("إضافة تقييم", "Add assessment")}
          </Button>
          {editing !== false ? (
            <div
              ref={editor}
              data-testid="assessment-editor"
              onInvalid={(event) => event.preventDefault()}
              onInput={(event) => {
                /* Native selects fire input before change: rerendering here restores the old controlled value. */ if (
                  !(event.target instanceof HTMLSelectElement) &&
                  (event.target as HTMLElement).closest(
                    '[data-testid="typed-value"]',
                  )
                )
                  setRawEdited(true);
              }}
              onChange={() => {
                clearFeedback();
                setSaved(false);
              }}
              className="admin-focused-workspace !m-0 space-y-4"
              aria-label={label("مساحة تحرير التقييم", "Assessment workspace")}
            >
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-canvas py-3">
                <h2 className="text-xl font-bold">
                  {label("تحرير التقييم", "Edit assessment")} ·{" "}
                  {codingEnabled ? modeName(content.ide ?? "javascript") : label('اختيار من متعدد', 'Multiple choice')}
                </h2>
                <Button
                  variant="secondary"
                  onClick={() => setLang(ar ? "en" : "ar")}
                  aria-label={ar ? "Switch to English" : "التبديل إلى العربية"}
                >
                  {ar ? "EN" : "ع"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => closeEditor()}
                >
                  {label("العودة إلى الدروس", "Back to lessons")}
                </Button>
              </div>
              <p className="rounded-control border border-border p-3">
                {codingEnabled ? label(
                  "١. احفظ المسودة ← ٢. حضّر الاختبارات ← ٣. راجعها ← ٤. انشر. النسخة المنشورة الحالية تبقى متاحة حتى نشر التعديل.",
                  "1. Save draft → 2. Prepare tests → 3. Review → 4. Publish. The current published revision remains available until you publish the changes.",
                ) : label('١. أضف الأسئلة والخيارات وحدد الإجابات الصحيحة ← ٢. احفظ المسودة ← ٣. انشر. النسخة المنشورة تبقى متاحة أثناء التحرير.', '1. Add questions and choices; select correct answers → 2. Save draft → 3. Publish. The published revision remains available while editing.')}
              </p>
              <p
                role="status"
                data-testid="admin-draft-status"
                className="text-sm font-semibold"
              >
                {busy
                  ? label("جارٍ حفظ المسودة…", "Saving draft…")
                  : dirty
                    ? label("تعديلات غير محفوظة", "Unsaved changes")
                    : editing
                      ? label(
                          "المسودة المحفوظة — لم تُعدّل بعد",
                          "Saved draft — no new changes",
                        )
                      : label(
                          "مسودة جديدة — لم تُحفظ بعد",
                          "New draft — not saved yet",
                        )}
              </p>
              {error ? (
                <div role="alert" className="rounded-control border border-error-fg bg-error-bg p-3 text-error-fg" key={errorOccurrence}>
                  <p>{error}</p>
                </div>
              ) : null}
              <EditorFieldErrors issues={issues} />
              <div className="grid gap-3 md:grid-cols-2">
                {input(
                  "العنوان بالعربية",
                  content.titleAr,
                  (v) => setContent({ ...content, titleAr: v }),
                  "rtl",
                  200,
                )}
                {input(
                  "Title in English",
                  content.titleEn,
                  (v) => setContent({ ...content, titleEn: v }),
                  "ltr",
                  200,
                )}
                <label>
                  {label("التعليمات بالعربية", "Arabic instructions")}
                  <textarea
                    required
                    maxLength={16000}
                    dir="rtl"
                    className={textInputClassName(false)}
                    value={content.instructionsAr}
                    onChange={(e) =>
                      setContent({ ...content, instructionsAr: e.target.value })
                    }
                  />
                </label>
                <label>
                  English instructions
                  <textarea
                    required
                    maxLength={16000}
                    dir="ltr"
                    className={textInputClassName(false)}
                    value={content.instructionsEn}
                    onChange={(e) =>
                      setContent({ ...content, instructionsEn: e.target.value })
                    }
                  />
                </label>
                <label>
                  {label("نوع التقييم", "Assessment type")}
                  <select
                    className={textInputClassName(false)}
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="ASSIGNMENT">
                      {label("واجب", "Assignment")}
                    </option>
                    <option value="QUIZ">{label("اختبار", "Quiz")}</option>
                  </select>
                </label>
                <fieldset
                  data-testid="assessment-requirement"
                  className="min-w-0 space-y-2"
                >
                  <legend>
                    {label(
                      "هل يلزم اجتيازه للمتابعة؟",
                      "Required to continue?",
                    )}
                  </legend>
                  {[
                    [
                      "true",
                      "مطلوب",
                      "Required",
                      "يجب اجتيازه لفتح الدرس التالي.",
                      "Must be passed to unlock the next lesson.",
                    ],
                    [
                      "false",
                      "اختياري",
                      "Optional",
                      "يمكن متابعة الدروس دون اجتيازه.",
                      "Students can continue without passing it.",
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
                          "اختر مطلوب أو اختياري قبل حفظ التقييم.",
                          "Choose Required or Optional before saving the assessment.",
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
                className="space-y-2"
                aria-label={label("أسئلة التقييم", "Assessment questions")}
              >
                <h3 className="text-lg font-bold">
                  {label("الأسئلة", "Questions")} · {content.questions.length}
                  /10
                </h3>
                <p className="text-sm text-muted">
                  {label(
                    "افتح سؤالًا واحدًا لتحريره. جميع الأسئلة تُراجع عند الحفظ.",
                    "Open one question to edit. All questions are checked when you save.",
                  )}
                </p>
              </section>
              {content.questions.map((q, index) => (
                <details
                  key={q.id}
                  open={activeQuestion === q.id}
                  data-admin-question={index + 1}
                  className="rounded-control border border-border bg-surface"
                >
                  <summary
                    className="cursor-pointer p-4 font-semibold"
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveQuestion(activeQuestion === q.id ? null : q.id);
                    }}
                  >
                    {label("السؤال", "Question")} {index + 1} ·{" "}
                    {(ar ? q.titleAr : q.titleEn) ||
                      label("سؤال جديد", "New question")}{" "}
                    <span className="text-sm font-normal text-muted">
                      ·{" "}
                      {q.type === "CHOICE"
                        ? label("اختيار من متعدد", "Multiple choice")
                        : q.type === "PROGRAM"
                          ? label("مدخلات ومخرجات", "Input/output")
                          : label("اختبارات سلوك", "Behavior checks")}
                    </span>
                  </summary>
                  <div className="space-y-4 border-t border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">
                        {label("السؤال", "Question")} {index + 1}
                      </h3>
                      <label className="block flex-1">
                        <span className="text-sm font-semibold">
                          {label("نوع السؤال", "Question type")}
                        </span>
                        <select
                          data-testid="question-type"
                          aria-label={label("نوع السؤال", "Question type")}
                          className={textInputClassName(false)}
                          value={q.type}
                          onChange={(e) =>
                            changeQuestionType(
                              index,
                              e.target.value as Question["type"],
                            )
                          }
                        >
                          {codingEnabled ? <option value="PROGRAM">
                            {label(
                              "مسألة مدخلات ومخرجات",
                              "Input/output problem",
                            )}
                          </option> : null}
                          {codingEnabled && content.ide !== "python" ? (
                            <option value="CODING">
                              {label("اختبارات سلوك", "Behavior checks")}
                            </option>
                          ) : null}
                          <option value="CHOICE">
                            {label("اختيار من متعدد", "Multiple choice")}
                          </option>
                        </select>
                      </label>
                      <p className="basis-full text-sm text-muted">
                        {label(
                          "يمكن تغيير النوع دون فقد العناوين. إعدادات كل نوع تبقى خلال جلسة التحرير؛ يُحفظ النوع المختار فقط.",
                          "Switch freely without losing titles. Each type’s settings stay in this editing session; only the selected type is saved.",
                        )}
                      </p>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          clearFeedback();
                          setSaved(false);
                          setContent((c) => ({
                            ...c,
                            questions: c.questions.filter(
                              (old) => old.id !== q.id,
                            ),
                          }));
                          questionVersions.current.delete(q.id);
                          setActiveQuestion(
                            content.questions.find((old) => old.id !== q.id)
                              ?.id ?? null,
                          );
                        }}
                      >
                        {label("حذف السؤال", "Remove question")}
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {input(
                        "السؤال بالعربية",
                        q.titleAr,
                        (v) => updateQuestion(index, { ...q, titleAr: v }),
                        "rtl",
                      )}
                      {input(
                        "Question in English",
                        q.titleEn,
                        (v) => updateQuestion(index, { ...q, titleEn: v }),
                        "ltr",
                      )}
                    </div>
                    {q.type !== "CHOICE" ? (
                      <>
                        {q.type === "PROGRAM" ? (
                          <ProgramSettings
                            mode={content.ide ?? "javascript"}
                            value={q.program!}
                            onChange={(program) =>
                              updateQuestion(index, { ...q, program })
                            }
                          />
                        ) : null}
                        <details>
                          <summary className="cursor-pointer">
                            {q.type === "PROGRAM"
                              ? label(
                                  "كود ابتدائي اختياري للطالب — لا تضع الحل المرجعي هنا",
                                  "Optional student starter — keep the reference solution separate",
                                )
                              : label(
                                  "كود الإدارة الخاص",
                                  "Private admin code",
                                )}
                          </summary>
                          <Suspense
                            fallback={
                              <Loading
                                text={label("تحميل المحرر…", "Loading editor…")}
                              />
                            }
                          >
                            <WebIDE
                              mode={content.ide ?? "javascript"}
                              value={q.starter!}
                              onChange={(starter) =>
                                updateQuestion(index, { ...q, starter })
                              }
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
                            "مشاركة هذا الكود ككود ابتدائي مع الطالب (لا تضع الحل الصحيح)",
                            "Share this code as student starter code (do not include the solution)",
                          )}
                        </label>
                        <p className="text-sm text-muted">
                          {label(
                            "الكود خاص بالإدارة افتراضيًا. الطالب يبدأ بمحرر فارغ؛ التقييم يعتمد على الاختبارات الخاصة.",
                            "Admin code is private by default. Students start with an empty editor; grading uses your private tests.",
                          )}
                        </p>
                        {q.type === "CODING" ? (
                          <CheckBuilder
                            mode={content.ide ?? "javascript"}
                            checks={q.checks!}
                            onChange={(checks) =>
                              updateQuestion(index, { ...q, checks })
                            }
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {q.choices?.map((c, i) => (
                            <div
                              key={c.id}
                              className="grid items-center gap-2 md:grid-cols-[1fr_1fr_auto_auto]"
                            >
                              {input(
                                "الخيار بالعربية",
                                c.textAr,
                                (v) =>
                                  updateQuestion(index, {
                                    ...q,
                                    choices: q.choices!.map((x, j) =>
                                      j === i ? { ...x, textAr: v } : x,
                                    ),
                                  }),
                                "rtl",
                              )}
                              {input(
                                "Choice in English",
                                c.textEn,
                                (v) =>
                                  updateQuestion(index, {
                                    ...q,
                                    choices: q.choices!.map((x, j) =>
                                      j === i ? { ...x, textEn: v } : x,
                                    ),
                                  }),
                                "ltr",
                              )}
                              <label>
                                <input
                                  type="radio"
                                  required
                                  name={`correct-${q.id}`}
                                  checked={q.correctChoiceId === c.id}
                                  onChange={() =>
                                    updateQuestion(index, {
                                      ...q,
                                      correctChoiceId: c.id,
                                    })
                                  }
                                />{" "}
                                {label("الإجابة الصحيحة", "Correct answer")}
                              </label>
                              <Button
                                variant="secondary"
                                disabled={q.choices!.length <= 2}
                                disabledReason={{
                                  ar: "احتفظ بخيارين على الأقل.",
                                  en: "Keep at least two choices.",
                                }}
                                onClick={() =>
                                  updateQuestion(index, {
                                    ...q,
                                    choices: q.choices!.filter(
                                      (old) => old.id !== c.id,
                                    ),
                                    correctChoiceId:
                                      q.correctChoiceId === c.id
                                        ? ""
                                        : q.correctChoiceId,
                                  })
                                }
                              >
                                {label("حذف الخيار", "Remove choice")}
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="secondary"
                          disabled={(q.choices?.length ?? 0) >= 8}
                          disabledReason={{
                            ar: "الحد الأقصى ٨ اختيارات للسؤال.",
                            en: "Maximum: 8 choices per question.",
                          }}
                          onClick={() =>
                            updateQuestion(index, {
                              ...q,
                              choices: [
                                ...q.choices!,
                                {
                                  id: crypto.randomUUID(),
                                  textAr: "",
                                  textEn: "",
                                },
                              ],
                            })
                          }
                        >
                          {label("إضافة خيار", "Add choice")}
                        </Button>
                      </>
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
                          ar: "الحد الأقصى ١٠ أسئلة للتقييم.",
                          en: "Maximum: 10 questions per assessment.",
                        }
                  }
                  onClick={() => {
                    clearFeedback();
                    setSaved(false);
                    const next = codingEnabled ? newQuestion(
                      content.ide === "web" ? "CODING" : "PROGRAM",
                      content.ide ?? "javascript",
                    ) : { id: crypto.randomUUID(), type: 'CHOICE' as const, titleAr: '', titleEn: '', choices: [{ id: 'a', textAr: '', textEn: '' }, { id: 'b', textAr: '', textEn: '' }], correctChoiceId: '' };
                    setContent((c) => ({
                      ...c,
                      questions: [...c.questions, next],
                    }));
                    setActiveQuestion(next.id);
                  }}
                >
                  {label("إضافة سؤال", "Add question")}
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {label("حفظ مسودة", "Save draft")}
                </Button>
                <Button
                  disabled={busy}
                  variant="secondary"
                  onClick={() => closeEditor()}
                >
                  {label("إلغاء", "Cancel")}
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

function CheckBuilder({
  checks,
  onChange,
  mode,
}: {
  mode: IDEMode;
  checks: Check[];
  onChange: (c: Check[]) => void;
}): JSX.Element {
  const { lang } = useLang();
  const ar = lang === "ar";
  const label = (a: string, e: string): string => (ar ? a : e);
  const update = (i: number, c: Check): void =>
    onChange(checks.map((old, index) => (index === i ? c : old)));
  const show = (v: unknown): string =>
    typeof v === "string" ? v : v === undefined ? "" : JSON.stringify(v);
  return (
    <div data-admin-checks className="space-y-3">
      <h4 className="font-semibold">
        {label("اختبارات السلوك الخاصة", "Private behavior checks")}
      </h4>
      <p className="text-sm text-muted">
        {label(
          "حدد مخرجات الطباعة أو ناتج الدالة أو سلوك الصفحة؛ لا تقارن نص الكود.",
          "Define printed output, function results or web behavior. Never compare source text.",
        )}
      </p>
      {checks.map((c, i) => (
        <div
          key={i}
          data-admin-check
          className="space-y-2 rounded-control border border-border p-3"
        >
          <label>
            {label("نوع الاختبار", "Check type")}
            <select
              value={c.type}
              className={textInputClassName(false)}
              onChange={(e) =>
                update(i, {
                  type: e.target.value,
                  ...(c.steps ? { steps: c.steps } : {}),
                  ...(!["console", "function"].includes(e.target.value)
                    ? { selector: c.selector ?? "" }
                    : {}),
                  ...(["attribute", "style", "function"].includes(
                    e.target.value,
                  )
                    ? { name: c.name ?? "" }
                    : {}),
                  ...(e.target.value === "function"
                    ? { args: c.args ?? [] }
                    : {}),
                  ...(e.target.value !== "exists"
                    ? { expected: c.expected ?? "" }
                    : {}),
                })
              }
            >
              {[
                ...(mode === "web"
                  ? [
                      ["exists", "وجود عنصر", "Element exists"],
                      ["text", "نص العنصر", "Element text"],
                      ["value", "قيمة العنصر", "Element value"],
                      ["attribute", "خاصية العنصر", "Element attribute"],
                      ["style", "تنسيق العنصر", "Computed style"],
                    ]
                  : !["console", "function"].includes(c.type)
                    ? [[c.type, "اختبار صفحة سابق", "Existing page check"]]
                    : []),
                [
                  "console",
                  "مخرجات console.log",
                  "Printed output (console.log)",
                ],
                [
                  "function",
                  "القيمة التي ترجعها الدالة",
                  "Function return value",
                ],
              ].map(([v, a, e]) => (
                <option key={v} value={v}>
                  {label(a, e)}
                </option>
              ))}
            </select>
          </label>
          {!["console", "function"].includes(c.type) ? (
            <label>
              {label(
                "محدد العنصر (مثل #result)",
                "Element selector (e.g. #result)",
              )}
              <input
                required
                maxLength={256}
                dir="ltr"
                className={textInputClassName(false)}
                value={c.selector ?? ""}
                onChange={(e) => update(i, { ...c, selector: e.target.value })}
              />
            </label>
          ) : null}
          {["attribute", "style", "function"].includes(c.type) ? (
            <label>
              {label("اسم الخاصية أو الدالة", "Property or function name")}
              <input
                required
                maxLength={100}
                pattern={
                  c.type === "function"
                    ? "[A-Za-z_$][A-Za-z0-9_$]*"
                    : "[A-Za-z_$][A-Za-z0-9_$\\-]*"
                }
                dir="ltr"
                className={textInputClassName(false)}
                value={c.name ?? ""}
                onChange={(e) => update(i, { ...c, name: e.target.value })}
              />
            </label>
          ) : null}
          {c.type === "function" ? (
            <>
              <p className="text-sm text-muted">
                {label(
                  "مثال: الدالة sum ومدخلان 2 و3 والناتج المتوقع رقم 5. كل مدخل قيمة منفصلة؛ لا تكتب اسم الدالة أو الأقواس في المدخلات.",
                  "Example: function sum, two inputs 2 and 3, expected Number 5. Each input is a separate value; do not enter the function name or parentheses as an input.",
                )}
              </p>
              <div className="space-y-3">
                <h5 className="font-semibold">
                  {label("مدخلات الدالة", "Function inputs")}
                </h5>
                {(c.args ?? []).map((argument, index) => (
                  <div
                    key={index}
                    className="rounded-control border border-border p-3"
                  >
                    <TypedValueEditor
                      name={label(`المدخل ${index + 1}`, `Input ${index + 1}`)}
                      value={argument}
                      onChange={(next) =>
                        update(i, {
                          ...c,
                          args: c.args!.map((old, at) =>
                            at === index ? next : old,
                          ),
                        })
                      }
                    />
                    <Button
                      variant="secondary"
                      onClick={() =>
                        update(i, {
                          ...c,
                          args: c.args!.filter((_, at) => at !== index),
                        })
                      }
                    >
                      {label("حذف المدخل", "Remove input")}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  disabled={(c.args?.length ?? 0) >= 10}
                  disabledReason={{
                    ar: "الحد الأقصى ١٠ مدخلات للدالة.",
                    en: "Maximum: 10 function inputs.",
                  }}
                  onClick={() =>
                    update(i, { ...c, args: [...(c.args ?? []), ""] })
                  }
                >
                  {label("إضافة مدخل", "Add input")}
                </Button>
              </div>
            </>
          ) : null}
          {["console", "function"].includes(c.type) ? (
            <TypedValueEditor
              name={label("القيمة المتوقعة", "Expected value")}
              value={c.expected ?? (c.expected === null ? null : "")}
              consoleOutput={c.type === "console"}
              onChange={(expected) => update(i, { ...c, expected })}
            />
          ) : c.type !== "exists" ? (
            <label>
              {label(
                "الناتج المتوقع (كما يظهر للطالب)",
                "Expected output (as printed or displayed)",
              )}
              <input
                dir="ltr"
                className={textInputClassName(false)}
                value={show(c.expected)}
                onChange={(e) => update(i, { ...c, expected: e.target.value })}
              />
            </label>
          ) : null}
          {c.type === "console" ? (
            <p className="text-sm text-muted">
              {label(
                "لطباعة console.log(2) اختر رقمًا وأدخل 2. للنص اختر نصًا واكتب Hello بدون علامات اقتباس. إذا توجد عدة طباعات، اختر نصًا وضع كل سطر كما يظهر.",
                "For console.log(2), choose Number and enter 2. For text, choose Text and enter Hello without quotes. For several logs, choose Text and enter each output line exactly as displayed.",
              )}
            </p>
          ) : null}
          {c.type === "console" &&
          typeof c.expected === "string" &&
          /^".*"$/.test(c.expected) ? (
            <Notice kind="info">
              {label(
                "علامات الاقتباس في هذا الحقل جزء من المخرجات المتوقعة. لطباعة 2 احذف علامات الاقتباس.",
                "Quotation marks in this field are part of the expected output. To print 2, remove those quotation marks.",
              )}
            </Notice>
          ) : null}
          {mode !== "web" &&
          (!["console", "function"].includes(c.type) ||
            (c.steps?.length ?? 0) > 0) ? (
            <Notice kind="info">
              {label(
                "هذا الاختبار يحتوي على قواعد صفحة سابقة. JavaScript فقط حاليًا؛ احذف التفاعلات وحوّل القواعد إلى مخرجات أو ناتج دالة ثم احفظ وانشر. لا يتم حذف القواعد تلقائيًا.",
                "This check contains earlier page rules. JavaScript is the current editor mode; remove interactions and use console or function checks, then save and publish. Existing rules are not removed automatically.",
              )}
            </Notice>
          ) : null}
          {(c.steps ?? []).map((s, j) => (
            <div
              key={j}
              data-testid="check-interaction"
              className="grid items-end gap-2 md:grid-cols-4"
            >
              <select
                aria-label={label(
                  "تفاعل قبل الاختبار",
                  "Interaction before check",
                )}
                value={s.action}
                className={textInputClassName(false)}
                onChange={(e) =>
                  update(i, {
                    ...c,
                    steps: c.steps!.map((old, k) =>
                      k === j ? { ...old, action: e.target.value } : old,
                    ),
                  })
                }
              >
                <option value="click">{label("نقرة", "Click")}</option>
                <option value="input">{label("إدخال", "Input")}</option>
              </select>
              <input
                required
                maxLength={256}
                dir="ltr"
                aria-label={label("عنصر التفاعل", "Interaction selector")}
                className={textInputClassName(false)}
                value={s.selector}
                onChange={(e) =>
                  update(i, {
                    ...c,
                    steps: c.steps!.map((old, k) =>
                      k === j ? { ...old, selector: e.target.value } : old,
                    ),
                  })
                }
              />
              {s.action === "input" ? (
                <input
                  maxLength={2000}
                  aria-label={label("القيمة المدخلة", "Input value")}
                  className={textInputClassName(false)}
                  value={s.value ?? ""}
                  onChange={(e) =>
                    update(i, {
                      ...c,
                      steps: c.steps!.map((old, k) =>
                        k === j ? { ...old, value: e.target.value } : old,
                      ),
                    })
                  }
                />
              ) : null}
              <Button
                variant="secondary"
                aria-label={label("حذف التفاعل", "Remove interaction")}
                onClick={() =>
                  update(i, {
                    ...c,
                    steps: c.steps!.filter((_, index) => index !== j),
                  })
                }
              >
                {label("حذف التفاعل", "Remove interaction")}
              </Button>
            </div>
          ))}
          {mode === "web" ? (
            <Button
              variant="secondary"
              disabled={(c.steps?.length ?? 0) >= 10}
              onClick={() =>
                update(i, {
                  ...c,
                  steps: [
                    ...(c.steps ?? []),
                    { action: "click", selector: "" },
                  ],
                })
              }
            >
              {label("إضافة تفاعل", "Add interaction")}
            </Button>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => onChange(checks.filter((_, j) => j !== i))}
            >
              {label("حذف الاختبار", "Remove check")}
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        disabled={checks.length >= 20}
        disabledReason={{
          ar: "الحد الأقصى ٢٠ اختبارًا للتقييم.",
          en: "Maximum: 20 checks per assessment.",
        }}
        data-admin-add-check
        onClick={() => onChange([...checks, { type: "console", expected: "" }])}
      >
        {label("إضافة اختبار", "Add check")}
      </Button>
    </div>
  );
}
