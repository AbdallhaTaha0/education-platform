import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DrmClient } from '../../src/modules/catalog/drmClient.js';
import { adminPost, createCatalogWorld, createFullDraft, type CatalogWorld } from './catalog-helpers.js';

let world: CatalogWorld;

beforeAll(async () => {
  world = await createCatalogWorld(true);
});

afterAll(async () => {
  await world.fixture?.stop();
  await world.close();
});

describe('registration intent durability', () => {
  it('idempotent repeat without uploadUrl fails safe with identifiers converged', async () => {
    const { lessonId } = await createFullDraft(world, 'intent-lost');
    const reg = await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' });
    expect(reg.status).toBe(201);
    expect(typeof reg.body.data.uploadUrl).toBe('string');
    const first = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId } });
    expect(first.assetId).not.toBeNull();
    const assetCountBefore = world.fixture!.assets.size;

    // Simulate a lost result write: clear the recorded DRM asset id.
    await world.prisma.mediaMapping.update({ where: { lessonId }, data: { assetId: null } });

    // The accepted external contract omits uploadUrl on idempotent repeats,
    // so the retry must fail safe: no success-with-null, no second asset,
    // no stored or fabricated URL — but identifiers still converge.
    const retry = await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' });
    expect(retry.status).toBe(409);
    expect(retry.body.error.code).toBe('UPLOAD_URL_UNAVAILABLE');
    expect(retry.body.data).toBeUndefined();
    const converged = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId } });
    expect(converged.assetId).toBe(first.assetId);
    expect(converged.externalAssetId).toBe(first.externalAssetId);
    expect(converged.idempotencyKey).toBe(first.idempotencyKey);
    expect(converged.errorCategory).toBe('UPLOAD_URL_UNAVAILABLE');
    expect(world.fixture!.assets.size).toBe(assetCountBefore);
    expect(await world.prisma.mediaMapping.count({ where: { lessonId } })).toBe(1);
    const dumped = JSON.stringify(converged);
    expect(dumped).not.toContain('/upload/');
    expect(dumped).not.toContain('sig=');
    // The administrator cannot upload: no URL was issued, none stored.
    const failed = await world.prisma.auditEvent.count({ where: { entityId: lessonId, action: 'MEDIA_REGISTER_FAILED' } });
    expect(failed).toBeGreaterThanOrEqual(1);
  });

  it('reproduces the exact idempotent-repeat shape: same asset, no uploadUrl key', async () => {
    const fixture = world.fixture!;
    const client = new DrmClient({
      baseUrl: fixture.url,
      clientId: fixture.expectedClientId,
      clientSecret: fixture.expectedClientSecret,
      timeoutMs: 2000,
      maxRetries: 0,
    });
    const first = await client.registerMedia({
      externalAssetId: 'edu-repeat-shape',
      contentType: 'video/mp4',
      securityTier: 'STANDARD',
      idempotencyKey: 'idem-repeat-shape',
    });
    expect(typeof first.uploadUrl).toBe('string');
    const raw = await fetch(`${fixture.url}/v1/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': fixture.expectedClientId, 'X-Client-Secret': fixture.expectedClientSecret },
      body: JSON.stringify({ externalAssetId: 'edu-repeat-shape', contentType: 'video/mp4', securityTier: 'STANDARD', idempotencyKey: 'idem-repeat-shape' }),
    });
    const repeat = (await raw.json()) as Record<string, unknown>;
    expect(repeat['assetId']).toBe(first.assetId);
    expect(repeat['idempotent']).toBe(true);
    expect('uploadUrl' in repeat).toBe(false);
  });

  it('registration timeout reuses the same identifiers', async () => {
    const { lessonId } = await createFullDraft(world, 'intent-timeout');
    world.fixture!.failNextRegistrations = 1;
    const failed = await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' });
    expect(failed.status).toBe(502);
    const intent = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId } });
    expect(intent.assetId).toBeNull();
    const retry = await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' });
    expect(retry.status).toBe(201);
    const done = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId } });
    expect(done.externalAssetId).toBe(intent.externalAssetId);
    expect(done.idempotencyKey).toBe(intent.idempotencyKey);
    expect(done.assetId).not.toBeNull();
  });

  it('concurrent registrations create one mapping and one effective external asset', async () => {
    const { lessonId } = await createFullDraft(world, 'intent-race');
    const assetsBefore = world.fixture!.assets.size;
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' })),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled' && (r.value as { status: number }).status === 201);
    expect(succeeded.length).toBeGreaterThanOrEqual(1);
    expect(await world.prisma.mediaMapping.count({ where: { lessonId } })).toBe(1);
    const mapping = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId } });
    expect(mapping.assetId).not.toBeNull();
    expect(world.fixture!.assets.size).toBe(assetsBefore + 1);
  });

  it('completion timeout reconciles via status instead of fabricating failure', async () => {
    const { lessonId } = await createFullDraft(world, 'intent-complete');
    await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' });
    world.fixture!.delayMs = 2500;
    const slow = await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media/complete`, world.adminJar, {});
    world.fixture!.delayMs = 0;
    // Either reconciled via status poll or a retryable timeout — never a fabricated success row.
    expect([200, 502]).toContain(slow.status);
    const mapping = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId } });
    expect(['PROCESSING', 'READY', 'UPLOAD_PENDING']).toContain(mapping.status);
  });

  it('no database transaction stays open during delayed fixture responses', async () => {
    const { lessonId } = await createFullDraft(world, 'intent-notx');
    world.fixture!.delayMs = 500;
    const pending = adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' });
    await new Promise((r) => setTimeout(r, 200));
    const idle = (await world.prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction'`) as unknown as { count: string }[];
    const openCount = Number(idle[0]?.count ?? '0');
    const res = await pending;
    world.fixture!.delayMs = 0;
    expect(res.status).toBe(201);
    expect(openCount).toBe(0);
  });
});
