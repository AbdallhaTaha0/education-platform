/**
 * Explicitly labeled HTTP contract fixture for platform tests.
 * This is NOT real DRM or R2 evidence. It implements the exact HTTP shapes
 * the platform adapter consumes (headers, bodies, status codes) with
 * controllable modes for failure/timeout/retry/credential tests.
 */
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { DrmPlaybackFixture, type PlaybackFixtureOptions } from './drmPlaybackFixture.js';

export type { PlaybackFixtureOptions };

export type FixtureMode = 'healthy' | 'flaky-status' | 'delete-pending-then-complete';

export interface FixtureAsset {
  internalId: string;
  externalAssetId: string;
  status: string;
  deletionId?: string;
  deletionStatus?: string;
}

export class DrmFixture {
  private server: Server | null = null;
  url = '';
  expectedClientId = 'fixture-client';
  expectedClientSecret = 'fixture-secret-that-is-long-enough-0123456789';
  assets = new Map<string, FixtureAsset>();
  deletions = new Map<string, { assetId: string; status: string; polls: number }>();
  requests: { method: string; url: string; headers: Record<string, string | string[] | undefined>; body: unknown }[] = [];
  mode: FixtureMode = 'healthy';
  failNextStatusCount = 0;
  failNextDeletes = 0;
  failNextRegistrations = 0;
  reissuePendingUploadUrl = false;
  completeConflictOnce = false;
  delayMs = 0;
  /**
   * M5 playback surface. Populated by enablePlayback(); kept as a separate
   * module so this file stays focused on the catalog contract.
   */
  playback: DrmPlaybackFixture | null = null;

