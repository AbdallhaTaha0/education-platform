/** Shared health-check types. Statuses are coarse by design: no connection
 * strings, credentials, or driver error text may reach API responses. */

export type DependencyStatus = 'up' | 'down';

export interface DependencyCheck {
  status: DependencyStatus;
  /** Milliseconds the check took (bounded by the readiness timeout). */
  latencyMs: number;
}

export interface ReadinessChecks {
  postgres: DependencyCheck;
  redis: DependencyCheck;
}

export type CheckFn = () => Promise<DependencyCheck>;

export class CheckTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} check exceeded ${timeoutMs}ms`);
    this.name = 'CheckTimeoutError';
  }
}

/** Races a check against a bounded timeout so readiness cannot hang. */
export async function withTimeout(check: CheckFn, timeoutMs: number, label: string): Promise<DependencyCheck> {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<DependencyCheck>((_, reject) => {
      timer = setTimeout(() => reject(new CheckTimeoutError(label, timeoutMs)), timeoutMs);
      timer.unref?.();
    });
    return await Promise.race([check(), timeout]);
  } catch {
    return { status: 'down', latencyMs: Date.now() - started };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
