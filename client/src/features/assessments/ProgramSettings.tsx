import { lazy, Suspense, useEffect, useState } from "react";
import { useLang } from "../../i18n";
import { textInputClassName } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { FormActions } from "../../components/ui/FormActions";
import { Notice } from "../../components/ui/Notice";
import { assessmentApi, errorLabel } from "./api";
import type { IDEMode } from "../ide/types";
const WebIDE = lazy(() =>
  import("../ide/WebIDE").then((m) => ({ default: m.WebIDE })),
);
export interface ProgramSettingsValue {
  inputAr: string;
  inputEn: string;
  outputAr: string;
  outputEn: string;
  comparison: "tokens" | "exact" | "json";
  reference: string;
  samples: Array<{ input: string; output: string }>;
  generator:
    | { mode: "integer"; min: number; max: number; count: number }
    | { mode: "custom"; code: string };
}
export const newProgram = (
  mode: IDEMode = "javascript",
): ProgramSettingsValue => ({
  inputAr: "رقم صحيح n.",
  inputEn: "One integer n.",
  outputAr: "اطبع مربع الرقم.",
  outputEn: "Print the square of the number.",
  comparison: "tokens",
  reference:
    mode === "python"
      ? "n = int(input())\nprint(n ** 2)"
      : "const n = Number(readline());\nconsole.log(n ** 2);",
  samples: [{ input: "3", output: "9" }],
  generator: { mode: "integer", min: -10, max: 10, count: 10 },
});

