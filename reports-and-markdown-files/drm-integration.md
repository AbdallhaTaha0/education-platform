# External DRM integration contract

Historical verification from the preceding computer: see [manager continuation review](m5-manager-continuation-review.md) and [the bounded recorded-manifest repair](drm-recorded-manifest-repair-proposal.md). The owner-authorized static recorded-manifest repair and 65-check real-browser journey passed; closure changes await owner acceptance. That run recorded a healthy isolated port-8082 stack and restored API TTL of 300 seconds. On this computer after Docker restoration (2026-10-01), the guarded platform preview is healthy but the configured external DRM `/health` endpoint is unreachable. No TTL change or real-media journey was performed here. See [the local handoff continuation](m6-local-handoff-review.md) and [package-02 evidence](m6-02-backend-report.md); no production release is approved.

Confirmed platform boundary: API-only; platform code never queries DRM persistence. On 2026-09-28 the owner separately authorized bounded maintenance inside education-drm-service to add missing permanent media deletion. That work remains an independent DRM package change and does not alter the platform integration boundary.

## Upload

Platform admin authorization precedes application-authenticated POST /v1/media. Existing request fields include externalAssetId, title, contentType, securityTier and optional idempotencyKey. Response provides internal assetId and a presigned upload URL. Upload the original using the prescribed URL/content type; call POST /v1/media/:assetId/complete with the internal ID and inspect GET /v1/admin/media/:assetId/status.

Owner-approved recovery clarification (D20, 2026-09-29): if the original registration succeeds externally but its response or the platform result write is lost, repeating the same idempotent registration must preserve the existing DRM asset and issue a fresh short-lived upload URL while that asset remains `UPLOADED`. It must not create a replacement asset, expose storage keys, persist signed URLs, or issue an upload URL after completion/processing/deletion has begun. This capability is authorized as a separate bounded DRM prerequisite and is not accepted until independently verified.

Persist platform lesson-to-media mapping and readiness in platform PostgreSQL. Do not mark playable based on upload completion alone. Until actual events are verified, use the supported status API with bounded polling/reconciliation. Do not implement webhook emitters inside DRM. Validate returned upload destinations and browser reachability without exposing server credentials.

Cloudflare R2 through external DRM is confirmed. Local configuration/substitute is pending; this adapter must not change the external package's storage internals.

## Playback

1. Authenticate the student using platform cookie/session controls.
2. Check active entitlement using backend time, and validate course/lesson/external asset mapping.
3. Construct the required short-lived signed assertion; existing claims are iss, aud, sub, app, course, lesson, asset, iat, exp, jti, with optional device/nbf.
4. app is the DRM client_id; asset matches externalAssetId; sub identifies the platform student. Do not confuse internal asset UUID with external asset ID.
5. Call POST /v1/playback/sessions server-side with application credentials. Do not forward browser-supplied credentials or trust browser-supplied course ownership.
6. Return validated frontend-safe session data: playback ID/token, expirations, manifest/license URLs, provider and watermark policy. Never include the application secret or assertion signing key.
7. Follow external player/session APIs for heartbeat, renewal, end and revoke. Browser heartbeat/end/renew require a playback bearer plus the matching device id. Application-authenticated revoke and `renew-admin` are the platform's server-to-server routes and enforce tenant ownership.

Assertion verification uses JWKS, configured issuer/audience and a maximum 300-second lifetime. The platform signs RS256 with a server-only PKCS#8 key and publishes only its public JWK at `/.well-known/jwks.json`; HS256 is fixture-only and forbidden in production. Current media/license routes require a playback bearer token. Keep this token transient and separate from platform authentication/session cookies; no long-term browser persistence.

## Subscription expiry

Backend must deny access after expiry regardless of UI state. Track necessary session references and call supported external revocation/termination. Stop the frontend player and show renewal-required. Retry failed external termination with bounded observable handling.

