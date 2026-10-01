/**
 * Dependency URL validation for player payloads (M5).
 *
 * The DRM returns relative manifest/license paths. The platform resolves them
 * against a configured browser-facing origin and then re-validates the result:
 * only http/https, only an allow-listed origin, no embedded credentials, no
 * traversal, and a bounded length. A dependency cannot redirect the player to
 * an arbitrary host by returning an absolute URL.
 */
import { LearningError } from '../errors.js';

const MAX_URL_LENGTH = 2048;

export interface ResolvedDependencyUrls {
  manifestUrl: string;
  licenseUrl: string;
}

/**
 * @param allowedOrigin browser-facing DRM origin, e.g. https://drm.example.com
 */
export function resolveDependencyUrls(
  rawManifest: unknown,
  rawLicense: unknown,
  allowedOrigin: string | undefined,
): ResolvedDependencyUrls {
  if (allowedOrigin === undefined || allowedOrigin === '') {
    throw new LearningError(
      'PLAYBACK_UNAVAILABLE',
      'No browser-facing media origin is configured.',
    );
  }
  let base: URL;
  try {
    base = new URL(allowedOrigin);
  } catch {
    throw new LearningError('PLAYBACK_UNAVAILABLE', 'The configured media origin is invalid.');
  }
  if (base.username !== '' || base.password !== '') {
    throw new LearningError('PLAYBACK_UNAVAILABLE', 'The configured media origin is invalid.');
  }
  return {
    manifestUrl: resolveOne(rawManifest, base, 'manifest'),
    licenseUrl: resolveOne(rawLicense, base, 'license'),
  };
}

function resolveOne(raw: unknown, base: URL, field: string): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_URL_LENGTH) {
    throw new LearningError(
      'PLAYBACK_UNAVAILABLE',
      `The media service returned an unusable ${field} URL.`,
    );
  }
  if (/[\r\n]/.test(raw) || raw.includes('..')) {
    throw new LearningError(
      'PLAYBACK_UNAVAILABLE',
      `The media service returned an unusable ${field} URL.`,
    );
  }
  let candidate: URL;
  try {
    candidate = new URL(raw, base);
  } catch {
    throw new LearningError(
      'PLAYBACK_UNAVAILABLE',
      `The media service returned an unusable ${field} URL.`,
    );
  }
  if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
    throw new LearningError(
      'PLAYBACK_UNAVAILABLE',
      `The media service returned an unusable ${field} URL.`,
    );
  }
  if (candidate.username !== '' || candidate.password !== '') {
    throw new LearningError(
      'PLAYBACK_UNAVAILABLE',
      `The media service returned an unusable ${field} URL.`,
    );
  }
  // Only the configured origin is ever handed to the player.
  if (candidate.origin !== base.origin) {
    throw new LearningError(
      'PLAYBACK_UNAVAILABLE',
      `The media service returned an unusable ${field} URL.`,
    );
  }
  return candidate.toString();
}
