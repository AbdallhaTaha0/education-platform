import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminPatch, adminPost } from './catalog-helpers.js';
import { createLearningWorld, createPublishedCourse, grantSubscription, makeLessonPlayable, studentGet, studentPost, type LearningWorld } from './learning-helpers.js';

let world: LearningWorld;
const titles = { titleAr: 'درس إضافي', titleEn: 'Additional lesson' };
beforeAll(async () => { world = await createLearningWorld(); });
afterAll(async () => { await world?.fixture?.stop(); await world?.close(); });

describe('owner-approved published lesson additions', () => {
  it('appends and uploads without interrupting existing subscribers or releasing unfinished media', async () => {
    const c = await createPublishedCourse(world, 'live-addition');
    await grantSubscription(world, world.studentId, c.courseId, Date.now() + 86_400_000);
    const before = await world.prisma.lesson.findUniqueOrThrow({ where: { id: c.lessonId } });
    const added = await adminPost(world.app, `/admin/catalog/sections/${c.sectionId}/lessons`, world.adminJar, titles);
    expect(added.status).toBe(201);
    const id = added.body.data.lesson.id as string;
    expect(added.body.data.lesson.position).toBe(2);
    expect(await world.prisma.lesson.findUniqueOrThrow({ where: { id: c.lessonId } })).toEqual(before);
    expect((await world.prisma.course.findUniqueOrThrow({ where: { id: c.courseId } })).status).toBe('PUBLISHED');
    const outline = await studentGet(world.app, `/learning/courses/${c.slug}/outline`, world.studentJar);
    expect(outline.status).toBe(200);
    expect(JSON.stringify(outline.body)).toContain(id);
    const playback = (lessonId: string) => studentPost(world.app, `/learning/courses/${c.slug}/lessons/${lessonId}/playback`, world.studentJar, { deviceId: 'published-addition-device' });
    expect((await playback(c.lessonId)).status).toBe(201);
    const pending = await playback(id);
    expect(pending.body.error.code).toBe('MEDIA_NOT_READY');
    await makeLessonPlayable(world, c.courseId, id, 120);
    expect((await playback(id)).status).toBe(201);
    const replacement = await adminPost(world.app, `/admin/catalog/lessons/${id}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' });
    expect(replacement.status).toBe(409);
    expect(replacement.body.error.code).toBe('MEDIA_EXISTS');
    expect(await world.prisma.auditEvent.count({ where: { entityId: id, action: 'LESSON_CREATED' } })).toBe(1);
  });

  it('serializes concurrent append requests and preserves existing positions', async () => {
    const c = await createPublishedCourse(world, 'live-concurrent');
    const added = await Promise.all(Array.from({ length: 4 }, (_, i) => adminPost(world.app, `/admin/catalog/sections/${c.sectionId}/lessons`, world.adminJar, { ...titles, titleEn: `Additional ${i}` })));
    expect(added.map(r => r.status)).toEqual([201, 201, 201, 201]);
    const lessons = await world.prisma.lesson.findMany({ where: { sectionId: c.sectionId }, orderBy: { position: 'asc' } });
    expect(lessons.map(l => l.position)).toEqual([1, 2, 3, 4, 5]);
    expect(lessons[0]?.id).toBe(c.lessonId);
  });

  it('retains ADMIN, CSRF and bilingual validation requirements', async () => {
    const c = await createPublishedCourse(world, 'live-auth');
    const path = `/admin/catalog/sections/${c.sectionId}/lessons`;
    expect((await adminPost(world.app, path, world.studentJar, titles)).status).toBe(403);
    expect((await studentPost(world.app, path, world.adminJar, titles, { withCsrf: false })).status).toBe(403);
    expect((await adminPost(world.app, path, world.adminJar, { titleEn: 'Missing Arabic' })).status).toBe(400);
    expect(await world.prisma.lesson.count({ where: { sectionId: c.sectionId } })).toBe(1);
  });

  it('does not authorize moving existing lessons, renaming or section changes', async () => {
    const c = await createPublishedCourse(world, 'live-bounded');
    const insert = await adminPost(world.app, `/admin/catalog/sections/${c.sectionId}/lessons`, world.adminJar, { ...titles, position: 1 });
    expect(insert.body.error.code).toBe('COURSE_NOT_DRAFT');
    const rename = await adminPatch(world.app, `/admin/catalog/lessons/${c.lessonId}`, world.adminJar, titles);
    expect(rename.body.error.code).toBe('COURSE_NOT_DRAFT');
    const section = await adminPost(world.app, `/admin/catalog/courses/${c.courseId}/sections`, world.adminJar, titles);
    expect(section.body.error.code).toBe('COURSE_NOT_DRAFT');
  });

  it.each(['PROCESSING', 'READY', 'ARCHIVED', 'DELETION_PENDING'] as const)('retains the %s addition/upload guard', async state => {
    const c = await createPublishedCourse(world, `live-block-${state.toLowerCase()}`);
    const added = await adminPost(world.app, `/admin/catalog/sections/${c.sectionId}/lessons`, world.adminJar, titles);
    expect(added.status).toBe(201);
    const id = added.body.data.lesson.id as string;
    // Synthetic lifecycle state, never owner data.
    await world.prisma.course.update({ where: { id: c.courseId }, data: state === 'DELETION_PENDING' ? { deletionRequestedAt: new Date() } : { status: state } });
    const code = state === 'DELETION_PENDING' ? state : state === 'ARCHIVED' ? 'COURSE_ARCHIVED' : 'COURSE_NOT_DRAFT';
    expect((await adminPost(world.app, `/admin/catalog/sections/${c.sectionId}/lessons`, world.adminJar, titles)).body.error.code).toBe(code);
    expect((await adminPost(world.app, `/admin/catalog/lessons/${id}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' })).body.error.code).toBe(code);
  });
});