An external bearer session is not itself proof that platform enrollment remains valid. Direct heartbeat/renewal and already-issued licenses/buffered content may constrain enforcement timing. Test and document actual behavior. Do not promise instantaneous termination merely because a platform endpoint now denies access. Repair DRM behavior only under a separate explicit owner-authorized maintenance assignment.

## External readiness

The prior source review found incomplete commercial licensing and possible playback issues. These remain dependency observations to confirm against the supplied running service, not permission for an unrelated rewrite. Validate real upload-to-playback, renewal, watermark and termination black-box. Mocks are insufficient production evidence.

## Permanent media deletion prerequisite

The bounded DRM prerequisite is accepted. The API now exposes an application-scoped asynchronous media-deletion contract and safe status endpoint. Acceptance verified immediate playback denial, active-session revocation, source and packaged-prefix cleanup, personalized variants, cascading secret/material cleanup, retained non-secret operation/audit evidence, retry and reconciliation, and prefixes containing more than 1,000 objects. At that prerequisite checkpoint, live Cloudflare R2 verification was blocked by unavailable credentials. Later lifecycle evidence and the current manager continuation are recorded separately; that historical blocker does not describe the current local configuration.

## 2026-09-30 — renewal contract, test-fixture parity and the watermark boundary

**Renewal has two distinct routes, and they must not be confused.** After the
owner-authorized M5 security correction:

- `POST /v1/playback/sessions/:id/renew` is the **browser** route. It requires the
  transient playback bearer and a body `deviceId` that matches the device bound
  into that token. A mismatch is `403 DEVICE_MISMATCH`.
- `POST /v1/playback/sessions/:id/renew-admin` is the **platform** route. It is
  authenticated with the application credentials, because the platform never
  holds the playback bearer. It verifies that the session belongs to the calling
  application (`403 APP_MISMATCH` otherwise) and refuses a non-active session.
  Both routes return the renewed token, its expiry and the session expiry.
- Heartbeat and end use the same strict device binding as browser renewal.

**A labeled test double must implement the corrected contract.** During the
gate-closure pass the platform browser suite failed to renew, and the cause was
the fixture, not the platform: `docker/drm-fixture/server.js` still matched only
`end|revoke|renew`, so the platform's `renew-admin` call reached a 404 that the
platform correctly reported as "session gone". The fixture now implements
`renew-admin` with the same tenant-ownership and status checks and records the
owning application per session. Any future change to the renewal contract must
update the browser fixture in the same change, or the browser suite silently
measures a route that does not exist.

## The browser watermark is a visible label, not protection

The platform renders the DRM-supplied **masked** identity over protected
playback. Verified in Chromium through Nginx: it is present during playback, in
the error state, in a 390 px layout, and as a layer of the player frame so a
fullscreen transition carries it; it is `aria-hidden`, takes no pointer events,
does not block the native controls, and never contains an email address, phone
number, student name, token, trace code or signature.

Its boundary must be stated wherever it is discussed: a DOM/CSS overlay cannot
survive screen capture, a camera or a re-encode. It raises the cost of casual
re-sharing and identifies a session to whoever can see the screen. Forensically
attributable watermarking remains the external DRM's responsibility (D07), and
`playback/schemas.ts` continues to redact the trace code and signature so they
never reach the browser.

## End-to-end RS256 remains unproven against the real service

The platform signs RS256 with a server-only PKCS#8 key and publishes only the
derived public JWK at `/.well-known/jwks.json`; production refuses HS256, and
startup fails closed on a non-RSA or sub-2048-bit key. All of that is covered by
unit and fixture tests. It has **not** been exercised end to end against the
running DRM, because neither side is configured for it: the platform's ignored
`.env` carries no assertion issuer, audience, private key or key id, and the
DRM's ignored `.env` has an empty `JWT_JWKS_URL`. Until both are supplied and a
real request is proven, treat RS256 interoperability as a configuration
prerequisite, not a proven capability.
