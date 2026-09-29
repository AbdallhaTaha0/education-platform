# DRM upload-URL recovery prerequisite — implementation report

Post-acceptance checkpoint (2026-09-29): the manager committed the combined
accepted DRM recovery and job-status work locally as `5293917`. The historical
worker-state descriptions below intentionally preserve the uncommitted review
state. Nothing was pushed or deployed.

Date: 2026-09-29. Owner-authorized bounded maintenance inside
`education-drm-service/` under decision D20. All changes are left uncommitted
for independent manager review. Nothing was committed, pushed, deployed, or
turned into a PR, no paid resource was provisioned, and no platform
development volume was removed.

No platform application code was written. The platform repository's existing
uncommitted M3 work is untouched, the platform still consumes DRM only through
HTTP APIs, and the platform development stack
(`docker-nginx/client/server/postgres/redis`, volumes `docker_pgdata`,
`docker_redisdata`, `docker_seaweeddata`) stayed healthy throughout. The only
change at the platform repository level is this report.

This report claims no production readiness, no M3 acceptance, and no
10,000-user capacity.

**Independent manager correction (2026-09-29):** after the separately
authorized `updateJobStatus` repair made the real worker reach `READY`
quickly, a fresh manager run exposed a timing-dependent assertion in
`media-upload-recovery-lifecycle.integration.test.ts`: the suite reported
37/38 because it expected playback creation to return 409 even though the
same disposable database showed the asset was legitimately `READY`, where
201 is correct. The test was corrected without production-code changes: it
still proves a stale URL cannot reopen completion, obtain another recovery
URL, or create another job, then uses bounded state polling to require
`READY` before expecting playback success. A freshly rebuilt Docker image
passed the recovery suite 38/38 twice consecutively, processing 7/7,
deletion 44/44, unit 48/48, integration 3/3, media 3/3, end-to-end 2/2, and
typecheck. Manager correction images: api `f6f87be55839`, worker
`52ab168b477e`, migrate `125dbad256b2`, test runner `47f76bec68a1`. The
failed 37/38 manager run is retained here as review history, not hidden.

## 1. Git state

| Repository | Starting revision | Ending revision | Working tree |
| --- | --- | --- | --- |
| Platform (`education-platform`) | `bad064f` (`docs: accept DRM deletion prerequisite`) | `bad064f`, unchanged | Still carries the pre-existing uncommitted M3 work; this report is the only addition |
| Nested DRM (`education-drm-service/`) | `6e1e01c` (`feat: add durable media deletion`) | `6e1e01c`, unchanged | 9 modified + 8 new untracked files, all uncommitted |

The platform tracks the nested package as a gitlink (`160000
6e1e01c09d4f5a8e6827750d2430321d5acf8827`). Because the nested work is
uncommitted, the platform shows ` M education-drm-service`. That is the
expected state for a hand-off: the manager reviews the nested diff first, then
decides whether to commit inside the nested repository and bump the gitlink.

Nested working tree after the change:

```
 M README.md
 M apps/api/package.json
 M apps/api/src/modules/media/routes.ts
 M apps/api/src/services/upload.service.ts
 M apps/api/vitest.config.ts
 M docker/docker-compose.deletion-test.yml
 M package.json
 M packages/database/src/repositories/media.repository.ts
 M packages/drm-core/src/providers/s3-storage.provider.ts
?? apps/api/src/services/upload-recovery.service.ts
?? apps/api/src/tests/media-upload-recovery-isolation.integration.test.ts
?? apps/api/src/tests/media-upload-recovery-lifecycle.integration.test.ts
?? apps/api/src/tests/media-upload-recovery-state.integration.test.ts
?? apps/api/src/tests/media-upload-recovery.integration.test.ts
?? apps/api/src/tests/media-upload-recovery.test.ts
?? apps/api/src/tests/upload-recovery-source-fixture.ts
?? apps/api/src/tests/upload-recovery.harness.ts
?? apps/api/vitest.upload-recovery.config.ts

 9 files changed, 220 insertions(+), 18 deletions(-)
```

## 2. Changed DRM files and migration impact

New production code
- `apps/api/src/services/upload-recovery.service.ts` (153 lines) — the whole
  recovery decision: state predicate, content-type revalidation, the
  snapshot → sign → verify ordering, the stable conflict code, and the signer
  seam. One responsibility, no god file.
