/**
 * Stage: platform-mediated real lifecycle (TEST-ONLY).
 *
 * Uses only the platform's public HTTP API with cookie + CSRF + Origin
 * controls. Verifies that the platform stores opaque external identifiers only,
 * never a presigned URL or a credential, and deletes through the platform
 * contract so the external object storage is actually freed.
 */

import { readFile } from 'node:fs/promises';
import { expect, recordBlocked, recordFail, step } from '../lib/safe-log.mjs';
import { mediaPath, pollUntil } from '../lib/context.mjs';

export async function platformLifecycle(ctx) {
  step('platform-lifecycle');
  if (!ctx.platform) {
    recordBlocked('platform-lifecycle', { note: 'platform URL and origin are required' });
    return { completed: false };
  }
  const platform = ctx.platform;
  const runId = ctx.runId;

  // 1. Throwaway admin session through the browser contract.
  const identifier = ctx.env.VERIFY_ADMIN_IDENTIFIER;
  const password = ctx.env.VERIFY_ADMIN_PASSWORD;
  if (!identifier || !password) {
    recordBlocked('platform-admin-login', { note: 'verification admin credentials are required' });
    return { completed: false };
  }
  const login = await platform.login(identifier, password);
  expect('platform-login', login.status === 200, { status: login.status, ms: login.elapsedMs });
  if (login.status !== 200) return { completed: false, reason: 'admin login failed' };

  let courseId;
  let deletionCompleted = false;
  try {
    // 2. Unique bilingual course, section and lesson.
    const course = await platform.createCourse({
      slug: `pre-m5-live-${runId}`,
      titleAr: `تحقق مباشر ${runId}`,
      titleEn: `Live verification ${runId}`,
      descriptionAr: `وصف تحق�� ${runId}`,
      descriptionEn: `Verification description ${runId}`,
    });
    expect('platform-course', course.status === 201, { status: course.status });
    courseId = course.json?.data?.course?.id;
    if (!courseId) return { completed: false, reason: 'course creation failed' };

    const section = await platform.createSection(courseId, {
      titleAr: `قسم ${runId}`,
      titleEn: `Section ${runId}`,
      position: 1,
    });
    expect('platform-section', section.status === 201, { status: section.status });
    const sectionId = section.json?.data?.section?.id;
    if (!sectionId) return { completed: false, reason: 'section creation failed' };

    const lesson = await platform.createLesson(sectionId, {
      titleAr: `درس ${runId}`,
      titleEn: `Lesson ${runId}`,
      position: 1,
    });
    expect('platform-lesson', lesson.status === 201, { status: lesson.status });
    const lessonId = lesson.json?.data?.lesson?.id;
    if (!lessonId) return { completed: false, reason: 'lesson creation failed' };

    // 3-4. Register through the platform adapter and upload the same bytes.
    const video = await readFile(mediaPath(ctx.env));
    const registration = await platform.registerLessonMedia(lessonId, {
      contentType: 'video/mp4',
      title: 'Pre-M5 live verification',
    });
    expect('platform-media-register', registration.status === 201, { status: registration.status });
    const uploadUrl = registration.json?.data?.uploadUrl;
    expect('platform-upload-url', typeof uploadUrl === 'string' && uploadUrl.length > 0, {
      label: 'uploadUrl',
    });
    if (!uploadUrl)
      return { completed: false, reason: 'platform returned no upload URL', courseId };

    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      body: video,
    });
    expect('platform-upload', put.status === 200, { status: put.status, bytes: video.length });

    // 5. Complete and reconcile to READY.
    const complete = await platform.completeLessonMedia(lessonId);
    expect('platform-complete', complete.status === 200, { status: complete.status });

    const ready = await pollUntil({
      label: 'platform-ready',
      attempts: 40,
      intervalMs: 5000,
      probe: async () => platform.syncLessonMedia(lessonId),
      getState: platformMediaState,
      done: (state) => state === 'READY',
      onState: (attempt, state) =>
        expect('platform-ready-state', true, { state, attempts: attempt }),
    });
    expect('platform-ready', ready.reached, { state: ready.state, attempts: ready.attempts });

    // 6. The public API must not expose signed URLs or credentials after registration.
    const readBack = await platform.readCourse(courseId);
    const serialized = JSON.stringify(readBack.json ?? {});
    expect('platform-no-upload-url-stored', !serialized.includes('X-Amz-Signature'), {
      label: 'uploadUrl',
    });
    expect('platform-no-secret-stored', !serialized.includes('X-Amz-Client-Secret'), {
      label: 'clientSecret',
    });
    expect(
      'platform-no-access-key-stored',
      !/S3_SECRET_ACCESS_KEY|S3_ACCESS_KEY_ID/.test(serialized),
      {
        label: 'storageKey',
      },
    );

    // 7-8. Permanent deletion through the platform contract.
    const deletion = await platform.deleteCourse(courseId, courseId);
    expect('platform-delete-request', deletion.status === 202, {
      status: deletion.status,
      state: deletion.json?.data?.operation?.status,
    });
    const operationId = deletion.json?.data?.operation?.id;
    const completed = await pollUntil({
      label: 'platform-delete',
      attempts: 40,
      intervalMs: 5000,
      probe: async () => platform.readDeletion(operationId),
      getState: platformDeletionState,
      done: (state) => state === 'COMPLETED',
      onState: (attempt, state) =>
        expect('platform-delete-state', true, { state, attempts: attempt }),
    });
    expect('platform-delete-complete', completed.reached, {
      state: completed.state,
      attempts: completed.attempts,
    });
    deletionCompleted = completed.reached;

    return { completed: true, courseId, lessonId, sectionId };
  } finally {
    if (courseId && !deletionCompleted) {
      const cleanup = await requestExactCourseCleanup(platform, courseId).catch(() => null);
      if (!cleanup || ![202, 409].includes(cleanup.status)) {
        recordFail('platform-best-effort-cleanup', {
          status: cleanup?.status,
          note: 'exact verification course cleanup could not be scheduled',
        });
      }
    }
  }
}

export function platformMediaState(result) {
  return result?.status === 200 && typeof result.json?.data?.mapping?.status === 'string'
    ? result.json.data.mapping.status
    : undefined;
}

export function platformDeletionState(result) {
  return result?.status === 200 && typeof result.json?.data?.operation?.status === 'string'
    ? result.json.data.operation.status
    : undefined;
}

export function requestExactCourseCleanup(platform, courseId) {
  return platform.deleteCourse(courseId, courseId);
}
