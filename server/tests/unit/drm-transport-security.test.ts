import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrmClient } from '../../src/modules/catalog/drmClient.js';
const config = { baseUrl: 'https://drm.example', clientId: 'fixture-client', clientSecret: 'fixture-placeholder', timeoutMs: 1000, maxRetries: 0 };
afterEach(() => vi.unstubAllGlobals());
describe('DRM credential destination binding', () => {
  it.each(['application', 'bearer'] as const)('rejects redirects on the %s path', async (mode) => {
    const fetcher = vi.fn(async (_url: unknown, init: RequestInit) => {
      expect(init.redirect).toBe('error');
      throw new TypeError('redirect rejected');
    });
    vi.stubGlobal('fetch', fetcher);
    const client = new DrmClient(config);
    const request = mode === 'application' ? client.mediaStatus('asset') : client.playbackHeartbeat('session', 'device', 'fixture-placeholder');
    await expect(request).rejects.toMatchObject({ code: 'DRM_NETWORK' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});


describe('DRM response byte budget', () => {
  it('cancels an oversized stream without waiting for its end', async () => {
    const cancel = vi.fn(); let reads = 0;
    const body = new ReadableStream<Uint8Array>({ pull(controller) { reads++; controller.enqueue(new Uint8Array(64 * 1024)); }, cancel });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await expect(new DrmClient(config).mediaStatus('asset')).rejects.toMatchObject({ code: 'DRM_MALFORMED' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(reads).toBeLessThanOrEqual(6);
  });
  it('counts UTF-8 bytes rather than JavaScript characters', async () => {
    const body = JSON.stringify({ blob: 'ع'.repeat(140 * 1024) });
    expect(body.length).toBeLessThan(256 * 1024);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await expect(new DrmClient(config).mediaStatus('asset')).rejects.toMatchObject({ code: 'DRM_MALFORMED' });
  });
});
