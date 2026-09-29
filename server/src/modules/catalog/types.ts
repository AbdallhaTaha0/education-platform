import type { Prisma, PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { ServerConfig } from '../../config.js';
import type { DrmClient } from './drmClient.js';

/** Prisma interactive-transaction client (typed, no `any`). */
export type TxClient = Prisma.TransactionClient;

export type DbClient = PrismaClient | TxClient;

export interface CatalogRouteContext {
  prisma: PrismaClient;
  redis: Redis;
  config: ServerConfig;
  drmFactory: (cfg: ServerConfig) => DrmClient | null;
}

export type DeletionTargetType = 'COURSE' | 'SECTION' | 'LESSON';

export interface PublicPlan {
  id: string;
  currentPricePiastres: number;
  previousPricePiastres: number | null;
  durationDays: number;
}

export interface PublicCourse {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  publishedAt: string | null;
  plans: PublicPlan[];
}

export interface AffectedMedia {
  mappingId: string;
  drmAssetId: string | null;
  externalAssetId: string;
  lessonId: string;
  sectionId: string;
  courseId: string;
}

export interface CourseHierarchyLesson {
  id: string;
  titleAr: string;
  titleEn: string;
  media: { status: string; assetId: string | null } | null;
}

export interface CourseHierarchySection {
  id: string;
  titleAr: string;
  titleEn: string;
  lessons: CourseHierarchyLesson[];
}

export interface CourseHierarchy {
  id: string;
  status: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  deletionRequestedAt: Date | null;
  sections: CourseHierarchySection[];
  plans: { id: string }[];
}
