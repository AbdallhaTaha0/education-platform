import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { invalid, object, text } from './contracts.js';
import type { Content } from './contracts.js';

export interface ProgramTest { input: string; output: string }
export interface ProgramSpec {
  inputAr: string; inputEn: string; outputAr: string; outputEn: string;
  comparison: 'tokens' | 'exact' | 'json'; samples: ProgramTest[];
  reference?: string;
  generator?: { mode: 'integer'; min: number; max: number; count: number } | { mode: 'custom'; code: string };
  tests?: ProgramTest[];
}
export function programText(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8192) return invalid(); return value;
}
export function programSpec(value: unknown): ProgramSpec {
  const o = object(value);
  if (!['tokens', 'exact', 'json'].includes(o.comparison as string) || !Array.isArray(o.samples) || !o.samples.length || o.samples.length > 3) return invalid();
  const samples = o.samples.map((s) => { const t = object(s); return { input: programText(t.input), output: programText(t.output) }; });
  const g = object(o.generator); let generator: ProgramSpec['generator'];
  if (g.mode === 'integer') {
    if (![g.min, g.max, g.count].every(Number.isSafeInteger) || (g.min as number) < -1e9 || (g.max as number) > 1e9 || (g.min as number) > (g.max as number) || (g.count as number) < 1 || (g.count as number) > 16) return invalid();
    generator = { mode: 'integer', min: g.min as number, max: g.max as number, count: g.count as number };
  } else if (g.mode === 'custom') generator = { mode: 'custom', code: text(g.code, 32768) };
  else return invalid();
  return { inputAr: text(o.inputAr, 2000), inputEn: text(o.inputEn, 2000), outputAr: text(o.outputAr, 2000), outputEn: text(o.outputEn, 2000), comparison: o.comparison as ProgramSpec['comparison'], reference: text(o.reference, 32768), generator, samples };
}
export const preparationHash = (c: Content): string => createHash('sha256').update(JSON.stringify(c)).digest('hex');
function sampleMatches(actual: string, expected: string, mode: ProgramSpec['comparison']): boolean {
  if (mode === 'exact') return actual.replace(/\r\n?/g, '\n').trimEnd() === expected.replace(/\r\n?/g, '\n').trimEnd();
  if (mode === 'tokens') return isDeepStrictEqual(actual.trim() ? actual.trim().split(/\s+/) : [], expected.trim() ? expected.trim().split(/\s+/) : []);
  try { return isDeepStrictEqual(JSON.parse(actual), JSON.parse(expected)); } catch { return false; }
}

/** Only the controller's verified output can populate frozen hidden cases. */
export function freezePrograms(c: Content, records: unknown): Content {
  if (!Array.isArray(records)) throw new Error('PREPARATION_INVALID');
  const programs = c.questions.filter((q) => q.type === 'PROGRAM');
  if (records.length !== programs.length) throw new Error('PREPARATION_INVALID');
  let count = 0;
  const questions = c.questions.map((q) => {
    if (q.type !== 'PROGRAM') return q;
    const matches = records.filter((r) => object(r).questionId === q.id);
    if (matches.length !== 1) throw new Error('PREPARATION_INVALID');
    const tests = object(matches[0]).tests;
    if (!Array.isArray(tests) || !tests.length || tests.length > 20) throw new Error('PREPARATION_INVALID');
    const frozen = tests.map((s) => { const t = object(s); return { input: programText(t.input), output: programText(t.output) }; });
    if (new Set(frozen.map((t) => t.input)).size !== frozen.length) throw new Error('PREPARATION_INVALID');
    for (const sample of q.program!.samples) if (!frozen.some((t) => t.input === sample.input && sampleMatches(t.output, sample.output, q.program!.comparison))) throw new Error('PREPARATION_INVALID');
    count += frozen.length;
    const { reference: _reference, generator: _generator, tests: _tests, ...settings } = q.program!;
    return { ...q, program: { ...settings, tests: frozen } };
  });
  const frozen = { ...c, questions };
  if (count > 20 || JSON.stringify(records).length > 48000 || Buffer.byteLength(JSON.stringify(frozen)) > 200_000) throw new Error('PREPARATION_LIMIT');
  return frozen;
}
