// TEST ONLY: transport/auth fixture; no real credentials or provider calls.
export class ApiError extends Error { code = 'FIXTURE'; status = 500; }
export const useAuth = () => ({ user: null });
export const useLang = () => ({ lang: 'en' });
export async function apiResponse(path: string, init: RequestInit = {}) {
  if (path.endsWith('/views/start')) return Response.json({ data: { view: { viewSessionId: 'fixture-view' } } });
  const ms = JSON.parse(String(init.body)).playedMilliseconds;
  (window as any).__totals.push(ms);
  if ((window as any).__hang) return new Promise<Response>(() => {});
  return Response.json({ data: { view: { playedMilliseconds: ms } } });
}
