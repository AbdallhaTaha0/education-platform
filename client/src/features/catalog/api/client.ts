import { apiFetch } from '../../../auth';
import type {
  AdminCourseDetail,
  AdminCourseSummary,
  DeletionOperation,
  LifecycleAction,
  PublicCourse,
} from '../types/models';

export async function fetchPublicCourses(): Promise<PublicCourse[]> {
  const body = await apiFetch<{ data: { courses: PublicCourse[] } }>('/catalog/courses', {
    retryOnAuth: false,
  });
  return body.data.courses;
}

export async function fetchPublicCourse(slug: string): Promise<PublicCourse> {
  const body = await apiFetch<{ data: { course: PublicCourse } }>(
    `/catalog/courses/${encodeURIComponent(slug)}`,
    {
      retryOnAuth: false,
    },
  );
  return body.data.course;
}

export async function fetchAdminCourses(): Promise<AdminCourseSummary[]> {
  const body = await apiFetch<{ data: { courses: AdminCourseSummary[] } }>(
    '/admin/catalog/courses',
    {
      retryOnAuth: true,
    },
  );
  return body.data.courses;
}

export async function createAdminCourse(input: {
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  academic?: import('../../academic/model').Academic | null;
}): Promise<void> {
  await apiFetch('/admin/catalog/courses', { method: 'POST', retryOnAuth: false, body: input });
}

export async function fetchAdminCourse(courseId: string): Promise<AdminCourseDetail> {
  const body = await apiFetch<{ data: { course: AdminCourseDetail } }>(
    `/admin/catalog/courses/${courseId}`,
    {
      retryOnAuth: true,
    },
  );
  return body.data.course;
}

export async function patchAdminCourse(
  courseId: string,
  input: {
    slug: string;
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    academic?: import('../../academic/model').Academic | null;
  },
): Promise<void> {
  await apiFetch(`/admin/catalog/courses/${courseId}`, {
    method: 'PATCH',
    retryOnAuth: false,
    body: input,
  });
}

export async function fetchLifecycleActions(courseId: string): Promise<LifecycleAction[]> {
  const body = await apiFetch<{ data: { actions: LifecycleAction[] } }>(
    `/admin/catalog/courses/${courseId}/lifecycle-actions`,
    { retryOnAuth: true },
  );
  return body.data.actions;
}

export async function transitionCourse(courseId: string, to: string): Promise<void> {
  await apiFetch(`/admin/catalog/courses/${courseId}/transitions`, {
    method: 'POST',
    retryOnAuth: false,
    body: { to },
  });
}

export async function archiveCourse(courseId: string): Promise<void> {
  await apiFetch(`/admin/catalog/courses/${courseId}/archive`, {
    method: 'POST',
    retryOnAuth: false,
    body: {},
  });
}

export async function unarchiveCourse(courseId: string): Promise<void> {
  await apiFetch(`/admin/catalog/courses/${courseId}/unarchive`, {
    method: 'POST',
    retryOnAuth: false,
    body: {},
  });
}

export async function createPlan(
  courseId: string,
  input: {
    currentPricePiastres: number;
    previousPricePiastres: number | null;
    durationDays: number | null;
    accessMode?: string;
    accessEndsAt?: string | null;
  },
): Promise<void> {
  await apiFetch(`/admin/catalog/courses/${courseId}/plans`, {
    method: 'POST',
    retryOnAuth: false,
    body: input as unknown as Record<string, unknown>,
  });
}

export async function patchPlan(
  planId: string,
  input: {
    currentPricePiastres: number;
    previousPricePiastres: number | null;
    durationDays: number | null;
    accessMode?: string;
    accessEndsAt?: string | null;
  },
): Promise<void> {
  await apiFetch(`/admin/catalog/plans/${planId}`, {
    method: 'PATCH',
    retryOnAuth: false,
    body: input as unknown as Record<string, unknown>,
  });
}

export async function removePlan(planId: string): Promise<void> {
  await apiFetch(`/admin/catalog/plans/${planId}`, { method: 'DELETE', retryOnAuth: false });
}

