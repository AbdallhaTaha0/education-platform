/**
 * Public HTTP client for the external DRM service (TEST-ONLY).
 *
 * The harness consumes the DRM exactly as the platform does: application
 * authentication over X-Client-Id / X-Client-Secret, JSON bodies, and the
 * documented routes. It never touches the DRM database, its queues, its keys,
 * or its storage internals.
 *
 * Response bodies are reduced to status, state strings and safe counters. The
 * presigned upload URL and playback token are returned to the caller (they are
 * needed to perform the next step) but are never printed.
 */

export class DrmClient {
  constructor(config) {
    this.config = config;
  }

  static fromEnv(env) {
    const missing = ['DRM_BASE_URL', 'DRM_CLIENT_ID', 'DRM_CLIENT_SECRET'].filter(
      (name) => !env[name],
    );
    if (missing.length > 0) {
      throw new Error(`missing DRM configuration: ${missing.join(', ')}`);
    }
    return new DrmClient({
      baseUrl: env.DRM_BASE_URL.replace(/\/+$/, ''),
      clientId: env.DRM_CLIENT_ID,
      clientSecret: env.DRM_CLIENT_SECRET,
    });
  }

  static describeCredentials(config) {
    return [
      { label: 'DRM_BASE_URL', present: true, length: config.baseUrl.length },
      { label: 'DRM_CLIENT_ID', present: true, length: config.clientId.length },
      { label: 'DRM_CLIENT_SECRET', present: true, length: config.clientSecret.length },
    ];
  }

  async request(method, path, { body, bearer, headers = {} } = {}) {
    const started = Date.now();
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'X-Client-Id': this.config.clientId,
        'X-Client-Secret': this.config.clientSecret,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json;
    try {
      json = text.length > 0 ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    return {
      status: response.status,
      json,
      rawLength: text.length,
      elapsedMs: Date.now() - started,
    };
  }

  /** Read-only probe used to prove preserved application credentials work. */
  async probe() {
    return this.request('POST', '/v1/media', { body: {} });
  }

  async health() {
    const started = Date.now();
    const response = await fetch(`${this.config.baseUrl}/health`);
    const text = await response.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
    return {
      status: response.status,
      json,
      elapsedMs: Date.now() - started,
    };
  }

  async healthDependencies() {
    const started = Date.now();
    const response = await fetch(`${this.config.baseUrl}/health/dependencies`);
    const text = await response.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
    return { status: response.status, json, elapsedMs: Date.now() - started };
  }

  async registerMedia(input) {
    return this.request('POST', '/v1/media', { body: input });
  }

  async completeMedia(assetId) {
    return this.request('POST', `/v1/media/${encodeURIComponent(assetId)}/complete`, { body: {} });
  }

  async mediaStatus(assetId) {
    return this.request(
      'GET',
      `/v1/admin/media/${encodeURIComponent(assetId)}/status`,
    );
  }

  async createPlaybackSession(input) {
    return this.request('POST', '/v1/playback/sessions', { body: input });
  }

  async heartbeat(sessionId, { deviceId, bearer }) {
    return this.request('POST', `/v1/playback/sessions/${encodeURIComponent(sessionId)}/heartbeat`, {
      body: { deviceId },
      bearer,
    });
  }

  async endSession(sessionId, { deviceId, bearer }) {
    return this.request('POST', `/v1/playback/sessions/${encodeURIComponent(sessionId)}/end`, {
      body: { deviceId },
      bearer,
    });
  }

  async renewSession(sessionId, { deviceId, bearer }) {
    return this.request('POST', `/v1/playback/sessions/${encodeURIComponent(sessionId)}/renew`, {
      body: { deviceId },
      bearer,
    });
  }

  async renewSessionForApplication(sessionId) {
    return this.request(
      'POST',
      `/v1/playback/sessions/${encodeURIComponent(sessionId)}/renew-admin`,
      { body: {} },
    );
  }

  async revokeSession(sessionId, { reason } = {}) {
    return this.request('POST', `/v1/playback/sessions/${encodeURIComponent(sessionId)}/revoke`, {
      body: { reason: reason || 'VERIFICATION' },
    });
  }

  async requestDeletion(assetId, confirmation) {
    return this.request('DELETE', `/v1/media/${encodeURIComponent(assetId)}`, {
      body: { confirmation },
    });
  }

  async deletionStatus(deletionId) {
    return this.request('GET', `/v1/admin/media-deletions/${encodeURIComponent(deletionId)}`);
  }

  /** ClearKey license request. The challenge is never printed or logged. */
  async requestLicense({ bearer, challenge }) {
    const started = Date.now();
    const response = await fetch(`${this.config.baseUrl}/v1/licenses`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/octet-stream',
        Authorization: `Bearer ${bearer}`,
      },
      body: Buffer.from(JSON.stringify(challenge)),
    });
    const text = await response.text();
    let json = {};
    try {
      json = text.length > 0 ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    return {
      status: response.status,
      json,
      mime: (response.headers.get('content-type') || '').split(';')[0],
      rawLength: text.length,
      elapsedMs: Date.now() - started,
    };
  }
}

