/**
 * Unit: DRM adapter schemas, error mapping, timeout/retry limits, redaction.
 * Uses an in-process HTTP fixture (labeled, not real DRM) via node:http.
 */
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { describe, expect, it, afterEach } from 'vitest';
import { DrmClient } from '../../src/modules/catalog/drmClient.js';
import { sanitizeForLog } from '../../src/logger.js';

let server: Server | null = null;
let lastHeaders: Record<string, string | string[] | undefined> = {};
let lastBody: unknown = null;
let behavior:
  | 'ok-register'
  | 'malformed'
  | 'oversized'
  | 'error500'
  | 'error404'
  | 'slow'
  | 'delete-ok'
  | 'status-ready'
  | 'deletion-completed' = 'ok-register';
let requestCount = 0;

async function startFixture(): Promise<string> {
  requestCount = 0;
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    requestCount += 1;
    lastHeaders = req.headers as Record<string, string>;
    let data = '';
    req.on('data', (c) => {
      data += c;
    });
    req.on('end', () => {
      try {
        lastBody = data ? JSON.parse(data) : null;
      } catch {
        lastBody = data;
      }
      if (behavior === 'slow') {
        // Never respond; client timeout must win.
        return;
      }
      if (behavior === 'malformed') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('not-json{{{');
        return;
      }
      if (behavior === 'oversized') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ blob: 'x'.repeat(300 * 1024) }));
        return;
      }
      if (behavior === 'error500') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'boom' }));
        return;
      }
      if (behavior === 'error404') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Asset not found' }));
        return;
      }
      if (req.url === '/v1/media' && req.method === 'POST') {
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            assetId: '11111111-1111-1111-1111-111111111111',
            status: 'UPLOADED',
            uploadUrl: 'https://signed.example/u?sig=abc',
            idempotent: false,
          }),
        );
        return;
      }
      if (req.url?.endsWith('/complete') && req.method === 'POST') {
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'PROCESSING' }));
        return;
      }
      if (req.url?.includes('/v1/admin/media/') && req.url?.includes('/status')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'x', status: 'READY' }));
        return;
      }
      if (req.url?.startsWith('/v1/media/') && req.method === 'DELETE') {
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            deletionId: '22222222-2222-2222-2222-222222222222',
            status: 'PENDING',
            duplicate: false,
            scheduled: true,
          }),
        );
        return;
      }
      if (req.url?.includes('/v1/admin/media-deletions/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            deletionId: '22222222-2222-2222-2222-222222222222',
            status: 'COMPLETED',
          }),
        );
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'READY' }));
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
  const addr = server!.address() as { port: number };
  return `http://127.0.0.1:${addr.port}`;
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

function clientFor(
  baseUrl: string,
  overrides: Partial<{ timeoutMs: number; maxRetries: number }> = {},
) {
  return new DrmClient({
    baseUrl,
    clientId: 'test-client-01',
    clientSecret: 'test-secret-that-is-long-enough-0123456789',
    timeoutMs: overrides.timeoutMs ?? 2000,
    maxRetries: overrides.maxRetries ?? 2,
  });
}

describe('DRM adapter contract', () => {
  it('sends required headers + stable idempotency body', async () => {
    const baseUrl = await startFixture();
    behavior = 'ok-register';
    const client = clientFor(baseUrl);
    const res = await client.registerMedia({
      externalAssetId: 'edu-abc',
      contentType: 'video/mp4',
      securityTier: 'STANDARD',
      idempotencyKey: 'idem-123',
    });
    expect(res.assetId).toBe('11111111-1111-1111-1111-111111111111');
    expect(lastHeaders['x-client-id']).toBe('test-client-01');
    expect(lastHeaders['x-client-secret']).toBe('test-secret-that-is-long-enough-0123456789');
    expect(lastBody).toMatchObject({ externalAssetId: 'edu-abc', idempotencyKey: 'idem-123' });
  });

  it('maps 4xx/5xx to safe categories without raw bodies', async () => {
    const baseUrl = await startFixture();
    behavior = 'error500';
    const client = clientFor(baseUrl, { maxRetries: 0 });
    await expect(client.mediaStatus('any-id')).rejects.toMatchObject({ code: 'DRM_SERVER' });
    behavior = 'error404';
    await expect(client.mediaStatus('missing')).rejects.toMatchObject({ code: 'DRM_NOT_FOUND' });
  });

  it('rejects malformed or oversized JSON', async () => {
    const baseUrl = await startFixture();
    behavior = 'malformed';
    const client = clientFor(baseUrl, { maxRetries: 0 });
    await expect(client.mediaStatus('x')).rejects.toMatchObject({ code: 'DRM_MALFORMED' });
    behavior = 'oversized';
    await expect(client.mediaStatus('x')).rejects.toMatchObject({ code: 'DRM_MALFORMED' });
  });

  it('enforces bounded timeouts', async () => {
    const baseUrl = await startFixture();
    behavior = 'slow';
    const client = clientFor(baseUrl, { timeoutMs: 300, maxRetries: 0 });
    const started = Date.now();
    await expect(client.mediaStatus('x')).rejects.toMatchObject({ code: 'DRM_TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('retries idempotent GET within limits, never unsafe POST', async () => {
    const baseUrl = await startFixture();
    behavior = 'error500';
    const client = clientFor(baseUrl, { maxRetries: 2 });
    requestCount = 0;
    await expect(client.mediaStatus('x')).rejects.toThrow();
    expect(requestCount).toBe(3); // 1 + 2 retries
    requestCount = 0;
    await expect(
      client.registerMedia({
        externalAssetId: 'e',
        contentType: 'video/mp4',
        securityTier: 'STANDARD',
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow();
    expect(requestCount).toBe(1); // unsafe POST never retried
  });

  it('requires exact DELETE confirmation shape (client sends it)', async () => {
    const baseUrl = await startFixture();
    behavior = 'delete-ok';
    const client = clientFor(baseUrl);
    const res = await client.deleteMedia('11111111-1111-1111-1111-111111111111', 'edu-abc');
    expect(res.deletionId).toBe('22222222-2222-2222-2222-222222222222');
    expect(lastBody).toEqual({ confirmation: 'edu-abc' });
  });

  it('redacts secrets, signed URLs, and credentials in logs', () => {
    const sanitized = sanitizeForLog({
      uploadUrl: 'https://signed.example/u?sig=secret123&token=abc',
      clientSecret: 'super-secret',
      nested: { assertion: 'jwt-here', safeId: 'edu-123' },
    }) as Record<string, unknown>;
    const dumped = JSON.stringify(sanitized);
    expect(dumped).not.toContain('super-secret');
    expect(dumped).not.toContain('secret123');
    expect(dumped).toContain('[Redacted]');
    expect(dumped).toContain('edu-123');
  });
});
