/** Stable machine-readable identity error codes. The frontend localizes these;
 * messages here are English fallbacks only and carry no sensitive data. */
export const IDENTITY_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_FIELD',
  'EMAIL_TAKEN',
  'PHONE_TAKEN',
  'INVALID_CREDENTIALS',
  'TOKEN_MISSING',
  'TOKEN_INVALID',
  'TOKEN_REUSED',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'CSRF_INVALID',
  'ORIGIN_FORBIDDEN',
  'FORBIDDEN',
  'RATE_LIMITED',
  'ADMIN_EXISTS',
  'NOT_FOUND',
] as const;

export type IdentityErrorCode = (typeof IDENTITY_ERROR_CODES)[number];

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: IdentityErrorCode | string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** Consistent success envelope: `{ data: ... }`. */
export function ok<T>(data: T): { data: T } {
  return { data };
}
