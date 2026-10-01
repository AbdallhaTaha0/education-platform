/**
 * Server-side DRM HTTP adapter (API-only). No raw bodies, URLs, or secrets
 * enter logs or audits. Responses are explicitly schema-validated.
 */
import { ApiError } from '../identity/errors.js';
import type { ServerConfig } from '../../config.js';
import { getLogger, sanitizeForLog } from '../../logger.js';
import {
  validateCompletionResponse,
  validateDeletionRequestResponse,
  validateDeletionStatusResponse,
  validateMediaStatusResponse,
  validateRegistrationResponse,
} from './drm/schemas.js';

export type DrmErrorCategory =
  | 'DRM_UNCONFIGURED'
  | 'DRM_TIMEOUT'
  | 'DRM_NETWORK'
  | 'DRM_UNAUTHORIZED'
  | 'DRM_NOT_FOUND'
  | 'DRM_CONFLICT'
  | 'DRM_VALIDATION'
  | 'DRM_SERVER'
  | 'DRM_MALFORMED'
  | 'DRM_UNKNOWN';

export interface DrmAdapterConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
  maxRetries: number;
}

export function resolveDrmAdapterConfig(config: ServerConfig): DrmAdapterConfig | null {
  const { drmBaseUrl, drmClientId, drmClientSecret, drmRequestTimeoutMs, drmMaxRetries } = config;
  if (drmBaseUrl === undefined || drmClientId === undefined || drmClientSecret === undefined)
    return null;
  return {
    baseUrl: drmBaseUrl.replace(/\/+$/, ''),
    clientId: drmClientId,
    clientSecret: drmClientSecret,
    timeoutMs: drmRequestTimeoutMs,
    maxRetries: drmMaxRetries,
  };
}

const MAX_BODY_BYTES = 256 * 1024;

