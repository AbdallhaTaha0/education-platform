import type { Prisma, PrismaClient } from '@prisma/client';
import type { PlatformCache as Redis } from '../../infra/cache.js';
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
  durationDays: number | null;
  accessMode: 'DURATION' | 'TERM_END' | 'YEAR_END' | 'UNTIL_REMOVAL';
  accessEndsAt: string | null;
}

export interface PublicSubject {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
}

export interface PublicTeacher {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  bioAr: string | null;
  bioEn: string | null;
}

export interface PublicCourse {
  coverUrl?: string | null;
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  publishedAt: string | null;
  plans: PublicPlan[];
  subject: PublicSubject | null;
  teacher: PublicTeacher | null;
  academic: {
    grade: string | null;
    academicYear: string | null;
    term: number | null;
    courseKind: string | null;
    teachingMonth: string | null;
  };
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
  subjectId?: string | null;
  teacherId?: string | null;
  subject?: { id: string; active: boolean } | null;
  teacher?: { id: string; active: boolean } | null;
  sections: CourseHierarchySection[];
  plans: { id: string }[];
}
