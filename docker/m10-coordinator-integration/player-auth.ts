// TEST ONLY: the player presentation receives synthetic auth/lang context.
// Telemetry transport uses the real same-origin cookie/CSRF guarded API.
export class ApiError extends Error { code = 'TEST_TRANSPORT'; status = 500; }
export const useAuth = () => ({ user: null });
export const useLang = () => ({ lang: 'en' });
export const apiResponse = (path: string, init: RequestInit) => fetch(`/api${path}`, { ...init, credentials: 'include' });