- `packages/database/src/repositories/media.repository.ts` (+72 lines) —
  `findUploadRecoverySnapshot` and `uploadRecoverySnapshotCurrent` next to the
  existing media repository functions.

Modified production code
- `apps/api/src/services/upload.service.ts` (147 lines) — the idempotent branch
  now delegates to the recovery service instead of its own inline
  `SELECT id, status`; the local `UPLOAD_URL_TTL` const is replaced by the
  shared `UPLOAD_URL_TTL_SECONDS` so the lifetime has one source of truth.
  `completeProtectedUpload` is **not** changed.
- `apps/api/src/modules/media/routes.ts` (+18 lines, documentation only) — the
  request/response/error contract is now written down at the route. No handler
  logic changed; the route already returned `202` for both branches.
- `packages/drm-core/src/providers/s3-storage.provider.ts` (+8 lines) — the
  presigned-URL repair described in section 3.
- `README.md` — the retry contract and the disposable verification commands.

Tests and verification wiring
- `apps/api/src/tests/media-upload-recovery.test.ts` (124) — unit contract.
- `apps/api/src/tests/media-upload-recovery.integration.test.ts` (211) —
  registration, idempotent retry, concurrency, request identity.
- `apps/api/src/tests/media-upload-recovery-state.integration.test.ts` (231) —
  state matrix and transaction/external-I/O ordering.
- `apps/api/src/tests/media-upload-recovery-isolation.integration.test.ts`
  (191) — tenant isolation, authentication/validation, secret containment.
- `apps/api/src/tests/media-upload-recovery-lifecycle.integration.test.ts`
  (253) — lost response, recovered PUT, completion, stale-URL safety, expiry.
- `apps/api/src/tests/upload-recovery.harness.ts` (259) — shared disposable
  harness: HTTP client, tenant/asset factories, real S3-compatible provider,
  Redis and table dumps.
- `apps/api/src/tests/upload-recovery-source-fixture.ts` (102) — a real 1s
  H.264/AAC MP4 embedded as base64, generated with the worker's own FFmpeg.
- `apps/api/vitest.upload-recovery.config.ts` (16) — suite entry point.
- `apps/api/vitest.config.ts` (+4) — the four integration files are excluded
  from the default unit run, as the deletion and scaffold suites already are.
- `apps/api/package.json`, `package.json` (+1 each) — `test:upload-recovery`
  script at the package and workspace root.
- `docker/docker-compose.deletion-test.yml` (+43) — the existing disposable
  topology is reused unchanged. The two runners moved into a `verify` profile
  and now share one image (`drm-verification-test-runner:local`); a new
  `recovery-runner` service runs the recovery suite. No service, image, port,
  volume, or environment value of the existing stack was changed, so the
  previously accepted deletion verification commands still work.

**Migration impact: none.** No new migration was needed. `media_assets` already
carries `asset_version` (migration 001, re-asserted in 002) which no code wrote;
recovery now reads it as an optimistic-concurrency token. The
`media_deletions` table from accepted migration 007 supplies the pending/running
deletion check. Nothing is written by recovery, so no migration rollback story
is required. `packages/database/migrations/` is unchanged.

**Configuration impact:** none. No new environment variable. The upload-URL
lifetime stays the existing hard-coded 3600s, now referenced from one constant.

## 3. Pre-existing blocking defect that had to be repaired first

Reproduced against the real local S3-compatible provider using the
**no-idempotency-key first-registration** path, which this assignment does not
touch: the `uploadUrl` that `POST /v1/media` returns for a brand-new asset
cannot be used for a plain `PUT`. The presigned URL carried

```
…&X-Amz-SignedHeaders=host&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject
```

and the upload was rejected:

```
PUT -> 400 <Code>BadDigest</Code><Message>The Content-Md5 you specified did not match what we received.
```

Supplying the matching `x-amz-checksum-crc32` header instead produced
`403 SignatureDoesNotMatch`, because that header is not part of
`X-Amz-SignedHeaders=host`. The cause is the AWS SDK default
`requestChecksumCalculation: WHEN_SUPPORTED` in `@aws-sdk/client-s3@3.1141.0`,
which hoists a placeholder checksum into the presigned query string. Every
presigned PUT URL this package has ever issued is affected, and no existing
suite caught it because the accepted deletion suite uploads fixtures through
`uploadObject` and never through a presigned URL.

