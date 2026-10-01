# Remaining M7/M8 packages after local refresh

2026-10-01. Follow the owner instruction to exclude teammate handoff item 4 (recovery/monitoring) for now. The owner subsequently also deferred deployment, commercial DRM and capacity qualification. This document is a future continuation plan only; no answers, credentials or provider access are required to finish the current local setup. The [local refresh report](local-m7-m8-refresh-review.md) records current source, preserved data, reproduced tests and a functioning port-8080 preview. The unchanged [Railway runbook](m7-railway-runbook.md) remains the release contract; this plan does not authorize paid provisioning or deployment.

## Package 2 — Railway release

The edge image/config, minimal server image, separate migration image, two replicas, private dependencies and release sequence already exist. The current candidate passed a fresh isolated rehearsal after the Windows shell-entrypoint repair. Use candidate image digests and rebuild after material source changes; never reuse development HTTP cookies, credentials, payment fixtures, preview accounts or ClearKey settings as production configuration.

Required inputs: Railway access and project/staging environment, approved public domain/origin, registry/release naming, private database/Redis references, independent DRM HTTPS endpoints, production credentials, approved receiving-account instructions, and resource/spending limits. Store secrets in the provider or ignored local files, never in this report or a worker prompt.

Prepare and review effective per-service settings first. Keep backend/database/cache/migration private and expose only the HTTPS edge. Run the dedicated migration job and verify its exit/migration records before enabling the backend. Verify readiness, real HTTPS cookies/CSRF, manual approval/purchase idempotency, package/presale visibility, Socket.IO delivery and protected video through the release origin. Obtain final deployment approval for the concrete candidate. Item 4's deferred recovery requirements remain visible as a production-launch gate; do not treat deferral as evidence that recovery is ready.

## Package 3 — Commercial DRM and final browser origin

Required inputs: chosen commercial DRM provider, legitimate license/packaging credentials and permitted test content, its independent operator, and the exact release website/DRM origins. The five local Widevine fields are currently empty. Preserve the API-only boundary; any needed DRM source maintenance requires a separate explicit bounded assignment.

Use a run-owned test asset and supported APIs. Verify protected processing, actual supported-browser playback with the commercial license, watermark/device/tenant binding, publication and subscription enforcement, renewal/expiry/end, and final-origin R2 upload preflight/positive/negative browser behavior. Record actual browser/CDM/provider results. End run-owned sessions and delete only the run-owned asset through the supported deletion operation; verify completion. Preserve the owner's real video. Do not label a local ClearKey pass as this package's acceptance.

## Package 4 — Recovery/monitoring

Deferred by the owner. Do not activate backup schedules, recovery drills, monitoring automations or alerts as part of this continuation. The previous runbook and historical evidence remain unchanged.

## Package 5 — Proposed 10,000-user qualification

This is a reviewable proposal; percentages, timing and pass thresholds are **not approved policies**. Do not start external traffic until the owner approves the staging environment, spending cap, workload and targets. Avoid the owner's port-8080 preview, real media and personal/financial records.

Define simultaneous students explicitly: distinguish active application users, open notification connections, students playing protected video, and requests per second. Record separate totals; HTTP concurrency alone cannot establish 10,000 students. Obtain the expected browsing/viewing mix, lesson lengths, rendition bitrates, purchase/recharge frequency and device/browser/network mix.

| Scenario | Workload and evidence |
| --- | --- |
| Public discovery | Landing/catalog/filter/course/package details, Arabic/English responses; cache-hit/miss and response latency |
| Authenticated students | Cookie/CSRF login and refresh, dashboard/outline access; account/session cardinality and denial rates |
| Wallet/purchase | Synthetic funded accounts; normal and duplicate purchase requests, package ownership overlap, immutable snapshots and exact ledger/balance reconciliation |
| Notifications | Distinct authenticated Socket.IO connections across replicas; recipient isolation, delivery lag and reconnect behavior |
| Protected viewing | Real commercial licenses, realistic bitrate/rendition mix, manifests/segments, renewal/heartbeat and entitlement expiry; startup/rebuffer/denial evidence |
| Presale and expired access | Expected authorization denials separated from unexpected server failures; no unpublished content leakage |

Proposed ramp checkpoints: 100, 500, 1,000, 2,500, 5,000 and 10,000 concurrent students. Hold durations, think times, playback fraction and soak duration must be approved before implementation. Use distributed Docker load generators with synchronized accounting and sufficient independent CPU/network headroom; a saturated generator invalidates the result. Run representative browser/CDM cohorts alongside protocol clients; API requests alone do not prove commercial playback.

Specify acceptance limits before testing: platform p95/p99 response time by scenario, unexpected error fraction, video startup/rebuffer rate, notification delivery delay, and allowable resource/connection utilization. Money/ownership correctness and absence of tenant/content leaks are mandatory invariants. Stop on a breached approved spend limit, unexpected financial mismatch, cross-user access, sustained instability or invalid generator measurements.

Capture backend replica utilization/restarts, PostgreSQL locks/connection use, Redis memory/latency, edge connections, notification delivery, independent DRM queues/license throughput and media bandwidth. These are run measurements; permanent monitoring setup stays deferred under item 4. Report observed bottlenecks and sizing at each checkpoint. Do not extrapolate the 200-request local smoke to the target.

The eventual worker package must have Docker project names, exact run-owned fixture IDs/prefixes, checked exit statuses and cleanup in `finally`. Verify every mount and project label before removing owned containers/networks/volumes; clean after success, failure or stop. Remove test assets through external APIs, retain immutable financial evidence only in the disposable test database until teardown, and preserve private sanitized results. No global prune or unrelated-preview deletion.

## Package 6 — Owner review

Present functional M8 evidence separately from actual Railway/commercial DRM/capacity results and the deferred recovery gate. Identify exact failed/blocked checks and their causes. Request milestone acceptance and deployment approval only for the concrete reviewed result. Commit and push accepted work according to the owner's standing instruction; do not infer acceptance from a successful local preview.