  async start(): Promise<string> {
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {      let data = '';
      req.on('data', (c) => {
        data += c;
      });
      req.on('end', () => {
        const respond = () => {
          let body: unknown = null;
          try {
            body = data ? JSON.parse(data) : null;
          } catch {
            body = data;
          }
          this.requests.push({
            method: req.method ?? '',
            url: req.url ?? '',
            headers: req.headers as Record<string, string>,
            body,
          });
          // Presigned browser uploads carry no application credentials by design.
          if ((req.url ?? '').startsWith('/upload/') && req.method === 'PUT') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          // Required headers.
          if (req.headers['x-client-id'] !== this.expectedClientId || req.headers['x-client-secret'] !== this.expectedClientSecret) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid client credentials' }));
            return;
          }
          const url = req.url ?? '';
          // M5 playback routes are delegated to the playback fixture, which
          // runs after the application-credential check above.
          if (this.playback !== null) {
            const handled = this.playback.handle(
              req.method ?? '',
              url,
              req.headers as Record<string, string | string[] | undefined>,
              body as Record<string, unknown> | null,
              (status, payload) => {
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(payload));
              },
              (externalAssetId) => {
                for (const [internalId, asset] of this.assets.entries()) {
                  if (asset.externalAssetId === externalAssetId && asset.status === 'READY') {
                    return { internalId };
                  }
                }
                return null;
              },
            );
            if (handled) return;
          }
          // POST /v1/media
          if (url === '/v1/media' && req.method === 'POST') {
            if (this.failNextRegistrations > 0) {
              this.failNextRegistrations -= 1;
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'transient registration failure' }));
              return;
            }
            const b = body as Record<string, unknown>;
            if (!b || typeof b['externalAssetId'] !== 'string' || typeof b['idempotencyKey'] !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'bad request' }));
              return;
            }
            // Stable idempotency: same externalAssetId returns same asset.
            for (const a of this.assets.values()) {
              if (a.externalAssetId === b['externalAssetId']) {
                res.writeHead(202, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ assetId: a.internalId, status: a.status, idempotent: true,
                  ...(this.reissuePendingUploadUrl && a.status === 'UPLOADED' ? { uploadUrl: `${this.url}/upload/${a.internalId}?sig=fixture-reissued` } : {}) }));
                return;
              }
            }
            const internalId = randomUUID();
            const asset: FixtureAsset = { internalId, externalAssetId: b['externalAssetId'] as string, status: 'UPLOADED' };
            this.assets.set(internalId, asset);
            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                assetId: internalId,
                status: 'UPLOADED',
                uploadUrl: `${this.url}/upload/${internalId}?sig=fixture-signed`,
                idempotent: false,
              }),
            );
            return;
          }
          // POST /v1/media/:id/complete
          const completeMatch = url.match(/^\/v1\/media\/([^/]+)\/complete$/);
          if (completeMatch && req.method === 'POST') {
            const id = decodeURIComponent(completeMatch[1] as string);
            const asset = this.assets.get(id);
            if (!asset) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Asset not found' }));
              return;
            }
            if (this.completeConflictOnce && asset.status !== 'UPLOADED') {
              this.completeConflictOnce = false;
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Upload has already been completed' }));
              return;
            }
            asset.status = 'PROCESSING';
            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'PROCESSING' }));
            return;
          }
          // GET /v1/admin/media/:id/status
          const statusMatch = url.match(/^\/v1\/admin\/media\/([^/]+)\/status$/);
          if (statusMatch && req.method === 'GET') {
            if (this.failNextStatusCount > 0) {
              this.failNextStatusCount -= 1;
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'transient' }));
              return;
            }
            const id = decodeURIComponent(statusMatch[1] as string);
            const asset = this.assets.get(id);
            if (!asset) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Asset not found' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id, status: asset.status }));
            return;
          }
          // DELETE /v1/media/:id
          const deleteMatch = url.match(/^\/v1\/media\/([^/]+)$/);
          if (deleteMatch && req.method === 'DELETE') {
            if (this.failNextDeletes > 0) {
              this.failNextDeletes -= 1;
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'transient delete failure' }));
              return;
            }
            const id = decodeURIComponent(deleteMatch[1] as string);
            const asset = this.assets.get(id);
            if (!asset) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Asset not found' }));
              return;
            }
            const b = body as Record<string, unknown>;
            if (!b || b['confirmation'] !== asset.externalAssetId) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'CONFIRMATION_MISMATCH' }));
              return;
            }
            // Duplicate while pending: return existing.
            for (const [delId, del] of this.deletions.entries()) {
              if (del.assetId === id && (del.status === 'PENDING' || del.status === 'RUNNING')) {
                res.writeHead(202, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ deletionId: delId, status: del.status, duplicate: true, scheduled: true }));
                return;
              }
            }
            const deletionId = randomUUID();
            const initial = this.mode === 'delete-pending-then-complete' ? 'PENDING' : 'PENDING';
            this.deletions.set(deletionId, { assetId: id, status: initial, polls: 0 });
            asset.status = 'DELETING';
            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ deletionId, status: initial, duplicate: false, scheduled: true }));
            return;
          }
          // GET /v1/admin/media-deletions/:id
          const delStatusMatch = url.match(/^\/v1\/admin\/media-deletions\/([^/]+)$/);
          if (delStatusMatch && req.method === 'GET') {
            const delId = decodeURIComponent(delStatusMatch[1] as string);
            const del = this.deletions.get(delId);
            if (!del) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Deletion not found' }));
              return;
            }
            del.polls += 1;
            // Advance PENDING→RUNNING→COMPLETED across polls.
            if (del.polls >= 3) del.status = 'COMPLETED';
            else if (del.polls >= 2) del.status = 'RUNNING';
            if (del.status === 'COMPLETED') {
              // Simulate storage cleanup: drop the asset row from fixture (not platform).
              this.assets.delete(del.assetId);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ deletionId: delId, status: del.status, attempts: del.polls }));
            return;
          }
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'unknown' }));
        };
        if (this.delayMs > 0) setTimeout(respond, this.delayMs);
        else respond();
      });
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', () => resolve()));
    const addr = this.server!.address() as { port: number };
    this.url = `http://127.0.0.1:${addr.port}`;
    return this.url;
  }

  markReady(internalId: string): void {
    const a = this.assets.get(internalId);
    if (a) a.status = 'READY';
  }

  /**
   * Enable the M5 playback surface. Must be called after start() so the
   * configured public origin matches the listening port.
   */
  enablePlayback(options: Omit<PlaybackFixtureOptions, 'publicBaseUrl'>): DrmPlaybackFixture {
    this.playback = new DrmPlaybackFixture({ ...options, publicBaseUrl: this.url });
    return this.playback;
  }

  markFailed(internalId: string): void {
    const a = this.assets.get(internalId);
    if (a) a.status = 'FAILED';
  }

  reset(): void {
    this.assets.clear();
    this.deletions.clear();
    this.requests = [];
    this.failNextStatusCount = 0;
    this.failNextDeletes = 0;
    this.failNextRegistrations = 0;
    this.completeConflictOnce = false;
    this.delayMs = 0;
    this.mode = 'healthy';
    this.playback?.reset();
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
  }
}
