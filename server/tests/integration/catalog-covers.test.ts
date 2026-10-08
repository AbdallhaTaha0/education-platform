import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  adminGet,
  adminPatch,
  adminPost,
  createCatalogWorld,
  type CatalogWorld,
} from './catalog-helpers.js';
import { createWorkingCopy, publishWorkingCopy } from '../../src/modules/catalog/courses/revisions.js';

let world: CatalogWorld;
const image = {
  filename: 'cover.png',
  mime: 'image/png',
  base64:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1sAAAAASUVORK5CYII=',
};
beforeAll(async () => {
  world = await createCatalogWorld();
});
afterAll(async () => {
  await world.close();
});
describe('course photo uploads and visibility', () => {
  it('saves a photo atomically, serves drafts privately, and includes a cover path in the published catalog', async () => {
    const response = await adminPost(world.app, '/admin/catalog/courses', world.adminJar, {
      slug: `photo-${Date.now()}`,
      titleAr: 'دورة',
      titleEn: 'Course',
      descriptionAr: 'وصف',
      descriptionEn: 'Description',
      coverImage: image,
    });
    expect(response.status).toBe(201);
    const id = response.body.data.course.id;
    expect(response.body.data.course.coverId).toBeTruthy();
    expect(response.body.data.course.cover).toBeUndefined();
    expect((await request(world.app).get(`/catalog/courses/${id}/cover`)).status).toBe(404);
    const privatePhoto = await adminGet(
      world.app,
      `/admin/catalog/courses/${id}/cover`,
      world.adminJar,
    );
    expect(privatePhoto.status).toBe(200);
    expect(privatePhoto.headers['cache-control']).toBe('private, no-store');
    expect(
      (
        await request(world.app)
          .get(`/admin/catalog/courses/${id}/cover`)
          .set('Cookie', world.studentJar.header())
      ).status,
    ).toBe(403);
    await world.prisma.course.update({ where: { id }, data: { status: 'PUBLISHED' } });
    const publicPhoto = await request(world.app).get(`/catalog/courses/${id}/cover`);
    expect(publicPhoto.status).toBe(200);
    expect(publicPhoto.headers['content-type']).toContain('image/png');
    expect(Buffer.from(publicPhoto.body)).toEqual(Buffer.from(image.base64, 'base64'));
    const catalog = await request(world.app).get('/catalog/courses');
    expect(
      catalog.body.data.courses.find((course: { id: string }) => course.id === id).coverUrl,
    ).toContain(`/catalog/courses/${id}/cover?v=`);
    const live = await world.prisma.course.findUniqueOrThrow({ where: { id } });
    const draft = await world.prisma.$transaction((tx) =>
      createWorkingCopy(tx, world.adminUser.id, live),
    );
    expect(draft.coverId).toBe(live.coverId);
    const changed = await adminPatch(
      world.app,
      `/admin/catalog/courses/${draft.id}`,
      world.adminJar,
      { coverImage: image },
    );
    expect(changed.status).toBe(200);
    expect(changed.body.data.course.coverId).not.toBe(live.coverId);
    expect((await world.prisma.course.findUniqueOrThrow({ where: { id } })).coverId).toBe(
      live.coverId,
    );
    const editedDraft = await world.prisma.course.findUniqueOrThrow({ where: { id: draft.id } });
    await world.prisma.$transaction(tx => publishWorkingCopy(tx, world.adminUser.id, editedDraft));
    expect((await world.prisma.course.findUniqueOrThrow({ where: { id } })).coverId).toBe(editedDraft.coverId);
    expect((await request(world.app).get(`/catalog/courses/${draft.id}/cover`)).status).toBe(404);
    await world.prisma.course.update({ where: { id }, data: { status: 'ARCHIVED' } });
    expect((await request(world.app).get(`/catalog/courses/${id}/cover`)).status).toBe(404);
  });
  it('rejects non-images, spoofed MIME, oversized payloads and unknown upload fields', async () => {
    for (const coverImage of [
      { ...image, mime: 'image/svg+xml' },
      { ...image, base64: Buffer.from('not a picture').toString('base64') },
      { ...image, base64: 'A'.repeat(180000) },
      { ...image, url: 'https://untrusted.invalid/image' },
    ]) {
      const response = await adminPost(world.app, '/admin/catalog/courses', world.adminJar, {
        slug: `invalid-${Date.now()}`,
        titleAr: 'دورة',
        titleEn: 'Course',
        descriptionAr: 'وصف',
        descriptionEn: 'Description',
        coverImage,
      });
      expect(response.status).toBe(400);
    }
  });
});