This made the authorized objective impossible to deliver: the required
deliverable is a *usable* recovered upload URL, and the required test "PUT the
original through the recovered URL and complete the existing asset normally"
cannot pass while every presigned URL is broken. The repair is one client
configuration flag on the existing S3 adapter, with the rationale in a comment:

```ts
requestChecksumCalculation: "WHEN_REQUIRED",
```

It changes no endpoint, bucket, credential handling, key derivation, provider
selection, or deletion/playback behaviour — only the automatic checksum
behaviour of the S3 client. The accepted 44/44 deletion suite still passes
unchanged. This is flagged prominently for the manager because it is a change
inside `packages/drm-core`, which the worker prompt's wording ("do not change
storage providers") could be read as excluding. The worker's judgement is that
leaving a provably unusable presigned URL in place would have failed the
assignment's own success criteria — the deliverable is a *usable* URL — and
that the manager should confirm or reject this single flag on review.

## 4. Final request, response, state and concurrency contract

Authentication is unchanged: `X-Client-Id` / `X-Client-Secret`, 401 missing or
invalid, 403 non-`ACTIVE` application, `applicationId` always taken from the
authenticated application and never from the body.

`POST /v1/media` — request (validated by the existing `registerMediaSchema`):
`{ externalAssetId: 1..255 chars, title?: <=255, contentType: "video/mp4" |
"video/webm" | "video/quicktime", securityTier?: STANDARD|PREMIUM|TRACEABLE,
idempotencyKey?: <=64 }`.

| Case | Status | Body |
| --- | --- | --- |
| First registration | 202 | `{ assetId, status, uploadUrl, uploadKey, processingJobId, idempotent: false }` |
| Idempotent repeat, asset still `UPLOADED` | 202 | `{ assetId, status, idempotent: true, uploadUrl }` |
| Idempotent repeat, asset in any other state | 409 | `{ error, code: "UPLOAD_RECOVERY_NOT_ALLOWED" }` |
| Idempotent repeat, deletion `PENDING`/`RUNNING` | 409 | `{ error, code: "UPLOAD_RECOVERY_NOT_ALLOWED" }` |
| Schema violation | 400 | `{ error: "Validation failed", details: [...] }` |
| Missing/invalid credentials | 401 | `{ error }` |
| Non-`ACTIVE` application | 403 | `{ error }` |

Contract points
- **Matching** is by `(application_id, external_asset_id)` — the owning
  application *and* the stable external asset identity used by the current
  idempotency behaviour. The `idempotencyKey` value is not stored or compared
  (unchanged pre-existing semantics): any key value converges on the same
  asset. Another application registering the same `externalAssetId` gets its own
  asset and never sees the owner's.
- **Response shape.** The recovery body has exactly `assetId`, `status`,
  `idempotent: true`, `uploadUrl`. It never returns `uploadKey`,
  `processingJobId`, a source key as data, credentials, signing inputs, or a
  stack trace. The presigned URL necessarily encodes its own object key, exactly
  as the first-registration URL already does.
- **Eligibility.** A URL is issued only while `status = 'UPLOADED'` and no
  `media_deletions` row for the asset is `PENDING` or `RUNNING`. `PROCESSING`,
  `TRANSCODING`, `PACKAGING`, `READY`, `FAILED`, `DELETING`, `DELETE_FAILED`
  and any unknown or later state are refused with the same stable
  machine-readable code — never a silent URL. Unknown states are additionally
  refused by the unit predicate, and the `media_assets` CHECK constraint
  currently prevents unknown states from being stored at all.
- **No second identity.** Recovery writes nothing: no asset, no processing job,
  no storage key, no audit row, no status change, no `asset_version` change.
  Registration still records no audit row, so there is no second audit identity.
- **Server-owned key.** The URL is signed from the asset row's existing
  `source_object_key`. A caller-supplied key in the body is ignored (zod strips
  unknown fields) and the server still derives its own; asserted in the suite.
- **Content type.** Revalidated by the registration schema on the route and
  re-checked inside the recovery service against the same three types
  (`assertRecoverableContentType` → 400 `INVALID_SOURCE_TYPE`), so a URL can
  never be signed for a type the completion check would reject. Note that the
  SigV4 presigner does not sign `Content-Type`; the load-bearing guard against
  content-type confusion therefore remains the existing completion check
  (`metadata.contentType` must start with `video/`), which is unchanged and
  covered.
