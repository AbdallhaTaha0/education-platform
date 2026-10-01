import { randomUUID } from 'node:crypto';
import { ApiError } from '../identity/errors.js';

/** Centralized M3 engineering bounds (tested). */
export const DURATION_DAYS_MIN = 1;
export const DURATION_DAYS_MAX = 3650;
export const PRICE_MIN_PIASTRES = 1;
export const PRICE_MAX_PIASTRES = 2000000000;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const DRM_CONTENT_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export type DrmContentType = (typeof DRM_CONTENT_TYPES)[number];
/** UI-facing MIME aliases accepted at the platform edge, normalized to DRM values. */
export const PLATFORM_CONTENT_ALIASES: Record<string, DrmContentType> = {
  MP4: 'video/mp4',
  'video/mp4': 'video/mp4',
  WEBM: 'video/webm',
  'video/webm': 'video/webm',
  QUICKTIME: 'video/quicktime',
  'video/quicktime': 'video/quicktime',
};
export const DRM_SECURITY_TIERS = ['STANDARD', 'PREMIUM', 'TRACEABLE'] as const;

export function assertUuid(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ${field}.`, { field });
  }
  return value;
}

export function nonBlankString(value: unknown, field: string, maxLen = 500): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} is required.`, { field });
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be nonblank.`, { field });
  }
  if (trimmed.length > maxLen) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} is too long.`, { field });
  }
  return trimmed;
}

export function validateSlug(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Slug is required.', { field: 'slug' });
  }
  const slug = value.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 120 || !SLUG_PATTERN.test(slug)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Slug is invalid.', { field: 'slug' });
  }
  return slug;
}

export function validatePosition(value: unknown, field = 'position'): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10000) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a positive integer.`, { field });
  }
  return value;
}

export function validateDurationDays(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < DURATION_DAYS_MIN ||
    value > DURATION_DAYS_MAX
  ) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `durationDays must be ${DURATION_DAYS_MIN}–${DURATION_DAYS_MAX}.`,
      {
        field: 'durationDays',
      },
    );
  }
  return value;
}

export function validatePrice(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < PRICE_MIN_PIASTRES ||
    value > PRICE_MAX_PIASTRES
  ) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `${field} must be ${PRICE_MIN_PIASTRES}–${PRICE_MAX_PIASTRES} piastres.`,
      {
        field,
      },
    );
  }
  return value;
}

export function validatePricePair(
  current: unknown,
  previous: unknown,
): { current: number; previous: number | null } {
  const cur = validatePrice(current, 'currentPricePiastres');
  if (previous === undefined || previous === null) return { current: cur, previous: null };
  const prev = validatePrice(previous, 'previousPricePiastres');
  if (!(prev > cur)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'previousPricePiastres must be strictly greater than currentPricePiastres.',
      {
        field: 'previousPricePiastres',
      },
    );
  }
  return { current: cur, previous: prev };
}

export function normalizeContentType(value: unknown): DrmContentType {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'contentType is required.', {
      field: 'contentType',
    });
  }
  const key = value.trim();
  const upper = key.toUpperCase();
  const mapped =
    PLATFORM_CONTENT_ALIASES[key] ??
    PLATFORM_CONTENT_ALIASES[upper] ??
    PLATFORM_CONTENT_ALIASES[key.toLowerCase()];
  if (!mapped) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'contentType must be MP4, WebM, or QuickTime.', {
      field: 'contentType',
    });
  }
  return mapped;
}

export function validateSecurityTier(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'STANDARD';
  if (typeof value !== 'string' || !(DRM_SECURITY_TIERS as readonly string[]).includes(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'securityTier is invalid.', {
      field: 'securityTier',
    });
  }
  return value;
}

/** Reject unknown fields on mutation payloads where practical. */
export function rejectUnknownFields(body: unknown, allowed: ReadonlySet<string>): void {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be an object.');
  }
  const unknown = Object.keys(body as Record<string, unknown>).filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    throw new ApiError(400, 'INVALID_FIELD', 'Request contains unknown fields.', {
      fields: unknown,
    });
  }
}

export function generateExternalAssetId(): string {
  return `edu-${randomUUID()}`;
}

export function generateIdempotencyKey(): string {
  return randomUUID();
}

/** DRM → local media-state mapping (documented + tested). */
export function mapDrmStatusToLocal(drmStatus: string): string {
  switch (drmStatus) {
    case 'UPLOADED':
      return 'UPLOAD_PENDING';
    case 'PROCESSING':
    case 'TRANSCODING':
    case 'PACKAGING':
      return 'PROCESSING';
    case 'READY':
      return 'READY';
    case 'FAILED':
      return 'FAILED';
    case 'DELETING':
      return 'DELETION_PENDING';
    case 'DELETE_FAILED':
      return 'DELETION_FAILED';
    default:
      return 'FAILED';
  }
}

/** Valid course transitions. ARCHIVED is handled separately (any non-archived → ARCHIVED). */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PROCESSING'],
  PROCESSING: ['READY'],
  READY: ['PUBLISHED'],
  PUBLISHED: [],
  ARCHIVED: [],
};

export function assertValidTransition(from: string, to: string): void {
  if (from === to) {
    throw new ApiError(409, 'INVALID_TRANSITION', `Already in ${from}.`);
  }
  // Archive/unarchive use dedicated endpoints; direct transition API rejects them.
  if (to === 'ARCHIVED' || from === 'ARCHIVED') {
    throw new ApiError(
      409,
      'INVALID_TRANSITION',
      `Transition ${from} → ${to} must use archive endpoints.`,
    );
  }
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ApiError(409, 'INVALID_TRANSITION', `Transition ${from} → ${to} is not allowed.`);
  }
}
