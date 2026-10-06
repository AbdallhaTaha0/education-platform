# DRM permanent media-deletion prerequisite — implementation report

Date: 2026-09-28. Owner-authorized bounded maintenance inside
`education-drm-service/` (nested Git HEAD `6135bf5` before work; accepted
revision `6e1e01c`). The final tree passed independent manager review and
Docker reproduction. Platform milestones 1–2 remain accepted and
untouched: the platform still consumes DRM solely through HTTP APIs — no
platform code touches DRM tables, keys, queues, or storage credentials, and
no M3 platform code was written.

## 1. Changed DRM files and migration

Migration: `packages/database/migrations/007_media_deletion.sql` (additive;
`media_assets.status` gains `DELETING`/`DELETE_FAILED`; new durable
`media_deletions` table with snapshots, state, attempts, error category,
timestamps; partial unique index for exactly one active operation per asset;
ownership/status indexes; `updated_at` trigger), plus additive
`008_media_deletion_reconcile_index.sql` (composite
`(status, updated_at, created_at)` index serving the reconciliation
eligible-set query; 007 untouched, so previously recorded applications stay
consistent).

New files:
- `packages/database/src/repositories/media-deletions.repository.ts` (CRUD +
  atomic state transitions)
- `packages/drm-core/src/storage-ownership.ts` (server-derived ownership rules)
- `packages/media-deletion/` (new workspace package: `deletion-processor.ts`,
  retry-safe 7-step cleanup with injectable storage for fault tests,
  `queue-delivery.ts` with the shared verified BullMQ handoff, and
  `reconciliation.ts` for durable outbox repair)
- `apps/api/src/services/media-deletion.service.ts` (request/status; durable
  accept with `scheduled` indicator, no rollback of committed state)
- `apps/worker/src/workers.ts` (single factory creating exactly one video +
  one deletion worker, startup + periodic reconciliation, idempotent
  shutdown closing workers, then both queues, then Redis/DB)
- `apps/api/src/index.ts` + both `queues/index.ts` (idempotent
  `shutdownQueues()` closing both Queue instances exactly once; API shutdown
  guarded the same way)
- `apps/api/src/tests/media-deletion.test.ts` and `config.test.ts` (unit),
  `media-deletion.integration.test.ts` (44 integration tests), and
  `vitest.deletion.config.ts`
- `docker/docker-compose.deletion-test.yml` (isolated verification stack)

Modified: `packages/{shared` (statuses, deletion types, confirmation/UUID
schemas), `drm-core` (storage interface + S3 paginated/batch prefix deletion
+ `NotImplemented` single-delete fallback), `database` (repo export, fixed
migrate entrypoint `dist/generate.js` and its migrations path — previously
migrations silently never applied, plus `target: runtime` pins in dev
compose so the new test stage cannot leak into serving images),
`apps/api` (DELETE route, status route, deletion queue, bounded numeric
`TRUST_PROXY` parsing, `confirmation` log redaction, api tsconfig reference,
test stage, devDependency for tests),
`apps/worker` (deletion queue with `shutdownQueues`, `workers.ts` factory
with exactly one video + one deletion worker and idempotent shutdown,
single `main().catch` in `index.ts`, processor moved to shared package),
`apps/api` (queue `shutdownQueues` + guarded shutdown), `tsconfig.json`,
`pnpm-lock.yaml`
(regenerated for the new workspace package; no new external dependencies).

## 2. Final contracts

- `DELETE /v1/media/:assetId` (app auth `X-Client-Id`/`X-Client-Secret`;
  body `{confirmation: <externalAssetId exact>}`) → `202
  {deletionId, assetId, externalAssetId, status, duplicate, scheduled}`. The
  DB transaction is the durable acceptance point (transition, session
  revocation, PENDING operation, audit). Every path — fresh, DELETING
  duplicate, and unique-index race loser — then attempts the same idempotent
  handoff (`ensureDeletionJob`, shared with the reconciler) using the
  deletion id as jobId, and `scheduled:true` is returned only when a runnable
  or already-delivered job is confirmed; otherwise the operation stays
  PENDING/RUNNING, the asset stays non-playable, and the response is still
  accepted `202` with `scheduled:false` — never a rollback (sessions cannot
  be un-revoked) and never a rejection implication. A `SAVEPOINT` isolates
  the insert so a unique violation cannot poison the transaction before the
  duplicate lookup. Errors: 400
  `INVALID_ASSET_ID`/`CONFIRMATION_MISMATCH`, 404 `ASSET_NOT_FOUND`,
  409 `DELETION_BUSY` (PROCESSING/TRANS/PACKAGING) / `INVALID_STATE`.
  Repeats while PENDING/RUNNING return the existing operation;
  `DELETE_FAILED` starts a fresh one.