- **Lifetime.** 3600 seconds, preserved, and asserted to be the same for the
  first registration and the recovered URL.

Transaction and external-I/O ordering
1. `findUploadRecoverySnapshot` — one indexed read, **no transaction, no row
   lock, no storage call**, returning id, status, source key, `asset_version`
   and `deletion_pending`.
2. Eligibility gate on the snapshot. Not `UPLOADED`, or a pending/running
   deletion → 409 with the stable code, no URL signed.
3. Sign the URL from the snapshot's server-owned key and the validated content
   type, **outside every transaction and lock**.
4. `uploadRecoverySnapshotCurrent` — one conditional re-read on
   `id`, `application_id`, `status = 'UPLOADED'`, `source_object_key`,
   `asset_version` and "no pending/running deletion". If anything moved, the URL
   that was already signed is **discarded** and the same conflict code is
   returned.

Step 4 is a short compare-and-set style check, deliberately **not** an
exclusive claim: an exclusive version claim would reject all but one of N
concurrent identical retries, which the requirement forbids. Correctness does
not rest on step 4. A URL issued microseconds before a state change is harmless
because upload completion is still the authority: it requires the asset to be
`UPLOADED`, re-reads the stored object metadata, and performs the atomic
`UPLOADED -> PROCESSING` transition. All four "something moved" cases (state
moved, deletion became pending, source key repointed, version moved) are
tested.

Concurrency: 10 simultaneous identical retries each return 202 with the same
`assetId`, `status: "UPLOADED"` and a URL they generated themselves; one media
row, one processing job, one audit identity, one source key; every returned URL
is independently usable against that one key. SigV4 timestamps have
one-second granularity, so two recoveries inside the same second legitimately
produce byte-identical URL strings; the suites assert usability, not textual
difference.

Once permanently deleted, an asset's identity becomes registerable again with a
new server-owned key (an idempotency key is not a tombstone) — tested.

## 5. Exact Docker commands, counts, images and results

All verification ran in Docker. The disposable project is
`drm-deletion-test` and never publishes ports.

```powershell
cd education-drm-service
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml build
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml up -d --wait
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml --profile verify build
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm recovery-runner
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:integration
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:media
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:e2e
docker run --rm --entrypoint sh drm-verification-test-runner:local -c "cd /app && pnpm typecheck"
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm -e DATABASE_URL=postgresql://nobody:nobody@127.0.0.1:1/nonexistent migrate
docker compose -p drm-migfail -f docker/docker-compose.deletion-test.yml -f migfail.override.yml up
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml down -v
```

`--profile verify build` is required for the shared test image: the two runners
sit in a profile so that `up -d --wait` provisions only the stack. The
migration-gate drill used a throwaway `migfail.override.yml` outside the
repository that replaces the migrate command with `process.exit(3)`.

| Suite / drill | Result |
| --- | --- |
| Upload-recovery worker runs 1 and 2 (4 files) | **PASS 38/38 ×2** |
| Independent manager run after job-status repair | **FAIL 37/38** — stale readiness-dependent assertion; asset verified `READY` |
| Independent manager runs after deterministic test correction | **PASS 38/38 ×2** |
| Accepted deletion integration run 1 | **PASS 44/44** |
| Accepted deletion integration run 2 | **PASS 44/44** |
| Unit default config (11 files; 38 pre-existing + 10 new) | **PASS 48/48** |
| `test:integration` scaffold | PASS 3/3 |
| `test:media` scaffold | PASS 3/3 |
| `test:e2e` scaffold | PASS 2/2 |
| `pnpm typecheck` (`tsc --build --force`, includes all suites) | PASS |
| `pnpm lint` | **PRE-EXISTING FAILURE** — the repository contains no ESLint configuration file, so `eslint` exits 2 before linting anything. Unrelated to this change; no lint baseline exists to regress. |
| Migration failure, unreachable database | exit code 1 |
| Migration failure, simulated exit 3 | compose exit 1; `api` and `worker` were only `Created`, never started |
| `docker compose -f docker/docker-compose.yml config --quiet` | OK |
| `docker compose -f docker/docker-compose.production.yml config --quiet` | OK once the required variables are supplied |
| Runtime image secret scan (api, worker) | 0 files; uid 1000; no compiled test sources |
| API/worker/migrate log secret scan | 0 hits |
| Live Cloudflare R2 | **BLOCKED** — see section 8 |

