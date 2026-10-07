// TEST ONLY: synthetic identity/language for isolated presentation verification.
export const useAuth = () => ({ user: { role: 'STUDENT', phone: '01000000000' } });
export const useLang = () => ({ lang: (window as any).__language ?? 'en' });
export class ApiError extends Error { code = 'FIXTURE'; status = 500; }
export async function apiResponse() { throw new Error('Tracking disabled in presentation fixture'); }
