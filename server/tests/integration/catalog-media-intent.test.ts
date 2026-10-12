import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStorageClient } from '../../src/infra/storage.js';
import { adminPost, createCatalogWorld, createFullDraft, registerTestVideo, uploadTestVideo, type CatalogWorld } from './catalog-helpers.js';

let world: CatalogWorld;
beforeAll(async () => { world = await createCatalogWorld(); });
afterAll(async () => { await world?.close(); });

describe('no-DRM private video uploads', () => {
  it('rejects retired DRM upload options instead of accepting misleading configuration', async () => {
    const { lessonId } = await createFullDraft(world, 'upload-retired-field');
    const response = await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, {
      contentType: 'video/mp4', securityTier: 'STANDARD',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_FIELD');
    expect(await world.prisma.mediaMapping.count({ where: { lessonId } })).toBe(0);
  });

  it('accepts a signed direct upload, verifies bytes on completion, and reaches READY', async () => {
    const { lessonId } = await createFullDraft(world, 'upload-ready');
    const registration = await registerTestVideo(world, lessonId);
    expect(registration.mapping.status).toBe('UPLOAD_PENDING');
    expect(new URL(registration.uploadUrl).searchParams.has('X-Amz-Signature')).toBe(true);
    expect(JSON.stringify(registration.mapping)).not.toContain(registration.uploadUrl);
    await uploadTestVideo(registration.uploadUrl);

    const completed = await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media/complete`, world.adminJar, {});
    expect(completed.status).toBe(200);
    const overwrite = await fetch(registration.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'If-None-Match': '*' },
      body: Buffer.from('late replacement attempt'),
    });
    await overwrite.body?.cancel();
    expect(overwrite.status).toBe(412);
    const stored = await createStorageClient(world.config)!.getObject('lesson-videos/' + registration.mapping.assetId);
    expect(Buffer.from(stored.body).toString()).toBe('disposable platform video fixture bytes');
    expect(completed.body.data.mapping.status).toBe('READY');
    expect(JSON.stringify(await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId } }))).not.toContain('X-Amz-Signature');
  });

  it('does not mark a missing object ready and keeps the private object unsigned-inaccessible', async () => {
    const { lessonId } = await createFullDraft(world, 'upload-private');
    const registration = await registerTestVideo(world, lessonId);
    const early = await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media/complete`, world.adminJar, {});
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('UPLOAD_NOT_FOUND');

    await uploadTestVideo(registration.uploadUrl);
    const storageEndpoint = world.config.storageEndpoint!;
    const objectUrl = new URL(registration.uploadUrl);
    objectUrl.search = '';
    const unsigned = await fetch(objectUrl, { method: 'GET' });
    await unsigned.body?.cancel();
    expect([401, 403]).toContain(unsigned.status);
    const completed = await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media/complete`, world.adminJar, {});
    expect(completed.status).toBe(200);
    expect(storageEndpoint).toContain('storage:9000');
  });

  it('retries registration idempotently with one platform asset and no persisted URL', async () => {
    const { lessonId } = await createFullDraft(world, 'upload-retry');
    const first = await registerTestVideo(world, lessonId);
    const retry = await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, { contentType: 'video/mp4' });
    expect(retry.status).toBe(201);
    expect(retry.body.data.mapping.id).toBe(first.mapping.id);
    expect(retry.body.data.mapping.assetId).toBe(first.mapping.assetId);
    expect(await world.prisma.mediaMapping.count({ where: { lessonId } })).toBe(1);
    expect(JSON.stringify(await world.prisma.auditEvent.findMany({ where: { entityId: lessonId } }))).not.toContain('X-Amz-Signature');
  });
});
