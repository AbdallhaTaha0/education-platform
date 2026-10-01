import type { Browser } from 'puppeteer-core';
import { isDeepStrictEqual } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';

interface Test { input: string; output: string }
export interface Program {
  comparison: string; samples: Test[]; tests?: Test[]; reference?: string;
  generator?: { mode: string; min?: number; max?: number; count?: number; code?: string };
}
export function matchesOutput(actual: string, expected: string, mode: string): boolean {
  const normalize = (s: string) => s.replace(/\r\n?/g, '\n');
  if (mode === 'exact') return normalize(actual).trimEnd() === normalize(expected).trimEnd();
  if (mode === 'tokens') return isDeepStrictEqual(actual.trim() ? actual.trim().split(/\s+/) : [], expected.trim() ? expected.trim().split(/\s+/) : []);
  if (mode === 'json') { try { return isDeepStrictEqual(JSON.parse(actual), JSON.parse(expected)); } catch { return false; } }
  return false;
}

/** New page for every case: no student globals or logs survive between inputs. */
export async function runProgram(browser: Browser, source: string, input: string): Promise<string> {
  const page = await browser.newPage();
  try {
    const logs: string[] = []; let failed = false, oversized = false;
    page.on('console', (message) => { if (message.type() !== 'log' || oversized) return; logs.push(message.text().slice(0, 8193)); if (logs.length > 100 || logs.join('\n').length > 8192) oversized = true; });
    page.on('pageerror', () => { failed = true; });
    await page.setRequestInterception(true); page.on('request', (request) => { void request.abort().catch(() => undefined); });
    const nonce = randomUUID().replace(/-/g, '');
    await page.setContent(`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><body></body>`, { timeout: 2000 });
    await page.evaluate((input) => {
      const lines = input.replace(/\r\n?/g, '\n').split('\n'); if (lines[lines.length - 1] === '') lines.pop(); let at = 0;
      Object.defineProperty(window, 'readline', { value: () => lines[at++], writable: false, configurable: false });
    }, input);
    await page.evaluate(({ source, nonce }) => { const script = document.createElement('script'); script.nonce = nonce; script.textContent = 'document.currentScript.remove();\n' + source; document.head.append(script); }, { source, nonce });
    // Drain synchronous browser console events, without granting asynchronous
    // programs an unlimited execution lifetime. Programs finish synchronously.
    await page.evaluate(() => undefined);
    if (failed || oversized) throw new Error('PROGRAM_FAILED');
    return logs.join('\n');
  } finally { await page.close().catch(() => undefined); }
}

export async function prepareProgram(browser: Browser, p: Program, seed: string): Promise<Test[]> {
  if (!p.reference || !p.generator) throw new Error('REFERENCE_FAILED');
  let inputs: string[];
  if (p.generator.mode === 'integer') {
    const { min, max, count } = p.generator;
    if (![min, max, count].every(Number.isSafeInteger) || min! > max! || min! < -1e9 || max! > 1e9 || count! < 1 || count! > 16) throw new Error('GENERATOR_FAILED');
    const values = new Set<number>(); const size = Math.min(count!, max! - min! + 1);
    for (const edge of [min!, max!, 0, -1, 1]) if (values.size < size && edge >= min! && edge <= max!) values.add(edge);
    let n = 0;
    while (values.size < size && n < 1000) { const number = createHash('sha256').update(`${seed}:${n++}`).digest().readUInt32BE(0); values.add(min! + number % (max! - min! + 1)); }
    for (let value = min!; values.size < size; value++) values.add(value);
    inputs = [...values].map(String);
  } else if (p.generator.mode === 'custom' && p.generator.code) {
    try { const values: unknown = JSON.parse(await runProgram(browser, p.generator.code, '')); if (!Array.isArray(values) || !values.length || values.length > 16 || values.some((s) => typeof s !== 'string' || s.length > 8192)) throw new Error(); inputs = values; }
    catch { throw new Error('GENERATOR_FAILED'); }
  } else throw new Error('GENERATOR_FAILED');
  inputs = [...new Set([...p.samples.map((s) => s.input), ...inputs])];
  if (inputs.length > 20) throw new Error('PREPARATION_LIMIT');
  const tests: Test[] = [];
  for (const input of inputs) {
    let output: string, repeated: string;
    try { output = await runProgram(browser, p.reference, input); repeated = await runProgram(browser, p.reference, input); } catch { throw new Error('REFERENCE_FAILED'); }
    if (output !== repeated) throw new Error('UNSTABLE_REFERENCE');
    if (p.samples.filter((s) => s.input === input).some((sample) => !matchesOutput(output, sample.output, p.comparison))) throw new Error('SAMPLE_MISMATCH');
    tests.push({ input, output });
  }
  return tests;
}
