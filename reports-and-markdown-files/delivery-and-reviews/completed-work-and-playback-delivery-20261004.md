# Completed website work and playback delivery — 2026-10-04

**Later follow-up:** Pending materials were correctly excluded from this earlier delivery. The owner subsequently authorized finishing them and pushing both repositories; [the separate final report](course-materials-and-dual-repository-delivery-20261004.md) records that integration.

The owner instructed the coordinator to repair remaining playback bugs directly, then commit, push and report the completed work. This delivery includes verified platform recovery and the previously completed website UX. It preserves unfinished course-material changes in the working tree and does not deploy or update localhost:8080.

## What we completed

- **Course viewing:** protected curriculum and learning progress on offer/learning pages; expandable sections, Arabic/English lesson-title search, direct lesson navigation, previous/next lesson guidance and a visible course-plan action on mobile. Search never starts playback or changes progress/access. Duration formatting is included, but the delivered backend does not yet provide processed durations: unknown durations stay unknown.
- **Fullscreen and playback:** whole-player native fullscreen with expanded-mode fallback, watermark retained, a single accessible in-frame Play/Pause/Resume control, gesture guidance, supported-media guidance and stale-promise protection. Browser tab hiding does not terminate playback. Page exit closes only this page's grant; external closure remains backed by existing durable retry.
- **Student recovery:** own bounded blocker-first session list, explicit session selection/end, honest CONFIRMED/QUEUED/NOOP outcomes, status checking, no restart on null/FAILED/PENDING/missing/unavailable state, and an explicit restart action after confirmation.
- **ADMIN devices:** protected per-student inspection, honest truncated counts, inactive ACTIVE-only release, preserved active playback and REVOKED bans, explicit uncertain-result handling and controls disabled while reconciling.
- **Durable release audit:** pre-call intent, per-student transactional row lock, intent/outcome correlation, originating ADMIN attribution with separate reconciliation actor, atomic deduplication, refusals and recoverable timeout/write failures. No exactly-once external execution claim.
- **IDE:** code stays on the left in Arabic/English, green Run control, JavaScript logo/yellow identity and preserved language/layout behavior.
- **Disabled actions:** bilingual reasons across student and ADMIN forms, navigation, assessments, wallet, catalog and playback; native disabling and backend enforcement stay intact.
- **Demo/testing:** previously created original uploaded test videos, quiz, required/optional assignments and selected synthetic student's testing guide remain available on the retained preview. No account progress, passes, wallet or existing courses were reset by this delivery. See the earlier demo report for its real-vs-browser verification limits.

## Bugs the coordinator fixed directly

1. **Pending audit starvation after 100 historical requests.** The worker's oldest-first bounded scan restarted at the beginning every call; 130 completed request/outcome pairs hid newer pending work permanently. PostgreSQL now filters completed history before bounding pending results. Complete device inspection then excludes still-present references before selecting absent candidates, so old uncertain devices cannot hide recoverable absent references. Batch counts remain explicitly partial.
2. **A real database error turned an applied release into a generic failure.** Catching an INSERT error inside a PostgreSQL transaction left that transaction aborted; the following pending-state read failed with SQLSTATE 25P02. Outcome errors now escape the transaction, roll back, and are handled outside it. The committed intent remains recoverable and the response reports `released:true, auditPending:true`. The same handling preserves safe refusal messages and idempotent retry recovery.
3. **Player rejection handling stopped after React StrictMode setup replay.** Cleanup set a mounted flag false, but repeated setup never restored it. Setup now restores that flag; changing grants clears old gesture/error notices, while late promises from previous grants remain ignored.
4. **Harness cleanup gaps.** Browser runners now receive the exact service label their removal guard expects. Every mounted volume is inspected even if absent from the project-labelled inventory. Post-removal absence requires a successful inventory rather than treating any failed inspect as proof of deletion. Guard tests run in Docker. Coordinator projects, images and evidence can be named independently without overwriting worker evidence.

Meaningful regressions are retained in `server/tests/integration/device-release-recovery-regressions.test.ts` and the isolated actual-player `strict-player-*` probes. Two database regressions failed against the pre-repair image; the StrictMode gesture probe also failed before repair. All pass after repair. Historical defect probes remain as evidence; they deliberately assert old defective behavior and are not acceptance tests for the repaired product.

## Independent verification

