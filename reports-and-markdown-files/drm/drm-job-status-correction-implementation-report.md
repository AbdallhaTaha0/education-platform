# DRM processing job-status correction — implementation report

Post-acceptance checkpoint (2026-09-29): the manager committed the combined
accepted DRM recovery and job-status work locally as `5293917`. The historical
worker-state descriptions below intentionally preserve the uncommitted review
state. Nothing was pushed or deployed.

Date: 2026-09-29. Owner-authorized bounded maintenance inside
`education-drm-service/` under the job-status correction worker prompt. All
changes are left uncommitted for independent manager review. Nothing was
committed, pushed, deployed, or turned into a PR, no paid resource was
provisioned, and no platform development volume was removed.

No platform application code was written or modified. The platform
repository's existing uncommitted M3 work is untouched, the platform still
consumes DRM only through HTTP APIs, and the platform development stack
(`docker-nginx/client/server/postgres/redis`) plus the platform test stack
(`education-platform-test-postgres/redis`) stayed healthy throughout. The only
change at the platform repository level is this report.

This report claims no production readiness, no M3 acceptance, and no
10,000-user capacity.

**Independent manager correction (2026-09-29):** the production SQL fix
passed independent processing verification 7/7, but a subsequent recovery
run exposed one stale timing assertion (37/38). The repaired worker can reach
`READY` before the test requests playback, so the observed 201 was correct;
the test incorrectly required 409 without observing asset state. No
production code changed. The test now retains every stale-URL invariant and
uses bounded polling to require `READY` before asserting playback 201. A
freshly rebuilt Docker image then passed recovery 38/38 twice consecutively,
processing 7/7, deletion 44/44, unit 48/48, integration 3/3, media 3/3,
end-to-end 2/2, and typecheck. The manager's failed 37/38 run is recorded
explicitly rather than erased. Manager correction images: api
`f6f87be55839`, worker `52ab168b477e`, migrate `125dbad256b2`, test runner
`47f76bec68a1`.

## 1. Git state

| Repository | Starting revision | Ending revision | Working tree |
| --- | --- | --- | --- |
| Platform (`education-platform`) | `bad064f` | `bad064f`, unchanged | Pre-existing uncommitted M3 work; this report is the only addition |
| Nested DRM (`education-drm-service/`) | `6e1e01c` | `6e1e01c`, unchanged | Upload-recovery prerequisite changes preserved + 6 job-status files, all uncommitted |

The platform tracks the nested package as a gitlink (`160000
6e1e01c09d4f5a8e6827750d2430321d5acf8827`). Because the nested work is
uncommitted, the platform shows ` M education-drm-service`. That is the
expected state for a hand-off: the manager reviews the nested diff first,
then decides whether to commit inside the nested repository and bump the
gitlink.

Job-status correction changes inside the nested working tree (separated from
the preserved upload-recovery prerequisite changes):

```
M packages/database/src/repositories/jobs.repository.ts   (+9/-3: the fix)
M apps/api/package.json                                   (+1: test:processing-lifecycle script)
M apps/api/vitest.config.ts                               (+1: exclude new test from default unit run)
M docker/docker-compose.deletion-test.yml                 (+19: processing-runner service)
?? apps/api/src/tests/media-processing-lifecycle.integration.test.ts   (new, 222 lines)
?? apps/api/vitest.processing-lifecycle.config.ts                      (new, 12 lines)
```

All other modified/untracked nested files belong to the preserved
upload-recovery prerequisite (documented in
`drm-upload-url-recovery-implementation-report.md`) and were not touched.
The `requestChecksumCalculation: "WHEN_REQUIRED"` presigner setting is
retained exactly as ratified.

## 2. Root cause and final SQL/type contract

`updateJobStatus` in
`packages/database/src/repositories/jobs.repository.ts` sent parameter `$2`
into one statement in two incompatible roles:

- `SET status = $2` — `status` is `character varying(20)`, so PostgreSQL
  infers `$2` as `character varying`;
- `$2 = 'RUNNING'` and `$2 IN ('COMPLETED', 'FAILED')` in `CASE`
  expressions — the string literals infer `text`.

PostgreSQL refuses the statement before execution for every status:

```
ERROR 42P08: inconsistent types deduced for parameter $2
DETAIL: text versus character varying
```

The first attempted correction (`$2::text` in the `CASE` expressions) does
**not** fix it: PostgreSQL uses the cast target as a type hint, so `$2::text`
still infers `text` against the `varchar` from the assignment. This was
proven with a bare `PREPARE` against the disposable PostgreSQL — the `$2::text`
variant still fails 42P08.

The working correction casts toward the column type (`$2::varchar`), making
every `$2` usage infer `character varying` consistently. Verified with the
same bare `PREPARE`, which then succeeds:

