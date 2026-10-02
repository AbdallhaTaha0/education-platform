/** Frontend-safe learning models (M5). Mirrors the server contract. */

export type SubscriptionState = 'ACTIVE' | 'EXPIRED';

export interface DashboardSubscription {
  courseId: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  expiresAt: string | null;
  availableForLearning?: boolean;
  academic?: import('../../academic/model').Academic;
  state: SubscriptionState;
  percentComplete: number;
  totalLessons: number;
  completedLessons: number;
  lastLessonId: string | null;
  lastAccessedAt: string | null;
}

export interface DashboardPayload {
  active: DashboardSubscription[];
  expired: DashboardSubscription[];
  walletBalancePiastres: number | null;
}

export interface LearningCourse {
  courseId: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  expiresAt: string | null;
  entitled: boolean;
  status: string;
}

export interface OutlineLesson {
  lessonId: string;
  titleAr: string;
  titleEn: string;
  position: number;
  playable: boolean;
  locked?: boolean;
  blockingAssessmentIds?: string[];
  completed: boolean;
  resumePositionSeconds: number;
}

export interface OutlineSection {
  sectionId: string;
  titleAr: string;
  titleEn: string;
  position: number;
  lessons: OutlineLesson[];
}

export interface OutlinePayload {
  course: LearningCourse;
  sections: OutlineSection[];
}

/** Only what the player needs. The token never leaves component memory. */
export interface PlaybackGrant {
  referenceId: string;
  playbackSessionId: string;
  playbackToken: string;
  tokenExpiresAt: string;
  sessionExpiresAt: string;
  manifestUrl: string;
  licenseUrl: string;
  drmProvider: string;
  watermark: {
    type: string;
    maskedIdentity: string;
    positions: Array<{ x: number; y: number }>;
    expiresAt: string | null;
  } | null;
  resumePositionSeconds: number;
}

export interface LessonProgressState {
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
}

/**
 * Result of ending a playback session. `closure` says whether the DRM confirmed
 * the closure immediately or the platform will retry it in the background; the
 * viewer-facing state is ended either way.
 */
export type PlaybackClosure = 'CONFIRMED' | 'QUEUED' | 'NOOP';

export interface PlaybackEnd {
  ended: boolean;
  closure: PlaybackClosure;
}

/**
 * Result of a platform-mediated renewal. Only the transient credential and its
 * expiries cross the wire; the external session id and media URLs are unchanged.
 */
export interface PlaybackRenewal {
  renewed: true;
  playbackToken: string;
  tokenExpiresAt: string;
  sessionExpiresAt: string;
}

export type PlayerPhase =
  | 'idle'
  | 'requesting'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error'
  | 'expired';

export interface PlayerState {
  phase: PlayerPhase;
  grant: PlaybackGrant | null;
  errorCode: string | null;
  message: string | null;
}

export const LEARNING_ERROR_KEYS = [
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

export type LearningErrorKey = (typeof LEARNING_ERROR_KEYS)[number];
