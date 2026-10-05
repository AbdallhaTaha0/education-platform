# DRM security repair — 2026-10-06

## Outcome and authorization

The owner instructed “fix the drm” following the security audit. This authorizes the bounded repairs for F01 (key-bearing packaging errors) and F03 (webhook destination validation/connection pinning). The owner separately approved upgrading the DRM TypeScript ESLint parser/plugin to a qualified version 8 release to remove the F02 development dependency chain.

**F01 and F03 are fixed in source and verified. The DRM portion of F02 is resolved: the final dependency audit reports zero known advisories.** Platform frontend/browser-tooling advisories remain outside this follow-up.

No deployment, commit, push, schema migration, retained-data edit or historical log deletion occurred. The platform consumes only the independent DRM API; no platform database coupling or role change was introduced.

## F01 — key-safe processing failures

Changed:
- apps/worker/src/utils/video-error.ts — fixed allowlisted messages/categories; bounded numeric exit status and timeout flag; no raw command, stderr, stdout or cause retained.
- apps/worker/src/services/video-processing/packaging.service.ts — replaces subprocess exceptions immediately at the packaging boundary.
- apps/worker/src/processors/video.processor.ts — stage-derived safe failures for logging, PostgreSQL error fields and BullMQ rethrow. Reconstructs sanitized errors rather than retaining attached causes. Persistence failure cannot replace the queue exception with a raw database error. Source-cleanup warnings are sanitized too.

Successful processing, finite static manifest flags, encryption input, key zeroing and temporary-directory cleanup remain. Size/duration failures retain their explicit categories. Raw-message substring classification was removed so secrets never become diagnostic text.

Verified: simulated failure/timeout cases inspect log arguments, SQL update arguments and thrown errors; native executable failure and native timeout tests exercise actual Node subprocess error objects. Two additional tests run the real processVideo failure path with real PostgreSQL and BullMQ, verifying persisted error_message/error_category, failedReason and stacktrace contain no synthetic content key or command arguments. Media is marked FAILED. Persistence-error and success/source-cleanup cases also pass.

Historical exposure remains unknown. These code changes do not remove already retained keys: privately inspect authorized log/job/queue backups and rotate/repackage only affected outputs if confirmed. No successfully published-key compromise is asserted.

## F03 — public-only pinned webhook delivery

Changed:
- packages/drm-core/src/webhook-destination.ts — shared HTTPS/443/no-credentials validation and vetted ipaddr.js 2.4.0 normalization. Rejects nonpublic IPv4, mapped IPv4, private/link-local/multicast/reserved ranges and non-global/transition/documentation IPv6. Every DNS answer must pass.
- packages/drm-core/src/webhook.service.ts — HTTPS request connects to a validated literal, preserving original Host, TLS SNI and certificate identity checks. A fresh agent prevents socket reuse across endpoints. Each retry revalidates DNS; there is no second hostname resolution during the connection. Redirects are never followed. Response bodies are destroyed without buffering; request deadline and response-header limit remain bounded.
- packages/drm-core/src/index.ts and packages/drm-core/package.json — exports/dependency.
- apps/api/src/services/webhook.service.ts — registration and pre-delivery checks reuse the shared policy and preserve UNSAFE_WEBHOOK_URL errors, without exposing unknown exceptions.

Verified: 45 transport/address cases cover alternate numeric IPv4, dotted/hexadecimal mapped private IPv6, mixed public/private DNS answers, DNS failure, public IPv4/IPv6, changed answers before retry, redirect rejection, signed payload/headers and original-host certificate identity verification. Tests assert the actual request options use the validated IP and perform one DNS lookup per attempt.

The transport tests intercept HTTPS request creation; they do not claim a live production TLS handshake or network-egress certification. Deployment must still enforce independent outbound/private-network policy and qualify the actual receiver certificate/DNS environment. Public receivers using transition/reserved address space are deliberately rejected.