Final disposable-stack images: `drm-deletion-test-api` `b4941c40404f`,
`drm-deletion-test-worker` `650fcd04da83`, `drm-deletion-test-migrate`
`0ded82f89b94`, `drm-verification-test-runner:local` `0985286dc89e`
(pinned stock `postgres:16.4-alpine3.20`, `valkey/valkey:8.0.1-alpine3.20`,
`chrislusf/seaweedfs:4.47` unchanged). The disposable project and its two
volumes were removed with `down -v` after verification; the platform
development project and its volumes were never touched.

## 6. Evidence per required proof

- **First registration returns an asset and upload URL** — `202` with a UUID
  `assetId`, `status: "UPLOADED"`, a `X-Amz-Signature` URL with
  `X-Amz-Expires=3600`, one `video_processing_jobs` row, and the server-owned
  key matching the returned `uploadKey`.
- **Identical retry returns the same asset, a fresh usable URL, and no
  duplicate** — same `assetId`, `idempotent: true`, exactly one
  `media_assets` row for the identity, one `video_processing_jobs` row, zero
  audit rows, and `asset_version` still 1. A real PUT through the recovered URL
  lands on the pre-existing source key, confirmed with a real
  `HeadObject` (`size` and `contentType`).
- **Lost response, retry, real PUT, normal completion** — the first response is
  discarded while only `externalAssetId` and the idempotency key are kept; the
  retry yields the same asset and a URL; a real 6038-byte H.264/AAC MP4 is PUT
  through it; `POST /v1/media/:assetId/complete` returns `202
  {status:"PROCESSING", size: 6038, processingJobId}`; the real worker
  consumes the enqueued BullMQ job (observed leaving `waiting`), and the asset
  is still the same row with the same source key. The recovery suite also PUTs
  the same source through five concurrent recovered URLs and keeps one asset and
  one key.
- **Concurrent retries** — ten parallel identical retries, all 202, all the same
  `assetId`, one row, one job, one key, every URL usable.
- **Tenant isolation** — a second application registering the same
  `externalAssetId` gets its own asset under its own `uploads/{appId}/` prefix;
  its repeat converges on its own asset; the owner's asset id and source key
  never appear in the other tenant's response; a cross-tenant status read is 404
  with no id in the body.
- **Fail-safe inputs** — missing credentials 401, unknown client id 401, wrong
  secret 401, suspended application 403; empty and 256-character
  `externalAssetId`, `application/pdf`, `video/avi`,
  `video/mp4; charset=utf-8`, a 65-character idempotency key and an unknown
  security tier all 400 with no asset created; a different `externalAssetId`
  under the same key registers a separate asset instead of colliding; a
  caller-supplied `sourceObjectKey` is ignored.
- **State rejection** — all seven non-`UPLOADED` statuses are 409 with
  `UPLOAD_RECOVERY_NOT_ALLOWED`, no `uploadUrl`, no signature, no source key in
  the body, and the asset row unchanged (`asset_version` still 1). `PENDING` and
  `RUNNING` deletions are 409 with the same code and never cause a second
  registration. Unknown and later statuses are refused by the unit predicate.
- **URL expiry on the real provider** — a URL signed with the real provider at
  `X-Amz-Expires=1` succeeds immediately and is then rejected by SeaweedFS with
  `403 <Code>AccessDenied</Code><Message>Request has expired</Message>`. The
  tampered-signature control is 403 while the untampered URL is accepted, so the
  recovered URL is a real credential rather than a wildcard. The 3600s lifetime
  itself is asserted on the real API rather than by waiting an hour.
- **Secret and key containment** — no signed URL, source key, `X-Amz-Signature`,
  client secret or S3 credential appears in `media_deletions`,
  `video_processing_jobs`, `audit_logs`, `playback_sessions` or
  `license_events` rows (only `media_assets.source_object_key` legitimately
  holds the key), in any Redis key/value of any type, in any error response
  body, in any api/worker/migrate container log (0 hits across the 8 scanned
  patterns: signature, checksum param, object-key prefix, client-secret prefix,
  storage secret, playback secret, private-key header, `client_secret`), or in
  either runtime image filesystem (0 files). `docker history` matches no secret
  pattern. The new production code performs no write and no logging.
