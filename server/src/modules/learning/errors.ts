/**
 * Stable frontend-safe learning error categories.
 *
 * These are contract, not decoration: the client localizes them, and tests
 * assert on them. Messages carry no user, course, lesson, asset, dependency or
 * database detail, so an unauthenticated or unauthorized caller learns nothing
 * beyond the category itself.
 */
export const LEARNING_ERROR_CODES = [
  'SUBSCRIPTION_REQUIRED',
  'SUBSCRIPTION_EXPIRED',
  'LESSON_NOT_FOUND',
  'MEDIA_NOT_READY',
  'PLAYBACK_UNAVAILABLE',
  'PLAYBACK_DEVICE_LIMIT',
  'PLAYBACK_DEVICE_REVOKED',
  'PLAYBACK_STREAM_LIMIT',
  'PLAYBACK_SESSION_EXPIRED',
  'DRM_DEPENDENCY_FAILED',
  'DRM_UNCONFIGURED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'MATERIAL_INVALID',
  'MATERIAL_TOO_LARGE',
  'MATERIAL_NOT_FOUND',
  'MATERIAL_STORAGE_UNAVAILABLE',
  'DEVICE_INSPECTION_UNAVAILABLE',
  'DEVICE_RELEASE_ACTIVE',
  'DEVICE_RELEASE_REVOKED',
  'DEVICE_RELEASE_UNAVAILABLE',
] as const;

export type LearningErrorCode = (typeof LEARNING_ERROR_CODES)[number];

/** Default HTTP status per category. Denials never reveal existence. */
const STATUS_BY_CODE: Record<LearningErrorCode, number> = {
  SUBSCRIPTION_REQUIRED: 403,
  SUBSCRIPTION_EXPIRED: 403,
  LESSON_NOT_FOUND: 404,
  MEDIA_NOT_READY: 409,
  PLAYBACK_UNAVAILABLE: 503,
  PLAYBACK_DEVICE_LIMIT: 403,
  PLAYBACK_DEVICE_REVOKED: 403,
  PLAYBACK_STREAM_LIMIT: 403,
  PLAYBACK_SESSION_EXPIRED: 401,
  DRM_DEPENDENCY_FAILED: 502,
  DRM_UNCONFIGURED: 503,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  MATERIAL_INVALID: 400,
  MATERIAL_TOO_LARGE: 413,
  MATERIAL_NOT_FOUND: 404,
  MATERIAL_STORAGE_UNAVAILABLE: 503,
  DEVICE_INSPECTION_UNAVAILABLE: 503,
  DEVICE_RELEASE_ACTIVE: 409,
  DEVICE_RELEASE_REVOKED: 409,
  DEVICE_RELEASE_UNAVAILABLE: 503,
};

const DEFAULT_MESSAGE: Record<LearningErrorCode, string> = {
  SUBSCRIPTION_REQUIRED: 'An active subscription is required.',
  SUBSCRIPTION_EXPIRED: 'The subscription has expired and must be renewed.',
  LESSON_NOT_FOUND: 'Lesson not found.',
  MEDIA_NOT_READY: 'This lesson is not ready for playback yet.',
  PLAYBACK_UNAVAILABLE: 'Playback is temporarily unavailable.',
  PLAYBACK_DEVICE_LIMIT: 'The account device limit has been reached. Contact support.',
  PLAYBACK_DEVICE_REVOKED: 'This device cannot play videos. Contact support.',
  PLAYBACK_STREAM_LIMIT: 'Stop playback on another device before trying again.',
  PLAYBACK_SESSION_EXPIRED: 'The playback session has expired.',
  DRM_DEPENDENCY_FAILED: 'The media service is unavailable.',
  DRM_UNCONFIGURED: 'The media service is not configured.',
  FORBIDDEN: 'Access is not permitted.',
  VALIDATION_ERROR: 'Request is invalid.',
  MATERIAL_INVALID: 'The material is invalid or malformed.',
  MATERIAL_TOO_LARGE: 'The material exceeds the size limit.',
  MATERIAL_NOT_FOUND: 'Material not found.',
  MATERIAL_STORAGE_UNAVAILABLE: 'The storage service is unavailable.',
  DEVICE_INSPECTION_UNAVAILABLE: 'Device information is temporarily unavailable.',
  DEVICE_RELEASE_ACTIVE: 'This device has active playback and cannot be released.',
  DEVICE_RELEASE_REVOKED: 'Revoked devices cannot be released.',
  DEVICE_RELEASE_UNAVAILABLE: 'Device release is temporarily unavailable.',
};

export class LearningError extends Error {
  readonly status: number;
  readonly code: LearningErrorCode;

  constructor(code: LearningErrorCode, message?: string) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = 'LearningError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function isLearningErrorCode(value: unknown): value is LearningErrorCode {
  return typeof value === 'string' && (LEARNING_ERROR_CODES as readonly string[]).includes(value);
}
