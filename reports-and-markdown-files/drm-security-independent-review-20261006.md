# Independent latest-change review — 2026-10-06

Historical review: the owner subsequently assigned and completed local fixes. See [current delivery evidence](security-delivery-20261006.md); the findings below describe the state at inspection.

The source security repair passed the verification described below. It has **not** been delivered through the platform Git reference or applied to the running local DRM. This is a review, not milestone acceptance or production approval.

## Revisions and scope

- Platform HEAD: `73a77c15ab87952f3422bbc7c3402855c87fba88`; no newer platform implementation commit was present.
- Platform's recorded DRM gitlink: `dd66be36fd817af694236fa8846582251c961f90`.
- Nested DRM checkout: `52853b357168887f89cf5cd98f36060e9efeb38f` — `fix: protect packaging errors and pin webhook destinations`; nested tracked tree clean.
- One new nested commit was reviewed: 20 files, including processing-error sanitization, public-address webhook resolution/pinning, tests, and the TypeScript ESLint dependency update.
- No platform/DRM implementation was edited, no gitlink was changed, and nothing was committed or pushed.

## Findings

1. **Delivery gap: running DRM lacks both fixes.** Direct inspection of compiled code in the retained containers returned `running_worker_has_safeVideoError=false` and `running_api_has_pinned_webhook_transport=false`. The API and worker still use the existing `fayq-drm-*:0.8.0-local` images built on October 1. Healthy endpoints do not establish that a security repair is installed. A separate guarded local rebuild/recreation is needed before claiming the local runtime is protected by this commit.
2. **Delivery gap: the parent Git reference remains at the previous DRM revision.** The nested checkout advanced, but a checkout using the platform's recorded gitlink would select `dd66be3`, not `52853b3`. Updating and delivering the parent reference remains separate work; this review does not silently change it.
3. **Known pre-existing webhook status defect remains.** `apps/api/src/services/webhook.service.ts:115` updates deliveries using only `event_id`, although one event can have several destination rows. A later destination's outcome can overwrite an earlier destination's outcome. This line was unchanged by the reviewed commit and the nested report already discloses it. Repair should scope the update to its destination and add an opposite-outcomes regression. This review verified the SQL statically, not with a new multi-destination integration test.
4. **Documentation references are incomplete in this checkout.** The nested repair report names parent `drm-security-repair-20261006.md` and `security-delivery-20261006.md`; neither was present. This independent report records reproduced evidence instead of assuming those reports exist.

No blocking defect was found in the new sanitization or address-pinning code within the exercised scope.

## Fresh Docker verification

Built current nested source with its API Dockerfile's `test` target under a distinct temporary tag, `fayq-drm-security-review:52853b3`. Frozen-lockfile installation passed the configured supply-chain checks, installed parser/plugin `8.71.0`, and `pnpm build` completed the workspace's forced TypeScript build.

| Verification | Result |
| --- | --- |
| Default unit/security suite, no external network | **103/103**, 15 files |
| Security-specific tests included in that suite | **52/52**, four files; included in the 103 count |
| Real PostgreSQL/BullMQ failure-sink integration | **2/2**, one file |
| Isolated migrations | Exit **0**, before integration |
| Disposable cleanup | Passed; both test volumes, project containers and network removed |
| Retained volume preservation | Every pre-existing volume name remained present; none attached to the disposable project |

The initial default-suite attempt lacked synthetic configuration variables: 96 tests passed and the existing configuration suite refused import because `DATABASE_URL` was absent. After supplying the security Compose file's synthetic configuration, all 103 passed. This was a review-runner setup correction; no product code was changed. The initial failure log was retained alongside the passing evidence.

Failure-path coverage exercised sanitized logger arguments, SQL job errors, BullMQ failed reasons/stack traces, native subprocess failures/timeouts, key clearing and temporary-file cleanup. Webhook coverage exercised restricted literals, mixed DNS answers, pinned address/Host/SNI/certificate options, redirects, rebinding on retry, and DNS failures. Transport tests mock HTTPS; this is not a real remote TLS delivery qualification. The PostgreSQL/BullMQ test uses synthetic processing dependencies; it is not another live R2 or real-video lifecycle test. No full dependency-vulnerability audit was independently rerun.

## Local preview recovery and preservation

On arrival, the retained Nginx container had exited because `server:3000` was unresolved during startup. After the repository's persistent-volume guard passed, only that existing entry container was started again. No images were rebuilt or replaced in either retained stack.

- `http://localhost:8080/api/health/ready`: **200**.
- `http://localhost:3000/health`: **200**.
- Platform Nginx, client, server, grading controller and data services: healthy.
- DRM API/worker: running; database and cache: healthy.

No retained database/media fixture, real video, user, credential, R2 object, or CORS setting was modified. The review project was `fayq-security-review-20261006-001`; configuration and mount guards ran before startup and cleanup. Its two disposable volumes were absent after cleanup, and the temporary review image tag was removed. Build cache was not globally pruned.

Sanitized local evidence and the disposable review launcher are ignored under `docker/browser/evidence/security-review-20261006/`. They contain synthetic test configuration and verdicts, not retained secrets. No new DRM maintenance, deployment, capacity qualification, or commit/push authorization is inferred from this review.
