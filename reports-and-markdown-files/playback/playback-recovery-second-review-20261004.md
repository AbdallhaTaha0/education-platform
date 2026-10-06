# Playback recovery second coordinator review — 2026-10-04

Disposition: **corrections still required before combined integration or preview update**. The worker fixed important original paths, but its eight-item completion statement does not close the handoff. No implementation files, owner database, nested DRM package, preview image, commit or deployment were changed by this review.

## Independently reproduced evidence

- Built current server/client test images in Docker as `fayq-playback-coordinator-recheck-{server,client}:20261004`.
- Server and client typechecks pass; **225 server and 114 client unit tests pass**, plus two frontend DASH compatibility checks.
- Applied all 16 migrations only to a new disposable PostgreSQL database; **13/13 existing playback-recovery integration tests pass** with real platform persistence and the labelled HTTP DRM fixture.
- **Four additional audit defect probes reproduced the findings below**, using real PostgreSQL. Concurrent probes insert deterministic barriers around actual Prisma reads/writes to exercise a possible interleaving; they do not replace persistence. These probes intentionally assert the defective behavior, so their passing result is evidence of defects, not product acceptance.
- Chromium exercised the actual `OwnSessionRecovery` component with a standalone mocked API: QUEUED followed by `ENDED / FAILED` displayed “Closed and confirmed” and allowed the recovery callback. This is a negative-state UI reproduction, not evidence that the live backend ordinarily emits this combination or that real DRM playback advances.
- Probe files: `docker/playback-coordinator-review/audit-recheck.test.ts`, `recheck-entry.tsx`, `recheck-browser.mjs`, `recheck.compose.yml`, `recheck-cleanup.mjs`. Earlier review probes remain untouched.

The worker's 28 learning-playback and 44 browser checks were not rerun in this review. Their reported results remain worker evidence. Do not claim real-provider advancing-time playback from mocked browser states.

## Remaining findings

| Priority | Finding and evidence | Required correction |
| --- | --- | --- |
| P1 | False release outcome from incomplete inspection. `server/src/modules/learning/devices/service.ts:282` treats an absent reference as released without checking `inspection.truncated`. A pending intent plus `devices:[], truncated:true` creates a DEVICE_RELEASE audit while the HTTP fixture still holds the ACTIVE reference. | An incomplete list cannot prove absence. Keep the outcome unconfirmed/pending; use complete inspection or explicit API evidence. Distinguish an observed absent reference from proof this operation performed a release. |
| P1 | Duplicate intent/outcome under concurrency. `service.ts:320` checks then inserts an intent, and outcome writes also lack atomic deduplication. Two scheduled simultaneous requests create two REQUESTED and two RELEASE rows for one registration. Sequential duplicate tests do not cover this. | Correlate intent/outcome explicitly and enforce replica-safe atomic intent and terminal-outcome deduplication. Preserve external idempotency and recoverable intent before crossing the API boundary. |
| P2 | Reconciliation changes release attribution. `service.ts:235,288` assigns the current admin to the outcome. The probe releases under ADMIN A during an outcome-write outage, then reconciles under ADMIN B; the successful release row names B and carries no originating intent ID. | Preserve the originating actor and explicit intent correlation. If the reconciler is recorded, distinguish it from the requesting actor in safe metadata. |
| P1 | Older pending intents starve. `service.ts:260` limits the latest 20 REQUESTED rows before excluding completed history. One older pending intent behind 20 completed pairs is never considered on repeated student-scope sweeps; the probe returns `stillPending:0` despite the persisted unresolved intent. | Query pending work first, or walk durable bounded keyset pages with fair progress. A bounded batch must not imply no work exists outside that batch. Test older work behind completed history and across restarts. |
| P1 | Closure predicate accepts unconfirmed states. `client/src/features/learning/sessions/OwnSessionRecovery.tsx:32` accepts ENDED with every termination status except PENDING, including FAILED and null. The browser fixture reproduces QUEUED → ENDED/FAILED → “Closed and confirmed” → restart callback. ENDED is written before the external acknowledgement in `server/src/modules/learning/playback/service.ts:273`, so the state itself is not acknowledgement evidence. | Fail closed: offer restart only on explicit CONFIRMED or a subsequently observed state that establishes completed external closure. Add FAILED/null negative-state coverage alongside COMPLETED. Missing rows must remain uncertain. |
| P2 | Browser cleanup does not check exact resolved bind sources. `docker/playback-recovery-review/run.mjs:133` accepts an image substring and allowed destinations, then removes the container. It does not compare each mount's source, expected count or read/write mode to the assigned configuration. The Compose guard also permits any expected volume on any service/destination, rather than exact service mount mapping. | Inspect exact image/labels plus source/destination/type/mode/count before every removal, inspect volume identities and network consumers, and fail closed on mismatches. Add negative guard checks. This finding is source-inspected; no destructive mismatch experiment was run. |

## Original corrections credited

The durable pre-call intent now survives a failed outcome write; original NOOP automatic restart is removed; CONFIRMED restart is explicit; visibility-change termination is removed; blocker-first session ordering is implemented and its existing integration test passes. Playback rejection classification now separates gesture and unsupported-media failures and guards stale promises. ADMIN uncertain-result handling and stateful browser assertions are materially improved. Their preserved work should be corrected in place, not reverted.

The audit guarantee, closure predicate and cleanup guard still need the corrections above. Separate course-material findings in `../course-learning/course-learning-coordinator-review-20261004.md` remain a combined-integration gate; this review does not accept that handoff or certify production/capacity.

## Cleanup and preservation

Review project: `fayq-playback-coordinator-recheck-20261004`; task label: `fayq.task=playback-coordinator-recheck-20261004`. PostgreSQL used tmpfs; Redis used a separately inspected anonymous volume. No review host ports were published. The UI used `--network none`; Chromium joined only that UI container's namespace.

Before removing anything, `recheck-cleanup.mjs` inspected exact labels/config paths, service images, every resolved mount, the Redis volume's consumers, and the network's members. The first guard stopped safely because PostgreSQL tmpfs appears in HostConfig.Tmpfs rather than Mounts; after checking this exact configuration, the guard was corrected and rerun. Final cleanup: **containers=0, networks=0, volumes=0**, with the anonymous Redis volume explicitly checked absent. Images, source probes and other workers' evidence remain.

`node docker/ide/preview.mjs check` confirmed retained platform/DRM ownership and two volumes each. `http://localhost:8080` returned **200**. No outstanding review cleanup remains. Rollback is unnecessary for platform behavior because this review added only probes and reports; preserve these artifacts for repair verification.

Next assignment: [bounded remaining-corrections prompt](playback-recovery-second-repair-prompt-20261004.md).