```sql
UPDATE video_processing_jobs
SET status = $2,
    error_message = COALESCE($3, error_message),
    error_category = COALESCE($4, error_category),
    attempts = CASE WHEN $2::varchar = 'RUNNING' THEN attempts + 1 ELSE attempts END,
    started_at = CASE WHEN $2::varchar = 'RUNNING' AND started_at IS NULL THEN NOW() ELSE started_at END,
    completed_at = CASE WHEN $2::varchar IN ('COMPLETED', 'FAILED') THEN NOW() ELSE completed_at END
WHERE id = $1;
```

Final contract, unchanged in business semantics:

- atomic updates of status, attempts, start/completion times, optional error
  fields in one parameterized statement (no interpolation);
- exactly one attempts increment per `RUNNING` update under the existing call
  contract (the worker calls it once per transition; a second `RUNNING`
  update increments again, matching prior intent);
- `started_at` set only on the first `RUNNING` transition (`AND started_at
  IS NULL` preserved);
- `completed_at` set for terminal `COMPLETED`/`FAILED` only;
- existing error-message/category retention via `COALESCE` when absent;
- existing worker retry, queue, media-state, and deletion behavior untouched.

No migration was needed: the defect is query parameter typing, not schema
shape. `packages/database/migrations/` is unchanged.

## 3. Changed DRM files and line-count impact

Production correction (1 file, +9/−3):

- `packages/database/src/repositories/jobs.repository.ts` — three
  `$2::varchar` casts plus an explanatory comment recording why `::text`
  fails and `::varchar` succeeds. File remains 75 lines, well under the
  250-line preference. No god file, no restructuring.

Verification wiring (5 files):

- `apps/api/src/tests/media-processing-lifecycle.integration.test.ts` (new,
  222 lines) — 5 repository-level `updateJobStatus` regressions + 2 real
  worker-to-`READY` lifecycle proofs (first-registration and recovered URL).
- `apps/api/vitest.processing-lifecycle.config.ts` (new, 12 lines) —
  dedicated suite entry point so the 38-case recovery suite stays exactly 38.
- `apps/api/package.json` (+1) — `test:processing-lifecycle` script.
- `apps/api/vitest.config.ts` (+1) — new test excluded from the default unit
  run, matching the existing convention.
- `docker/docker-compose.deletion-test.yml` (+19) — `processing-runner`
  service reusing the existing disposable stack and shared test image; no
  service, image, port, volume, or environment value of the existing stack
  was changed.

**Migration impact: none. Configuration impact: none.**

## 4. Exact Docker commands, counts, images and results

All verification ran in Docker. The disposable project is
`drm-deletion-test` and never publishes ports. The stack was rebuilt after
the fix so api, worker, and test-runner images all contain the correction.

```powershell
cd education-drm-service
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml build
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml up -d --wait
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml --profile verify build
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:integration
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:deletion
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm recovery-runner
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm processing-runner
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:media
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:e2e
docker run --rm --entrypoint sh drm-verification-test-runner:local -c "cd /app && pnpm typecheck"
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm -e DATABASE_URL=postgresql://nobody:nobody@127.0.0.1:1/nonexistent migrate
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml down -v
```

| Suite / drill | Result |
| --- | --- |
| New processing-lifecycle suite (1 file, 7 tests) | **PASS 7/7** |
| Upload-recovery worker run (4 files, 38 cases) | **PASS 38/38** |
| Independent manager run before timing-test correction | **FAIL 37/38** — asset was already `READY`, so playback 201 was correct |
| Independent manager runs after timing-test correction | **PASS 38/38 ×2** |
| Accepted deletion integration | **PASS 44/44** (one transient SIGTERM-timing flake on first run, green on re-run; pre-existing, unrelated) |
| Unit default config | **PASS 48/48** |
| `test:integration` scaffold | PASS 3/3 |
| `test:media` scaffold | PASS 3/3 |
| `test:e2e` scaffold | PASS 2/2 |
| `pnpm typecheck` (`tsc --build --force`) | PASS |
| `pnpm lint` | **PRE-EXISTING FAILURE** — no ESLint configuration file in the repository (exit 2 before linting anything). Unrelated to this change; identical to the state recorded in the upload-recovery report. |
| Migration failure, unreachable database | exit code 1 (fails closed) |
| Runtime images (api, worker) | uid 1000, no compiled test sources |
| API/worker log secret scan | 0 hits |
| `git diff --check` | clean |
| Live Cloudflare R2 | **BLOCKED** — see section 6 |