- Worker startup + periodic (60s, env-bounded) reconciliation repairs the
  handoff. Eligibility lives in SQL: every PENDING row is always eligible,
  RUNNING rows only past the staleness cutoff (cutoff as query parameter),
  PENDING-first deterministic order, bounded batch — fresh RUNNING rows can
  never starve PENDING rows. PENDING ops without a live job are enqueued
  idempotently; stale RUNNING ops without a live job are recovered; live
  (active/waiting/delayed/paused) jobs are never duplicated or stolen. A
  retained terminal (completed/failed) job record is removed only after a
  re-check proves it is still terminal, then replaced; the replacement is
  verified runnable (waiting/delayed/active/paused/completed) before the
  operation is reported enqueued. Concurrent reconcilers and replicas
  converge on the deterministic jobId (duplicate adds collapse to one
  record). Terminal failure commits asset `DELETE_FAILED` + operation
  `FAILED` + failure audit in one transaction (completion was already
  transactional).
- `GET /v1/admin/media-deletions/:deletionId` → owning app's
  `{deletionId, assetId|null, externalAssetId, status, attempts,
  errorCategory, createdAt/updatedAt/startedAt/completedAt}`; 400 malformed,
  404 unknown-or-foreign (no cross-tenant signal).
- Queue `media-deletion` (attempts 5, exponential 10s backoff, job id =
  deletion id); worker concurrency 2; idempotent `shutdownQueues()` closes
  both Queue instances exactly once; shutdown order is workers, then queues,
  then Redis, then DB, on SIGTERM/SIGINT in both apps.
- Storage: `listKeysPage` (1000-key pages), `deleteKeys` (1000-key
  `DeleteObjects` batches, missing keys = success), `deletePrefix`
  (paginated, batched, verified-empty).

## 3. Object ownership and deletion invariants

Deletable locations are server-derived only: source key must equal the media
row's key inside `uploads/{applicationId}/` (single path segment);
packaged prefix must equal exactly `assets/{assetId}/` (UUID); variant keys
must equal database-owned `personalized_asset_variants` rows. Empty, root,
traversal, or mismatched prefixes are rejected before any storage call.
Sequence per job: lock/claim → validate → source → packaged prefix →
variants → verify empty → single DB transaction (delete asset with cascading
keys/sessions/licenses/jobs/watermarks/variants/revocations, complete
operation with snapshots, audit). DB metadata is never removed before
storage cleanup; absent objects are success; partial-batch errors surface;
playback is denied immediately at request time (status leaves READY +
all ACTIVE sessions revoked with revocation rows), independent of object
removal timing.

## 4. Commands, counts, images, results

```powershell
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml build
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml up -d --wait
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner
# Run the deletion command above a second time for stability.
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml down -v
```

| Suite | Result |
|---|---|
| Deletion integration run 1 (44 tests: lifecycle ×2 incl. double-signal shutdown, isolation, confirmation, state matrix, denial, deterministic concurrency+reconcile, revocation, source ±, nested, 1100 objects, variants, partial+retry, crash, outbox, duplicate-repair ×5 incl. unique-race, reconciliation ×8 incl. terminal replace/race/starvation, queue shutdown, cascade, scans) | PASS 44/44 |
| Deletion integration run 2, same fresh disposable project | PASS 44/44 |
| Unit default config (10 files incl. deletion and bounded proxy-hop tests) | PASS 38/38 |
| Existing integration / media / e2e configs | PASS 3/3, 3/3, 2/2 |
| Migration failure drill (bad DATABASE_URL → exit 1; dependents gated) | PASS |
| API/worker log secret scans + permissive-proxy validation scan | PASS, 0 hits |

Independent final images (`drm-deletion-final-*`): api
`0a6f913dd869`, worker `aea408f916f5`, migrate `0b00f19506b5`,
test-runner `1a24e4a9c2f6`
(postgres/valkey/seaweedfs pinned stock images, unchanged).

## 5. Required proofs

- **Worker lifecycle**: compiled `apps/worker/dist/index.js` contains
  exactly one `main().catch(`; a spawned worker process logs exactly one
  `DRM worker started`, exits 0 on SIGTERM, and logs exactly one
  `Shutting down worker` (idempotent close of both workers, both queues,
  Redis, DB); closely spaced SIGTERM/SIGINT also exits 0 with one shutdown
  log and no hang.
- **Retained terminal replacement**: stale RUNNING + retained failed job
  (forced via real worker + poisoned failure audit + attempts:1) is
  replaced and reaches COMPLETED exactly once; stale RUNNING and PENDING
  with retained completed jobs (real completions + resurrected fixtures)
  are replaced and reach COMPLETED with storage verified empty.
- **Race convergence**: reconcile racing a direct add, and three concurrent
  reconciles, each leave exactly one job record and one effective
  execution (single completion audit).
- **Deterministic request concurrency**: ten concurrent service requests
  use the explicit delivery seam to hold queue delivery, converge on one
  PENDING operation (one fresh + nine duplicates, all `scheduled:false`),
  then one real shared handoff reaches COMPLETED with one completion audit
  and empty owned storage. This replaces the unreliable assumption that a
  global BullMQ pause is a barrier for a worker already blocked for work.