export async function createSection(
  courseId: string,
  input: { titleAr: string; titleEn: string },
): Promise<void> {
  await apiFetch(`/admin/catalog/courses/${courseId}/sections`, {
    method: 'POST',
    retryOnAuth: false,
    body: input,
  });
}

export async function patchSection(
  sectionId: string,
  input: { titleAr: string; titleEn: string },
): Promise<void> {
  await apiFetch(`/admin/catalog/sections/${sectionId}`, {
    method: 'PATCH',
    retryOnAuth: false,
    body: input,
  });
}

export async function reorderSections(courseId: string, orderedIds: string[]): Promise<void> {
  await apiFetch(`/admin/catalog/courses/${courseId}/sections/reorder`, {
    method: 'POST',
    retryOnAuth: false,
    body: { orderedIds },
  });
}

export async function createLesson(
  sectionId: string,
  input: { titleAr: string; titleEn: string },
): Promise<void> {
  await apiFetch(`/admin/catalog/sections/${sectionId}/lessons`, {
    method: 'POST',
    retryOnAuth: false,
    body: input,
  });
}

export async function patchLesson(
  lessonId: string,
  input: { titleAr: string; titleEn: string },
): Promise<void> {
  await apiFetch(`/admin/catalog/lessons/${lessonId}`, {
    method: 'PATCH',
    retryOnAuth: false,
    body: input,
  });
}

export async function reorderLessons(sectionId: string, orderedIds: string[]): Promise<void> {
  await apiFetch(`/admin/catalog/sections/${sectionId}/lessons/reorder`, {
    method: 'POST',
    retryOnAuth: false,
    body: { orderedIds },
  });
}

export async function registerMedia(
  lessonId: string,
  input: { contentType: string; securityTier: string; title: string },
): Promise<{ uploadUrl: string }> {
  const body = await apiFetch<{ data: { uploadUrl: string } }>(
    `/admin/catalog/lessons/${lessonId}/media`,
    {
      method: 'POST',
      retryOnAuth: false,
      body: input,
    },
  );
  return { uploadUrl: body.data.uploadUrl };
}

export async function completeMedia(lessonId: string): Promise<void> {
  await apiFetch(`/admin/catalog/lessons/${lessonId}/media/complete`, {
    method: 'POST',
    retryOnAuth: false,
    body: {},
  });
}

export async function syncLessonMedia(lessonId: string): Promise<string> {
  const body = await apiFetch<{ data: { mapping: { status: string } } }>(
    `/admin/catalog/lessons/${lessonId}/media/sync`,
    { method: 'POST', retryOnAuth: false, body: {} },
  );
  return body.data.mapping.status;
}

export async function syncCourseMedia(courseId: string): Promise<void> {
  await apiFetch(`/admin/catalog/courses/${courseId}/media/sync`, {
    method: 'POST',
    retryOnAuth: false,
    body: {},
  });
}

export async function requestDeletion(
  kind: 'courses' | 'sections' | 'lessons',
  id: string,
  confirmation: string,
): Promise<DeletionOperation> {
  const body = await apiFetch<{ data: { operation: DeletionOperation } }>(
    `/admin/catalog/${kind}/${id}/delete`,
    {
      method: 'POST',
      retryOnAuth: false,
      body: { confirmation },
    },
  );
  return body.data.operation;
}

export async function fetchDeletion(operationId: string): Promise<DeletionOperation> {
  const body = await apiFetch<{ data: { operation: DeletionOperation } }>(
    `/admin/catalog/deletions/${operationId}`,
    {
      retryOnAuth: true,
    },
  );
  return body.data.operation;
}

export async function retryDeletion(operationId: string): Promise<DeletionOperation> {
  const body = await apiFetch<{ data: { operation: DeletionOperation } }>(
    `/admin/catalog/deletions/${operationId}/retry`,
    { method: 'POST', retryOnAuth: false, body: {} },
  );
  return body.data.operation;
}