Final disposable-stack image IDs: `drm-deletion-test-api`
`sha256:bca863c6a278e7d92055885bd22cee0c79215d0f71a6ed02f722f75dcda6c4db`,
`drm-deletion-test-worker`
`sha256:f572da91ae8262a3dec76a9abe3a110e4e2382db1283c6024fc87dd7b66c605a`,
`drm-deletion-test-migrate`
`sha256:8ea751494511113d5d2e117f2042ad213153bfb3269c049c1245192563325480`,
`drm-verification-test-runner:local`
`sha256:253f2a49700c9bd598f3efff6fe1f1bbe3590c028bc4722b731326a800b1fbfb`
(pinned stock `postgres:16.4-alpine3.20`,
`valkey/valkey:8.0.1-alpine3.20`, `chrislusf/seaweedfs:4.47` unchanged).
The disposable project and its volumes were removed with `down -v` after
verification; the platform development and test projects and their volumes
were never touched and remain healthy.

## 5. Evidence per required proof

- **PENDING → RUNNING** — succeeds, attempts 0→1 for that update,
  `started_at` set. Would fail 42P08 on the old query.
- **Subsequent progress update unaffected** — second `RUNNING` update
  succeeds (attempts 2); `updateJobProgress` path untouched.
- **RUNNING → COMPLETED** — succeeds, `completed_at` set, no error value
  introduced (`error_message`/`error_category` remain null).
- **RUNNING → FAILED** — succeeds, supplied safe error fields recorded,
  `completed_at` set.
- **Every valid status without 42P08** — `PENDING`, `RUNNING`, `COMPLETED`,
  `FAILED` (the full shared-type union) each pass through `updateJobStatus`
  cleanly.
- **First-registration upload → worker → READY** — real 6KB H.264/AAC MP4
  registered via `POST /v1/media`, PUT through the first-registration URL,
  completed (`202 PROCESSING`), consumed by the real worker (observed leaving
  the queue), asset reaches `READY` in ~1.4s.
- **Recovered-URL upload → worker → READY** — first response discarded,
  identical retry returns same asset + fresh URL (`idempotent: true`), real
  PUT, real completion, real worker, same asset reaches `READY` in ~0.8s.
- **No duplicates** — one `media_assets` row, one `video_processing_jobs`
  row, one source key per identity in both lifecycle paths.
- **Recovery is deterministic after manager correction** — the first
  independent post-SQL-fix run exposed the readiness race at 37/38; after the
  test-only correction, two consecutive fresh-image runs passed 38/38.
  Deletion remains green at 44/44.
- **Unit 48/48, integration 3/3, media 3/3, e2e 2/2 green** — no regressions.
- **Secret containment** — 0 hits for signature/secret/key patterns in
  api/worker logs; runtime images non-root without test sources. The
  correction performs no logging and touches no credential path.

## 6. Remaining risks and unresolved items

1. **BLOCKED — live Cloudflare R2 upload, processing, and deletion
   verification could not be performed because the required Cloudflare R2
   endpoint and credentials were not supplied.** All object-storage proof ran
   against local SeaweedFS in Docker. That provider is S3-compatible and is
   not R2.
2. **Pre-existing weakness, not repaired:** `POST
   /v1/media/:assetId/complete` answers 500 when the source object is
   missing (reported in the upload-recovery report §8.3, unchanged).
3. **Pre-existing behaviour, unchanged:** duplicate `POST /v1/media`
   without an `idempotencyKey` surfaces the unique violation as 500
   (reported in the upload-recovery report §8.4, unchanged).
4. **No performance or capacity evidence.** The worker-to-`READY` proof uses
   a 6KB fixture, not production-scale media.

### Rollback and recovery

- **Rollback is a redeploy, not a migration.** No schema, migration, seed,
  or configuration change is involved. Reverting is restoring the previous
  images built from the `6e1e01c` tree plus the preserved upload-recovery
  diff. Without this correction, every `updateJobStatus` call fails 42P08
  and no asset can reach `READY`.
- **Data.** The correction changes no stored shape — only the parameter
  typing of one UPDATE statement. Nothing to reconcile.
- **Stuck verification state.** The disposable project was removed with
  `down -v`. Recreate it with the commands in section 4; no development or
  production data is involved.

## 7. Handoff for independent review

Recommended review order:

1. `git -C education-drm-service diff
   packages/database/src/repositories/jobs.repository.ts` — the entire
   production correction (9 insertions, 3 deletions).
2. Read `apps/api/src/tests/media-processing-lifecycle.integration.test.ts`
   — the 7 regression proofs.
3. Reproduce in the disposable project (section 4): `processing-runner`
   for the new 7/7, `recovery-runner` for the preserved 38/38,
   `test-runner` for the accepted 44/44 deletion suite.
4. Confirm the platform diff is untouched apart from this report, and the
   nested upload-recovery diff is preserved.

Nothing was committed, pushed or deployed. The nested DRM diff and this
report are the only outputs.
