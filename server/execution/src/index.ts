import puppeteer from 'puppeteer-core';
import { isDeepStrictEqual } from 'node:util';
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { runProgram, prepareProgram, matchesOutput, type Program } from './program.js';

interface Check { type: string; selector?: string; name?: string; expected?: unknown; args?: unknown[]; steps?: Array<{ action: string; selector: string; value?: string }> }
interface Question { id: string; type: string; checks?: Check[]; correctChoiceId?: string; program?: Program }
interface Answer { questionId: string; source?: { html: string; css: string; javascript: string }; choiceId?: string }
interface Input { questions: Question[]; answers: Answer[]; mode?: string; seed?: string }

async function input(): Promise<Input | null> {
  let data = ''; for await (const chunk of process.stdin) { data += chunk.toString(); if (data.length > 1_000_000) throw new Error('INPUT_LIMIT'); }
  return data.trim() ? JSON.parse(data) as Input : null;
}

async function main(): Promise<void> {
  const request = await input();
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    protocolTimeout: 4000,
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--disable-background-networking'],
  });
  try {
    if (!request) {
      const page = await browser.newPage(); await page.goto('about:blank');
      const renderers = readdirSync('/proc').filter((id) => /^\d+$/.test(id)).flatMap((id) => {
        try { const cmd = readFileSync(`/proc/${id}/cmdline`, 'utf8'); if (!cmd.includes('--type=renderer')) return []; const status = readFileSync(`/proc/${id}/status`, 'utf8'); return [{ namespace: readlinkSync(`/proc/${id}/ns/user`), status, cmd }]; } catch { return []; }
      });
      const namespaceSandbox = renderers.length > 0 && renderers.every((r) => r.namespace !== readlinkSync('/proc/self/ns/user'));
      const seccompSandbox = renderers.length > 0 && renderers.every((r) => /Seccomp:\s+2/.test(r.status) && !r.cmd.includes('--no-sandbox'));
      if (!namespaceSandbox || !seccompSandbox) throw new Error('SANDBOX_DISABLED');
      process.stdout.write(JSON.stringify({ sandboxStarted: true, namespaceSandbox, seccompSandbox }) + '\n'); return;
    }
    if (!Array.isArray(request.questions) || request.questions.length > 10 || !Array.isArray(request.answers)) throw new Error('INPUT_INVALID');
    if (request.mode === 'prepare') {
      const prepared = []; let count = 0;
      try {
        for (const q of request.questions) {
          if (q.type !== 'PROGRAM' || !q.program) throw new Error('REFERENCE_FAILED');
          const tests = await prepareProgram(browser, q.program, `${request.seed}:${q.id}`); count += tests.length;
          if (count > 20) throw new Error('PREPARATION_LIMIT');
          prepared.push({ questionId: q.id, tests });
          if (JSON.stringify(prepared).length > 48000) throw new Error('PREPARATION_LIMIT');
        }
        process.stdout.write(JSON.stringify({ correct: true, results: prepared }) + '\n');
      } catch (error) { process.stdout.write(JSON.stringify({ correct: false, results: [{ error: (error as Error).message }] }) + '\n'); }
      return;
    }
    const results = [];
    for (const q of request.questions) {
      const answer = request.answers.find((a) => a.questionId === q.id);
      if (q.type === 'CHOICE') { const correct = answer?.choiceId === q.correctChoiceId; results.push({ questionId: q.id, correct, checksPassed: correct ? 1 : 0, checksTotal: 1 }); continue; }
      if (q.type === 'PROGRAM') {
        const tests = q.program?.tests;
        if (!tests?.length || tests.length > 20 || !answer?.source) throw new Error('INPUT_INVALID');
        let passed = 0;
        try { for (const test of tests) if (matchesOutput(await runProgram(browser, answer.source.javascript, test.input), test.output, q.program!.comparison)) passed++; }
        catch { /* A runtime error/timeout cannot yield success. */ }
        results.push({ questionId: q.id, correct: passed === tests.length, checksPassed: passed, checksTotal: tests.length }); continue;
      }
      const page = await browser.newPage();
      try {
      const logs: unknown[] = []; let scriptFailed = false;
      page.on('console', (message) => { if (logs.length < 100 && message.type() === 'log') logs.push(message.text().slice(0, 2000)); });
      page.on('pageerror', () => { scriptFailed = true; });
      await page.setRequestInterception(true);
      page.on('request', (r) => { void r.abort().catch(() => undefined); });
      const source = answer?.source; if (!source || !q.checks || q.checks.length > 20) throw new Error('INPUT_INVALID');
      // Both transport interception and no-network container apply. CSP also
      // refuses page frames/forms/resource channels; the trusted script alone
      // carries a fresh nonce, which is removed before student execution.
      const nonce = crypto.randomUUID().replace(/-/g, '');
      const csp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
      await page.setContent(`<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><body></body>`, { timeout: 3000 });
      await page.evaluate(({ html, css }) => { document.body.innerHTML = html; const s = document.createElement('style'); s.textContent = css; document.head.append(s); }, source);
      // A real browser executes the source. The controller, not the page,
      // compares values and decides correctness.
      const session = await page.createCDPSession();
      const { frameTree } = await session.send('Page.getFrameTree');
      const { executionContextId } = await session.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'fayq-checker' });
      const script = `document.currentScript.remove();\n${source.javascript}`;
      await page.evaluate(({ script, nonce }) => { const s = document.createElement('script'); s.nonce = nonce; s.textContent = script; document.head.append(s); }, { script, nonce });
      const evaluate = async (expression: string, isolated = true): Promise<unknown> => {
        const result = await session.send('Runtime.evaluate', { expression, ...(isolated ? { contextId: executionContextId } : {}), returnByValue: true, awaitPromise: true, timeout: 2000 });
        if (result.exceptionDetails) throw new Error('CHECK_FAILED'); return result.result.value;
      };
      let passed = 0;
      for (const c of q.checks) {
        try {
          for (const step of c.steps ?? []) {
            const selector = JSON.stringify(step.selector);
            if (step.action === 'click') await evaluate(`document.querySelector(${selector}).click()`);
            else await evaluate(`(() => { const e=document.querySelector(${selector}); e.value=${JSON.stringify(step.value ?? '')}; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
          }
          let actual: unknown;
          const selected = `document.querySelector(${JSON.stringify(c.selector)})`;
          if (c.type === 'exists') actual = await evaluate(`!!${selected}`);
          else if (c.type === 'text') actual = await evaluate(`${selected}.textContent`);
          else if (c.type === 'value') actual = await evaluate(`${selected}.value`);
          else if (c.type === 'attribute') actual = await evaluate(`${selected}.getAttribute(${JSON.stringify(c.name)})`);
          else if (c.type === 'style') actual = await evaluate(`getComputedStyle(${selected}).getPropertyValue(${JSON.stringify(c.name)})`);
          else if (c.type === 'function') {
            if (!/^[A-Za-z_$][\w$]*$/.test(c.name ?? '')) throw new Error('INVALID_FUNCTION');
            actual = await evaluate(`${c.name}(...${JSON.stringify(c.args ?? [])})`, false);
          } else if (c.type === 'console') actual = logs.join('\n');
          else throw new Error('INVALID_CHECK');
          // Console output is rendered text, even when console.log receives a
          // number. Accept legacy numeric expectations as their printed form;
          // function checks retain strict value/type comparison.
          const expected = c.type === 'exists' ? true : c.type === 'console' && (c.expected === null || ['string', 'number', 'boolean'].includes(typeof c.expected)) ? String(c.expected).replace(/\r\n/g, '\n') : c.expected;
          if (isDeepStrictEqual(actual, expected)) passed++;
        } catch { /* A failed behavior check is not an infrastructure success. */ }
      }
      results.push({ questionId: q.id, correct: !scriptFailed && passed === q.checks.length, checksPassed: passed, checksTotal: q.checks.length, ...(scriptFailed ? { error: 'CODE_ERROR' } : {}) });
      } catch (error) {
        // Once student execution has started, a renderer timeout is a code
        // resource failure. Browser startup failures still exit nonzero.
        if (!/timed out|timeout|Target closed|Session closed/i.test(String((error as Error).message))) throw error;
        results.push({ questionId: q.id, correct: false, checksPassed: 0, checksTotal: q.checks?.length ?? 0, error: 'CODE_LIMIT' });
      } finally { await page.close().catch(() => undefined); }
    }
    process.stdout.write(JSON.stringify({ results, correct: results.every((r) => r.correct) }) + '\n');
  } finally { await browser.close(); }
}
main().catch(() => { process.stderr.write('EXECUTION_SANDBOX_UNAVAILABLE\n'); process.exitCode = 1; });