- **Existing suites green** — the accepted deletion suite passes 44/44 twice
  after the storage change, the unit suite grows 38 → 48 with no regression, and
  the integration/media/e2e scaffolds and the production and development
  compose files still validate.
- **Images minimal, non-root, migration still gates startup** — both runtime
  images run as uid 1000, contain no compiled test sources, and hold no
  credentials; a failing migration exits non-zero and leaves `api` and `worker`
  unstarted.

## 7. Clean-code and file-structure decisions

- The recovery decision lives in its own focused service rather than growing
  `upload.service.ts`, which keeps registration (writes) and recovery (a pure
  read plus a signature) separately understandable. `upload.service.ts` is 147
  lines; the new service is 153.
- Data access follows the package's existing repository pattern; the two new
  functions sit beside the existing media repository functions (144 lines) and
  document why the read is lock-free and why the check is non-exclusive.
- The signer is injected as an optional parameter, mirroring the `enqueue` seam
  the accepted deletion service already uses. Production always uses the
  storage provider; the seam exists so the ordering guarantees can be tested
  against real PostgreSQL while a state change is interleaved.
- No god file: the largest new production file is 153 lines, well under the
  250-line preference. The new test files were deliberately decomposed into four
  single-concern suites (211/231/191/253 lines) plus a 259-line shared harness,
  so no new file in this change exceeds 300 lines.
- **Justified exception:** `packages/drm-core/src/providers/s3-storage.provider.ts`
  is 318 lines, above the 300-line threshold. It was already 310 lines before
  this assignment; the +8 lines are the `S3ClientConfig` type annotation, one
  configuration flag, and the comment explaining the `BadDigest` defect.
  Decomposing the storage adapter would restructure code shared by deletion,
  playback, packaging and webhook paths — explicitly outside this bounded
  authorization, and riskier than the defect being repaired. It is flagged for
  a separate decision.
- Test fixture choice: the 1-second MP4 is embedded as base64 in a dedicated
  102-line fixture module rather than committed as a binary, so the diff stays
  text-only and the suite stays hermetic.

## 8. Remaining risks and unresolved items

1. **BLOCKED — live Cloudflare R2 upload-URL recovery verification could not be
   performed because the required Cloudflare R2 endpoint and credentials were not
   supplied.** All object-storage proof ran against local SeaweedFS in Docker.
   That provider is S3-compatible and is not R2, and no fixture is presented as
   R2 evidence. When credentials exist, re-run the recovered-PUT, expiry and
   tamper cases against R2; the presigner and the recovery service need no
   change, only the endpoint/credential configuration.
2. **Pre-existing defect, deliberately not repaired (out of scope): video
   processing cannot complete.** `updateJobStatus` in
   `packages/database/src/repositories/jobs.repository.ts` (lines 38-56,
   unchanged by this work) sends `$2` into a statement where it is inferred both
   as `character varying` (`status = $2`) and as `text`
   (`$2 IN ('COMPLETED','FAILED')`). PostgreSQL refuses the statement, so every
   job-status update fails with `42P08 inconsistent types deduced for parameter
   $2`, and the worker marks the asset `FAILED` and retries. Deterministic
   reproduction with no application code involved:

   ```sql
   PREPARE probe AS
   UPDATE video_processing_jobs
   SET status = $2,
       error_message = COALESCE($3, error_message),
       error_category = COALESCE($4, error_category),
       attempts = CASE WHEN $2 = 'RUNNING' THEN attempts + 1 ELSE attempts END,
       started_at = CASE WHEN $2 = 'RUNNING' AND started_at IS NULL THEN NOW() ELSE started_at END,
       completed_at = CASE WHEN $2 IN ('COMPLETED', 'FAILED') THEN NOW() ELSE completed_at END
   WHERE id = $1;
   -- ERROR: inconsistent types deduced for parameter $2
   -- DETAIL: text versus character varying
   ```

   A cast such as `$2::varchar` in the two `CASE` expressions would fix it. The
   authorized scope explicitly excludes packaging and unrelated DRM internals,
   so it is reported rather than changed. Consequence for this prerequisite: the
   recovered upload, completion and job dispatch are proven, but an asset
   recovered today cannot reach `READY` until that separate defect is repaired.
   **This blocks M3 playback evidence, not M3 upload-URL recovery.**
   Question for the owner: authorize a bounded DRM fix for
   `updateJobStatus` (and re-verify the lifecycle suite to `READY`) as a
   follow-up?