## F02 — qualified development-tooling upgrade

Root package.json and pnpm-lock.yaml now lock the TypeScript ESLint parser/plugin at 8.71.0. The old globby/fast-glob/micromatch/braces development chain is removed. ESLint 8.57.1 and TypeScript 5.9.3 remain compatible; no unrelated major platform upgrade occurred.

Initial saving of the tooling change was rejected by automatic approval review as beyond the vague initial instruction. The owner then explicitly approved it. The first candidate, 8.71.1, was correctly rejected by the existing package-age policy during a frozen-lockfile build. Version 8.71.0 was published September 28 and passes that policy. No minimumReleaseAge exception or other workspace-policy relaxation was saved.

Final Docker pnpm audit: info 0, low 0, moderate 0, high 0, critical 0. This covers package advisories at review time, not OS/native-tool CVEs. Existing deprecated-package notices remain; no warning was suppressed.

## Verification

**105 tests pass, with no skips:**
- 103 default unit/security tests across 15 files: 51 existing API tests plus 52 new security cases.
- Two real PostgreSQL/BullMQ failure-sink tests.

The default apps/api/vitest.config.ts includes security-tests so these regressions run in the regular suite. Separate security/integration configurations and docker/docker-compose.security-test.yml support focused reproduction. Security test mounts are read-only.

Docker frozen-lockfile installation and pnpm build (TypeScript project build for API, worker, packages and demo player) pass. A focused ESLint parser/plugin compatibility check on all repaired source files passes. Both repositories' whitespace checks pass.

Initial failures were fixture problems: a Vitest hook accidentally returned a mock as cleanup, missing required environment for the existing config suite, and use of initDatabase's void return instead of getDb. They were corrected without changing production guards. The fresh database retained its exact safety-name check.

Commands actually used (project paths abbreviated only here):
- docker build --target test -f apps/api/Dockerfile -t fayq-drm-security-test:verified-20261006 .
- docker run --rm --network none ... pnpm --filter @drm/api exec vitest run --config vitest.security.config.ts
- docker compose -p fayq-drm-security-20261006 -f education-drm-service/docker/docker-compose.security-test.yml up -d --wait postgres valkey
- docker compose ... run --rm test
- docker compose ... run --rm --no-deps test pnpm test (final config mounted read-only)
- docker run --rm ... pnpm audit --json
- docker run --rm --network none ... pnpm exec eslint --no-eslintrc --parser @typescript-eslint/parser --plugin @typescript-eslint --env node,es2022 --parser-options '{"sourceType":"module","ecmaVersion":2022}' --rule '@typescript-eslint/no-unused-vars:error' [six repaired source files]
- docker compose ... down -v; docker rm -v [three owned stopped dependency containers]

Local ignored evidence: docker/browser/evidence/drm-security-repair-20261006/. Logs include the successful final default suite, real-sink integration suite, build, dependency audit, tooling compatibility and cleanup.

## Cleanup and retained state

Before deletion, project labels and every mount were inspected. Only this repair project's PostgreSQL/Valkey/migration containers, fresh security-pg volume, inspected anonymous Valkey volume, network and three stopped dependency-resolution containers were removed. Final project container/volume/network queries are empty; the anonymous volume is absent. No global prune.

Existing fayq-local-preview-grading-1 and fayq-local-materials-materials-minio-1 remain running. Existing application/DRM volumes and platform audit edits were preserved. Reusable images and sanitized verification evidence remain.

## Review, release and rollback

Review the nested source/lockfile/test diff and this report before any separately authorized release. No live video-processing/browser/license/capacity or production-infrastructure certification is implied by these bounded failure-path/transport tests.

No migration or new deployment configuration is needed. A future release rollback can restore the previous API/worker image pair; restoring the old source would reintroduce these vulnerabilities, so prefer a corrected forward release. Do not reset unrelated platform changes or retained data. Historical credential-candidate triage and exposure/rotation assessment remain private owner work.
