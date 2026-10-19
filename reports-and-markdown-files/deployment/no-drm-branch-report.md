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

Cloudflare R2 is compatible with this S3 storage path. In Railway, set `STORAGE_ENDPOINT` to `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `STORAGE_REGION=auto`, `STORAGE_BUCKET` to the bucket name, and use that bucket's R2 S3 Access Key ID and Secret Access Key for the remaining settings. Add a bucket CORS rule allowing the frontend's exact origin, `PUT`/`GET`, and the `Content-Type` and `If-None-Match` request headers. Upload URLs use conditional writes so they cannot replace an existing video. Keep the bucket private. Railway hosting does not provide the bucket; R2 storage and egress usage may cost money. [Cloudflare R2 S3 setup](https://developers.cloudflare.com/r2/get-started/s3/) · [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)

No custom domain is needed for a staging rehearsal. Use the Vercel project's stable HTTPS `*.vercel.app` frontend origin and a Railway-generated HTTPS gateway domain. Keep the existing `/api` proxy rewrite, set `ALLOWED_ORIGINS` and the R2 CORS allowed origin to that exact frontend origin, set `COOKIE_SECURE=true`, and keep `SEO_INDEXING_ENABLED=false`. The branch's Railway graph now contains only platform services and platform persistence; it no longer provisions DRM API/worker/database/cache resources, requests DRM secrets, or exposes the DRM JWKS route. Update origins after choosing a custom domain. See [the no-DRM Railway checklist](../../.railway/README.md).

Videos that currently exist only in the DRM service are not copied by this code and will not play from the new storage path. Re-upload them through the admin interface. Existing DRM-side assets also need cleanup in the old DRM service; this branch does not call it. Do not remove the old service's data until those videos have been recovered or intentionally retired.

## Production readiness

Owner direction on 2026-10-12 accepts the lower video-protection level for this release. This removes commercial DRM integration as a launch requirement; it does not establish production readiness. The branch was brought forward to the latest `origin/dev` candidate in local merge `2620188`, and the deployment checklist must use the no-DRM platform-only graph.

The remaining release gates are:

1. **Qualify the actual HTTPS edge and domains.** Verify certificate renewal, canonical redirects, HSTS, proxy trust, Secure cookies, rate-limit identity, backend isolation and private response/cache behavior on the deployed Railway/Vercel/R2 route.
2. **Verify the real R2 configuration.** Keep the bucket private; use a scoped key and exact-origin CORS; prove upload, read, replacement, deletion, byte-range playback and denial of unsigned access; rotate credentials and confirm billing limits. The account, credentials, CORS and bill limits have not been verified here.
3. **Recover required videos.** DRM-only assets are not copied by this branch. Re-upload or otherwise recover each required video and verify playback before retiring the old assets.
4. **Track the accepted client build-tool security exception.** The current full client audit reports five high findings, all from Tailwind 3's build-only `braces` chain; the shipped client dependency tree reports zero vulnerabilities. The moderate selector-parser finding was removed by pinning `postcss-selector-parser` 7.1.6, and the existing exact-version/source guard and depth limits for `braces` remain covered by eight Docker tests. npm still reports the upstream `braces` advisory because its package version is unchanged. Tailwind 4 clears the full audit but requires Chrome 111+, Safari 16.4+ and Firefox 128+; on 2026-10-12 the owner chose to preserve current browser support, so this is recorded as a build-tool exception rather than changing the browser floor.
5. **Prove operational recovery.** Verify least-privilege database access, PostgreSQL backup and restore, Redis/object-store network policy, secret inventory/rotation, alert delivery and incident procedures with the selected providers.
6. **Qualify scale and user experience.** The stated 10,000 simultaneous users has not been load-tested. The local synthetic mobile Lighthouse run measured 2.9-second LCP; measure the live site on real devices. Run disposable deployment checks for expiry, cross-account access, concurrent sessions, upload limits and failure recovery.
7. **Complete live end-to-end qualification.** Verify migrations, private admin setup, student/admin Arabic/English journeys, subscription and progression denials, R2 upload/playback/deletion and failure recovery on a disposable deployment before accepting real student traffic or payments.

The security and SEO reports describe the shared-source findings in [the security follow-up](../security/security-audit-followup-20261011.md) and [the SEO follow-up](../seo/seo-audit-followup-20261011.md). They do not certify this branch's live configuration.

## Verification on this branch

- The original branch report records a focused Docker playback test: **33 passed**, including the no-DRM concurrent-session cap regression; platform image builds and Railway graph checks also passed at that earlier revision.
- No cloud deployment, live R2 playback check, DRM-only asset recovery or 10,000-user load qualification was performed in that run.
- On the current merged branch, Docker builds of the platform migration, runtime and gateway images succeeded. The disposable production-mode rehearsal passed migration, readiness, gateway/auth denial, Secure CSRF, bilingual SSR, internal-route protection and release-admin validation; its containers, network and volume were removed and absence verified.
- Server production build and typecheck passed. Server unit tests passed **610/610**. Client typecheck passed and client tests passed **391/391**.
- Backend CI now passes in Docker: server unit tests **610/610**, canonical integration tests **408 passed across 50 files**, plus the separately guarded course-material suite (**23 unit and 20 MinIO-backed integration tests**). The older DRM-only and standalone-materials suites remain intentionally excluded from the canonical integration command and have their own coverage.
- Client tests pass in Docker: **391/391 across 46 files**. The production frontend image builds, including the SSR bundle. The no-DRM lesson bundle was reduced from about **993 KB to 55 KB** (gzip 290 KB to 17 KB) by loading dash.js only for grants that require the DASH/EME path; dash.js remains available as a separate lazy chunk. Remaining frontend build warnings are one mixed static/dynamic import and the separate IDE/formatter chunks above 500 KB.
- Current client `npm audit` still reports five high findings in the Tailwind 3 build chain; `npm audit --omit=dev` reports zero. The local `braces` depth guard is tested but the upstream package advisory remains visible to npm. A Tailwind 4 trial cleared the full audit, but was reverted because it raises the supported-browser floor; see gate 4 above. Server production dependencies audit clean.
- During the 2026-10-12 follow-up, S3 SigV4 presigned-request canonicalization was corrected, uploads were changed to signed conditional `If-None-Match: *` writes, and replay denial coverage was added. Docker verified the no-DRM playback/session rules, catalog media retirement and object deletion, PostgreSQL/Redis races, and storage-failure cleanup. Production-mode local rehearsal passed migrations, liveness/readiness, gateway/auth denial, Secure CSRF, bilingual SSR, private internal routes and release-admin checks; its disposable containers/network/volume were removed and absence verified.
- The production image build now emits smaller no-DRM course chunks; cloud deployment, actual R2 credentials/CORS/domain checks, recovery of required DRM-only videos, real browser/device checks, backup restore/alert delivery, incident operations, and 10,000-user capacity qualification have not been performed. Therefore this branch is **not certified production-ready** yet.
- On 2026-10-19, the verified no-DRM candidate was fast-forwarded to `deployment` and pushed as `e3418f8` (`feat: complete no-DRM Railway preparation`). The local `deployment` branch matched `origin/deployment` after the push.
- A fresh Docker rerun was attempted during that promotion, but Docker Desktop's Linux engine did not expose its API socket. The earlier Docker results above apply to the same commit; no new Docker results are claimed for this turn. No Railway or Vercel deployment was performed.