/**
 * Resolve a packaged segment reference from a DASH manifest.
 * Returns a concrete URL or null when the manifest only exposes a numeric or
 * time template, which this harness will not fabricate.
 */
export function absolutePlaybackUrl(baseUrl, value) {
  return new URL(value, `${baseUrl.replace(/\/+$/, '')}/`).toString();
}

export function resolveSegmentUrl(manifestUrl, manifestText) {
  const absoluteManifest = new URL(manifestUrl);
  const gatewayBase = new URL(
    absoluteManifest.pathname.replace(/\/manifest\.mpd$/, '/media/'),
    absoluteManifest,
  );
  const baseMatch = /<BaseURL>([^<]+)<\/BaseURL>/.exec(manifestText);
  const base = baseMatch ? new URL(baseMatch[1], gatewayBase) : gatewayBase;

  const explicit =
    /<SegmentURL\s+media="([^"]+)"/.exec(manifestText) ||
    /<SegmentTemplate[^>]*\bmedia="([^"]+)"/.exec(manifestText) ||
    /\bmedia="([^"$]+)"/.exec(manifestText);

  if (!explicit) return null;
  let reference = explicit[1].trim();
  const templateTag = /<SegmentTemplate\b([^>]*)>/i.exec(manifestText)?.[1] || '';
  const startNumber = Number(/\bstartNumber="(\d+)"/i.exec(templateTag)?.[1] || 1);
  const representationId = /<Representation\b[^>]*\bid="([^"]+)"/i.exec(manifestText)?.[1] || '';
  reference = reference.replace(/\$RepresentationID\$/g, representationId);
  reference = reference.replace(/\$Number(?:%0(\d+)d)?\$/g, (_match, width) =>
    width ? String(startNumber).padStart(Number(width), '0') : String(startNumber),
  );
  if (/\$(?:Number|Time|RepresentationID)/.test(reference)) return null;
  return new URL(reference, base).toString();
}

/**
 * Extract the ClearKey key id the service publishes to the player.
 * DASH advertises it as cenc:default_KID (optionally URL-encoded) or inside a
 * cenc:pssh. Returns base64url or null.
 */
export function extractClearKeyKid(manifestText) {
  const kidMatch = /default_KID="([^"]+)"/i.exec(manifestText);
  if (kidMatch) {
    const raw = decodeURIComponent(kidMatch[1]).trim();
    const uuidHex = raw.replace(/[{}-]/g, '');
    if (/^[0-9a-f]{32}$/i.test(uuidHex)) return Buffer.from(uuidHex, 'hex').toString('base64url');
    if (/^[A-Za-z0-9_-]{20,24}$/.test(raw)) return raw.replace(/=+$/, '');
  }
  return null;
}

/** Build the ClearKey license challenge the DRM expects. */
export function buildClearKeyChallenge(kidBase64Url) {
  return { kids: [kidBase64Url], type: 'temporary' };
}
