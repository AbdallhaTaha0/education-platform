import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { useLang } from '../../i18n';
import { Button } from '../../components/ui/Button';
import { previewDocument } from './preview';
import type { SourceFiles } from './types';
import { javaScriptHighlight } from './highlight';

export function WebIDE({ value, onChange, beforeRun, disabled = false, starter, defaultInput = '' }: { value: SourceFiles; onChange: (source: SourceFiles) => void; beforeRun?: () => Promise<void>; disabled?: boolean; starter?: SourceFiles; defaultInput?: string }): JSX.Element {
  const { lang } = useLang(); const label = (ar: string, en: string): string => lang === 'ar' ? ar : en;
  const [document, setDocument] = useState<string | null>(null);
  const [input, setInput] = useState(defaultInput);
  const [lines, setLines] = useState<Array<{ level: string; message: string }>>([]); const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false); const [formatting, setFormatting] = useState(false); const [formatError, setFormatError] = useState('');
  const formatter = useRef<Worker | null>(null); const mounted = useRef(true);
  const host = useRef<HTMLDivElement>(null); const view = useRef<EditorView | null>(null); const frame = useRef<HTMLIFrameElement>(null);
  const callback = useRef(onChange); const source = useRef(value); const runId = useRef(''); const syncing = useRef(false);
  callback.current = onChange; source.current = value;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; formatter.current?.terminate(); }; }, []);
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({ parent: host.current, doc: source.current.javascript, extensions: [basicSetup, javascript(), javaScriptHighlight, EditorView.lineWrapping, EditorView.theme({ '&': { backgroundColor: 'transparent', color: 'inherit' }, '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--color-muted)', borderColor: 'var(--color-border)' }, '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--color-interactive)' }, '.cm-cursor': { borderLeftColor: 'var(--color-ink)' }, '.cm-selectionBackground': { backgroundColor: 'var(--color-border-strong) !important' }, '.cm-content': { minHeight: '420px', fontFamily: 'monospace' } }), EditorView.contentAttributes.of({ 'aria-label': 'javascript editor', spellcheck: 'false' }), EditorView.updateListener.of((update) => { if (update.docChanged && !syncing.current) callback.current({ ...source.current, javascript: update.state.doc.toString() }); })] });
    view.current = editor; return () => { editor.destroy(); view.current = null; };
  }, []);
  useEffect(() => { const editor = view.current; if (editor && editor.state.doc.toString() !== value.javascript) { syncing.current = true; try { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value.javascript } }); } finally { syncing.current = false; } } }, [value]);
  useEffect(() => {
    const receive = (event: MessageEvent): void => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
      const m = event.data as { type?: unknown; runId?: unknown; level?: unknown; message?: unknown };
      if (!m || m.type !== 'fayq-preview' || m.runId !== runId.current || typeof m.message !== 'string' || !['log', 'warn', 'error', 'ready'].includes(String(m.level))) return;
      if (m.level !== 'ready') setLines((old) => old.length < 100 ? [...old, { level: String(m.level), message: (m.message as string).slice(0, 2000) }] : old);
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, []);
  async function run(): Promise<void> {
    if (busy || disabled) return; setBusy(true); setLines([]);
    try {
      const id = crypto.randomUUID(); const nonce = crypto.randomUUID().replace(/-/g, '');
      // Parse before reserving: malformed source still counts when the Run is accepted.
      let page: string | null = null; let error: unknown;
      try { page = previewDocument({ html: '', css: '', javascript: source.current.javascript }, id, nonce, input); } catch (e) { error = e; }
      await beforeRun?.(); runId.current = id;
      if (error) throw error;
      setDocument(page);
    } catch (e) { setLines([{ level: 'error', message: e instanceof Error ? e.message.slice(0, 2000) : label('تعذر التشغيل', 'Run failed') }]); }
    finally { setBusy(false); }
  }
  async function organize(): Promise<void> {
    if (formatting) return;
    const editor = view.current; if (!editor) return;
    const original = editor.state.doc.toString();
    setFormatting(true); setFormatError('');
    let worker: Worker | null = null; let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      worker = new Worker(new URL('./format.worker.ts', import.meta.url), { type: 'module' }); formatter.current = worker;
      const formatted = await new Promise<string>((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('format')), 10000);
        worker!.onerror = () => reject(new Error('format'));
        worker!.onmessage = (event: MessageEvent<{ code?: string; error?: boolean }>) => typeof event.data.code === 'string' ? resolve(event.data.code) : reject(new Error('format'));
        worker!.postMessage(original);
      });
      if (!mounted.current) return;
      if (view.current !== editor || editor.state.doc.toString() !== original) { setFormatError(label('تغير الكود أثناء التنسيق؛ حاول مرة أخرى.', 'Code changed while formatting; try again.')); return; }
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: formatted } });
    } catch { if (mounted.current) setFormatError(label('تعذر التنسيق. تأكد من صحة JavaScript؛ الكود محفوظ كما هو.', 'Could not format. Check your JavaScript syntax; your code is unchanged.')); }
    finally { clearTimeout(timeout); worker?.terminate(); formatter.current = null; if (mounted.current) setFormatting(false); }
  }
  return <section data-testid="web-ide" className="rounded-card border border-border bg-surface p-4" aria-label={label('محرر الويب', 'Web IDE')}>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span dir="ltr" className="rounded-control bg-primary px-3 py-2 font-semibold text-primary-ink">JavaScript</span>
      <Button data-testid="ide-run" onClick={() => void run()} disabled={busy || disabled}>{label('تشغيل', 'Run')}</Button>
      <Button variant="secondary" onClick={() => { runId.current = ''; setDocument(null); }} disabled={!document}>{label('إيقاف', 'Stop')}</Button>
      <Button data-testid="ide-format" variant="secondary" onClick={() => void organize()} disabled={formatting}>{formatting ? label('جارٍ التنسيق…', 'Formatting…') : label('تنسيق الكود', 'Format code')}</Button>
      {starter ? <Button data-testid="ide-reset" variant="secondary" onClick={() => setResetting(true)} disabled={formatting || busy}>{label('استعادة الكود الابتدائي', 'Reset to starter')}</Button> : null}
    </div>
    {resetting && starter ? <div role="alert" className="mb-3 rounded-control border border-border p-3"><p>{label('سيتم استبدال الكود الحالي بالكود الابتدائي لهذا السؤال. المحاولات والنتائج السابقة لن تتغير.', 'Replace your current code with this question’s starter code? Previous submissions and results will stay unchanged.')}</p><div className="mt-2 flex flex-wrap gap-2"><Button data-testid="ide-reset-confirm" disabled={formatting || busy} onClick={() => { runId.current = ''; setDocument(null); setLines([]); setFormatError(''); callback.current({ ...starter }); setResetting(false); }}>{label('تأكيد الاستعادة', 'Confirm reset')}</Button><Button variant="secondary" onClick={() => setResetting(false)}>{label('إلغاء', 'Cancel')}</Button></div></div> : null}
    {formatError ? <p role="alert" className="mb-3 text-error-fg">{formatError}</p> : null}
    <label className="mb-3 block text-sm font-semibold">{label('المدخلات (كل readline يقرأ سطرًا)', 'Input (each readline reads one line)')}<textarea data-testid="ide-input" dir="ltr" rows={3} maxLength={8192} value={input} onChange={(event) => setInput(event.target.value)} className="mt-2 w-full rounded-control border border-border bg-elevated p-3 font-mono text-ink" /></label>
    <div data-testid="ide-workspace" className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div ref={host} data-testid="ide-editor" dir="ltr" className="ide-editor min-h-[420px] min-w-0 overflow-hidden rounded-control border border-border bg-elevated text-ink" />
      <div data-testid="ide-console" className="flex h-[460px] min-w-0 flex-col rounded-control border border-border bg-elevated p-3">
        <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">{label('المخرجات', 'Console')}</h3><Button variant="secondary" onClick={() => setLines([])} disabled={lines.length === 0}>{label('مسح المخرجات', 'Clear console')}</Button></div>
        <pre dir="ltr" role="log" aria-label={label('مخرجات JavaScript', 'JavaScript output')} aria-live="polite" className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words text-sm">{lines.map((line, i) => <span key={i} className={`block ${line.level === 'error' ? 'text-error-fg' : ''}`}>{line.message}</span>)}</pre>
      </div>
    </div>
    <iframe key={runId.current} ref={frame} className="sr-only" aria-hidden="true" tabIndex={-1} title="Isolated JavaScript execution" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={document ?? '<!doctype html><html><body></body></html>'} />
    <p className="mt-3 text-xs text-muted">{label('JavaScript فقط حاليًا. استخدم console.log لعرض النتائج. التقييم الرسمي يتم عند الإرسال؛ الموارد الخارجية غير متاحة.', 'JavaScript only for now. Use console.log to display results. Official checking happens on Submit; external resources are unavailable.')}</p>
  </section>;
}
