# Course materials and both-repository delivery

2026-10-04, Africa/Cairo. The owner explicitly instructed the coordinator to finish the pending work, commit/push, report, then shut down the laptop, and subsequently clarified **push both DRM and platform**. This supersedes the previous instruction to preserve unfinished materials outside the platform delivery. Existing bounded DRM recovery is delivered; no new DRM implementation or production deployment is authorized by this follow-up.

## Delivered website behavior

- Course curriculum/progress, lesson search and truthful processed-duration labels, with unknown durations remaining unknown. The real provider's `duration` field is normalized without changing its API.
- ADMIN can upload an atomic Arabic/English WebVTT pair, replace/remove it, and upload/remove protected resources. Existing captions survive failed replacements. Validation and errors preserve form values.
- Students can select Arabic, English or Off captions inside the full player frame, including native fullscreen. Lesson changes/access loss revoke Blob URLs and discard stale responses. Downloads pass through authenticated entitlement checks; no public storage keys/URLs or browser credentials.
- Playback recovery, ADMIN device management, explicit own-session recovery, actionable bilingual playback errors and full-frame controls remain as delivered in [the prior platform report](completed-work-and-playback-delivery-20261004.md).
- Previously delivered IDE polish keeps code left in Arabic/English, the JavaScript identity/colors and green Run action. Website-wide disabled actions explain their reasons for STUDENT and ADMIN.
- Real browser visual review caught a duplicate assignments section caused by adjacent duplicate React keys. Distinct resource keys and an exactly-one-section regression correct it.

The retained demo on **http://localhost:8080** is updated. Use the existing assigned student account, open the learning demo course, and try the first lesson's **20-second real recording**, Arabic/English test captions, fullscreen and **Demo notes** download. Existing quiz and assignments remain available according to existing progression; no owner pass/submission was fabricated. Captions are explicitly demonstration text, not a teaching transcript. No new videos were uploaded or existing recordings replaced during this final integration.

## Coordinator findings closed

The ten backend and three frontend findings in [the materials review](../course-learning/course-learning-coordinator-review-20261004.md), plus its typecheck/harness failures, are corrected:

| Finding | Final correction and evidence |
|---|---|
| Wrong ADMIN mount/read guards | Independent `/admin/learning` router; cookie ADMIN reads; Origin/CSRF mutations. Real HTTP and UI authoring pass. |
| JSON/base64 vs multipart mismatch | Bounded native multipart parser for exact fields, repeated/unknown parts rejected, pre-body guards, 30-second body timeout. |
| Missing/non-additive migration | Two deployable additive migrations; original string identifiers/index names preserved; fresh, populated and repeated migration gates pass. |
| Broken S3 signing/byte corruption | SigV4 uses actual bucket/path, signed date/hash headers and exact byte buffers; genuine private MinIO Arabic VTT, PDF/ZIP bytes round-trip. |
| Caption uniqueness/replacement | Atomic delete/create plus durable old-object cleanup; repeated replacement and failure preservation tested on real PostgreSQL. |
| Lost cleanup on removal/crash | Durable object-intent ledger created before PUT, independent of cascading metadata; transactional DELETE triggers, bounded fair retry, crash grace. |
| Storage-key leak | Explicit public DTOs, no keys/credentials/provider URLs in replies. |
| Deletion/upload races | Existing course row lock and deletion/archive fence at reservation/publication/removal; concurrency regressions pass. |
| Ignored duration | Actual external `duration` normalized; real uploaded recording status/outline/UI show 20 seconds. |
| MIME-only/resource validation | Bounded filename/runtime validation and content/type checks; ZIP remains opaque, never extracted/executed. |
| Error mapping/filenames | Contracted MATERIAL errors; read/mutation distinction; RFC5987 Arabic filenames and safe malformed decode fallback. |
| Auth error class mismatch | Normalize auth API errors at materials boundary. |
| Stale lesson/URLs/loading | Lesson-bound rendered state, cancellation and access-loss cleanup for captions/resources. |
| CRLF rejection | Arabic CRLF WebVTT accepted server/client and actually displayed by the real browser. |
| Broken harness/type fixtures | Runnable JavaScript orchestrator, Docker-only jobs, corrected fixtures and inspected cleanup guards. |

## Architecture, migration and configuration

One Express application, exactly STUDENT/ADMIN, platform PostgreSQL/Prisma/Redis and external API-only DRM remain intact. Every student list/byte request checks course publication/removal, subscription/expiry and lesson progression. Archive preserves objects. Materials never query external DRM persistence.

Additive migrations:

1. `20261004010541_playback_recovery_materials_sync`: nullable processed duration, caption state/table and resource table, matching existing string IDs.
2. `20261004030000_material_object_lifecycle`: platform-owned `MaterialObject` ledger, PENDING/LIVE/DELETE state constraint/index, existing-object backfill and delete triggers surviving permanent lesson/section/course cascades.

Separate cleanup and expiry timers prevent slow storage delaying expiry enforcement. Cleanup is single-flight per replica with row locks/SKIP LOCKED; failed keys rotate fairly. Abandoned PENDING uploads become eligible after one hour, longer than bounded upload requests. Durable retries are not an exactly-once guarantee; object absence is idempotent. Metadata success does not require synchronous deletion of old bytes.

Server-only settings: `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET` (all-or-none); `STORAGE_REQUEST_TIMEOUT_MS` defaults 5000, bounded 250–30000; `STORAGE_MAX_RETRIES` defaults 2, bounded 0–3. Production endpoint requires HTTPS. Provider credentials never use a VITE prefix. Captions: 1 MiB each; resources: 10 MiB. Edge accepts 11 MiB for multipart overhead; backend enforces exact material limits.

