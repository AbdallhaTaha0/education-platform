/**
 * Platform-owned private object storage client (S3-compatible).
 *
 * Separate from DRM-owned video storage. Server-side credentials only.
 * Used for bilingual WebVTT captions and lesson resources.
 * No public URLs; all access goes through authenticated backend routes.
 */

import { ApiError } from '../modules/identity/errors.js';
import type { ServerConfig } from '../config.js';
import { getLogger, sanitizeForLog } from '../logger.js';

export type StorageErrorCategory =
  | 'STORAGE_UNCONFIGURED'
  | 'STORAGE_TIMEOUT'
  | 'STORAGE_NETWORK'
  | 'STORAGE_UNAUTHORIZED'
  | 'STORAGE_NOT_FOUND'
  | 'STORAGE_CONFLICT'
  | 'STORAGE_VALIDATION'
  | 'STORAGE_SERVER'
  | 'STORAGE_MALFORMED'
  | 'STORAGE_UNKNOWN';

export interface StorageAdapterConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
  timeoutMs: number;
  maxRetries: number;
}

export function resolveStorageAdapterConfig(config: ServerConfig): StorageAdapterConfig | null {
  const { storageEndpoint, storageRegion, storageAccessKeyId, storageSecretAccessKey, storageBucket } = config;
  if (
    storageEndpoint === undefined ||
    storageRegion === undefined ||
    storageAccessKeyId === undefined ||
    storageSecretAccessKey === undefined ||
    storageBucket === undefined
  ) {
    return null;
  }
  return {
    endpoint: storageEndpoint.replace(/\/+$/, ''),
    region: storageRegion,
    accessKeyId: storageAccessKeyId,
    secretAccessKey: storageSecretAccessKey,
    bucket: storageBucket,
    forcePathStyle: true,
    timeoutMs: config.storageRequestTimeoutMs ?? 5000,
    maxRetries: config.storageMaxRetries ?? 2,
  };
}

/** SigV4 signs the actual bucket path, headers and original binary payload.
 * https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
 */
export class StorageClient {
  constructor(private readonly cfg: StorageAdapterConfig) {}

  private async request(method: string, key: string, body?: Uint8Array, contentType?: string): Promise<{ body: Uint8Array; contentType: string; contentLength: number; missing: boolean }> {
    const { createHash, createHmac } = await import('node:crypto');
    const encode = (part: string) => encodeURIComponent(part).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    const endpoint = new URL(this.cfg.endpoint);
    if (endpoint.search || endpoint.hash || endpoint.username || endpoint.password) throw new ApiError(503, 'STORAGE_UNCONFIGURED', 'Invalid storage endpoint.');
    const path = `${endpoint.pathname.replace(/\/$/, '')}/${encode(this.cfg.bucket)}/${key.split('/').map(encode).join('/')}`;
    const url = `${endpoint.origin}${path}`;
    const bytes = body === undefined ? undefined : Buffer.from(body);
    const hash = createHash('sha256').update(bytes ?? Buffer.alloc(0)).digest('hex');
    for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 150 * 2 ** (attempt - 1)));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
      try {
        const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
        const date = stamp.slice(0, 8);
        const headers: Record<string, string> = { host: endpoint.host, 'x-amz-date': stamp, 'x-amz-content-sha256': hash, ...(contentType ? { 'content-type': contentType } : {}) };
        const names = Object.keys(headers).sort();
        const signed = names.join(';');
        const canonical = [method, path, '', names.map(k => `${k}:${headers[k].trim()}\n`).join(''), signed, hash].join('\n');
        const scope = `${date}/${this.cfg.region}/s3/aws4_request`;
        let signing = createHmac('sha256', `AWS4${this.cfg.secretAccessKey}`).update(date).digest();
        for (const value of [this.cfg.region, 's3', 'aws4_request']) signing = createHmac('sha256', signing).update(value).digest();
        const signature = createHmac('sha256', signing).update(`AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`).digest('hex');
        headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.cfg.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
        const res = await fetch(url, { method, headers, body: bytes, signal: controller.signal, redirect: 'error' });
        if (res.status === 404 && (method === 'DELETE' || method === 'HEAD')) {
          await res.body?.cancel();
          return { body: new Uint8Array(), contentType: '', contentLength: 0, missing: true };
        }
        if (!res.ok) {
          await res.body?.cancel();
          if (res.status >= 500 && attempt < this.cfg.maxRetries) continue;
          throw new ApiError(503, 'STORAGE_SERVER', 'Private storage request failed.');
        }
        const chunks: Uint8Array[] = [];
        let size = 0;
        if (res.body) {
          const reader = res.body.getReader();
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              size += part.value.length;
              if (size > 10_485_760) { await reader.cancel(); throw new ApiError(503, 'STORAGE_MALFORMED', 'Private storage response exceeds limit.'); }
              chunks.push(part.value);
            }
          } finally { reader.releaseLock(); }
        }
        return { body: Buffer.concat(chunks), contentType: res.headers.get('content-type') ?? 'application/octet-stream', contentLength: method === 'HEAD' ? Number(res.headers.get('content-length') ?? 0) : size, missing: false };
      } catch (err) {
        if (err instanceof ApiError || attempt === this.cfg.maxRetries) throw err instanceof ApiError ? err : new ApiError(503, 'STORAGE_NETWORK', 'Private storage request failed.');
      } finally { clearTimeout(timer); }
    }
    throw new ApiError(503, 'STORAGE_NETWORK', 'Private storage request failed.');
  }
  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> { await this.request('PUT', key, body, contentType); }
  async getObject(key: string): Promise<{ body: Uint8Array; contentType: string; contentLength: number }> { return this.request('GET', key); }
  async deleteObject(key: string): Promise<void> { await this.request('DELETE', key); }
  async headObject(key: string): Promise<{ contentType: string; contentLength: number } | null> { const result = await this.request('HEAD', key); return result.missing ? null : result; }
}
export function createStorageClient(config: ServerConfig): StorageClient | null {
  const cfg = resolveStorageAdapterConfig(config);
  return cfg ? new StorageClient(cfg) : null;
}