| Verified source | Results |
| --- | --- |
| Full working tree, including pending materials | Docker builds/typechecks; 225 server and 114 client unit tests; 19 recovery + 28 learning-playback integration checks; four coordinator real-database regressions; 52 browser recovery checks. Materials unit passing does not close the separate materials review. |
| Exact reviewed commit tree, exported before committing | Docker server/frontend builds and both typechecks; **196 server + 111 client unit tests**, two DASH compatibility checks, **10 cleanup guard tests**, **19 recovery + 4 real-database regressions + 28 learning-playback integration checks**, **52 browser recovery checks**. `ALL CHECKS PASSED`. |
| Actual player under development StrictMode | **4/4**: gesture rejection after setup replay, old notice cleared on grant change, stale rejection ignored, unsupported-media callback classified correctly. Fake grants/media only. |

The exact commit deliberately excludes unfinished materials tests and wiring, explaining its lower unit counts. Its browser suite explicitly asserts that pending materials UI is absent; it does not count absence as caption support. The full-workspace suite separately requires caption controls in the frame.

Browser recovery uses real cookie auth, platform outline/progress/directory APIs and navigation. Playback grants/media, device results and selected recovery responses are explicitly mocked in that browser harness. Real PostgreSQL/API integration uses the labelled external HTTP fixture. No new real-provider advancing-time playback, production security certification, load qualification or milestone acceptance is claimed.

Actual retained command evidence:

```text
docker build -f server/Dockerfile --target test -t fayq-playback-coordinator-third-server:20261004 .
docker compose -p fayq-playback-coordinator-recheck-20261004 -f docker/playback-coordinator-review/recheck.compose.yml up -d --wait
docker run ... npx prisma migrate deploy
docker run ... npx vitest run tests/integration/device-release-recovery-regressions.test.ts
node docker/playback-coordinator-review/recheck-cleanup.mjs
node docker/playback-coordinator-review/prepare-delivery.mjs
node docker/playback-recovery-review/run.mjs
node docker/ide/preview.mjs check
```

The full harness ran with unique `PLAYBACK_RECOVERY_*` project/image/evidence overrides: `fayq-playback-coordinator-third-{api,ui}-20261004` for the full tree, and `fayq-playback-delivery-{api,ui}-20261004` from the exported commit. Full command/output logs are retained in ignored `docker/browser/evidence/playback-coordinator-third-run.log` and `playback-delivery-run.log`. They contain synthetic fixture configuration only; private account fixtures, cookies, bearer tokens, signed URLs and owner env files are excluded from Git.

## Commit contents and preserved unfinished work

Completed files cover client course/IDE/disabled-action/recovery modules, platform device/session APIs and DRM adapter additions, their tests, isolated review tooling, prior screenshots and reports. Shared files were staged with reviewed content while their other worker changes remain untouched in the working tree. The staged tree was exported and built/tested independently, preventing hidden reliance on excluded working files.

The following remain **outside this commit**: materials storage/config/schema/migration, processed-duration synchronization, material routes/access/DTO additions, ADMIN caption/resource authoring, student materials fetching/downloading, materials unit/integration suites and their Docker harnesses. The separate `../course-learning/course-learning-coordinator-review-20261004.md` still governs those corrections. Captions/resources and true processed durations need that combined repair/integration gate before being enabled in the delivered tree. Existing API error names or optional presentation props are harmless forward-compatible declarations, not enabled materials functionality.

The nested `education-drm-service` working tree and submodule pointer are preserved unchanged by this delivery. Its earlier bounded maintenance remains a separate repository responsibility. No new platform migration or storage configuration is required for the delivered recovery changes; AuditEvent stores durability. The pending synchronization migration was applied only in full-tree disposable verification, never to owner data and never included as a reviewed migration.

## Cleanup and retained website

Every review project was inspected against exact configuration, labels, images and resolved mounts before removal. Project network membership and volume identities were checked; the coordinator DB probe also checked its anonymous Redis volume's consumers and explicit absence. The StrictMode container had two exact read-only fixture binds and no network or volumes.

Final disposable state: **containers=0, networks=0, volumes=0**, including all mounted/anonymous volumes. Only exact synthetic fixture files were removed. Source probes, logs, screenshots, reusable images, other workers and owner platform/DRM data remain. No global prune.

The retained preview ownership guard preserves two platform volumes and two DRM volumes; localhost:8080 remains HTTP 200. This commit/push changes repository history only. It does not update the retained website or grant production approval.

## Delivery and rollback

Delivery target is the existing `main` branch at the configured GitHub origin, following explicit owner commit/push authorization. The final response records the resulting commit and confirmed remote synchronization. No force push or history rewrite is used. An upstream change would be handled before delivery without discarding pending local work.

Rollback of delivered behavior uses a normal revert/rebuild after preserving the remaining working tree; no database rollback is needed because this commit adds no migration. Reverting does not restore externally released registrations. Historical reports describe their original checkpoints; this report and the README entry describe the current delivery and verification limits.
