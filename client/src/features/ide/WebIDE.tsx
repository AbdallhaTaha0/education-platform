import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';
import { pythonPreview } from './python';
import { useLang } from '../../i18n';
import { Button } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Notice';
import { previewDocument } from './preview';
import { modeName, type IDEMode, type Quota, type SourceFiles } from './types';
import { ideHighlight } from './highlight';
import './ide.css';

/** Visible reasons also remain readable when a native disabled button cannot focus. */
function IDEAction({ reason, ...props }: ComponentProps<typeof Button> & { reason?: string }): JSX.Element {
  return <Button {...props} disabledReason={reason} />;
}

export function WebIDE({ value, onChange, beforeRun, disabled = false, disabledReason, starter, defaultInput = '', mode = 'javascript', assessmentId, onPythonQuota }: { value: SourceFiles; onChange: (source: SourceFiles) => void; beforeRun?: () => Promise<void>; disabled?: boolean; disabledReason?: string; starter?: SourceFiles; defaultInput?: string; mode?: IDEMode; assessmentId?: string; onPythonQuota?: (quota: Quota) => void }): JSX.Element {
  const { lang } = useLang(); const label = (ar: string, en: string): string => lang === 'ar' ? ar : en;
  const [document, setDocument] = useState<string | null>(null);
  const [file, setFile] = useState<'html' | 'css' | 'javascript'>('javascript');
  const activeFile = mode === 'python' ? 'python' : mode === 'web' ? file : 'javascript';
  const pythonController = useRef<AbortController | null>(null);
  const [input, setInput] = useState(defaultInput);
  const [lines, setLines] = useState<Array<{ level: string; message: string }>>([]); const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false); const [formatting, setFormatting] = useState(false); const [formatError, setFormatError] = useState('');
  const formatter = useRef<Worker | null>(null); const mounted = useRef(true);
  const host = useRef<HTMLDivElement>(null); const view = useRef<EditorView | null>(null); const frame = useRef<HTMLIFrameElement>(null);
  const callback = useRef(onChange); const source = useRef(value); const runId = useRef(''); const syncing = useRef(false);
  callback.current = onChange; source.current = value;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; formatter.current?.terminate(); pythonController.current?.abort(); }; }, []);
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({ parent: host.current, doc: source.current[activeFile] ?? '', extensions: [basicSetup, keymap.of([indentWithTab]), indentUnit.of(activeFile === 'python' ? '    ' : '  '), activeFile === 'python' ? python() : activeFile === 'html' ? html() : activeFile === 'css' ? css() : javascript(), ideHighlight, EditorView.lineWrapping, EditorView.theme({ '&': { backgroundColor: 'transparent', color: 'inherit' }, '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--color-muted)', borderColor: 'var(--color-border)' }, '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--color-interactive)' }, '.cm-cursor': { borderLeftColor: 'var(--color-ink)' }, '.cm-selectionBackground': { backgroundColor: 'var(--color-border-strong) !important' }, '.cm-content': { minHeight: '420px', fontFamily: 'monospace' } }), EditorView.contentAttributes.of({ 'aria-label': activeFile + ' editor', spellcheck: 'false' }), EditorView.updateListener.of((update) => { if (update.docChanged && !syncing.current) callback.current({ ...source.current, [activeFile]: update.state.doc.toString() }); })] });
    view.current = editor; return () => { editor.destroy(); view.current = null; };
  }, [activeFile]);
  useEffect(() => { const editor = view.current; if (editor && editor.state.doc.toString() !== (value[activeFile] ?? '')) { syncing.current = true; try { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value[activeFile] ?? '' } }); } finally { syncing.current = false; } } }, [value, activeFile]);
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
      const id = crypto.randomUUID();
      if (mode === 'python') {
        runId.current = id; const controller = new AbortController(); pythonController.current = controller;
        const result = await pythonPreview(source.current.python ?? '', input, controller.signal, assessmentId, onPythonQuota);
        if (!controller.signal.aborted && mounted.current) setLines([...result.output.split('\n').filter((line) => line.length).map((message) => ({ level: 'log', message })), ...(result.error ? [{ level: 'error', message: result.error }] : [])]);
        return;
      }
      const nonce = crypto.randomUUID().replace(/-/g, '');
      // Parse before reserving: malformed source still counts when the Run is accepted.
      let page: string | null = null; let error: unknown;
      try { page = previewDocument(mode === 'web' ? source.current : { html: '', css: '', javascript: source.current.javascript }, id, nonce, input); } catch (e) { error = e; }
      await beforeRun?.(); runId.current = id;
      if (error) throw error;
      setDocument(page);
    } catch (e) { if (!pythonController.current?.signal.aborted && mounted.current) setLines([{ level: 'error', message: e instanceof Error ? e.message.slice(0, 2000) : label('تعذر التشغيل', 'Run failed') }]); }
    finally { if (mounted.current) setBusy(false); }
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
        worker!.postMessage({ code: original, language: activeFile });
      });
      if (!mounted.current) return;
      if (view.current !== editor || editor.state.doc.toString() !== original) { setFormatError(label('تغير الكود أثناء التنسيق؛ حاول مرة أخرى.', 'Code changed while formatting; try again.')); return; }
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: formatted } });
    } catch { if (mounted.current) setFormatError(label('تعذر التنسيق. تأكد من صحة الكود؛ الكود محفوظ كما هو.', 'Could not format. Check your code syntax; your code is unchanged.')); }
    finally { clearTimeout(timeout); worker?.terminate(); formatter.current = null; if (mounted.current) setFormatting(false); }
  }
  return <section data-testid="web-ide" data-ide-mode={mode} className="rounded-card border border-border bg-surface p-4" aria-label={label('محرر الويب', 'Web IDE')}>
    <div className="mb-3 flex flex-wrap items-start gap-2">
      <span dir="ltr" data-testid="ide-language" className="ide-language inline-flex items-center gap-2 rounded-control px-3 py-2 font-semibold">
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 32 32" className="shrink-0"><rect width="32" height="32" rx="3" fill="currentColor" /><text x="29" y="27" textAnchor="end" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="21" fill="var(--ide-language-ink)">{mode === 'python' ? 'Py' : mode === 'web' ? '<>' : 'JS'}</text></svg>
        {modeName(mode)}
      </span>
      <IDEAction data-testid="ide-run" className="ide-run" onClick={() => void run()} disabled={busy || disabled} reason={busy ? label('جارٍ بدء التشغيل؛ انتظر حتى ينتهي الطلب.', 'Starting execution; wait for the request to finish.') : disabledReason ?? label('التشغيل غير متاح حاليًا في هذا المحرر.', 'Run is currently unavailable in this editor.')}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3.5v13l11-6.5z" /></svg>{busy ? label('جارٍ التشغيل…', 'Starting…') : label('تشغيل', 'Run')}</IDEAction>
      <IDEAction data-testid="ide-stop" variant="secondary" onClick={() => { runId.current = ''; pythonController.current?.abort(); setDocument(null); }} disabled={!document && !busy} reason={label('لا يوجد تشغيل لإيقافه. شغّل الكود أولًا.', 'Nothing to stop. Run your code first.')}>{label('إيقاف', 'Stop')}</IDEAction>
      <IDEAction data-testid="ide-format" variant="secondary" onClick={() => void organize()} disabled={formatting} reason={label('يجري تنسيق الكود؛ انتظر حتى يكتمل.', 'Code formatting is in progress; wait until it finishes.')}>{formatting ? label('جارٍ التنسيق…', 'Formatting…') : label('تنسيق الكود', 'Format code')}</IDEAction>
      {starter ? <IDEAction data-testid="ide-reset" variant="secondary" onClick={() => setResetting(true)} disabled={formatting || busy} reason={formatting ? label('انتظر اكتمال التنسيق قبل استعادة الكود.', 'Wait for formatting to finish before resetting code.') : label('انتظر اكتمال طلب التشغيل قبل استعادة الكود.', 'Wait for the run request to finish before resetting code.')}>{label('استعادة الكود الابتدائي', 'Reset to starter')}</IDEAction> : null}
    </div>
    {resetting && starter ? <div role="alert" className="mb-3 rounded-control border border-border p-3"><p>{label('سيتم استبدال الكود الحالي بالكود الابتدائي لهذا السؤال. المحاولات والنتائج السابقة لن تتغير.', 'Replace your current code with this question’s starter code? Previous submissions and results will stay unchanged.')}</p><div className="mt-2 flex flex-wrap gap-2"><IDEAction data-testid="ide-reset-confirm" disabled={formatting || busy} reason={label('انتظر انتهاء التشغيل أو التنسيق قبل تأكيد الاستعادة.', 'Wait for execution setup or formatting to finish before confirming reset.')} onClick={() => { runId.current = ''; setDocument(null); setLines([]); setFormatError(''); callback.current({ ...starter }); setResetting(false); }}>{label('تأكيد الاستعادة', 'Confirm reset')}</IDEAction><Button variant="secondary" onClick={() => setResetting(false)}>{label('إلغاء', 'Cancel')}</Button></div></div> : null}
    {formatError ? <Notice kind="error">{formatError}</Notice> : null}
    <label className="mb-3 block text-sm font-semibold">{label('المدخلات', 'Input')}<textarea data-testid="ide-input" dir="ltr" rows={3} maxLength={8192} value={input} onChange={(event) => setInput(event.target.value)} className="mt-2 w-full rounded-control border border-border bg-elevated p-3 font-mono text-ink" /></label>
    {mode === 'web' ? <div role="tablist" aria-label={label('ملفات المشروع', 'Project files')} dir="ltr" className="mb-3 flex gap-2">{(['html', 'css', 'javascript'] as const).map((name) => <button type="button" role="tab" aria-selected={activeFile === name} key={name} className="min-h-[44px] rounded-control border border-border px-4" onClick={() => setFile(name)}>{name === 'javascript' ? 'JavaScript' : name.toUpperCase()}</button>)}</div> : null}
    <div data-testid="ide-workspace" dir="ltr" className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div ref={host} data-testid="ide-editor" data-ide-language={activeFile} dir="ltr" className="ide-editor min-h-[420px] min-w-0 overflow-hidden rounded-control border border-border bg-elevated text-ink" />
      <div data-testid="ide-console" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="flex h-[460px] min-w-0 flex-col rounded-control border border-border bg-elevated p-3">
        <div className="mb-3 flex items-start justify-between gap-2"><h3 className="font-semibold">{label('المخرجات', 'Console')}</h3><IDEAction data-testid="ide-clear" variant="secondary" onClick={() => setLines([])} disabled={lines.length === 0} reason={label('المخرجات فارغة؛ لا يوجد شيء لمسحه.', 'The console is empty; there is nothing to clear.')}>{label('مسح المخرجات', 'Clear console')}</IDEAction></div>
        <pre dir="ltr" role="log" aria-label={label('مخرجات الكود', 'Code output')} aria-live="polite" className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words text-sm">{lines.map((line, i) => <span key={i} className={`block ${line.level === 'error' ? 'text-error-fg' : ''}`}>{line.message}</span>)}</pre>
      </div>
    </div>
    <iframe key={runId.current} ref={frame} className={mode === 'web' ? 'mt-4 h-[420px] w-full rounded-control border border-border bg-white' : 'sr-only'} aria-hidden={mode !== 'web'} tabIndex={mode === 'web' ? 0 : -1} title={mode === 'web' ? 'Isolated web preview' : 'Isolated JavaScript execution'} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={document ?? '<!doctype html><html><body></body></html>'} />
    <p className="mt-3 text-xs text-muted">{label('استخدم console.log في JavaScript أو input()/print() في Python. التقييم الرسمي يتم عند الإرسال؛ الموارد الخارجية غير متاحة.', 'Use console.log for JavaScript or input()/print() for Python. Official checking happens on Submit; external resources are unavailable.')}</p>
    <p className="mt-1 text-xs text-muted">{label('Tab للمسافة البادئة، وShift+Tab لإزالتها. للخروج من المحرر اضغط Esc ثم Tab.', 'Tab indents; Shift+Tab unindents. Press Esc, then Tab to leave the editor.')}</p>
  </section>;
}
