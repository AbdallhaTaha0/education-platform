export interface PublicPlan {
  id: string;
  currentPricePiastres: number;
  previousPricePiastres: number | null;
  durationDays: number | null;
  accessMode?: 'DURATION' | 'TERM_END' | 'YEAR_END' | 'UNTIL_REMOVAL';
  accessEndsAt?: string | null;
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
  academic?: import('../../academic/model').Academic;
}

export interface AdminCourseSummary {
  coverId?: string | null;
  revisionOwnerId?: string | null;
  workingCopyId?: string | null;
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  status: string;
  deletionRequestedAt: string | null;
  grade?: string | null;
  academicYear?: string | null;
  term?: number | null;
  courseKind?: string | null;
  teachingMonth?: string | null;
}

export interface AdminPlan {
  id: string;
  currentPricePiastres: number;
  previousPricePiastres: number | null;
  durationDays: number | null;
  accessMode?: 'DURATION' | 'TERM_END' | 'YEAR_END' | 'UNTIL_REMOVAL';
  accessEndsAt?: string | null;
}

export interface AdminMedia {
  id: string;
  status: string;
  externalAssetId: string;
  assetId: string | null;
}

export interface AdminLesson {
  id: string;
  titleAr: string;
  titleEn: string;
  position: number;
  media: AdminMedia | null;
}

export interface AdminSection {
  id: string;
  titleAr: string;
  titleEn: string;
  position: number;
  lessons: AdminLesson[];
}

export interface AdminCourseDetail extends AdminCourseSummary {
  priorStatus: string | null;
  plans: AdminPlan[];
  sections: AdminSection[];
}

export interface LifecycleAction {
  action: 'DRAFT' | 'PROCESSING' | 'READY' | 'PUBLISHED' | 'ARCHIVE' | 'UNARCHIVE';
  enabled: boolean;
  reason: string | null;
}

export interface DeletionOperation {
  id: string;
  targetType: string;
  targetId: string;
  status: string;
  errorCategory: string | null;
  assets: { id: string; lastState: string | null; errorCategory: string | null }[];
}

export const SUPPORTED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export type SupportedVideoMime = (typeof SUPPORTED_VIDEO_MIMES)[number];

export function isSupportedVideoMime(mime: string): mime is SupportedVideoMime {
  return (SUPPORTED_VIDEO_MIMES as readonly string[]).includes(mime);
}

export function formatEgp(piastres: number, lang: string): string {
  const egp = (piastres / 100).toFixed(2);
  return lang === 'ar' ? `${egp} ج.م` : `${egp} EGP`;
}
