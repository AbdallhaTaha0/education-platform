/** Shared learning-module types. */
import type { PrismaClient } from '@prisma/client';
import type { DrmClient } from '../catalog/drmClient.js';
import type { PlaybackDeps } from './playback/service.js';
import type { StorageClient } from '../../infra/storage.js';

/** Route context stashed on the Express app under the `learning` key. */
export interface LearningRouteContext {
  prisma: PrismaClient;
  drm: DrmClient | null;
  playback: PlaybackDeps;
  storage: StorageClient | null;
  /** Backend time in ms. Browser time is display-only. */
  now: () => number;
}

/** Trusted binding resolved from platform records only. */
export interface LearningBinding {
  studentId: string;
  courseId: string;
  courseSlug: string;
  lessonId: string;
  /** Platform MediaMapping.externalAssetId. Never a browser-supplied value. */
  externalAssetId: string;
  /** Opaque internal DRM asset id, present only when the mapping is synced. */
  externalAssetIdInternal: string | null;
}

export interface EntitlementDecision {
  entitled: boolean;
  /** Latest subscription expiry at backend time, for the response envelope. */
  expiresAt: Date | null;
}

/** Bounded progress payload accepted from the player. */
export interface ProgressInput {
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
}

export interface ProgressAggregate {
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  lastLessonId: string | null;
}

/** Frontend-safe playback grant. Contains no secret and no signed URL. */
export interface PlaybackGrant {
  referenceId: string;
  playbackSessionId: string;
  playbackToken: string;
  tokenExpiresAt: string;
  sessionExpiresAt: string;
  manifestUrl: string;
  licenseUrl: string;
  drmProvider: string;
  watermark: WatermarkPresentation | null;
  resumePositionSeconds: number;
}

/** Only what the overlay may render: a label and positions, never a signature. */
export interface WatermarkPresentation {
  type: string;
  maskedIdentity: string;
  positions: Array<{ x: number; y: number }>;
  expiresAt: string | null;
}

/** Caption metadata returned to students (no storage keys). */
export interface CaptionMetadata {
  id: string;
  language: 'ar' | 'en';
  labelAr: string;
  labelEn: string;
  byteSize: number;
}

/** Resource metadata returned to students (no storage keys). */
export interface ResourceMetadata {
  id: string;
  labelAr: string;
  labelEn: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}

/** Materials response for a lesson. */
export interface LessonMaterials {
  lessonId: string;
  durationSeconds: number | null;
  captions: CaptionMetadata[];
  resources: ResourceMetadata[];
}

/** Admin-facing materials response includes validation state. */
export interface AdminLessonMaterials extends LessonMaterials {
  captions: (CaptionMetadata & { state: string; errorCategory?: string | null })[];
  resources: ResourceMetadata[];
}