- **No starvation**: 4 fresh RUNNING rows plus 2 PENDING rows with
  batchLimit 3 reconciles both PENDING rows on the first pass
  (`checked=2`); leftovers recover cleanly afterward.
- **Queue shutdown**: repeated `shutdownQueues()` is a safe no-op, resets
  for re-init, and a re-initialized module completes a real deletion.
- **Duplicate-request delivery repair**: a repeat after a failed enqueue
  returns `duplicate:true, scheduled:true` for the same operation and
  completes with no reconciler call (single op row, single job); a repeat
  while scheduling still fails returns `duplicate:true, scheduled:false`;
  the unique-index race path (forced via a pre-existing PENDING row) agrees
  on one scheduled operation — this also fixed a latent defect where the
  `23505` handler queried on a poisoned transaction (silent 500), now
  isolated with `SAVEPOINT deletion_insert`; live jobs are preserved
  untouched on repeat (same record, same state); retained terminal records
  cannot fake `scheduled:true` (failed-record path proven end to end to
  `COMPLETED`).
- **Durable outbox**: enqueue failure returns accepted `202 PENDING`
  `scheduled:false` with asset kept `DELETING` (playback still denied);
  startup-path reconciliation then enqueues the orphan to `COMPLETED`;
  later passes handle post-startup orphans; live jobs are never duplicated
  (repeated reconciles, one job); stale `RUNNING` without a job is
  recovered while fresh `RUNNING` is left alone; concurrent API bursts plus
  concurrent reconciles still yield one operation and one job.
- **Terminal atomicity**: forced terminal failure shows asset
  `DELETE_FAILED` + operation `FAILED` + category together with the
  `MEDIA_DELETION_FAILED` audit row (single transaction).
- **>1,000 objects**: 1100 segments uploaded, worker log
  `packagedDeleted: 1100`, prefix verified empty, COMPLETED.
- **Concurrency**: 10 parallel DELETEs (queue paused) → one 202 id, one DB
  row; BullMQ job id = deletion id prevents duplicate work.
- **Tenant isolation**: missing/wrong credentials 401; cross-app DELETE and
  status read 404 with no information leak.
- **Failure/retry**: terminal stub failure → `FAILED`/`DELETE_FAILED`,
  metadata preserved, safe status, HTTP retry → new op → COMPLETED;
  transient failure throws without terminal state; crash-after-storage
  simulation (verify-phase fault) → retry completes DB cleanup, row gone.
- **Playback denial**: pre-delete heartbeat 200; post-transition new
  sessions 409, heartbeat/renew/license/manifest/range denied; denial holds
  after COMPLETED.
- **Cascade**: post-COMPLETED, media/keys/jobs/sessions/license-events/
  watermarks/variants/revocations all empty; deletion row retained
  (`media_asset_id` NULL, id snapshots) plus REQUESTED/COMPLETED audits.
- **Secret scans**: API/worker logs contain IDs/counts only (0 hits for
  storage secrets, signatures, private keys, client secrets, tokens);
  `confirmation` added to logger redaction; image histories clean.
- **Proxy validation**: the disposable stack uses exactly one trusted proxy
  hop instead of trust-all; parser tests cover disabled, bounded numeric,
  trusted-address, negative, fractional and excessive values. API logs
  contain zero `ERR_ERL_PERMISSIVE_TRUST_PROXY` occurrences.
- **Live Cloudflare R2 deletion: BLOCKED — credentials unavailable.** All
  object-removal proof ran against local SeaweedFS S3-compatible storage in
  Docker. The provider uses only R2-compatible S3 APIs (`ListObjectsV2`,
  `DeleteObjects`, single delete fallback), so the same code runs against R2
  with real environment configuration; no R2 call was made and no mock is
  presented as R2 proof.

## 6. Before/after Git state and remaining risks

Before: nested repo clean at `6135bf5`. The accepted change adds the worker
factory, reconciliation/delivery modules, migrations 007–008, API contracts,
storage cleanup and Docker verification. No platform application code was changed; the platform-level
implementation report is the worker's only intended change outside the
nested DRM repository, while other manager documentation changes were
pre-existing. Platform dev stack (`docker-*`, healthy, `ready`) untouched
with its data intact.

Risks/notes: (a) SeaweedFS stands in for R2 — re-run the >1000-object and
variant proofs against R2 when credentials exist; (b) the repaired migrate
entrypoint now actually applies migrations in dev (previously a silent
no-op) — intended, idempotent, additive-only; (c) terminal-failure policy
consumes BullMQ attempts via API retry rather than endless worker retries;
(d) no production/Widevine/10k-user claims. Rollback/recovery: stop
workers, redeploy the previous images (`6135bf5` tree); migrations 007 and
008 are already recorded and become no-ops on redeployment. They add a
table, extend one CHECK, and create indexes only; no data rewrite or
destructive rollback is implemented. A stuck `RUNNING` op (worker loss) is recoverable through the
same DELETE contract after terminal marking, or a fresh op once the asset
reaches `DELETE_FAILED`; PENDING/RUNNING rows never block new deletions
after terminal states.