3. **Pre-existing weakness, not repaired:** `POST /v1/media/:assetId/complete`
   answers 500 when the source object is missing, because the storage
   `HeadObject` error is not mapped to a 4xx. Found while writing the stale-URL
   test; completion validation itself is not weakened. Suggested follow-up:
   answer `400 INVALID_SOURCE_MISSING`.
4. **Pre-existing behaviour, unchanged:** a duplicate `POST /v1/media` **without**
   an `idempotencyKey` still surfaces the `UNIQUE (application_id,
   external_asset_id)` violation as a 500 instead of a clean conflict. Idempotency
   remains opt-in, as before. Not in this assignment's scope; worth a decision.
5. **SigV4 granularity.** Two recoveries inside the same second return
   byte-identical URLs. Each call does sign a fresh URL, and the returned
   credential is valid for the full 3600s, but a client must not assume a
   recovered URL string differs from the previous one.
6. **Content type is not signature-bound.** The SigV4 presigner excludes
   `Content-Type` from `X-Amz-SignedHeaders`, so a recovered URL does not
   cryptographically bind the declared type. The existing completion check
   (stored `ContentType` must start with `video/`) remains the guard, and
   recovery never widens what may be uploaded.
7. **A credential minted before a transition stays valid for its lifetime** and
   can overwrite the source object of an asset that has already moved to
   `PROCESSING`. This is inherent to presigned URLs and is why completion, not
   the URL, is the authority; the suite proves the consequences (no re-processing,
   no playability).
8. **No performance or capacity evidence.** Nothing here measures throughput,
   and the concurrency proof is 10 simultaneous retries, not a load test.

### Rollback and recovery

- **Rollback is a redeploy, not a migration.** No schema, migration, seed or
  configuration change is involved, so reverting is restoring the previous
  images built from the `6e1e01c` tree. The API change is additive at the
  response level, and the platform needs no edit in either direction: its
  registration-response validator already treats `uploadUrl` and `idempotent` as
  optional, and `server/src/modules/catalog/media/intentService.ts` was written
  for exactly this gap — it fails a repeat that arrives without a URL
  (`UPLOAD_URL_UNAVAILABLE`, never a fabricated URL and never a second asset),
  which this change turns into a real URL for an `UPLOADED` asset. A refusal
  surfaces as `DRM_CONFLICT` through the platform's error mapping, which is the
  correct outcome for an asset that has left `UPLOADED`.
- **Data.** Recovery performs no writes, so there is nothing to reconcile,
  clean up or migrate. `asset_version` is only read.
- **The `requestChecksumCalculation` change can be reverted on its own.** If a
  reviewer rejects it, reverting that one flag restores the pre-existing
  behaviour in which no presigned upload URL works, which would fail the
  recovered-PUT proof.
- **The `verify` compose profile.** If the manager prefers the previous
  behaviour where `up -d --wait` also runs the deletion suite, drop the two
  `profiles: ["verify"]` lines and the `--profile verify build` step; the
  documented `run --rm` commands are unaffected either way.
- **Stuck verification state.** The disposable project is fully self-contained
  (`drm-deletion-test` with `pgdata-test` and `seaweeddata-test`) and was
  removed with `down -v`. Recreate it with the commands in section 5; no
  development or production data is involved.

## 9. Handoff for independent review

Recommended review order:
1. `git -C education-drm-service diff` for the nine modified files, then read
   `apps/api/src/services/upload-recovery.service.ts` and the two new
   repository functions.
2. Judge the `requestChecksumCalculation` repair in section 3, which is the one
   change touching `packages/drm-core`.
3. Reproduce the two suites in the disposable project (section 5). The
   `recovery-runner` prints per-test names, so the 38 recovery cases can be
   checked individually; `test-runner` reproduces the accepted deletion
   evidence.
4. Decide on the `updateJobStatus` follow-up in section 8.2, which currently
   prevents any recovered asset from reaching `READY`.
5. Platform documents (`README.md`, `decisions.md`, `drm-integration.md`,
   `test-and-review-plan.md`) still describe this prerequisite as authorized but
   not implemented. They were intentionally left alone so that no uncommitted
   M3 platform work or manager documentation was disturbed; the manager should
   update them when recording acceptance.

Nothing was committed, pushed or deployed. The nested DRM diff and this report
are the only outputs.
