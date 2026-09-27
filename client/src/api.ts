/** Same-origin API access through Nginx (/api/* -> backend). No secrets here. */
const API_BASE: string =
  (import.meta.env['VITE_API_BASE'] as string | undefined) || '/api';

export type HealthState = 'loading' | 'up' | 'down';

export interface FoundationStatus {
  live: HealthState;
  ready: HealthState;
}

async function fetchJson(path: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Liveness = the backend process responds. Readiness = deps reachable. */
export async function fetchFoundationStatus(timeoutMs = 8000): Promise<FoundationStatus> {
  const [liveRes, readyRes] = await Promise.allSettled([
    fetchJson('/health/live', timeoutMs),
    fetchJson('/health/ready', timeoutMs),
  ]);
  const live: HealthState =
    liveRes.status === 'fulfilled' && liveRes.value.ok ? 'up' : 'down';
  const ready: HealthState =
    readyRes.status === 'fulfilled' && readyRes.value.ok ? 'up' : 'down';
  return { live, ready };
}