function toCategory(status: number): DrmErrorCategory {
  if (status === 401 || status === 403) return 'DRM_UNAUTHORIZED';
  if (status === 404) return 'DRM_NOT_FOUND';
  if (status === 409) return 'DRM_CONFLICT';
  if (status >= 400 && status < 500) return 'DRM_VALIDATION';
  if (status >= 500) return 'DRM_SERVER';
  return 'DRM_UNKNOWN';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffWithJitter(attempt: number): number {
  return Math.min(200 * 2 ** attempt + Math.floor(Math.random() * 150), 2500);
}

interface FetchOptions {
  method: string;
  body?: unknown;
  idempotent: boolean;
}

/** Playback routes authenticate with the transient playback bearer token
 * rather than the application credentials. */
interface BearerFetchOptions extends FetchOptions {
  bearer: string;
}

export class DrmClient {
  constructor(private readonly cfg: DrmAdapterConfig) {}

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Client-Id': this.cfg.clientId,
      'X-Client-Secret': this.cfg.clientSecret,
    };
  }

  private async request(path: string, opts: FetchOptions): Promise<unknown> {
    const url = `${this.cfg.baseUrl}${path}`;
    const maxAttempts = opts.idempotent ? this.cfg.maxRetries + 1 : 1;
    let lastError: ApiError | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) await sleep(backoffWithJitter(attempt - 1));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
      try {
        const res = await fetch(url, {
          method: opts.method,
          headers: this.headers(),
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: controller.signal,
        });
        const text = await this.readBoundedBody(res);
        if (!res.ok) {
          const category = toCategory(res.status);
          getLogger().warn(
            sanitizeForLog({ drmPath: path, status: res.status, category, attempt }) as Record<
              string,
              unknown
            >,
            'drm request failed',
          );
          throw new ApiError(
            res.status === 404 ? 404 : res.status >= 500 ? 502 : res.status,
            category,
            'External media request failed.',
          );
        }
        return this.parseJson(text);
      } catch (err) {
        if (err instanceof ApiError) {
          const retryable =
            opts.idempotent && (err.code === 'DRM_SERVER' || err.code === 'DRM_UNKNOWN');
          if (!retryable || attempt === maxAttempts - 1) throw err;
          lastError = err;
          continue;
        }
        const aborted = (err as { name?: string }).name === 'AbortError';
        const mapped = new ApiError(
          502,
          aborted ? 'DRM_TIMEOUT' : 'DRM_NETWORK',
          'External media request failed.',
        );
        getLogger().warn(
          sanitizeForLog({ drmPath: path, category: mapped.code, attempt }) as Record<
            string,
            unknown
          >,
          'drm transport failure',
        );
        if (!opts.idempotent || attempt === maxAttempts - 1) throw mapped;
        lastError = mapped;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new ApiError(502, 'DRM_UNKNOWN', 'External media request failed.');
  }

  private async readBoundedBody(res: Response): Promise<string> {
    const text = await res.text();
    if (text.length > MAX_BODY_BYTES)
      throw new ApiError(502, 'DRM_MALFORMED', 'External response too large.');
    return text;
  }

  private parseJson(text: string): unknown {
    if (text.trim() === '') throw new ApiError(502, 'DRM_MALFORMED', 'External response empty.');
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null)
        throw new ApiError(502, 'DRM_MALFORMED', 'External response malformed.');
      return parsed;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, 'DRM_MALFORMED', 'External response malformed.');
    }
  }

  async registerMedia(input: {
    externalAssetId: string;
    title?: string;
    contentType: string;
    securityTier: string;
    idempotencyKey: string;
  }): Promise<{ assetId: string; status: string; uploadUrl?: string; idempotent?: boolean }> {
    const body: Record<string, unknown> = {
      externalAssetId: input.externalAssetId,
      contentType: input.contentType,
      securityTier: input.securityTier,
      idempotencyKey: input.idempotencyKey,
    };
    if (input.title !== undefined) body['title'] = input.title;
    return validateRegistrationResponse(
      await this.request('/v1/media', { method: 'POST', body, idempotent: false }),
    );
  }

  async completeUpload(assetId: string): Promise<{ status: string }> {
    return validateCompletionResponse(
      await this.request(`/v1/media/${encodeURIComponent(assetId)}/complete`, {
        method: 'POST',
        body: {},
        idempotent: false,
      }),
    );
  }

  async mediaStatus(assetId: string): Promise<{ status: string }> {
    return validateMediaStatusResponse(
      await this.request(`/v1/admin/media/${encodeURIComponent(assetId)}/status`, {
        method: 'GET',
        idempotent: true,
      }),
    );
  }

  async deleteMedia(
    assetId: string,
    confirmation: string,
  ): Promise<{ deletionId: string; status: string; duplicate?: boolean; scheduled?: boolean }> {
    return validateDeletionRequestResponse(
      await this.request(`/v1/media/${encodeURIComponent(assetId)}`, {
        method: 'DELETE',
        body: { confirmation },
        idempotent: true,
      }),
    );
  }

  async deletionStatus(deletionId: string): Promise<{ status: string }> {
    return validateDeletionStatusResponse(
      await this.request(`/v1/admin/media-deletions/${encodeURIComponent(deletionId)}`, {
        method: 'GET',
        idempotent: true,
      }),
    );
  }

  // ---- Playback (M5) --------------------------------------------------
  // The response is returned unvalidated here; the learning module applies the
  // stricter frontend-safe schema so a DRM-side change cannot silently widen
  // what the player receives.

  /**
   * Create an external playback session. Never auto-retried: the route is not
   * idempotent and a retry could open a second external session.
   */
  async createPlaybackSession(input: {
    externalUserId: string;
    externalAssetId: string;
    deviceId: string;
    assertion: string;
  }): Promise<unknown> {
    return this.request('/v1/playback/sessions', {
      method: 'POST',
      body: input,
      idempotent: false,
    });
  }

  private async bearerRequest(path: string, opts: BearerFetchOptions): Promise<unknown> {
    const url = `${this.cfg.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(url, {
        method: opts.method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.bearer}`,
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
      if (!res.ok) {
        getLogger().warn(
          sanitizeForLog({ drmPath: path, status: res.status, attempt: 0 }) as Record<
            string,
            unknown
          >,
          'drm playback request failed',
        );
        throw new ApiError(
          res.status === 401 ? 401 : 502,
          'DRM_PLAYBACK',
          'External playback request failed.',
        );
      }
      return this.parseJson(await this.readBoundedBody(res));
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const aborted = (err as { name?: string }).name === 'AbortError';
      throw new ApiError(
        502,
        aborted ? 'DRM_TIMEOUT' : 'DRM_NETWORK',
        'External playback request failed.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async playbackHeartbeat(sessionId: string, deviceId: string, bearer: string): Promise<unknown> {
    return this.bearerRequest(`/v1/playback/sessions/${encodeURIComponent(sessionId)}/heartbeat`, {
      method: 'POST',
      body: { deviceId },
      bearer,
      idempotent: true,
    });
  }

  async playbackEnd(sessionId: string, deviceId: string, bearer: string): Promise<unknown> {
    return this.bearerRequest(`/v1/playback/sessions/${encodeURIComponent(sessionId)}/end`, {
      method: 'POST',
      body: { deviceId },
      bearer,
      idempotent: true,
    });
  }

  async playbackRenew(sessionId: string, deviceId: string, bearer: string): Promise<unknown> {
    return this.bearerRequest(`/v1/playback/sessions/${encodeURIComponent(sessionId)}/renew`, {
      method: 'POST',
      body: { deviceId },
      bearer,
      idempotent: true,
    });
  }

  /**
   * Platform-mediated renewal (M5 correction round).
   *
   * The playback bearer token is never held server-side, so the platform cannot
   * call the bearer-protected `/renew`. It calls the service-to-service
   * `/renew-admin` route with application credentials instead. A 404/410 there
   * means the external session is already gone, which the caller treats as a
   * closed session rather than a dependency failure.
   */
  async renewPlaybackSession(sessionId: string): Promise<unknown> {
    return this.request(`/v1/playback/sessions/${encodeURIComponent(sessionId)}/renew-admin`, {
      method: 'POST',
      idempotent: true,
    });
  }

  /**
   * Ask the external service to terminate a session. Uses application
   * credentials (the bearer token is not held server-side by design) and is
   * treated as idempotent so the expiry reconciler can retry safely.
   */
  async revokePlaybackSession(sessionId: string, reason: string): Promise<{ status: string }> {
    const body = await this.request(
      `/v1/playback/sessions/${encodeURIComponent(sessionId)}/revoke`,
      {
        method: 'POST',
        body: { reason },
        idempotent: true,
      },
    );
    if (typeof body === 'object' && body !== null) {
      const status = (body as { status?: unknown }).status;
      return { status: typeof status === 'string' ? status : 'unknown' };
    }
    return { status: 'unknown' };
  }
}

export function createDrmClient(config: ServerConfig): DrmClient | null {
  const resolved = resolveDrmAdapterConfig(config);
  if (resolved === null) return null;
  return new DrmClient(resolved);
}
