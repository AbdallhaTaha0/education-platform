export interface SourceFiles { html: string; css: string; javascript: string }
export const EMPTY_SOURCE: SourceFiles = { html: '', css: '', javascript: 'console.log("Hello!");' };
export interface Quota { limit: number; customLimit: number | null; remaining: number; used: number; nextResetAt: string; schedule: string; epoch: number }
