import { assessmentApi } from '../assessments/api';
import type { Quota } from './types';
export async function pythonPreview(source: string, input: string, signal: AbortSignal, assessmentId?: string, onQuota?: (quota: Quota) => void): Promise<{ output: string; error: string | null }> {
  const job = await assessmentApi<{ id: string; quota?: Quota }>('/assessments/python/run', 'POST', { source, input, idempotencyKey: crypto.randomUUID(), ...(assessmentId ? { assessmentId } : {}) });
  if (job.quota) onQuota?.(job.quota);
  const started = Date.now();
  for (let n = 0; ; n++) {
    if (signal.aborted) throw new Error('STOPPED');
    const result = await assessmentApi<{ state: string; output: string | null; error: string | null }>(`/assessments/python/runs/${job.id}`);
    if (!['PENDING', 'RUNNING'].includes(result.state)) return { output: result.output ?? '', error: result.error };
    if (Date.now() - started > 120000) throw new Error('CHECKING_IN_PROGRESS');
    await new Promise<void>((resolve) => { const timer = setTimeout(done, n < 5 ? 1000 : 5000); function done(): void { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); } signal.addEventListener('abort', done, { once: true }); });
  }
}
