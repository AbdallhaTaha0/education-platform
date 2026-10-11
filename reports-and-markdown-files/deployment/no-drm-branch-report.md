# No DRM branch

Branch: `codex/no-drm`

This branch serves uploaded videos from the platform's private S3-compatible bucket. Admin uploads use short-lived signed PUT URLs; student playback is granted only after the existing subscription and lesson progression checks, then uses a five-minute signed GET URL and the browser's native video player. URL renewal still rechecks the subscription. Playback end, expiry, retired-media cleanup, and permanent deletion are handled in the platform without calling the DRM service.

## Features kept

- Student and admin authentication, course access checks, subscription expiry, lesson progression, and progress tracking.
- Admin video upload, replacement, synchronization, and deletion.
- Private object storage with signed upload and playback URLs.
- A visible student label overlay. It is a deterrent only and can be hidden or removed.
- A best-effort cap of two concurrent playback references per student account. Expired references stop counting, and the existing own-session recovery UI can close a session.

## Features lost

- Video encryption and DRM license enforcement. A paying student can save or redistribute the original video.
- Widevine, PlayReady, and FairPlay, DRM device registration/revocation, and DRM-enforced session limits. The two-reference platform cap reduces casual sharing but does not identify physical devices or stop screen capture.
- DRM transcoding, DASH packaging, and adaptive quality selection. Playback uses the uploaded file directly; supported formats depend on each browser. MP4/H.264/AAC is the broadest choice.
- DRM-backed forensic or signed watermarks. The remaining on-screen label is not tamper resistant.
- Immediate access revocation for a copied playback URL. A signed URL can be used by whoever has it until its five-minute expiry; new URLs require a valid subscription.

## Deployment requirements and existing videos

Cloudflare R2 is compatible with this S3 storage path. In Railway, set `STORAGE_ENDPOINT` to `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `STORAGE_REGION=auto`, `STORAGE_BUCKET` to the bucket name, and use that bucket's R2 S3 Access Key ID and Secret Access Key for the remaining settings. Add a bucket CORS rule allowing the frontend's exact origin, `PUT`/`GET`, and the `Content-Type` request header. Keep the bucket private. Railway hosting does not provide the bucket; R2 storage and egress usage may cost money. [Cloudflare R2 S3 setup](https://developers.cloudflare.com/r2/get-started/s3/) · [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)

No custom domain is needed for a staging rehearsal. Use the Vercel project's stable HTTPS `*.vercel.app` frontend origin and a Railway-generated HTTPS gateway domain. Keep the existing `/api` proxy rewrite, set `ALLOWED_ORIGINS` and the R2 CORS allowed origin to that exact frontend origin, set `COOKIE_SECURE=true`, and keep `SEO_INDEXING_ENABLED=false`. The branch's Railway graph now contains only platform services and platform persistence; it no longer provisions DRM API/worker/database/cache resources, requests DRM secrets, or exposes the DRM JWKS route. Update origins after choosing a custom domain. See [the no-DRM Railway checklist](../../.railway/README.md).

Videos that currently exist only in the DRM service are not copied by this code and will not play from the new storage path. Re-upload them through the admin interface. Existing DRM-side assets also need cleanup in the old DRM service; this branch does not call it. Do not remove the old service's data until those videos have been recovered or intentionally retired.

## Production readiness

This branch is **not ready for production release yet**. The source is built locally, but there is no live host to verify against. The concrete gates are:

1. **Choose and qualify the real HTTPS domain and edge.** Verify certificate renewal, HTTP-to-HTTPS/canonical redirects, HSTS, proxy trust, secure cookies, rate-limit identity, backend isolation, and private response/cache behavior on the deployed Railway/Vercel/R2 route.
2. **Configure and test R2 with real secrets.** Keep the bucket private; use a scoped access key, set exact-origin CORS, confirm upload/read/delete and byte-range playback, rotate credentials, and test that unsigned object URLs fail. The account ID, bucket, secrets, CORS and billing limits have not been verified here.
3. **Recover the video library.** Existing DRM-only assets are not copied to R2. Re-upload or otherwise recover each required video and verify it plays before retiring the old DRM assets.
4. **Accept the reduced video protection.** Without DRM, paid students can download or redistribute source videos. The visible student overlay can be hidden, and a copied signed URL works until its five-minute expiry. The two-session cap and subscription checks do not prevent screen recording or file copying. Confirm this protection level is acceptable for the course content and business model.
5. **Resolve the client build-tool dependency advisories.** The current full client dependency tree still reports five high and two moderate advisories in the Tailwind 3 build chain. The production-only client dependency audit and server audits were clean in the 2026-10-11 review, so this is build/development exposure, but it remains an open security finding.
6. **Complete operational recovery checks.** Verify database least-privilege, PostgreSQL backups and an actual restore, Redis/object-store network policy, secrets inventory/rotation, alert delivery, and incident procedures on the selected providers.
7. **Qualify real scale and user experience.** The required 10,000 simultaneous users has not been load-tested. The local mobile Lighthouse run measured 2.9-second LCP, above the 2.5-second good threshold; measure on the real site and real phones. Run disposable deployment checks for expiry, cross-account access, concurrent sessions, upload limits and failure recovery.

The security and SEO reports describe the shared-source findings in [the security follow-up](../security/security-audit-followup-20261011.md) and [the SEO follow-up](../seo/seo-audit-followup-20261011.md). They do not certify this branch's live configuration.

## Verification on this branch

- Focused Docker playback test: `server/tests/unit/learning-playback.test.ts`, **33 passed**, including the no-DRM concurrent-session cap regression.
- Server deploy image and client runtime image built successfully with Docker.
- Railway graph tests and the disposable production-mode verification use platform-only services; no DRM service or nested DRM image is required.
- No cloud deployment or live R2 playback check was performed. No DRM-only asset recovery or 10,000-user load qualification was performed.
- `git diff --check` passed.
