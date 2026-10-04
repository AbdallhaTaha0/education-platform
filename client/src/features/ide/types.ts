export type IDEMode = 'javascript' | 'web' | 'python';
export const IDE_MODES: IDEMode[] = ['javascript', 'web', 'python'];
export const modeName = (mode: IDEMode): string => mode === 'web' ? 'HTML + CSS + JavaScript' : mode === 'python' ? 'Python' : 'JavaScript';
export interface SourceFiles { html: string; css: string; javascript: string; python?: string }
export const emptySource = (mode: IDEMode): SourceFiles => mode === 'python' ? { html: '', css: '', javascript: '', python: 'print("Hello!")' } : mode === 'web' ? { html: '<h1 id="hello">Hello!</h1>', css: 'h1 { color: seagreen; }', javascript: 'console.log(document.querySelector("#hello").textContent);' } : { ...EMPTY_SOURCE };
export const EMPTY_SOURCE: SourceFiles = { html: '', css: '', javascript: 'console.log("Hello!");' };
export interface Quota { limit: number; customLimit: number | null; remaining: number; used: number; nextResetAt: string; schedule: string; epoch: number }