export function ProgramSettings({
  value,
  onChange,
  mode = "javascript",
}: {
  mode?: IDEMode;
  value: ProgramSettingsValue;
  onChange: (v: ProgramSettingsValue) => void;
}): JSX.Element {
  const { lang } = useLang();
  const label = (ar: string, en: string): string => (lang === "ar" ? ar : en);
  const field = (
    name: string,
    key: "inputAr" | "inputEn" | "outputAr" | "outputEn",
    dir: "rtl" | "ltr",
  ) => (
    <label>
      {name}
      <textarea
        required
        maxLength={2000}
        dir={dir}
        className={textInputClassName(false)}
        value={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <div data-testid="program-settings" className="space-y-4">
      {mode === "python" ? (
        <p className="font-semibold">
          {label(
            "Python: اقرأ المدخلات باستخدام input() واطبع الناتج باستخدام print(). للكائنات استخدم json.dumps().",
            "Python: read with input() and print with print(). For JSON use json.dumps().",
          )}
        </p>
      ) : null}
      {mode !== "python" ? (
        <p className="text-sm text-muted">
          {label(
            "مسألة مدخلات ومخرجات: الطالب يقرأ السطور باستخدام readline() ويطبع الإجابة باستخدام console.log(). النموذج الحالي مثال للمربع؛ عدّل الوصف والحل والمدخلات لمسألتك.",
            "Input/output problem: students read lines using readline() and print with console.log(). The current template is a square example; adapt the instructions, solution and inputs to your problem.",
          )}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {field("تنسيق المدخلات بالعربية", "inputAr", "rtl")}
        {field("Input format in English", "inputEn", "ltr")}
        {field("تنسيق المخرجات بالعربية", "outputAr", "rtl")}
        {field("Output format in English", "outputEn", "ltr")}
      </div>
      <label>
        {label("طريقة مقارنة الإجابة", "Output comparison")}
        <select
          data-testid="program-comparison"
          className={textInputClassName(false)}
          value={value.comparison}
          onChange={(e) =>
            onChange({
              ...value,
              comparison: e.target.value as ProgramSettingsValue["comparison"],
            })
          }
        >
          <option value="tokens">
            {label(
              "كلمات/أرقام (تجاهل فروق المسافات)",
              "Tokens (ignore whitespace differences)",
            )}
          </option>
          <option value="exact">
            {label(
              "نص مطابق (تجاهل المسافات في نهاية المخرجات)",
              "Exact text (ignore trailing whitespace)",
            )}
          </option>
          <option value="json">
            {label("قيمة JSON بنفس الأنواع", "JSON value with matching types")}
          </option>
        </select>
      </label>
      {value.comparison === "json" && mode !== "python" ? (
        <p className="text-sm text-muted">
          {label(
            "للكائنات والقوائم، استخدم console.log(JSON.stringify(value)) في الحل، وأدخل JSON صالحًا في مخرجات المثال.",
            "For objects and arrays, print console.log(JSON.stringify(value)) in the solution and enter valid JSON as the sample output.",
          )}
        </p>
      ) : null}
      <h4 className="font-semibold">
        {label("أمثلة عامة للطالب", "Public examples")}
      </h4>
      {value.samples.map((sample, i) => (
        <div
          key={i}
          data-testid="program-sample"
          className="grid gap-3 rounded-control border border-border p-3 md:grid-cols-2"
        >
          <label>
            {label("مدخل المثال", "Sample input")}
            <textarea
              dir="ltr"
              maxLength={8192}
              className={textInputClassName(false)}
              value={sample.input}
              onChange={(e) =>
                onChange({
                  ...value,
                  samples: value.samples.map((s, at) =>
                    at === i ? { ...s, input: e.target.value } : s,
                  ),
                })
              }
            />
          </label>
          <label>
            {label("الإجابة الصحيحة للمثال", "Sample output")}
            <textarea
              dir="ltr"
              maxLength={8192}
              className={textInputClassName(false)}
              value={sample.output}
              onChange={(e) =>
                onChange({
                  ...value,
                  samples: value.samples.map((s, at) =>
                    at === i ? { ...s, output: e.target.value } : s,
                  ),
                })
              }
            />
          </label>
          <Button
            variant="secondary"
            disabled={value.samples.length === 1}
            disabledReason={{
              ar: "يجب الاحتفاظ بمثال واحد على الأقل.",
              en: "Keep at least one example.",
            }}
            onClick={() =>
              onChange({
                ...value,
                samples: value.samples.filter((_, at) => at !== i),
              })
            }
          >
            {label("حذف المثال", "Remove example")}
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        disabled={value.samples.length >= 3}
        disabledReason={{
          ar: "الحد الأقصى ٣ أمثلة. عدّل مثالًا أو احذفه لإضافة آخر.",
          en: "Maximum: 3 examples. Edit or remove one to add another.",
        }}
        onClick={() =>
          onChange({
            ...value,
            samples: [...value.samples, { input: "", output: "" }],
          })
        }
      >
        {label("إضافة مثال", "Add example")}
      </Button>
      <details open data-admin-required-code>
        <summary className="font-semibold">
          {label(
            "الحل المرجعي الخاص (لا يشارك مع الطالب)",
            "Private reference solution (never shared)",
          )}
        </summary>
        <Suspense fallback={<p>…</p>}>
          <WebIDE
            mode={mode === "python" ? "python" : "javascript"}
            value={{
              html: "",
              css: "",
              javascript: mode === "python" ? "" : value.reference,
              python: mode === "python" ? value.reference : "",
            }}
            defaultInput={value.samples[0]?.input ?? ""}
            onChange={(s) =>
              onChange({
                ...value,
                reference: mode === "python" ? (s.python ?? "") : s.javascript,
              })
            }
          />
        </Suspense>
      </details>
      <label>
        {label("توليد الاختبارات المخفية", "Hidden input generator")}
        <select
          data-testid="program-generator"
          className={textInputClassName(false)}
          value={value.generator.mode}
          onChange={(e) =>
            onChange({
              ...value,
              generator:
                e.target.value === "integer"
                  ? { mode: "integer", min: -10, max: 10, count: 10 }
                  : {
                      mode: "custom",
                      code:
                        mode === "python"
                          ? 'import json\nprint(json.dumps(["2", "3", "-4"]))'
                          : 'console.log(JSON.stringify(["2", "3", "-4"]));',
                    },
            })
          }
        >
          <option value="integer">
            {label("أرقام صحيحة ضمن نطاق", "Integers in a range")}
          </option>
          <option value="custom">
            {label("مولّد مدخلات مخصص", "Custom input generator")}
          </option>
        </select>
      </label>
      {value.generator.mode === "integer" ? (
        <div className="grid gap-3 md:grid-cols-3">
          {(["min", "max", "count"] as const).map((key) => (
            <label key={key}>
              {label(
                key === "min"
                  ? "أقل قيمة"
                  : key === "max"
                    ? "أكبر قيمة"
                    : "عدد المدخلات",
                key === "min"
                  ? "Minimum"
                  : key === "max"
                    ? "Maximum"
                    : "Input count",
              )}
              <input
                data-testid={`generator-${key}`}
                required
                min={key === "count" ? 1 : -1e9}
                max={key === "count" ? 16 : 1e9}
                dir="ltr"
                type="number"
                step="1"
                aria-invalid={
                  !Number.isSafeInteger(
                    value.generator.mode === "integer"
                      ? value.generator[key]
                      : 0,
                  )
                }
                className={textInputClassName(false)}
                value={
                  value.generator.mode === "integer" ? value.generator[key] : ""
                }
                onChange={(e) => {
                  if (value.generator.mode === "integer")
                    onChange({
                      ...value,
                      generator: {
                        ...value.generator,
                        [key]:
                          e.target.value === "" ? NaN : Number(e.target.value),
                      },
                    });
                }}
              />
            </label>
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">
            {label(
              "اطبع JSON يحتوي على قائمة من نصوص المدخلات (حتى 16). يمكن إنشاء نصوص وأرقام متعددة وقوائم وكائنات. الكود ينفذ فقط داخل العزل.",
              "Print one JSON array of input strings (up to 16). You can generate strings, multiple numbers, arrays or objects. This code runs only in isolation.",
            )}
          </p>
          <div data-admin-required-code>
            <Suspense fallback={<p>…</p>}>
              <WebIDE
                mode={mode === "python" ? "python" : "javascript"}
                value={{
                  html: "",
                  css: "",
                  javascript: mode === "python" ? "" : value.generator.code,
                  python: mode === "python" ? value.generator.code : "",
                }}
                onChange={(s) =>
                  onChange({
                    ...value,
                    generator: {
                      mode: "custom",
                      code: mode === "python" ? (s.python ?? "") : s.javascript,
                    },
                  })
                }
              />
            </Suspense>
          </div>
        </>
      )}
      <p className="text-sm text-muted">
        {label(
          "احفظ ثم حضّر الاختبارات وراجعها قبل النشر. يجب أن يطابق الحل الأمثلة العامة ويعطي نتائج مستقرة. الحد 20 اختبارًا لكل تقييم؛ الحلول تعمل بالتزامن ولا تعتمد على مؤقتات أو شبكة.",
          "Save, prepare tests, then review before publishing. The reference must match public examples and give stable results. Limit: 20 tests per assessment. Programs run synchronously without timers or network access.",
        )}
      </p>
    </div>
  );
}

interface Preparation {
  state: string;
  error?: string | null;
  result?: Array<{
    questionId: string;
    tests: Array<{ input: string; output: string }>;
  }> | null;
}
export function PreparationPanel({
  assessmentId,
  onPublish,
}: {
  assessmentId: string;
  onPublish?: () => void;
}): JSX.Element {
  const { lang } = useLang();
  const ar = lang === "ar";
  const label = (a: string, b: string): string => (ar ? a : b);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Preparation | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  async function prepare(): Promise<void> {
    if (
      requesting ||
      status?.state === "PENDING" ||
      status?.state === "RUNNING"
    )
      return;
    setRequesting(true);
    setError("");
    setReviewed(false);
    try {
      const next = await assessmentApi<Preparation>(
        `/admin/assessments/${assessmentId}/prepare`,
        "POST",
        {},
      );
      setStatus(next);
      setOpen(true);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(errorLabel(e, ar));
    } finally {
      setRequesting(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async (): Promise<void> => {
      try {
        const next = await assessmentApi<Preparation>(
          `/admin/assessments/${assessmentId}/preparation`,
        );
        if (!active) return;
        setStatus(next);
        setError("");
        if (next.state !== "READY") setReviewed(false);
        if (["PENDING", "RUNNING"].includes(next.state))
          timer = setTimeout(() => void poll(), 1500);
      } catch (e) {
        if (active) setError(errorLabel(e, ar));
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, assessmentId, ar, refresh]);
  return (
    <div data-testid="program-preparation" className="basis-full space-y-2">
      <p className="text-sm font-semibold">
        {label(
          "مسودة محفوظة ← تحضير ← مراجعة ← نشر. أي تعديل يحتاج تحضيرًا جديدًا.",
          "Saved draft → Prepare → Review → Publish. Draft edits need fresh preparation.",
        )}
      </p>
      <FormActions className="mt-2">
        <Button
          variant="secondary"
          disabled={
            requesting ||
            status?.state === "PENDING" ||
            status?.state === "RUNNING"
          }
          disabledReason={{
            ar: "جارٍ تحضير الاختبارات. انتظر ظهور النتيجة.",
            en: "Tests are being prepared. Wait for the result.",
          }}
          onClick={() => void prepare()}
        >
          {label("تحضير ومراجعة الاختبارات", "Prepare and review tests")}
        </Button>
      </FormActions>
      {error && open ? (
        <FormActions className="mt-2">
          <Button
            variant="secondary"
            onClick={() => {
              setError("");
              setRefresh((n) => n + 1);
            }}
          >
            {label("تحديث حالة التحضير", "Refresh preparation status")}
          </Button>
        </FormActions>
      ) : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      {open && status?.state === "FAILED" ? (
        <Notice kind="error" key={refresh}>
          {label(
            "فشل تحضير الاختبارات. راجع الحل المرجعي ومولّد المدخلات والأمثلة، ثم أعد المحاولة.",
            "Test preparation failed. Check the reference solution, input generator and samples, then try again.",
          )}
        </Notice>
      ) : null}
      {open && status ? (
        <div aria-live="polite">
          <p>
            {status.state === "READY"
              ? label("الاختبارات جاهزة للنشر", "Tests ready to publish")
              : status.state === "FAILED"
                ? label(
                    "فشل التحضير. راجع الحل والمولّد والأمثلة.",
                    "Preparation failed. Check the reference, generator and examples.",
                  )
                : status.state === "UNPREPARED"
                  ? label(
                      "المسودة الحالية تحتاج تحضير الاختبارات.",
                      "The current draft needs test preparation.",
                    )
                  : label("جارٍ تحضير الاختبارات…", "Preparing tests…")}
            {status.error ? ` (${status.error})` : ""}
          </p>
          {status.result && status.state === "READY" ? (
            <details
              onToggle={(e) => {
                if (e.currentTarget.open) setReviewed(true);
              }}
            >
              <summary>
                {label("مراجعة الاختبارات الخاصة", "Review private tests")}
              </summary>
              {status.result.map((q) => (
                <div key={q.questionId}>
                  {q.tests.map((t, i) => (
                    <div
                      key={i}
                      className="my-2 grid gap-2 rounded-control border border-border p-3 md:grid-cols-2"
                    >
                      <pre dir="ltr" className="overflow-auto">
                        {t.input}
                      </pre>
                      <pre dir="ltr" className="overflow-auto">
                        {t.output}
                      </pre>
                    </div>
                  ))}
                </div>
              ))}
            </details>
          ) : null}
        </div>
      ) : null}
      {onPublish ? (
        <>
          <FormActions className="mt-2">
            <Button
              disabled={status?.state !== "READY" || !reviewed}
              disabledReason={
                status?.state !== "READY"
                  ? {
                      ar: "حضّر اختبارات المسودة الحالية أولًا.",
                      en: "Prepare tests for the current draft first.",
                    }
                  : {
                      ar: "افتح مراجعة الاختبارات الخاصة قبل النشر.",
                      en: "Open the private-test review before publishing.",
                    }
              }
              onClick={onPublish}
            >
              {label("نشر النسخة", "Publish revision")}
            </Button>
          </FormActions>
          <p className="text-sm text-muted">
            {status?.state !== "READY"
              ? label(
                  "حضّر اختبارات المسودة الحالية أولًا.",
                  "Prepare tests for the current draft first.",
                )
              : !reviewed
                ? label(
                    "افتح مراجعة الاختبارات الخاصة قبل النشر.",
                    "Open the private-test review before publishing.",
                  )
                : label(
                    "جاهز للنشر؛ يتحقق الخادم من مطابقة الاختبارات للمسودة.",
                    "Ready to publish; the server checks the exact draft fingerprint.",
                  )}
          </p>
        </>
      ) : null}
    </div>
  );
}
