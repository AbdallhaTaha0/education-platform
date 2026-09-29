import { ApiError } from '../identity/errors.js';
import { MAX_RECHARGE_PIASTRES, MIN_RECHARGE_PIASTRES } from './errors.js';

/** Validate an integer-minor-unit EGP amount. Floats are never accepted. */
export function assertPiastres(value: unknown, field: string, min = MIN_RECHARGE_PIASTRES, max = MAX_RECHARGE_PIASTRES): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ${field}: expected an integer number of piastres.`, { field });
  }
  return value;
}

export function assertNonEmptyString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ${field}.`, { field });
  }
  return value.trim();
}

export function assertIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 64 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid idempotencyKey.', { field: 'idempotencyKey' });
  }
  return value;
}

/** Normalize a transfer reference for channel-scoped uniqueness (D21). */
export function normalizeReference(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid reference.', { field: 'reference' });
  }
  const norm = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (norm.length < 4 || norm.length > 64 || !/^[A-Z0-9]+$/.test(norm)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid reference.', { field: 'reference' });
  }
  return norm;
}
