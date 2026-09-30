/**
 * Playback portion of the explicitly labeled HTTP contract fixture.
 *
 * NOT real DRM evidence. It implements the exact HTTP shapes the platform
 * adapter consumes for M5 playback, and it VERIFIES the signed assertion the
 * platform mints, so the tests assert the real claim contract rather than a
 * stub that always agrees.
 *
 * Deliberately strict: unknown assets and device mismatches are refused. The
 * fixture proves the platform contract only; live DRM behavior is verified by
 * the separate lifecycle harness.
 */
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

export interface PlaybackSession {
  sessionId: string;
  assetId: string;
  externalAssetId: string;
  externalUserId: string;
  deviceId: string;
  status: 'active' | 'ended' | 'revoked';
  token: string;
}

export interface PlaybackFixtureOptions {
  /** Origin the platform must use as DRM_PUBLIC_BASE_URL. */
  publicBaseUrl: string;
  expectedSecret: string;
  expectedIssuer: string;
  expectedAudience: string;
}

export interface PlaybackRequestRecord {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown> | null;
}

export class DrmPlaybackFixture {
  sessions = new Map<string, PlaybackSession>();
  requests: PlaybackRequestRecord[] = [];
  failNextCreates = 0;
  failNextRevokes = 0;
  /** Persistent renewal failure, for the client stop-and-end path. */
  renewAlwaysFails = false;
  /**
   * Persistent revoke failure. Needed because the platform client retries
   * idempotent calls, so a single injected failure is absorbed by the retry.
   */
  revokeAlwaysFails = false;
  /** Signed assertion claims as the fixture decoded them, for assertions. */
  lastClaims: Record<string, unknown> | null = null;

  constructor(private readonly options: PlaybackFixtureOptions) {}

  reset(): void {
    this.sessions.clear();
    this.requests = [];
    this.failNextCreates = 0;
    this.failNextRevokes = 0;
    this.renewAlwaysFails = false;
    this.revokeAlwaysFails = false;
    this.lastClaims = null;
  }

  /**
   * Returns true when the request was a playback route this fixture owns.
   * Throws for an authenticated-but-malformed playback request so a contract
   * change cannot pass silently.
   */
  handle(
    method: string,
    url: string,
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown> | null,
    send: (status: number, payload: unknown) => void,
    resolveAsset: (externalAssetId: string) => { internalId: string } | null,
  ): boolean {
    this.requests.push({ method, url, headers, body });

    const create = /^\/v1\/playback\/sessions$/.exec(url);
    if (create && method === 'POST') {
      this.create(body, send, resolveAsset);
      return true;
    }

    const sessionAction = /^\/v1\/playback\/sessions\/([^/]+)\/(end|revoke|heartbeat|renew|renew-admin)$/.exec(url);
    if (sessionAction && method === 'POST') {
      const sessionId = decodeURIComponent(sessionAction[1] as string);
      const rawAction = sessionAction[2] as 'end' | 'revoke' | 'heartbeat' | 'renew' | 'renew-admin';
      const action = rawAction === 'renew-admin' ? 'renew' : rawAction;
      this.sessionAction(sessionId, action, headers, body, send);
      return true;
    }
    return false;
  }

