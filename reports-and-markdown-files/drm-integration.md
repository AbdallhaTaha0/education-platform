# External DRM integration contract

Confirmed platform boundary: API-only; platform code never queries DRM persistence. On 2026-09-28 the owner separately authorized bounded maintenance inside education-drm-service to add missing permanent media deletion. That work remains an independent DRM package change and does not alter the platform integration boundary.

## Upload

Platform admin authorization precedes application-authenticated POST /v1/media. Existing request fields include externalAssetId, title, contentType, securityTier and optional idempotencyKey. Response provides internal assetId and a presigned upload URL. Upload the original using the prescribed URL/content type; call POST /v1/media/:assetId/complete with the internal ID and inspect GET /v1/admin/media/:assetId/status.

Persist platform lesson-to-media mapping and readiness in platform PostgreSQL. Do not mark playable based on upload completion alone. Until actual events are verified, use the supported status API with bounded polling/reconciliation. Do not implement webhook emitters inside DRM. Validate returned upload destinations and browser reachability without exposing server credentials.

Cloudflare R2 through external DRM is confirmed. Local configuration/substitute is pending; this adapter must not change the external package's storage internals.

## Playback

1. Authenticate the student using platform cookie/session controls.
2. Check active entitlement using backend time, and validate course/lesson/external asset mapping.
3. Construct the required short-lived signed assertion; existing claims are iss, aud, sub, app, course, lesson, asset, iat, exp, jti, with optional device/nbf.
4. app is the DRM client_id; asset matches externalAssetId; sub identifies the platform student. Do not confuse internal asset UUID with external asset ID.
5. Call POST /v1/playback/sessions server-side with application credentials. Do not forward browser-supplied credentials or trust browser-supplied course ownership.
6. Return validated frontend-safe session data: playback ID/token, expirations, manifest/license URLs, provider and watermark policy. Never include the application secret or assertion signing key.
7. Follow external player/session APIs for heartbeat, renewal, end and revoke. Existing session routes are /v1/playback/sessions/:id/{heartbeat,renew,end,revoke}; revoke requires application authentication.

Existing assertion verification uses JWKS, configured issuer/audience and a maximum 300-second lifetime. Document the platform signing configuration without changing the external implementation. Current media/license routes require a playback bearer token. Keep this token transient and separate from platform authentication/session cookies; no long-term browser persistence.

## Subscription expiry

Backend must deny access after expiry regardless of UI state. Track necessary session references and call supported external revocation/termination. Stop the frontend player and show renewal-required. Retry failed external termination with bounded observable handling.

An external bearer session is not itself proof that platform enrollment remains valid. Direct heartbeat/renewal and already-issued licenses/buffered content may constrain enforcement timing. Test and document actual behavior. Do not promise instantaneous termination merely because a platform endpoint now denies access. Repair DRM behavior only under a separate explicit owner-authorized maintenance assignment.

## External readiness

The prior source review found incomplete commercial licensing and possible playback issues. These remain dependency observations to confirm against the supplied running service, not permission for an unrelated rewrite. Validate real upload-to-playback, renewal, watermark and termination black-box. Mocks are insufficient production evidence.

## Permanent media deletion prerequisite

The bounded DRM prerequisite is accepted. The API now exposes an application-scoped asynchronous media-deletion contract and safe status endpoint. Acceptance verified immediate playback denial, active-session revocation, source and packaged-prefix cleanup, personalized variants, cascading secret/material cleanup, retained non-secret operation/audit evidence, retry and reconciliation, and prefixes containing more than 1,000 objects. The platform may integrate this API in M3, while live Cloudflare R2 verification remains blocked until credentials are supplied.
