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
  'PLAYBACK_SESSION_EXPIRED',
  'DRM_DEPENDENCY_FAILED',
  'DRM_UNCONFIGURED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
] as const;

export type LearningErrorCode = (typeof LEARNING_ERROR_CODES)[number];

/** Default HTTP status per category. Denials never reveal existence. */
const STATUS_BY_CODE: Record<LearningErrorCode, number> = {
  SUBSCRIPTION_REQUIRED: 403,
  SUBSCRIPTION_EXPIRED: 403,
  LESSON_NOT_FOUND: 404,
  MEDIA_NOT_READY: 409,
  PLAYBACK_UNAVAILABLE: 503,
  PLAYBACK_SESSION_EXPIRED: 401,
  DRM_DEPENDENCY_FAILED: 502,
  DRM_UNCONFIGURED: 503,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
};

const DEFAULT_MESSAGE: Record<LearningErrorCode, string> = {
  SUBSCRIPTION_REQUIRED: 'An active subscription is required.',
  SUBSCRIPTION_EXPIRED: 'The subscription has expired and must be renewed.',
  LESSON_NOT_FOUND: 'Lesson not found.',
  MEDIA_NOT_READY: 'This lesson is not ready for playback yet.',
  PLAYBACK_UNAVAILABLE: 'Playback is temporarily unavailable.',
  PLAYBACK_SESSION_EXPIRED: 'The playback session has expired.',
  DRM_DEPENDENCY_FAILED: 'The media service is unavailable.',
  DRM_UNCONFIGURED: 'The media service is not configured.',
  FORBIDDEN: 'Access is not permitted.',
  VALIDATION_ERROR: 'Request is invalid.',
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