Private local storage is an independent **local fixture**, built from pinned official MinIO source `RELEASE.2025-04-22T22-12-26Z` because the previous public image could not be pulled. No host port is published. Persistent owner-local project `fayq-local-materials` uses external volume `fayq-local-materials-objects` and network `fayq-local-materials`, ownership label `fayq.owner=local-materials`; platform server joins that network. Credentials stay in ignored root `.env`. This fixture is not a production object-storage selection/security qualification. Production R2/provider provisioning is outside this delivery.

Signing reference: [AWS S3 SigV4](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sig-v4-header-based-auth.html). Fixture source: [official MinIO repository](https://github.com/minio/minio).

## Verification actually completed

| Gate | Result |
|---|---|
| Server Docker image/typecheck | PASS |
| Server unit suite | **230/230** |
| Real PostgreSQL/Redis/MinIO HTTP integration | **73/73**: 22 materials, 28 learning playback, 19 recovery, 4 database regressions |
| Fresh/populated baseline/repeated migrations | PASS; existing string IDs and row fingerprints preserved |
| Final client Docker typecheck | PASS |
| Final client tests | **115/115** Vitest plus **2/2** dash.js patch tests |
| Production server/migrate/client/Nginx images | Build PASS |
| Real combined browser integration | **19/19**, no endpoint/player/material doubles |
| Existing bounded DRM recovery Docker gates | **11/11** real recovery integration plus **51/51** API unit tests |
| Retained owner-preview upgrade | PASS; protected pg_dump, repeated migrate, **14 table fingerprints preserved** |
| Demo provisioning preservation | PASS; wallets/purchases/subscriptions/progress/passes/submissions/preserved unlocks unchanged |
| Retained preview readiness | **200**, platform/external DRM retained-volume guards pass |

The combined browser gate uses actual cookie login, multipart uploads, private object bytes, DRM grants/licenses and an existing encrypted uploaded asset. Real video time advances, native cue loading displays Arabic CRLF/English LF cues, fullscreen contains caption controls, Off removes tracks, resource bytes match and Arabic mobile layout has no overflow. It uses a bounded transport proxy to preserve the DRM's already-configured localhost:8080 origin while routing only this browser to the isolated platform; browser security is not disabled. Headless Escape is attempted, with native fullscreen-exit API fallback; this gate does not newly certify OS Escape behavior. Previous mocked 33-check materials and 52-check recovery harness evidence remains historical, clearly distinct from these 19 real integration checks. No capacity, commercial DRM or production qualification is claimed.

All disposable backend, integrated-browser and DRM projects were inspected against exact labels/images/resolved mounts before removal. Final counts are **containers=0, networks=0, volumes=0** for each, and every mounted test volume is individually verified absent. Browser-owned external playback/device registrations were reconciled before discarding its platform fixture. Existing preview, DRM data, reusable images and evidence remain preserved. No global prune.

Reproduction commands from repository root (Docker images must first be built using the matching Dockerfiles):

```powershell
node docker/course-learning-backend/run-tests.mjs
docker run --rm fayq-materials-final-client-test:20261004 sh -c "npm run typecheck && npm test"
node docker/course-learning-backend/ui-run.mjs
node docker/drm-delivery/run.mjs
node docker/ide/preview.mjs check
```

Private logs/screenshots/backups live under ignored `docker/browser/evidence/`; no credentials, login fixtures or raw database dumps are committed. Actual final logs: `materials-final-gate-complete.log`, `materials-client-final-pass.log`, `materials-ui-gate-key-fix.log`, `drm-delivery-gate-rerun.log`, `materials-preview-upgrade.log`. Earlier failed attempts remain retained as diagnostics; initial fixture failures, unavailable public storage images and the wrong-origin playback failure were corrected before final gates. A later test command added a nonexistent extra Codemirror test filename after the complete client suite; the corrected final command exits successfully and runs the two existing dash.js tests plus all 115 unit tests.

## Delivery and recovery

External repository `AliIbrahim3600/education-drm-service`, main: **dd66be36fd817af694236fa8846582251c961f90**, commit `feat: add tenant-scoped inactive device recovery with audited release`, pushed and remote SHA independently verified. Only pre-existing bounded recovery files were committed; no new nested edits were made for materials. Platform main includes the matching gitlink and this completed materials integration; its final commit/push is the commit containing this report. Existing preceding platform delivery is `f20660117d6f7e543164fca2034c7a733b42f25d`.

Local upgrade ran `node docker/course-learning-backend/preview.mjs upgrade`. It refuses replacement of existing storage settings; do not rerun it blindly. A protected pre-migration `PGDMP` backup, old runtime image IDs and final upgrade receipt are in ignored `docker/browser/evidence/materials-preview/`. Revert runtime image tags using that manifest if needed; additive columns/tables may remain for rollback. Preserve the object volume and pending ledger. Database restoration is an explicit recovery operation, never an automatic code rollback, and must account for newer owner activity.

After laptop restart Docker's retained services restart automatically. If manual startup is needed, start materials storage first, then the established preview:

```powershell
docker compose --env-file .env -p fayq-local-materials -f docker/course-learning-backend/compose.local-storage.yml up -d --wait
node docker/local-preview.mjs up
```

Owner-authorized shutdown is performed only after both remote commits and final readiness/cleanup are verified, without forcing unsaved applications closed. No milestone acceptance, production deployment, limit increase, external persistence coupling or new DRM maintenance is inferred.