  private create(
    body: Record<string, unknown> | null,
    send: (status: number, payload: unknown) => void,
    resolveAsset: (externalAssetId: string) => { internalId: string } | null,
  ): void {
    if (this.failNextCreates > 0) {
      this.failNextCreates -= 1;
      send(500, { error: 'transient playback failure' });
      return;
    }
    const externalAssetId = body?.['externalAssetId'];
    const deviceId = body?.['deviceId'];
    const assertion = body?.['assertion'];
    if (typeof externalAssetId !== 'string' || typeof deviceId !== 'string' || typeof assertion !== 'string') {
      send(400, { error: 'bad request' });
      return;
    }

    let claims: Record<string, unknown>;
    try {
      const decoded = jwt.verify(assertion, this.options.expectedSecret, { clockTimestamp: Math.floor(Date.now() / 1000) });
      if (typeof decoded === 'string') throw new Error('unexpected string payload');
      claims = decoded as Record<string, unknown>;
    } catch {
      send(401, { error: 'assertion rejected' });
      return;
    }
    this.lastClaims = claims;
    if (
      claims['iss'] !== this.options.expectedIssuer ||
      claims['aud'] !== this.options.expectedAudience ||
      claims['asset'] !== externalAssetId ||
      claims['device'] !== deviceId
    ) {
      send(403, { error: 'assertion does not match request' });
      return;
    }

    // Strict unknown-asset refusal (the real service is currently defective).
    const asset = resolveAsset(externalAssetId);
    if (asset === null) {
      send(404, { error: 'unknown asset' });
      return;
    }

    const sessionId = randomUUID();
    const token = `fixture-playback-token-${randomUUID()}`;
    this.sessions.set(sessionId, {
      sessionId,
      assetId: asset.internalId,
      externalAssetId,
      externalUserId: String(claims['sub'] ?? ''),
      deviceId,
      status: 'active',
      token,
    });
    send(201, {
      playbackSessionId: sessionId,
      playbackToken: token,
      tokenExpiresAt: new Date(Date.now() + 120_000).toISOString(),
      sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      manifestUrl: `/v1/playback/sessions/${sessionId}/manifest.mpd`,
      licenseUrl: '/v1/playback/licenses',
      drmProvider: 'CLEAR_KEY',
      watermark: {
        type: 'MASKED',
        maskedIdentity: 'fixt***@example',
        positions: [{ x: 50, y: 50 }],
        traceCode: 'fixture-trace-code',
        signature: 'fixture-signature',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
  }

  private sessionAction(
    sessionId: string,
    action: 'end' | 'revoke' | 'heartbeat' | 'renew',
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown> | null,
    send: (status: number, payload: unknown) => void,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      send(404, { error: 'session not found' });
      return;
    }
    if (session.status === 'revoked') {
      send(410, { error: 'session revoked' });
      return;
    }

    // Two service-to-service forms carry no device id and no playback bearer,
    // because the platform deliberately never holds the token:
    //   revoke  — administrative closure (viewer end or entitlement lapse)
    //   renew   — platform-mediated token renewal
    // A browser-driven renew carries deviceId plus the bearer and is checked
    // against both below.
    const serviceCall = action === 'revoke' || (action === 'renew' && typeof body?.['deviceId'] !== 'string');
    if (serviceCall) {
      if (action === 'revoke') {
        if (this.revokeAlwaysFails) {
          send(500, { error: 'transient revoke failure' });
          return;
        }
        if (this.failNextRevokes > 0) {
          this.failNextRevokes -= 1;
          send(500, { error: 'transient revoke failure' });
          return;
        }
        const wasActive = session.status === 'active';
        session.status = 'revoked';
        send(200, { status: wasActive ? 'revoked' : 'ended' });
        return;
      }
      this.platformRenew(session, send);
      return;
    }

    const deviceId = body?.['deviceId'];
    if (typeof deviceId !== 'string' || deviceId !== session.deviceId) {
      // Strict wrong-device refusal (the real service is currently defective).
      send(403, { error: 'device mismatch' });
      return;
    }
    const auth = headers['authorization'];
    if (auth !== `Bearer ${session.token}`) {
      send(401, { error: 'invalid playback token' });
      return;
    }

    if (action === 'renew') {
      this.platformRenew(session, send);
      return;
    }
    if (action === 'end') {
      session.status = 'ended';
      send(200, { status: 'ended' });
      return;
    }
    send(200, { status: 'active' });
  }

  /**
   * Re-issue a fresh transient token for the SAME external session. The session
   * id, manifest and license URL are unchanged: only the credential moves, which
   * is what lets the player swap it without touching DASH or EME.
   */
  private platformRenew(session: PlaybackSession, send: (status: number, payload: unknown) => void): void {
    if (this.renewAlwaysFails) {
      send(500, { error: 'transient renew failure' });
      return;
    }
    const token = `fixture-renewed-token-${randomUUID()}`;
    session.token = token;
    send(200, {
      status: 'active',
      playbackToken: token,
      tokenExpiresAt: new Date(Date.now() + 120_000).toISOString(),
      sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
  }

  /** Public origin the platform must be configured with. */
  get publicBaseUrl(): string {
    return this.options.publicBaseUrl;
  }
}
