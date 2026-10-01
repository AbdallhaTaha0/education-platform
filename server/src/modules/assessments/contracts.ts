import { ApiError } from '../identity/errors.js';
import { programSpec, type ProgramSpec } from './program-contracts.js';

export interface SourceFiles { html: string; css: string; javascript: string }
export type CheckType = 'exists' | 'text' | 'value' | 'attribute' | 'style' | 'function' | 'console';
export interface Check {
  type: CheckType; selector?: string; name?: string; expected?: unknown; args?: unknown[];
  steps?: Array<{ action: 'click' | 'input'; selector: string; value?: string }>;
}
export interface Question {
  id: string; type: 'CODING' | 'CHOICE' | 'PROGRAM'; titleAr: string; titleEn: string;
  program?: ProgramSpec;
  starter?: SourceFiles; shareStarter?: boolean; checks?: Check[];
  choices?: Array<{ id: string; textAr: string; textEn: string }>;
  correctChoiceId?: string;
}
export interface Content { titleAr: string; titleEn: string; instructionsAr: string; instructionsEn: string; questions: Question[] }
export interface Answer { questionId: string; source?: SourceFiles; choiceId?: string }
export interface CheckResult { questionId: string; correct: boolean; checksPassed: number; checksTotal: number; error?: string }
export const invalid = (): never => { throw new ApiError(400, 'VALIDATION_ERROR', 'Assessment input is invalid.'); };
export function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid();
  return v as Record<string, unknown>;
}
export function text(v: unknown, max = 200): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) return invalid();
  return v.trim();
}
export function key(v: unknown): string {
  const s = text(v, 100); if (!/^[A-Za-z0-9_-]+$/.test(s)) return invalid(); return s;
}
export function files(v: unknown): SourceFiles {
  const o = object(v);
  for (const k of ['html', 'css', 'javascript']) if (typeof o[k] !== 'string' || (o[k] as string).length > 32768) invalid();
  return { html: o.html as string, css: o.css as string, javascript: o.javascript as string };
}
function check(v: unknown): Check {
  const o = object(v); const type = o.type as CheckType;
  if (!['exists', 'text', 'value', 'attribute', 'style', 'function', 'console'].includes(type)) return invalid();
  const c: Check = { type };
  if (!['function', 'console'].includes(type)) c.selector = text(o.selector, 256);
  if (['attribute', 'style', 'function'].includes(type)) {
    c.name = text(o.name, 100);
    if (!/^[a-zA-Z_$][\w$-]*$/.test(c.name)) return invalid();
    if (type === 'function' && !/^[A-Za-z_$][\w$]*$/.test(c.name)) return invalid();
  }
  if (type !== 'exists') {
    if (o.expected === undefined || JSON.stringify(o.expected).length > 8192) return invalid();
    c.expected = o.expected;
  }
  if (type === 'function') { if (!Array.isArray(o.args) || o.args.length > 10) return invalid(); c.args = o.args; }
  if (o.steps !== undefined) {
    if (!Array.isArray(o.steps) || o.steps.length > 10) return invalid();
    c.steps = o.steps.map((s) => {
      const step = object(s); if (step.action !== 'click' && step.action !== 'input') return invalid();
      return { action: step.action, selector: text(step.selector, 256), ...(step.action === 'input' ? { value: typeof step.value === 'string' && step.value.length <= 2000 ? step.value : invalid() } : {}) };
    });
  }
  return c;
}
export function content(v: unknown): Content {
  const o = object(v);
  if (!Array.isArray(o.questions) || o.questions.length < 1 || o.questions.length > 10) return invalid();
  const questions = o.questions.map((entry): Question => {
    const q = object(entry); const base = { id: key(q.id), titleAr: text(q.titleAr, 2000), titleEn: text(q.titleEn, 2000) };
    if (q.type === 'PROGRAM') {
      if (q.shareStarter !== undefined && typeof q.shareStarter !== 'boolean') return invalid();
      return { ...base, type: 'PROGRAM', starter: files(q.starter), shareStarter: q.shareStarter === true, program: programSpec(q.program) };
    }
    if (q.type === 'CODING') {
      if (!Array.isArray(q.checks) || !q.checks.length || q.checks.length > 20) return invalid();
      if (q.shareStarter !== undefined && typeof q.shareStarter !== 'boolean') return invalid();
      return { ...base, type: 'CODING', starter: files(q.starter), shareStarter: q.shareStarter === true, checks: q.checks.map(check) };
    }
    if (q.type !== 'CHOICE' || !Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 8) return invalid();
    const choices = q.choices.map((x) => { const c = object(x); return { id: key(c.id), textAr: text(c.textAr, 2000), textEn: text(c.textEn, 2000) }; });
    const correctChoiceId = key(q.correctChoiceId);
    if (new Set(choices.map((x) => x.id)).size !== choices.length || !choices.some((x) => x.id === correctChoiceId)) return invalid();
    return { ...base, type: 'CHOICE', choices, correctChoiceId };
  });
  if (new Set(questions.map((q) => q.id)).size !== questions.length) return invalid();
  const planned = questions.filter((q) => q.type === 'PROGRAM').reduce((n, q) => n + q.program!.samples.length + (q.program!.generator?.mode === 'integer' ? q.program!.generator.count : 1), 0);
  if (planned > 20) return invalid();
  const c = { titleAr: text(o.titleAr), titleEn: text(o.titleEn), instructionsAr: text(o.instructionsAr, 16000), instructionsEn: text(o.instructionsEn, 16000), questions };
  if (Buffer.byteLength(JSON.stringify(c)) > 200_000) return invalid();
  return c;
}
export function publicContent(c: Content): Omit<Content, 'questions'> & { questions: Omit<Question, 'checks' | 'correctChoiceId'>[] } {
  return { ...c, questions: c.questions.map(({ checks: _checks, correctChoiceId: _correct, shareStarter, program, ...q }) => {
    const safeProgram = program ? (({ reference: _reference, generator: _generator, tests: _tests, ...safe }) => safe)(program) : undefined;
    return { ...q, ...(safeProgram ? { program: safeProgram } : {}), ...(q.type !== 'CHOICE' ? { starter: shareStarter === true ? q.starter : { html: '', css: '', javascript: '' } } : {}) };
  }) };
}
export function answers(v: unknown, c: Content, draft = false): Answer[] {
  if (!Array.isArray(v) || v.length !== c.questions.length) return invalid();
  const out = c.questions.map((q) => {
    const matches = v.filter((x) => object(x).questionId === q.id); if (matches.length !== 1) return invalid();
    const a = object(matches[0]);
    if (q.type !== 'CHOICE') return { questionId: q.id, source: files(a.source) };
    const choiceId = draft && a.choiceId === '' ? '' : key(a.choiceId);
    if (choiceId && !q.choices!.some((choice) => choice.id === choiceId)) return invalid();
    return { questionId: q.id, choiceId };
  });
  if (Buffer.byteLength(JSON.stringify(out)) > 200_000) return invalid();
  return out;
}
