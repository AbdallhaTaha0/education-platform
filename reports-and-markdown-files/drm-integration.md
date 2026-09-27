# External DRM integration contract

Confirmed boundary: API-only, no edits anywhere inside education-drm-service/. Earlier observations are dependency findings, never platform repair assignments. Use supported responses and frontend requirements; never query DRM persistence.

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

An external bearer session is not itself proof that platform enrollment remains valid. Direct heartbeat/renewal and already-issued licenses/buffered content may constrain enforcement timing. Test and document actual behavior. Do not promise instantaneous termination merely because a platform endpoint now denies access. If the API cannot enforce the requirement, report an external blocker to the owner without editing DRM.

## External readiness

The prior source review found incomplete commercial licensing and possible playback issues. These remain dependency observations to confirm against the supplied running service, not instructions to rewrite it. Validate real upload-to-playback, renewal, watermark and termination black-box. Mocks are insufficient production evidence. Admin download/removal requires supported external endpoints plus owner policy.
