/**
 * Validation of the external DRM playback-session response (M5).
 *
 * Only fields the player needs survive. The application secret, the signed
 * assertion, the signing key, internal storage keys and the raw dependency body
 * are never returned to the caller, logged, or audited. An unexpected shape is
 * a dependency failure, not a client error.
 */
import { LearningError } from '../errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KNOWN_PROVIDERS = new Set(['CLEAR_KEY', 'WIDEVINE', 'PLAYREADY', 'FAIRPLAY']);

export interface ValidatedPlaybackSession {
  playbackSessionId: string;
  playbackToken: string;
  tokenExpiresAt: string;
  sessionExpiresAt: string;
  manifestUrl: string;
  licenseUrl: string;
  drmProvider: string;
  /** Raw watermark passthrough; shaped separately before it reaches a client. */
  watermark: Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(): never {
  throw new LearningError('DRM_DEPENDENCY_FAILED', 'The media service returned an unusable response.');
}

function isoDate(value: unknown): string {
  if (typeof value !== 'string') fail();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail();
  return new Date(parsed).toISOString();
}

export function validatePlaybackSession(body: unknown): ValidatedPlaybackSession {
  if (!isRecord(body)) fail();
  const sessionId = body['playbackSessionId'];
  if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) fail();
  const token = body['playbackToken'];
  if (typeof token !== 'string' || token.length < 8 || token.length > 4096) fail();
  const manifestUrl = body['manifestUrl'];
  if (typeof manifestUrl !== 'string' || manifestUrl.length === 0 || manifestUrl.length > 2048) fail();
  const licenseUrl = body['licenseUrl'];
  if (typeof licenseUrl !== 'string' || licenseUrl.length === 0 || licenseUrl.length > 2048) fail();
  const provider = body['drmProvider'];
  if (typeof provider !== 'string' || !KNOWN_PROVIDERS.has(provider)) fail();

  const watermark = body['watermark'];
  return {
    playbackSessionId: sessionId,
    playbackToken: token,
    tokenExpiresAt: isoDate(body['tokenExpiresAt']),
    sessionExpiresAt: isoDate(body['sessionExpiresAt']),
    manifestUrl,
    licenseUrl,
    drmProvider: provider,
    watermark: isRecord(watermark) ? watermark : null,
  };
}

/**
 * Validate the DRM's playback-renewal response (M5 correction round).
 *
 * Renewal re-issues a transient bearer token for an existing external session,
 * so the response is minimized to exactly the credential fields the in-memory
 * player swaps. Nothing else from the dependency body is forwarded: no
 * assertion, no key id, no storage key, no session secret.
 */
export interface ValidatedRenewal {
  playbackToken: string;
  tokenExpiresAt: string;
  sessionExpiresAt: string;
  /** False when the dependency reported the session is no longer usable. */
  renewed: boolean;
}

export function validateRenewal(body: unknown): ValidatedRenewal {
  if (!isRecord(body)) fail();

  // The dependency may report that the session ended; that is not a schema
  // failure, it is a refused renewal the client must act on.
  const status = typeof body['status'] === 'string' ? (body['status'] as string) : '';
  if (status === 'ended' || status === 'revoked' || status === 'expired') {
    return { playbackToken: '', tokenExpiresAt: '', sessionExpiresAt: '', renewed: false };
  }

  const token = body['playbackToken'] ?? body['token'];
  if (typeof token !== 'string' || token.length < 8 || token.length > 4096) fail();
  return {
    playbackToken: token,
    tokenExpiresAt: isoDate(body['tokenExpiresAt']),
    sessionExpiresAt: isoDate(body['sessionExpiresAt'] ?? body['tokenExpiresAt']),
    renewed: true,
  };
}

/**
 * Reduce the dependency watermark object to the only fields an overlay may
 * render. The trace code and the signature are dropped: a visible overlay must
 * never expose signing material.
 */
export function toWatermarkPresentation(
  watermark: Record<string, unknown> | null,
): {
  type: string;
  maskedIdentity: string;
  positions: Array<{ x: number; y: number }>;
  expiresAt: string | null;
} | null {
  if (watermark === null) return null;
  const type = typeof watermark['type'] === 'string' ? (watermark['type'] as string).slice(0, 32) : 'MASKED';
  const identity =
    typeof watermark['maskedIdentity'] === 'string'
      ? (watermark['maskedIdentity'] as string).slice(0, 128)
      : '';
  const raw = Array.isArray(watermark['positions']) ? (watermark['positions'] as unknown[]) : [];
  const positions: Array<{ x: number; y: number }> = [];
  for (const entry of raw.slice(0, 12)) {
    if (!isRecord(entry)) continue;
    const x = Number(entry['x']);
    const y = Number(entry['y']);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      positions.push({
        x: Math.min(100, Math.max(0, x)),
        y: Math.min(100, Math.max(0, y)),
      });
    }
  }
  const expiresAt = typeof watermark['expiresAt'] === 'string' ? watermark['expiresAt'] : null;
  return { type, maskedIdentity: identity, positions, expiresAt };
}
