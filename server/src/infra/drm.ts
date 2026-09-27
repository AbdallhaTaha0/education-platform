/**
 * External DRM connection descriptor (M1: configuration + boundary only).
 *
 * education-drm-service/ is an external, read-only dependency consumed by API
 * only with server-side credentials. No video/upload/playback integration is
 * implemented in this milestone. An unconfigured or unreachable DRM must be
 * reported separately and must NEVER fail local foundation readiness.
 */

export interface DrmStatus {
  /** Always "optional-external" in M1: informational, never readiness-gating. */
  mode: 'optional-external';
  configured: boolean;
  /** Redacted host only when a base URL is configured; otherwise omitted. */
  baseUrlHost?: string;
  note: string;
}

export function describeDrmConnection(env: NodeJS.ProcessEnv = process.env): DrmStatus {
  const raw = env['DRM_BASE_URL'];
  const baseUrl = raw !== undefined && raw.trim() !== '' ? raw.trim() : undefined;
  if (!baseUrl) {
    return {
      mode: 'optional-external',
      configured: false,
      note: 'DRM_BASE_URL is not set; local foundation readiness does not require external DRM (M1).',
    };
  }
  let baseUrlHost: string | undefined;
  try {
    baseUrlHost = new URL(baseUrl).host;
  } catch {
    baseUrlHost = 'invalid-url';
  }
  return {
    mode: 'optional-external',
    configured: true,
    baseUrlHost,
    note: 'External DRM is API-only. Actual upload/playback integration is out of scope for M1.',
  };
}
