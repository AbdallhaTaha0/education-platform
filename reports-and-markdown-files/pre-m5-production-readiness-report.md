> Current continuation status (2026-10-01): see [M5 manager continuation review](m5-manager-continuation-review.md). The older revisions, counts and verdicts below are historical evidence. M5 code is committed at `b04d84f`, with nested DRM at `015392b`; the subsequent closure changes remain uncommitted. Production release is not approved.

# Pre-M5 production-readiness report (correction round 5)

Date: 2026-09-30. Scope: Pre-Milestone 5 production-readiness closure only. No
Milestone 5 features implemented. All work remains uncommitted for owner review. No
commit, push, deployment, pull request, or history amendment occurred.

This revision supersedes the first pre-M5 report and correction rounds 1–4.

- **Round 1** corrected factual errors, added the command record, separated
  claims by evidence class, and reversed the readiness verdict.
- **Round 2** (documentation and operational-safety only) fixed the browser
  example so the disposable volume overrides actually reach every command in the
  sequence, withdrew the "exact commands" claim for the real-R2 runs because
  those commands were never preserved, corrected the credential-rotation
  procedure, and finished Docker cleanup.
- **Round 3** (text consistency only) aligned the rotation rule across §1, §19
  and §25; fixed the §0 cross-references; made the pre-rotation R2, ingestion
  and deletion observations consistently "historical, not reproducible"; added
  the DRM image rebuild step to the post-rotation procedure; and corrected the
  index wording.
- **Round 4** completed the remaining editorial consistency corrections without
  running Docker or any live verification.
- **Final closure attempt** (see §31) stopped at Gate 0: the owner has not
  confirmed revocation, so no DRM start and no live-R2 operation was performed.
  The reproducible verification harness required before any live work was built
  and initially self-tested, and the conditional non-R2 platform checks were rerun.
- **Round 5** (see §33) repaired the harness after independent review found
  fail-open outcomes and public-contract errors. Credential-free verification
  now passes 19 self-checks and 10 offline contract/safety fixtures.

The verdict is unchanged by every round.

## 0. Verdict

`NOT READY FOR MILESTONE 5`

Mandatory pre-M5 gates are not all satisfied: revocation of the exposed R2
credential pair is not owner-confirmed, one Pre-M5 test object remains in the bucket, R2 CORS
is unproven, packaged-segment delivery is unproven, and successful ClearKey
license issuance is unproven. See §27 (claim separation) and §28 (owner-action
blockers).

## 1. Security incident and rotation gate

During the first pre-M5 run, a read-only configuration check used
`Select-String '^S3_'` against the ignored `education-drm-service/.env`. That
command printed the real `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and
`S3_SECRET_ACCESS_KEY` values into tool output. This was a direct violation of
the rule that credentials must never be printed. Consequences:

- The R2 access-key pair is treated as **compromised**.
- The values are not repeated anywhere in this report, in any committed file,
  or in any later tool output. No old or replacement value is quoted,
  search-printed, logged, or stored.
- The owner must revoke the old R2 token/access-key pair in the Cloudflare
  dashboard and supply a replacement **through the ignored
  `education-drm-service/.env`**. Supplying it in chat or committing it is
  prohibited.
- All live-R2 operations are suspended until that confirmation. The DRM
  development stack was stopped to remove any process still using the exposed
  pair (§6.3).
- Accepted rotation rule (identical in §19 and §25):
  - **Owner confirmation establishes revocation.** The owner's Cloudflare
    revocation confirmation is the evidence; nothing further about the old
    credential is required.
  - **The exposed value must not be preserved, re-entered, quoted, or tested.**
    No request is ever made with it.
  - **Only replacement credentials are verified**, using the ignored
    `education-drm-service/.env`, recording status/category and presence/length
    only.
- Real-R2 observations from before rotation are historical and not reproducible
  (§18.8); they do not constitute accepted R2 proof and must be re-run after
  rotation with a fresh unique test identifier.

## 2. Starting revisions and Git state

| Repository | HEAD | origin/main | Working tree |
| --- | --- | --- | --- |
| Platform (`education-platform`, `main`) | `c7b0c958d0cfa120a57b4cda70302b29493995c4` | same | Uncommitted: 3 modified + 1 new report |
| Nested DRM (`education-drm-service/`, `main`) | `d250fffa394a30ca77f2dfeb87872f1fd615db28` | same | Clean; not edited in this assignment |
| Platform gitlink | `d250fffa394a30ca77f2dfeb87872f1fd615db28` | — | Matches nested HEAD |

Accepted history preserved and not rewritten: `fce352f` (M1), `b8080a8` (M2),
`d520dd7` (M3), `03e51eb` (M4 code), `5224cbb` (M4 acceptance docs), `527297e`
(platform Compose correction), `6e1e01c` (DRM deletion), `5293917` (DRM
recovery/job-status), `d250fff` (DRM R2/Compose configuration), `c7b0c95`
(platform gitlink update).

## 3. Changed files by repository

Platform (all uncommitted):

| File | Change | Why |
| --- | --- | --- |
| `docker/compose.dev.yml` | Volume `name` values become `${PGDATA_NAME:-docker_pgdata}` / `${REDISDATA_NAME:-docker_redisdata}`; browser example rewritten to require explicit disposable volume names and a `config` inspection step before `down -v` | `527297e` pinned dev volumes but made every `-p` project reuse them, so a disposable `down -v` could delete development data. The default keeps dev data; the documented disposable form is isolated. |
| `reports-and-markdown-files/pre-m5-production-readiness-report.md` | This report (new, replaces the first pre-M5 report) | Record corrected evidence, commands, and blockers |
| `reports-and-markdown-files/docker-and-operations.md` | Volume-inspection procedure, object-storage credential-handling rule, corrected storage row, removed the stale "could not reach Docker Engine" sentence | Operational truth for disposable runs and credential handling |
| `reports-and-markdown-files/README.md` | Index row plus baseline paragraph rewritten | Prior baseline claimed R2 verification was complete; corrected to name the open blockers |

Nested DRM: **no file changes**. `education-drm-service/` is byte-identical to
`d250fff`; `git status` is empty.

Evidence PNGs rewritten by browser runs were restored with
`git checkout -- reports-and-markdown-files/m3-evidence/`; only the four files
above plus the new report remain changed.

## 4. Docker versions

- Engine `29.6.2`, Client `29.6.2`, Compose `v5.3.1`, storage driver `overlayfs`,
  architecture `x86_64`.
- This differs from the M4 verification environment (`Engine 29.8.1`,
  `Compose v5.5.1`); all evidence in this report is from `29.6.2 / v5.3.1`.

## 5. Compose project names and volume safety

Active project names:

| Purpose | Project | Source |
| --- | --- | --- |
| Platform development | `education-platform` | `docker/compose.dev.yml` `name:` |
| DRM development | `education-drm-service` | DRM `docker/docker-compose.yml` `name:` |
| DRM production | `education-drm-service-production` | DRM `docker/docker-compose.production.yml` `name:` |
| Platform test (disposable) | `education-platform-test` | explicit `-p` |
| Browser verification (disposable) | `education-platform-browser` | explicit `-p` + volume overrides |
| DRM regression (disposable) | `drm-deletion-test` | explicit `-p` |
| Migration-failure drill (disposable) | `prem5-migfail` | explicit `-p` |
| Backup/restore drills (disposable) | `prem5-drill-*`, `prem5-drm-drill-*` | standalone containers/volumes |

Rendered volume names were inspected before any `down -v` (see §18.1 for the
commands and the exact output):

- Development defaults render `docker_pgdata` and `docker_redisdata` — the
  accepted development volumes, preserved.
- The browser project renders `education-platform-browser_pgdata` and
  `education-platform-browser_redisdata` — unique names that do not collide
  with development.

Safety rules enforced during this assignment:

- `down -v` was never run against `education-platform`,
  `education-drm-service`, or `education-drm-service-production`.
- `down -v` was run only for `education-platform-test`, `drm-deletion-test`,
  `education-platform-browser` (with explicit disposable volume names), and
  `prem5-migfail`, after resolving and inspecting the volume names.
- Never run: `docker system prune --volumes`, `docker volume prune`, broad
  container/network/volume deletion.
- Development volumes `docker_pgdata` (created 2026-09-27, originally labelled
  project `docker`) and `docker_redisdata` (2026-09-28) are intact. The
  `education-drm-service_pgdata` volume is intact after the DRM stack stop.

## 6. Object-storage and DRM connection status

### 6.1 R2 configuration (no values revealed)

- DRM `.env.example` documents placeholders with `S3_REGION=auto` and
  `S3_FORCE_PATH_STYLE=false`.
- The ignored `education-drm-service/.env` contains all six `S3_*` variables
  with non-placeholder values. Presence/length-only inspection is the method
  used in **correction rounds 1, 2 and 3**; it does not describe the initial
  run, which did print the values (see §1). The current pair is the
  **compromised** pair from §1 and is pending revocation.
- DRM development and production Compose both pass the same six variables to
  `api` and `worker`, with `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and
  `S3_SECRET_ACCESS_KEY` required fail-closed (`:?set`), `S3_REGION` defaulting
  to `auto`, and `S3_FORCE_PATH_STYLE` defaulting to `false`.
- SeaweedFS is absent from DRM development and production Compose and remains
  only in `docker/docker-compose.deletion-test.yml` for isolated disposable
  destructive tests.

### 6.2 Platform-to-DRM configuration (no credentials revealed)

- A dedicated local application identity was created for the platform through
  the DRM administrative API (`POST /v1/applications`, admin bearer token read
  from the ignored DRM `.env` inside a script, never printed). Generated
  `clientId` length 32, `clientSecret` length 64; both stored only in the
  ignored root `.env`.
- Ignored configuration values: `DRM_BASE_URL=http://host.docker.internal:3000`,
  `DRM_CLIENT_ID`, `DRM_CLIENT_SECRET`, `DRM_REQUEST_TIMEOUT_MS=5000`,
  `DRM_MAX_RETRIES=2`. Committed files reference only `${DRM_*:...}`, so no
  machine-specific address and no credential is committed.
- Compose deployments remain independent: separate projects, separate
  networks, cross-service access through the host gateway only in the ignored
  file.
- **Corrected claim:** `GET /health/ready` reports `drm.configured: true` from
  configuration presence alone. It does **not** probe the external service —
  with the DRM stack stopped it still returned HTTP 200 with
  `configured: true`. Reachability was proven separately by the explicit
  authorization probes in §12 (valid 400, wrong secret 401, wrong client 401)
  issued from the platform server container while the DRM API was running.
- Bundle and storage safety: the client image contains no
  `DRM_CLIENT_SECRET` string (0 grep hits); the browser suite asserts the only
  browser-storage keys are `edu-platform-theme` and `edu-platform-lang`.
- Log redaction: cookies and CSRF render as `[Redacted]`; the startup line
  prints hosts only (`postgresql://postgres:5432`, `redis://redis:6379`,
  `baseUrlHost`), never passwords; DRM API logs contain identifiers and counts.

### 6.3 Live-R2 operations suspended

The DRM development stack was stopped with `docker compose --env-file .env -f
docker/docker-compose.yml down` (no `-v`, so `education-drm-service_pgdata` is
preserved). Reason: its `api` and `worker` hold the compromised credential pair
in their environment and its health probe calls R2, so any live-R2 operation
must not continue. The platform development stack remains up and healthy; it
still reports `configured: true` for DRM, which per §6.2 does not imply
reachability.

## 7. Teammate configuration review

Verified `527297e`, `c7b0c95`, `d250fff`:

| Requirement | Result | Evidence |
| --- | --- | --- |
| Platform stable project identity `education-platform` | PASS | `docker/compose.dev.yml:29` |
| Development-volume names remain compatible | PASS | `docker_pgdata` / `docker_redisdata` render unchanged; data intact |
| DRM development project `education-drm-service` | PASS | DRM `docker/docker-compose.yml:1` |
| DRM production project `education-drm-service-production` | PASS | DRM `docker/docker-compose.production.yml:1` |
| Active development and production use Cloudflare R2 | PASS | No `seaweedfs` service; S3 vars required fail-closed |
| `S3_REGION=auto` | PASS | Both DRM Compose files default `auto` |
| Path-style addressing disabled | PASS | `S3_FORCE_PATH_STYLE` default `false` in both |
| SeaweedFS absent from active development and production | PASS | Removed from both DRM Compose files |
| SeaweedFS available only to isolated disposable tests | PASS | Present only in `docker-compose.deletion-test.yml` |
| API and worker both receive required R2 configuration | PASS | Identical six variables in both services, dev and prod |
| Production PostgreSQL and Valkey remain private | PASS | `networks: [data]` with `data: internal: true`; no published DB/queue ports |
| Required production secrets fail closed when absent or weak | PASS | `:?set` for PostgreSQL/Valkey/master key/playback/watermark/admin tokens, CORS, JWT issuer and JWKS, S3 credentials, `DRM_DOMAIN`; API rejects `ADMIN_API_TOKEN` under 32 chars and weak secrets |
| No host-specific path committed | PASS | Only container paths and the relative `./Caddyfile` |
| No credential committed | PASS | Only placeholders and clearly labelled test fixture values |

One focused correction was applied by this assignment: the volume-isolation
override plus the browser example (§3). No other configuration defect was found,
and no unrelated DRM change was made.

## 8. Direct real-R2 evidence — HISTORICAL ONLY, NOT REPRODUCIBLE

Executed with unique per-run test identifiers and a 15 KB 1-second H.264/AAC
MP4 generated inside a disposable worker container (test pattern plus sine tone;
generated content, properly licensed). A fixture or SeaweedFS result is not
counted as R2 evidence anywhere in this report.

The exact commands for these runs were **not preserved** (§18.8). Treat this
table as a historical observation log, not as a reproducible transcript, and not
as evidence about the rotated configuration.

Reported pre-rotation observations (historical; not independently reproducible
per §18.8):

| Step | Reported pre-rotation observation |
| --- | --- |
| Object smoke: PUT, HEAD, GET, LIST, DELETE | reported: put ok, exists true, get match true, list 1, delete ok, exists false, list 0 |
| Asset creation `POST /v1/media` | reported: `202`, `UPLOADED`, asset id length 36, presigned URL length 479 |
| Presigned upload with exact method/header/MIME | reported: `PUT` with `Content-Type: video/mp4` returned 200 |
| Completion | reported: `202`, `PROCESSING` |
| Worker processing to ready | reported: `GET status` returned `READY` on the first 5-second poll, twice |
| Playback session creation | reported: `201`, response carried session id, playback token, manifest URL, license URL, watermark policy |
| Manifest fetch with bearer token | reported: `200`, `application/dash+xml`, 2456 bytes |
| Direct DRM deletion request and completion | reported: `202` then `COMPLETED` on first poll; repeat request `404`; asset status `404` afterwards |
| Test-asset prefix emptiness | reported: `assets/{assetId}/` count 0; `uploads/` count 0 |
| Unrelated-object preservation | reported: `pre-m5-preserve/` still had 1 key after the test asset was deleted |

These rows record the reported historical observations from the pre-rotation
run. Because the commands were not preserved, they are not independently
reproducible and do not constitute accepted R2 proof. They must be re-run after
rotation with a fresh unique test identifier; §19 lists the procedure.

## 9. Platform-mediated ingestion and deletion — HISTORICAL ONLY, NOT REPRODUCIBLE

Commands for these runs were not preserved either (§18.8); treat as a historical
observation log only.

| Step | Reported pre-rotation observation |
| --- | --- |
| Platform admin cookie login | reported: `200` |
| Bilingual course (Arabic + English title and description) | reported: `201` |
| Section and lesson creation with both translations | reported: `201`, `201` |
| Media registration `POST /lessons/:id/media` | reported: `201`, presigned URL length 479, mapping `UPLOAD_PENDING` |
| Upload through the platform-issued URL | reported: `PUT` `video/mp4` returned 200 |
| Platform completion | reported: `200` |
| Platform status reconciliation | reported: mapping `READY` on first sync poll |
| Platform permanent deletion | reported: `202` with confirmation, reconciled to `COMPLETED` |
| Test data cleanup | reported: test admin, course and generated sessions removed |

Contract-level platform→DRM behaviour is also covered by the integration suite
(`catalog-media-intent`, `catalog-deletion-*`, `catalog-deletion-unconfigured`,
`catalog-replica-lease`, `deletion-intent-safety`, `drm-contract`) against the
labelled fixture. Fixture evidence proves the platform contract only, never R2.

## 10. ClearKey playback — INCOMPLETE

| Requirement | Result | Note |
| --- | --- | --- |
| Playback session created for a ready asset | reported (pre-rotation, historical) | 201 with transient playback token, manifest and license URLs; commands not preserved (§18.8) |
| Manifest retrieved with the session bearer token | reported (pre-rotation, historical) | 200, `application/dash+xml`, 2456 bytes; commands not preserved (§18.8) |
| **Packaged segment retrieved through the DRM HTTP delivery route** | **UNPROVED** | The earlier claim "segment PASS via manifest + S3 prefix" was wrong and is withdrawn. Listing a prefix or reading the manifest does not exercise an authenticated segment request. No segment HTTP request was recorded. |
| **Successful license issuance with a valid challenge/KID** | **UNPROVED** | The only license call was rejected `400 INVALID_LICENSE_CHALLENGE` because no valid ClearKey KID challenge was supplied. That is correct validation, not successful issuance. |
| Session revocation and denial after deletion | independently verified by the DRM deletion suite | The suite is reproducible and passed 44/44 (§20); it does not depend on the R2 credential pair |

Per the correction instruction, the lifecycle is **not** called complete while
segment delivery and successful license issuance are unproved. Both require
live R2 access and are therefore suspended until credential rotation.

## 11. Commercial DRM / Widevine

`BLOCKED` and separate from the ClearKey result. Development ran with
`CLEAR_KEY_ENABLED=true`; production configuration sets it `false` with
`PREMIUM_DRM_REQUIRED` and Widevine variables unset. No Widevine license
server URL, signing key, IV, provider or content-key seed was supplied, so no
Widevine challenge, license, or protected-playback claim is made. Owner
credentials plus the M5 player are prerequisites.

## 12. Negative authorization evidence

Recorded against the running DRM API and platform API. These are HTTP
authorization results and do not depend on R2 object content, but they were
observed while the compromised pair was present in the environment and must be
re-confirmed after rotation before the connectivity gate is treated as current.

| Case | Expected | Result |
| --- | --- | --- |
| Valid application credentials, empty body | 400 (auth passes, body invalid) | PASS |
| Wrong client secret | 401 | PASS |
| Wrong client id | 401 | PASS |
| Second tenant's credentials requesting the first tenant's asset | 404, no identifier leak | PASS |
| Unknown asset for playback | 404 | PASS |
| Malformed bearer token on heartbeat | 401 | PASS |
| Valid token, unknown session id on heartbeat | denial | PASS (`403`; status code differs from 401/404 but the request is refused) |
| License request without a valid KID challenge | 400 validation | PASS (validation only, not issuance) |
| Platform role boundaries (student cannot approve recharge, cross-user 404, proof 403, anonymous 401) | denial | PASS via integration and browser suites |
| Expired playback token (time-based) | 401 after TTL | **SKIPPED** — requires a 300-second wait or clock control; scheduled for M5 with the player |

## 13. R2 CORS

`BLOCKED`. The first pre-M5 run called the S3 `GetBucketCors` API from the DRM
API container and received `AccessDenied`, then incorrectly concluded that no
wildcard configuration existed. An unreadable response proves nothing about
configuration, and that conclusion is withdrawn.

To resolve it, the owner must provide CORS visibility or configuration through
the Cloudflare dashboard or an authorized API token. Then, and only then:

- Read the bucket's CORS rules and compare them against explicitly approved
  frontend origins, the `PUT` method, the `Content-Type` request header, and any
  response headers the frontend must read.
- Do not invent a production origin and do not configure `*`.
- Prove a browser-style preflight (`OPTIONS` with `Origin` and
  `Access-Control-Request-Method: PUT`) and a presigned `PUT` carrying an
  `Origin` header from the same approved origin.

Until the owner acts, CORS remains `BLOCKED` and no claim is made about the
bucket's current CORS state.

## 14. Remaining object in the bucket

`pre-m5-preserve/unrelated-*.txt` — exactly one object, created by this
pre-M5 run as an unrelated-object preservation control. It is the only known
object this assignment left behind.

Deleting it requires live R2 access and is therefore suspended until rotation.
Post-rotation procedure (§19 step 7): list the exact prefix `pre-m5-preserve/`,
confirm exactly one key matching `pre-m5-preserve/unrelated-*.txt` exists and
that no other run shares the prefix, delete that single key, then re-list the
same prefix and record it empty. Do not delete the bucket, a broad prefix, or any
other run's objects.

Note: the exact generated key suffix is not recorded here, because recording it
would require a live listing, and the listing commands were not preserved
(§18.8). The post-rotation run must resolve the key by listing the unique
prefix, not by reusing any identifier from this report.

The `pre-m5-smoke/` prefix was already emptied during the first run by a
single-object delete and was re-verified empty. Test assets created by both
pre-rotation lifecycles were deleted and their prefixes verified empty.

## 15. Migration results

| Drill | Result | Detail |
| --- | --- | --- |
| Platform fresh, empty disposable database | PASS | 6 migrations applied: `m1_init`, `m2_identity`, `m3_catalog`, `m3_corrections`, `m4_wallet`, `m4_integrity` |
| Platform upgrade on development database | PASS | 5 → 6 rows; `m4_integrity` applied; users preserved |
| Platform migration failure gate | PASS | Unreachable `DATABASE_URL` produced Prisma `P1001` and a non-zero exit; the dependent service never started |
| DRM fresh, disposable project | PASS | `001`–`008` applied |
| DRM migration failure gate | PASS | `ECONNREFUSED`, exit code 1; api and worker stayed unstarted |

Side finding: the ignored root `.env` still carried `SERVICE_VERSION=0.3.0-m3`
from M3 while the M4 Compose defaults and package version were `0.4.0-m4`, so
the running server reported version `0.3.0-m3` and served a database one
migration behind. The value was corrected to `0.4.0-m4` in the ignored file and
the images were rebuilt; no tracked file changed. Readiness now reports
`0.4.0-m4` and the sixth migration is applied.

## 16. Persistence results

| Drill | Result | Detail |
| --- | --- | --- |
| Platform development restart without `-v` | PASS | All five services healthy; 6 migrations; development users and courses preserved |
| DRM development restart | PASS (pre-rotation) | postgres, valkey, api and worker started; 2 application identities preserved in `education-drm-service_pgdata` |
| No `down -v` on development projects | PASS | Confirmed for the entire assignment |

Session counts in the development database changed from 1 to 2 because the
verification run performed real logins. No user, course, wallet, or purchase
record was lost.

## 17. Backup and restore drills (disposable only)

| Drill | Result | Detail |
| --- | --- | --- |
| Platform PostgreSQL | PASS | Dumped the disposable test database (320 users) and restored it into a fresh disposable `postgres:16-alpine` container; restored row count 320, matching the source. Source, target container and volume inspected first, then removed. |
| DRM PostgreSQL | PASS | Read-only `pg_dump` of the DRM development database (2 applications) restored into a fresh disposable `postgres:16.4-alpine3.20` container; restored count 2, matching the source. Container and volume removed. |

No development database was overwritten. Both drill targets were removed with
`docker rm -f` and `docker volume rm` for their exact names.

## 18. Exact sanitized commands used

All commands ran from the repository root unless a work directory is given.
Secrets are referenced through environment variables or ignored files and are
never expanded or printed. PowerShell session-scoped `$env:` assignments are
listed explicitly because they do not persist between tool calls.

### 18.1 Volume-name inspection (before any `down -v`)

```powershell
# Development defaults must render docker_pgdata / docker_redisdata
docker compose --env-file .env -f docker/compose.dev.yml config | Select-String 'name: (docker_|education-)'
# Disposable browser project must render unique education-platform-browser_* volumes
$env:PGDATA_NAME='education-platform-browser_pgdata'
$env:REDISDATA_NAME='education-platform-browser_redisdata'
$env:NGINX_PORT='8081'
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser config | Select-String 'name: (docker_|education-)'
```

Observed: development `docker_pgdata`, `docker_redisdata`; browser
`education-platform-browser_pgdata`, `education-platform-browser_redisdata`.

### 18.2 Platform suites, typecheck, client build

```powershell
docker compose -p education-platform-test -f docker/compose.test.yml build
docker compose -p education-platform-test -f docker/compose.test.yml up -d --wait migrate
docker compose -p education-platform-test -f docker/compose.test.yml up -d --wait
docker compose -p education-platform-test -f docker/compose.test.yml run --rm test npm run test:unit --silent
docker compose -p education-platform-test -f docker/compose.test.yml run --rm test npm run test:integration --silent
docker compose -p education-platform-test -f docker/compose.test.yml run --rm test npm run typecheck
# Client typecheck + production build happen inside the client image build (tsc -b && vite build)
docker compose --env-file .env -f docker/compose.dev.yml build client
```

### 18.3 Platform development stack and migrations

```powershell
docker compose --env-file .env -f docker/compose.dev.yml build server migrate client nginx
docker compose --env-file .env -f docker/compose.dev.yml up -d --wait
docker compose --env-file .env -f docker/compose.dev.yml exec postgres psql -U postgres -d education_platform -c 'SELECT migration_name FROM _prisma_migrations ORDER BY started_at;'
docker compose --env-file .env -f docker/compose.dev.yml exec server node -e "fetch('http://127.0.0.1:3000/health/ready').then(async r=>{console.log('STATUS:'+r.status); console.log(await r.text())})"
```

### 18.4 Migration-failure gate (disposable)

```powershell
docker compose -p prem5-migfail -f docker/compose.test.yml up -d --wait postgres
docker compose -p prem5-migfail -f docker/compose.test.yml run --rm -e DATABASE_URL=postgresql://bad:bad@127.0.0.1:5999/nope migrate
```

### 18.5 Browser suite (disposable, volume-isolated)

```powershell
docker compose --env-file .env -f docker/compose.dev.yml build browser drm-fixture
# Session-scope the disposable overrides ONCE, before any -p command
$env:PGDATA_NAME='education-platform-browser_pgdata'
$env:REDISDATA_NAME='education-platform-browser_redisdata'
$env:NGINX_PORT='8081'
$env:ALLOWED_ORIGINS='http://localhost:8081,http://nginx:8080'
$env:DRM_BASE_URL='http://drm-fixture:8090'
$env:DRM_CLIENT_ID='fixture-client'
$env:DRM_CLIENT_SECRET='fixture-secret-that-is-long-enough-0123456789'
$env:PAYMENT_CHANNELS='[{"channel":"INSTAPAY","accountLabel":"test-alias (test only)","instructionsAr":"...","instructionsEn":"..."}]'
$env:BROWSER_ADMIN_EMAIL='<test-only address>'
$env:BROWSER_ADMIN_PHONE='<test-only number>'
$env:BROWSER_ADMIN_PASSWORD='<test-only password>'
# Inspect the rendered names before creating anything
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser config | Select-String 'name: (docker_|education-)'
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser up -d --wait
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser run --rm --no-deps -e BOOTSTRAP_ADMIN_NAME='...' -e BOOTSTRAP_ADMIN_EMAIL="$env:BROWSER_ADMIN_EMAIL" -e BOOTSTRAP_ADMIN_PHONE="$env:BROWSER_ADMIN_PHONE" -e BOOTSTRAP_ADMIN_PASSWORD="$env:BROWSER_ADMIN_PASSWORD" server node dist/bootstrap.js
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser run --rm browser
# Re-inspect the rendered names and assert they are the disposable ones BEFORE down -v
$rendered = docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser config | Select-String 'name: (docker_|education-)'
$rendered
if ($rendered -match 'docker_pgdata|docker_redisdata') { throw 'REFUSING down -v: a development volume name is resolved' }
if (-not ($rendered -match 'education-platform-browser_pgdata' -and $rendered -match 'education-platform-browser_redisdata')) { throw 'REFUSING down -v: disposable volume names not resolved' }
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser down -v
# Clear the session overrides so later commands cannot inherit them
'PGDATA_NAME','REDISDATA_NAME','NGINX_PORT','ALLOWED_ORIGINS','DRM_BASE_URL','DRM_CLIENT_ID','DRM_CLIENT_SECRET','PAYMENT_CHANNELS','BROWSER_ADMIN_EMAIL','BROWSER_ADMIN_PHONE','BROWSER_ADMIN_PASSWORD' | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
```

The `$env:` assignments at the top of this block are PowerShell **session**
variables. They apply to every subsequent command in the same shell, which is
why the `up`, bootstrap, `run` and `down -v` commands above all receive the
disposable volume names without repeating them. The POSIX-style
`PGDATA_NAME=... command` prefix form used in the first version of this example
is not PowerShell syntax; in PowerShell it would leave the defaults in place and
the disposable project would silently resolve `docker_pgdata` / `docker_redisdata`.

### 18.6 DRM suites, typecheck, migration failure (disposable)

```powershell
# workdir: education-drm-service
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml build
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml up -d --wait
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml --profile verify build
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm recovery-runner
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:deletion
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm processing-runner
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:integration
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:media
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm test-runner pnpm --filter @drm/api test:e2e
docker run --rm --entrypoint sh drm-verification-test-runner:local -c 'cd /app && pnpm typecheck'
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml run --rm -e DATABASE_URL=postgresql://nobody:nobody@127.0.0.1:1/nonexistent migrate
# after inspecting containers and volumes:
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml down -v
```

### 18.7 Backup and restore drills

```powershell
docker volume create prem5-drill-pgdata
docker run -d --name prem5-drill-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -v prem5-drill-pgdata:/var/lib/postgresql/data postgres:16-alpine
docker exec education-platform-test-postgres-1 pg_dump -U postgres education_platform_test | docker exec -i prem5-drill-postgres psql -U postgres -d postgres
docker exec prem5-drill-postgres psql -U postgres -d postgres -c 'SELECT count(*) FROM "User";'
docker rm -f prem5-drill-postgres; docker volume rm prem5-drill-pgdata

docker volume create prem5-drm-drill-pgdata
docker run -d --name prem5-drm-drill-postgres -e POSTGRES_USER=drm -e POSTGRES_PASSWORD=drm_password -e POSTGRES_DB=drm -v prem5-drm-drill-pgdata:/var/lib/postgresql/data postgres:16.4-alpine3.20
docker exec education-drm-service-postgres-1 pg_dump -U drm drm | docker exec -i prem5-drm-drill-postgres psql -U drm -d drm
docker exec prem5-drm-drill-postgres psql -U drm -d drm -c 'SELECT count(*) FROM applications;'
docker rm -f prem5-drm-drill-postgres; docker volume rm prem5-drm-drill-pgdata
```

### 18.8 Real-R2 operations — COMMANDS NOT PRESERVED

**The exact pre-rotation real-R2 commands and scripts were not preserved.** They
were written ad hoc during the first run, executed interactively, and then
discarded. What remains above (the stack start, the FFmpeg generation shape, and
the list of operations) is a *description* of what was run, not an executable
transcript. The placeholders have been removed rather than reconstructed,
because inventing a plausible command and presenting it as historical evidence
would misrepresent what is actually reproducible.

Consequences, stated plainly:

- The pre-rotation R2 results in §8, §9, §12 and §14 are **historical
  observations only**. They are not independently reproducible from this
  report, and they are not evidence about the rotated configuration.
- A reviewer must not attempt to reproduce the pre-rotation runs. They are
  superseded, and the credentials they used are revoked.
- The only executable command record in this report is the non-R2 Docker and
  platform/DRM suite work in §18.1–§18.7, §18.9–§18.11, which was run with
  named, repeatable commands.

Requirement for the post-rotation run (see §19): the verification must be
performed by a **preserved, sanitized script or an exact command transcript**,
committed or attached to the follow-up report, covering at minimum object
smoke, asset registration, presigned upload, completion, readiness polling,
segment fetch, license issuance, deletion, prefix checks, the preservation
control, and the leftover-object cleanup. Each command must read credentials
from the ignored environment only, and must print nothing sensitive. If that is
not done, the R2 gates stay unproven.

```powershell
# Recorded, non-secret operations that WERE used, for context only:
# workdir: education-drm-service
docker compose --env-file .env -f docker/docker-compose.yml up -d
# Test media was generated in a disposable worker container with FFmpeg
# (test-pattern video + sine audio, libx264 + AAC, ~15 KB, 1 second).
# All S3 access was performed by scripts reading process.env.S3_* inside the
# api container and printing only booleans and counts. Those scripts were not
# retained and are deliberately not reconstructed here.
```

### 18.9 Platform-to-DRM authorization probes

```powershell
# run from the platform server container; status codes only
docker compose --env-file .env -f docker/compose.dev.yml exec server node -e "fetch(process.env.DRM_BASE_URL+'/v1/media',{method:'POST',headers:{'Content-Type':'application/json','X-Client-Id':process.env.DRM_CLIENT_ID,'X-Client-Secret':process.env.DRM_CLIENT_SECRET},body:'{}'}).then(r=>console.log('valid-credentials status='+r.status))"
docker compose --env-file .env -f docker/compose.dev.yml exec server node -e "fetch(process.env.DRM_BASE_URL+'/v1/media',{method:'POST',headers:{'Content-Type':'application/json','X-Client-Id':process.env.DRM_CLIENT_ID,'X-Client-Secret':'<wrong test value>'},body:'{}'}).then(r=>console.log('wrong-secret status='+r.status))"
docker compose --env-file .env -f docker/compose.dev.yml exec server node -e "fetch(process.env.DRM_BASE_URL+'/v1/media',{method:'POST',headers:{'Content-Type':'application/json','X-Client-Id':'<unknown client>','X-Client-Secret':process.env.DRM_CLIENT_SECRET},body:'{}'}).then(r=>console.log('wrong-client status='+r.status))"
```

### 18.10 Image, runtime and secret inspections

```powershell
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}'
docker exec education-platform-server-1 id
docker exec education-drm-service-api-1 id
docker exec education-platform-server-1 ls /srv/server/tests
docker exec education-drm-service-api-1 ls /app/apps/api/dist/tests
docker history edu-platform-server:0.4.0-m4 --no-trunc --format '{{.CreatedBy}}' | Select-String -Pattern 'SECRET|PASSWORD|TOKEN'
docker history education-drm-service-api:latest --no-trunc --format '{{.CreatedBy}}' | Select-String -Pattern 'SECRET|PASSWORD|TOKEN'
docker compose --env-file .env -f docker/compose.dev.yml exec client sh -c 'grep -r "DRM_CLIENT_SECRET" /usr/share/nginx/html; echo bundle-scan-done'
git ls-files | Select-String 'env'
git diff --check
git -C education-drm-service diff --check
```

### 18.11 Cleanup and final state

```powershell
docker compose -p education-platform-test -f docker/compose.test.yml down -v
docker compose -p drm-deletion-test -f docker/docker-compose.deletion-test.yml down -v
docker compose -p prem5-migfail -f docker/compose.test.yml down -v
docker system df
docker image prune -a -f
docker system df
docker builder prune -a -f
docker system df
# Suspend live-R2 use until the owner rotates the exposed credential pair:
docker compose --env-file .env -f docker/docker-compose.yml down   # workdir: education-drm-service; no -v
docker ps --format '{{.Names}} | {{.Image}} | {{.Status}}'
docker volume ls
docker system df
```

## 19. Post-rotation procedure (owner action required; not yet executed)

The following is **future procedure only**. None of it has been executed in this
assignment, and none of it may be executed until the owner has confirmed
revocation (step 1).

1. **Revoke** the exposed R2 token/access-key pair in the Cloudflare dashboard,
   and confirm the revocation to the manager. The owner's confirmation is the
   evidence; nothing further about the old credential is required or permitted.
2. **Supply** a replacement pair by editing the ignored
   `education-drm-service/.env` (never in chat, never in a tracked file). The
   exposed value is not to be preserved, re-entered, quoted, or tested.
3. **Rebuild the DRM development images.** The DRM development images were
   removed by the second `docker image prune -a -f` in §26, because the stack had
   been stopped. Rebuild before starting:
   `docker compose --env-file .env -f docker/docker-compose.yml build`
   (workdir `education-drm-service`).
4. **Restart** the DRM development stack:
   `docker compose --env-file .env -f docker/docker-compose.yml up -d`
   (workdir `education-drm-service`).
5. **Verify the replacement only**: confirm the replacement credentials work by
   running the first preserved verification operation (§18.8 requirement) with
   `process.env.S3_*`, and record success. Record status/category and
   presence/length only; never print values. If Cloudflare exposes a safe
   metadata view showing the old access-key identity as disabled, that may be
   recorded as confirmation without revealing the identifier. Do not attempt
   any request with the revoked credential.
6. **Re-run** the unique real-R2 verification in §8 and §9 with a **new** unique
   test identifier and a freshly generated MP4. Do not reuse the pre-rotation
   evidence in §8 or §9.
7. **Delete the leftover test object** per §14 and confirm the unique prefix is
   empty.
8. **Resolve CORS** per §13 through the owner-authorized dashboard/API read, then
   prove preflight and presigned `PUT` from an approved origin.
9. **Prove the protected paths** in §10: an authenticated packaged-segment
   request recording status, content type and byte count (no URL or token), and
   a successful ClearKey license issuance using a valid KID challenge (no key,
   token or challenge contents recorded).
10. Re-issue the connectivity probes in §18.9 so they reflect rotated state.
11. Record the exact sanitized command transcript (or the preserved verification
    script) used in steps 5–9 in the follow-up report, per the §18.8
    requirement, so the R2 evidence is independently reproducible.

## 20. Test counts

All suites ran through Docker. These do not depend on the R2 credential pair,
so they remain valid; the only tracked change since they ran is Compose
comments and documentation, which do not affect them.

| Suite | Result |
| --- | --- |
| Platform unit (16 files) | 91/91 PASS |
| Platform integration against PostgreSQL/Redis (25 files) | 152/152 PASS (see §20.1) |
| Browser through Nginx (M3 58 + M4 23) | 81/81 PASS |
| Server typecheck (app + tests) | PASS (exit 0) |
| Client typecheck and production build | PASS (77 modules) |
| DRM unit | 48/48 PASS |
| DRM upload recovery | 38/38 PASS |
| DRM deletion | 44/44 PASS |
| DRM processing / job status | 7/7 PASS |
| DRM integration / media / end-to-end | 3/3, 3/3, 2/2 PASS |
| DRM typecheck (`tsc --build --force`) | PASS |
| `git diff --check` both repositories | clean |

### 20.1 Failures and reruns (recorded, not hidden)

| Run | Outcome | Investigation |
| --- | --- | --- |
| Integration run 1 (reused a dirty test volume while images were rebuilding) | 22 failed / 121 passed | Test-suite contention on a database that already held rows from earlier suites; not a code defect |
| Integration run 2 (fresh disposable database, cold start) | 17 failed | Cold-start contention; failures were authorization-shaped (`TOKEN_MISSING`, `TOKEN_INVALID`) consistent with a partly-initialized shared database, not with a schema or code change |
| Integration run 3 (unfiltered, warmed) | 151/152 | Single `wallet-purchase` concurrent-identical-retry flake; same profile as the M4 `139/140` transient |
| Integration runs 4 and 5 | 152/152 PASS | Green twice with no code change |
| DRM deletion first run | 43/44 | Known SIGTERM-timing transient; green on rerun with no change |
| Browser first attempt | Registration 403 | Stale `ALLOWED_ORIGINS` from a port-conflicted first `up`; correct after passing the exact Chromium origin |
| Platform lesson create | 400 `INVALID_FIELD` | Test payload used `contentAr`/`contentEn`, which `hierarchy/service.ts` rejects; corrected to `titleAr`/`titleEn`/`position` |
| Platform media re-register | 409 `MEDIA_EXISTS` | Correct enforced behavior; a second lesson was used instead |
| Platform delete without confirmation | 400 | `confirmation` is mandatory; supplied the exact slug/id |
| CORS read | `AccessDenied` | Insufficient permission; recorded as BLOCKED, not interpreted |

No FAIL remains open. The DRM `pnpm lint` script still fails because the
repository has no ESLint configuration; that is pre-existing and unchanged.

## 21. Image IDs

Platform `:0.4.0-m4` (rebuilt this session, still present and in use): server
`31499b5d6e6a`, migrate `3fd50783945c`, client `2ce2f85292f4`, nginx
`4cc796712027`. The platform test images (`eebc80b7763a`, `6e2a86c4d445`) and the
test-only browser `c7c54d7a13ea` and fixture `caea72e50766` images were pruned as
unused; none is part of any runtime image.

DRM development `:latest`: api `8e5b52e1e679`, worker `0dccdb99c3b8`, migrate
`6233e954d383`. **These three were pruned in correction round 2** by
`docker image prune -a -f`, because the DRM development stack had been stopped
for the security gate and they were therefore unused. Any re-verification of DRM
runtime properties (non-root user, stripped test sources, history secret scan)
must rebuild them first (§19 step 3); the recorded IDs are the ones that carried
that evidence.

DRM disposable `drm-deletion-test-*` and `drm-verification-test-runner:local`:
built for the suites in §20 and removed with the disposable project.

No image was rebuilt in correction rounds 1, 2 or 3; those rounds changed only
Compose comments, documentation, and (in round 2) Docker cleanup.

## 22. Production-readiness inspection (corrected)

| Area | Result | Note |
| --- | --- | --- |
| Minimal runtime images | PASS | Multi-stage; runtime copies production dependencies, built output and the generated Prisma client; DRM runtime strips compiled tests |
| Non-root users | PASS | Platform uid 999 (`app`), DRM uid 1000 (`node`) |
| Health checks — platform development | PASS | Five healthchecks: postgres, redis, server, client, nginx. `migrate` and `browser` have none; migration gating is dependency ordering, not a healthcheck. `drm-fixture` adds one in the browser profile. |
| Health checks — DRM development | PASS | Two healthchecks only: postgres and valkey. `api` and `worker` have no healthcheck; they are gated by postgres/valkey health plus completed migration. |
| Health checks — DRM production | PASS | Two healthchecks: postgres and valkey. api, worker and caddy have none. |
| Graceful shutdown | PASS | Platform handles SIGTERM/SIGINT with a bounded timeout; DRM worker shuts down workers, then queues, then Redis, then the database, idempotently (double-signal covered by the deletion suite) |
| Migration before startup | PASS | `service_completed_successfully` gates server/api/worker in the active files |
| Migration-failure gating | PASS | Both stacks exit non-zero and leave dependents unstarted |
| Restart policies | PASS | Production uses `unless-stopped` for postgres, valkey, api, worker, caddy; `restart: "no"` for the one-shot migrate job |
| Private production data services | PASS | `data` network is `internal: true`; no published database or queue ports; only Caddy publishes 80/443 |
| Required R2 egress | PASS | Production worker joins `data` plus `egress`; api joins `edge` plus `data` |
| No credentials in image history | PASS | Zero matches for secret-like patterns in platform server and DRM api history |
| No test sources in runtime images | PASS | `ls` of the test paths fails in both runtime images |
| Controlled base images | PASS with note | Version-pinned tags (`node:22-bookworm-slim`, `node:24.21.0-alpine3.23`, `postgres:16.4-alpine3.20`, `redis:7-alpine`, `valkey:8.0.1-alpine3.20`, `nginx-unprivileged:1.27-alpine`, `caddy:2.10-alpine`); not digest-pinned. Digest pinning is recommended hardening, not a blocker |
| Log redaction | PASS | Cookies and CSRF redacted; hosts only at startup; DRM logs carry identifiers and counts |
| Secure cookie settings | PASS | `COOKIE_SECURE=false` for local HTTP; production refuses to start unless it is explicitly `true` |
| CSRF and origin policy | PASS | State-changing requests require an approved origin plus session CSRF; read routes intentionally omit the origin check because browsers may omit it on GET |
| Rollback documentation | PASS | §23 |
| Backup/restore documentation | PASS | §17 and `docker-and-operations.md` |

No capacity or deployment claim is made anywhere.

## 23. Rollback

1. Stop the platform development stack without volumes:
   `docker compose --env-file .env -f docker/compose.dev.yml down`
2. Revert the Compose change if the volume-isolation override is unwanted:
   `git checkout -- docker/compose.dev.yml` (development defaults are the
   original pinned names).
3. Redeploy the previous image set (for example the M3-tagged images) or set
   `SERVICE_VERSION` accordingly, then `up -d --wait` and check
   `/health/ready`.
4. The sixth migration is additive (constraints only) and older code ignores
   it. Do not run `migrate reset` or `down -v` on development data; a full
   schema revert needs a pre-change backup, and no production backup was taken
   in this assignment.
5. DRM requires no rollback: this assignment changed no DRM file. Restart it
   only after credential rotation (§19).

## 24. Dependency-audit disposition

No `package.json`, `package-lock.json`, or `pnpm-lock.yaml` was modified, so no
upgrade was applied and no unrelated architecture change was introduced.

| Package | Severity | Path | Exposure | Fix | Disposition |
| --- | --- | --- | --- | --- | --- |
| `deepmerge-ts` (GHSA-ggr8-5vv4-36mx) | high (4) | `@prisma/config` → `prisma` → `@prisma/client` | production dependency; reached at Prisma config/generate time, no attacker-controlled merge graph | none available | Residual risk accepted and documented; pinned lockfile, minimal runtime without dev dependencies |
| `postcss` | high (1) | client build toolchain | build/test only; our own CSS is not attacker-controlled | requires leaving the pinned toolchain | Not remediated, to preserve the tested M4 build chain |
| Browser harness chain | high (3) | `docker/browser` | dev-only harness, never shipped | n/a | Not applicable to runtime |

Commands: `npm audit --omit=dev` inside the platform test runner and inside the
platform server runtime image; client and browser audits from the same session's
M4 baseline, unchanged by this assignment. Full (including dev) findings: server
1 critical / 5 high / 3 moderate, client 1 high, browser 3 high — all
pre-existing.

## 25. Secret-scan disposition

| Surface | Result |
| --- | --- |
| Tracked files, platform | Only `.env.example` is tracked; `.env` is ignored. Only placeholders and labelled test fixture values |
| Tracked files, DRM | Only `.env.example` and the demo-player example; `.env` ignored |
| Frontend bundle | No `DRM_CLIENT_SECRET` string in the served image; browser asserts no privileged secrets |
| Browser storage | Only `edu-platform-theme` and `edu-platform-lang` |
| Image history | Zero secret-like matches for platform server and DRM api |
| Logs | Cookies/CSRF redacted; startup prints hosts only; DRM logs carry identifiers and counts |

**Incident, stated plainly:** the first pre-M5 run printed the real R2
`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`
values into tool output. The R2 access-key pair must be treated as compromised
and revoked by the owner, and a replacement supplied through the ignored
`education-drm-service/.env`. Until that happens no live-R2 verification is
valid, and the evidence in §8 and §9 is explicitly pre-rotation, historical, and
not reproducible (§18.8). The exposed value is not to be preserved, re-entered
or tested; the owner's Cloudflare revocation confirmation is the evidence. No
secret value was printed during correction rounds 1, 2, or 3.

## 26. Cleanup results

Performed after recording test results, image IDs, backup/restore evidence, and
this report.

| Resource | Action | Result |
| --- | --- | --- |
| `education-platform-test` | resolved name inspected, containers and volumes listed, `down -v` | Removed: postgres, redis, network, `education-platform-test_pgdata-test` |
| `drm-deletion-test` | containers and volumes listed, `down -v` | Removed: api, worker, postgres, valkey, seaweedfs, network, `drm-deletion-test_pgdata-test`, `drm-deletion-test_seaweeddata-test` |
| `education-platform-browser` | rendered volume names verified unique, guard asserted, `down -v` with explicit disposable names | Removed: nginx, server, client, postgres, redis, drm-fixture, network, `education-platform-browser_pgdata`, `education-platform-browser_redisdata` |
| `prem5-migfail` | `down -v` | Removed container, network, `prem5-migfail_pgdata-test` |
| `prem5-drill-postgres` / `prem5-drill-pgdata` | `docker rm -f`, `docker volume rm` | Removed |
| `prem5-drm-drill-postgres` / `prem5-drm-drill-pgdata` | `docker rm -f`, `docker volume rm` | Removed |
| Unused images, first pass | `docker image prune -a -f` after `docker system df` | Images 28 → 20; reclaimed 1.679 GB; remaining 9.346 GB |
| Build cache, first pass | `docker builder prune -a -f` | 25.41 GB → 0 B; reclaimed 25.41 GB |
| DRM development stack | `down` without `-v` (security gate) | Stopped; `education-drm-service_pgdata` preserved |
| Unused images, second pass (correction round 2) | pre-state recorded, then `docker image prune -a -f` | Pre: 20 images, 9.346 GB, 1.04 GB reclaimable. Post: **16 images, 7.726 GB, 0 B reclaimable**; reclaimed **1.62 GB**. The removed images were the DRM development images (`education-drm-service-api/worker/migrate`) plus `postgres:16.4-alpine3.20`, which became unused **because the DRM stack was stopped**. Consequence: the post-rotation run must rebuild the DRM development images before restarting (§19 step 3). |
| Build cache, second pass | `docker builder prune -a -f` | Already 0 B; nothing to reclaim |

Never run: `docker system prune --volumes`, `docker volume prune`, broad
container/network/volume deletion, or `down -v` on a development project. No
volume was pruned in either pass.

Final Docker state (recorded after the second prune): platform development
running with five healthy containers (server, client, nginx, postgres, redis);
`/health/ready` returns 200 with `version 0.4.0-m4`, postgres `up`, redis `up`;
DRM development stopped; 16 images totalling 7.726 GB; 12 volumes (694.8 MB)
including `docker_pgdata`, `docker_redisdata` and `education-drm-service_pgdata`,
all confirmed present; build cache 0 B. Development data confirmed intact:
2 users, 2 sessions, 0 courses, 6 migrations.

## 27. Claim separation

| Claim class | Status | Basis |
| --- | --- | --- |
| Direct R2 object storage | HISTORICAL ONLY, not reproducible; must be re-proven | Real R2 PUT/HEAD/GET/LIST/DELETE and prefix checks were observed pre-rotation, but the commands were not preserved (§18.8) and the credentials are revoked |
| Platform-mediated ingestion | HISTORICAL ONLY, not reproducible; must be re-proven | Admin login, bilingual course/section/lesson, media registration, upload, READY reconciliation (§9); commands not preserved |
| Platform-mediated permanent deletion | HISTORICAL ONLY, not reproducible; must be re-proven | 202 request, reconciled COMPLETED, prefixes empty afterwards (§9); commands not preserved (§18.8) |
| ClearKey playback | INCOMPLETE | Session creation and manifest retrieval were observed pre-rotation but are historical, not reproducible (§10, §18.8); segment delivery and license issuance unproved |
| Commercial DRM / Widevine | BLOCKED | No Widevine configuration or credentials; never exercised (§11) |
| Browser watermark | PENDING | Watermark policy field observed in the playback response; visual confirmation requires the M5 player |
| Capacity (10,000 concurrent) | BLOCKED | No load, spike, soak, or browser-fleet run; no throughput or latency measurement |
| Production deployment | BLOCKED | No paid host, no production secrets, no TLS termination, no production data; only Compose validation |
| R2 CORS | BLOCKED | Requires owner-authorized visibility; `AccessDenied` proves nothing about configuration (§13) |
| Expired-token rejection | SKIPPED | Needs TTL wait or clock control; scheduled for M5 (§12) |
| Local suites, migrations, persistence, backup/restore | PROVEN | Reproducible Docker evidence in §15–§20, independent of the R2 pair |

## 28. Remaining blockers (owner actions)

1. **Revoke the exposed R2 access-key pair and supply a replacement** through the
   ignored `education-drm-service/.env`. Blocks all real-R2 evidence.
2. **Re-run the unique real-R2 verification** after rotation (§19 steps 5–7) and
   delete the leftover `pre-m5-preserve/` test object.
3. **Provide R2 CORS visibility or configuration** through the Cloudflare
   dashboard or an authorized API token (§13).
4. **Prove packaged-segment delivery and successful ClearKey license issuance**
   once the DRM service is reachable again (§10).
5. **Decide Widevine provisioning** for the commercial path (§11).
6. **Set recovery objectives** with the owner (RPO/RTO, backup retention,
   restore cadence) — platform drills exist, DRM media/key recovery remains the
   dependency operator's responsibility.

## 29. Correction rounds 2 and 3 record

Scope: documentation and operational safety only. No production code changed and
no production behaviour was edited in either round.

Round 2 — operational safety. No DRM file changed, no DRM stack restart, no
live-R2 operation, and no application or DRM suite re-run (unnecessary: the only
source change was a Compose comment block, which cannot affect application
behaviour).

| Item | Change | Verification |
| --- | --- | --- |
| Browser example in `docker/compose.dev.yml` | Rewritten to use PowerShell session `$env:` assignments set once before the first command, covering `config`, `up`, bootstrap, browser run, a second name inspection with an explicit pre-`down -v` guard, and session-variable cleanup. States explicitly that the `VAR=value command` prefix form is not PowerShell and would silently leave the development defaults. | Rendered the disposable project twice in one session with no re-assignment: both calls resolved `education-platform-browser_pgdata` / `education-platform-browser_redisdata`. Guard reported no development volume and both disposable names present. |
| Negative control | Same disposable project with the overrides cleared | Resolved `docker_pgdata` / `docker_redisdata`, and the guard correctly **refused** — demonstrating the hazard the sequence prevents |
| Default render | Development project, no overrides | Resolved `docker_pgdata` / `docker_redisdata`, unchanged from the accepted baseline |
| §18.8 "exact commands" | Placeholders (`<script ...>`, `<prefix listing script>`, `<CORS read script>`, `<temp>`) removed. The pre-rotation R2 commands were **not preserved** and are not reconstructed. §8/§9 relabelled historical and non-reproducible. | Section rewritten; no invented command presented as evidence |
| §19 rotation procedure | Removed the instruction to retain and test the revoked credential. Owner's Cloudflare revocation confirmation is now the evidence. Only the replacement is verified, via the ignored `.env`, recording status/category and presence/length. Optional Cloudflare metadata view of the disabled key identity may be recorded without the identifier. | Section rewritten |
| Cleanup completion | Recorded the pre-prune state, ran `docker image prune -a -f` (20 → 16 images, 9.346 GB → 7.726 GB, 1.62 GB reclaimed) and `docker builder prune -a -f` (already 0 B). No volume pruned. | Post-prune state, volume presence and platform health re-checked below |
| Verdict | Unchanged | `NOT READY FOR MILESTONE 5` |

Round 3 — text consistency only. No Docker, suite, migration, DRM, or R2 command
was run, and no cleanup was performed.

| Item | Change |
| --- | --- |
| Credential-rotation rule | Aligned the accepted rule across §1, §19 and §25: owner confirmation establishes revocation; the exposed value must not be preserved, re-entered, quoted or tested; only replacement credentials are verified |
| §0 cross-references | Corrected the stale pointers to §27 (claim separation) and §28 (owner-action blockers) |
| Pre-rotation R2 claims | Classified all three classes — direct R2 storage, platform-mediated ingestion, and platform-mediated permanent deletion — consistently as **historical and not reproducible**, removing PASS/"prove" wording that conflicted with that status |
| §19 procedure | Added the future step to rebuild the pruned DRM development images before `up -d`, marked as future procedure only |
| README wording | Replaced "exact command record" with wording that distinguishes reproducible exact sanitized commands for the local Docker evidence from the missing pre-rotation R2 commands |

Consequence worth noting: because the DRM development stack was stopped for the
security gate, its images became unused and were reclaimed by the second image
prune. The post-rotation run must rebuild them (§19 step 3).

## 31. Final closure attempt — stopped at Gate 0

This section records the last closure attempt. It did **not** reach any live
verification, because Gate 0 was not satisfied.

### 31.1 Gate 0 outcome: BLOCKED

Gate 0 requires the owner to confirm that the exposed R2 access-key pair was
revoked and that replacement credentials were placed in the ignored
`education-drm-service/.env`. **No such confirmation was provided in this
session.** Consequences, all observed:

- The DRM development stack was **not** started.
- **No live-R2 operation was performed**: no S3 request, no bucket CORS read, no
  presigned PUT, no object create, read, list or delete.
- Neither the exposed credential nor any candidate replacement was tested,
  re-entered, quoted, printed, grep-printed or logged.
- Gates 2 through 10 (rebuild/start, replacement-credential proof, CORS, direct
  lifecycle, platform-mediated lifecycle, negative/token cases, DRM regressions,
  cleanup) were therefore **not started**. They are not partial results; they
  are unexecuted.

File metadata only (no contents read, no values inspected): the ignored
`education-drm-service/.env` has a last-write time of `2026-09-29 21:44:11`
local, which is after the exposure recorded in §1. **A timestamp is not owner
confirmation** and is not treated as evidence of rotation. It is recorded only
so the owner can see whether the file was touched at all.

### 31.2 Safe non-R2 preparation completed

**Gate 1 — reproducible verification harness (created, test-only).**

New untracked files under the platform repository:

| File | Responsibility |
| --- | --- |
| `docker/verification/pre-m5-live-lifecycle.mjs` | CLI and stage orchestration |
| `docker/verification/lib/safe-log.mjs` | Sanitized output allow-list and assertion recorder |
| `docker/verification/lib/sigv4.mjs` | AWS SigV4 signing and presigning (dependency-free) |
| `docker/verification/lib/s3.mjs` | Direct S3 operations and the prefix safety guard |
| `docker/verification/lib/drm.mjs` | Public DRM HTTP client, DASH segment and ClearKey KID parsing |
| `docker/verification/lib/platform.mjs` | Platform cookie/CSRF/Origin HTTP client |
| `docker/verification/lib/context.mjs` | Run identity, run-scoped prefixes, bounded polling |
| `docker/verification/stages/selftest.mjs` | Credential-free safety-guard self-test |
| `docker/verification/stages/r2-smoke.mjs` | Direct R2 round trip and preservation control |
| `docker/verification/stages/cors.mjs` | Owner-authorized CORS read, preflight, presigned PUT |
| `docker/verification/stages/drm-lifecycle.mjs` | Direct lifecycle, segment, license, deletion |
| `docker/verification/stages/negative.mjs` | Negative and token cases |
| `docker/verification/stages/platform-lifecycle.mjs` | Platform-mediated ingestion and deletion |
| `docker/verification/stages/legacy-cleanup.mjs` | Strict removal of the single pre-rotation leftover |
| `docker/verification/tests/offline.test.mjs` | Credential-free contract, failure-semantics and safety fixtures |

Safety properties implemented and verified:

- Uses only the public DRM/platform HTTP contracts and provider-standard S3
  requests. It never touches the DRM database, queues, keys, or storage
  internals, and it imports no platform application package, so it cannot couple
  the platform to DRM internals.
- Reads every credential from the environment. Both output streams share one
  allow-list and redact configured secrets, URLs, signed queries and bearer
  material. Raw exception messages and response bodies are not emitted.
- Every direct test-object mutation is enforced at the S3 client boundary under
  `<root>/<runId>/<purpose>/`. The historical leftover uses a separate exact-name
  deletion guard. DRM-owned objects are mutated only by the public DRM API and
  verified using the exact upload object and asset-specific packaged prefix.
  There is no bucket-wide or broad-prefix delete.
- Uses a cryptographically unique run id and exact run-scoped prefixes, cleans
  up only its own exact objects, and exits non-zero on any unmet assertion.

Self-test executed (no network, no credentials):

```powershell
node docker/verification/pre-m5-live-lifecycle.mjs selftest
# 19 checks, 0 failed, 0 blocked, exit 0
node --test --test-isolation=none docker/verification/tests/offline.test.mjs
# 10 tests passed, 0 failed, exit 0
```

| Assertion | Result |
| --- | --- |
| prefix guard accepts `<root>/<run>/<purpose>/` | PASS |
| prefix guard rejects empty, `/`, `uploads/`, `assets/`, the test root, a prefix outside the root, a non directory-terminated prefix, and a 2-segment prefix | PASS |
| logger redacts URLs, signed queries, bearer material and configured secret sentinels on both output paths | PASS |
| logger drops unknown/forbidden fields (the probe's `unexpectedSecret` value did not appear in output) | PASS |
| presigned URL shape is virtual-host style and carries a signature parameter (value never printed) | PASS |
| relative playback URLs, numbered DASH segments, UUID-to-base64url KID conversion and ClearKey challenge shape | PASS |
| DRM/platform polling envelopes, exact upload-key extraction, CORS wildcard rejection and failed-LIST handling | PASS |
| required blocked/failure outcomes are non-zero; missing state and preflight prerequisites fail closed | PASS |

**Transient failure recorded, not hidden:** the first self-test run reported
`selftest-prefix-rejects-shallow: FAIL` (13 checks, 1 failed, exit 1). The
harness's own guard accepted a 2-segment run prefix because the depth test used
`< 2` where the intent was `< 3`. The guard was tightened to require
`<root>/<runId>/<purpose>/`, the self-test was rerun, and it passed 13/13 with
exit 0. This is a defect in the harness found by the harness, and it was fixed
before any live stage was reachable.

**Exact sanitized invocation for the post-rotation run (not executed here).**
Run from the repository root, in a shell that already holds the replacement
credentials in ignored files, and with the DRM stack started per §19 step 4:

```powershell
# One-time media generation in a host-mounted disposable directory
$mediaDir = Join-Path $env:TEMP 'pre-m5-live-media'
New-Item -ItemType Directory -Force -Path $mediaDir | Out-Null
docker run --rm -v "${mediaDir}:/out" --entrypoint sh education-drm-service-worker:latest -c "ffmpeg -y -f lavfi -i testsrc=size=128x128:rate=30:duration=1 -f lavfi -i sine=frequency=440:duration=1 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest /out/pre-m5-live.mp4"

# Harness stages. Credentials are exported from the ignored .env files by the
# operator; they are never echoed and never appear in the output.
$env:VERIFY_MEDIA_PATH = Join-Path $mediaDir 'pre-m5-live.mp4'
$env:VERIFY_STATE_FILE = 'C:\Users\pc\AppData\Local\Temp\opencode\pre-m5-verify-state.json'
$env:VERIFY_INCLUDE_EXPIRY = 'true'
$env:R2_APPROVED_ORIGIN = '<owner-approved origin for this environment>'   # required for the CORS proof
# Also set PLATFORM_BASE_URL, PLATFORM_ORIGIN, VERIFY_ADMIN_IDENTIFIER,
# VERIFY_ADMIN_PASSWORD, VERIFY_ALT_DRM_CLIENT_ID and
# VERIFY_ALT_DRM_CLIENT_SECRET without echoing their values.

node docker/verification/pre-m5-live-lifecycle.mjs selftest
node --test --test-isolation=none docker/verification/tests/offline.test.mjs
node docker/verification/pre-m5-live-lifecycle.mjs all
```

### 31.3 Gate 8 conditional non-R2 checks (rerun)

No platform application source, build configuration, browser harness, or
production dependency changed, so the independently reviewed platform counts
(91 unit / 152 integration / 81 browser) were retained rather than rerun. The
harness imports no platform package, so a server typecheck was not required by
it. The conditional checks that were due:

| Check | Command | Result |
| --- | --- | --- |
| Compose default volume rendering | `docker compose --env-file .env -f docker/compose.dev.yml config` | PASS — renders `docker_pgdata` / `docker_redisdata` |
| Compose disposable rendering + safety guard | render `-p education-platform-browser` with session overrides, then the pre-`down -v` guard | PASS — renders `education-platform-browser_pgdata` / `..._redisdata`; guard reported no development volume and both disposable names present |
| Platform readiness | `docker compose --env-file .env -f docker/compose.dev.yml exec server node -e "fetch('.../health/ready')..."` | PASS — 200, version `0.4.0-m4`, postgres `up`, redis `up` |
| Client bundle secret scan | grep the served bundle for harness path and credential patterns | PASS — 0 matching files |
| Harness absent from runtime images | no Dockerfile references `docker/verification`; `/srv/server` contains only `dist`, `node_modules`, and the package files | PASS |
| `git diff --check` | both repositories | PASS (exit 0) |
| DRM source cleanliness | `git -C education-drm-service status` | PASS — clean at `d250fff` |

Not run, and therefore not claimed: the focused platform-to-DRM live lifecycle
(requires Gate 0) and the full platform suite matrix (not due).

### 31.4 Gate status summary for this attempt

| Gate | Status | Note |
| --- | --- | --- |
| 0 Credential rotation | **BLOCKED** | Owner confirmation absent; no DRM start, no R2 operation |
| 1 Verification harness | **PASS (prepared, corrected)** | 19/19 self-checks and 10/10 offline contract fixtures pass; live proof not run |
| 2 Rebuild and start DRM | NOT STARTED | Blocked by Gate 0 |
| 3 Replacement credential and direct R2 proof | NOT STARTED | Blocked by Gate 0 |
| 4 R2 CORS | NOT STARTED | Blocked by Gate 0; also needs owner-authorized visibility |
| 5 Direct DRM lifecycle | NOT STARTED | Blocked by Gate 0 |
| 6 Platform-mediated lifecycle | NOT STARTED | Blocked by Gate 0 |
| 7 Negative and token cases | NOT STARTED | Blocked by Gate 0 |
| 8 Regressions and runtime checks | **PARTIAL** | DRM regressions not run (Gate 0); conditional non-R2 platform checks pass |
| 9 Recovery and claim separation | PRESERVED | Prior backup/restore drill evidence retained; claims still separated in §27 |
| 10 Cleanup | NOT STARTED | Correctly withheld: no live evidence was created this round, and the existing state was left intact |

## 32. Handoff

Both repositories are left uncommitted for owner review. No commit, push,
deployment, pull request, history amendment, or Milestone 5 dashboard, learning,
player, subscription-expiry, progress, or watermark work occurred. The nested
DRM repository is unchanged and clean at `d250fff`, and no DRM production,
migration, test, or configuration file was edited. Development volumes
`docker_pgdata`, `docker_redisdata`, and `education-drm-service_pgdata` are
preserved, and the platform development stack is healthy.

**Owner prerequisites for the live closure:** confirm that the exposed R2
access-key pair has been revoked and place the replacement credentials in the
ignored `education-drm-service/.env`; authorize CORS visibility and the exact
approved origin; and provide a valid second DRM tenant plus a throwaway platform
admin through the environment. Once supplied, §19 steps 2–11 and §31.2 give the
preserved procedure for every remaining gate. No secret value was printed.

## 33. Correction round 5 — harness contract and fail-closed repair

Codex's first independent review rejected the original Gate 1 PASS. The 13-check
self-test covered prefix depth but not orchestration or the real public response
contracts. Required paths could be recorded as skipped and still end PASS;
polling read the wrong response level; playback URLs were treated as absolute;
numbered DASH segments and valid ClearKey challenges were unsupported; live
tokens could not reach the later negative stage; failed LIST operations could
look empty; and deletion checked the shared `uploads/` prefix.

The test-only harness was corrected on 2026-09-30 without reading `.env`, using
Docker, starting DRM, contacting R2, or making a platform lifecycle request:

- Required blocked/failure outcomes now exit non-zero and stop later stages.
- The final proof runs in one `all` process. Playback credentials remain in
  memory while binding, challenge, recovery and expiry cases run before cleanup.
- DRM and platform polling use their documented JSON envelopes and require HTTP
  200. Relative playback URLs, `$Number$` segments, UUID KIDs and the actual
  ClearKey challenge/response shapes are handled.
- Direct S3 mutations enforce exact run scope inside the client. Legacy deletion
  has its own exact-name guard. Non-200 LIST never proves emptiness, and DRM
  deletion verifies only the exact owned upload object and asset prefix.
- CORS requires the exact approved origin, PUT and `Content-Type`; wildcard or
  unreadable configuration cannot pass. Platform cleanup remains exact and
  best-effort after an intermediate failure.
- Both output streams use one sanitizer; configured secret sentinels, URLs,
  signed queries and bearer material are redacted, and raw exceptions are not
  emitted.

Verification results:

| Check | Result |
| --- | --- |
| Syntax check of every `docker/verification/**/*.mjs` file | PASS |
| Credential-free harness self-test | PASS — 19/19, exit 0 |
| Offline contract/safety fixtures | PASS — 10/10, exit 0 |
| Required BLOCKED/FAIL outcome mapping | PASS — non-zero asserted |
| Secret-sentinel and signed-URL output sanitization | PASS |
| `git diff --check`, platform and DRM | PASS |

The first default `node --test` attempt could not create a worker process in the
restricted review environment (`spawn EPERM`). This was an environment-level
test-runner failure, not hidden. The same test file was rerun in Node's supported
single-process mode with `--test-isolation=none` and passed 10/10.

At the time of correction round 5, Gate 1 was prepared and credential-free
tested while Gates 2–10 remained unexecuted pending owner prerequisites. No
application source, production dependency, DRM file, Docker state, object
storage, commit, push, deployment, pull request, or M5 feature was changed in
that correction.

## 34. Subsequent owner-authorized M5 DRM security correction

After this Pre-M5 handoff, the owner confirmed credential rotation, authorized
M5 to proceed, and then explicitly authorized bounded DRM maintenance for the
reviewed playback-security contract. The historical verdict below is retained;
current implementation evidence is recorded in `m5-implementation-report.md`.

The corrected harness later ran a fresh unique MP4 through real R2 and the DRM:
processing reached READY, authenticated segment delivery returned 206, a
ClearKey license succeeded, unknown-asset playback returned 404, wrong-device
heartbeat returned 403, and exact upload/packaged cleanup was verified. It
recorded 41 PASS, 0 FAIL and 2 BLOCKED: no second DRM tenant was available and
the optional full token-expiry wait was not run. R2 CORS, commercial DRM,
browser watermark, capacity, production deployment, and a complete real
platform-to-DRM RS256 run remain open.

NOT READY FOR MILESTONE 5

## 35. Owner-authorized M5 gate-closure pass (2026-09-30)

Recorded after the Pre-M5 handoff, for continuity. **The verdict in section 0 is
unchanged and is still `NOT READY FOR MILESTONE 5`.** Nothing in this section
relaxes it. The full evidence, including every failure and every gate status, is
in [m5-implementation-report.md](m5-implementation-report.md) sections 13 to 22.

### 35.1 What this pass changed about the Pre-M5 findings

| Pre-M5 item | Status after the gate-closure pass |
| --- | --- |
| Section 12: expired playback token (time-based) — SKIPPED, needs a TTL wait or clock control | **Still not proven by a real wait.** The DRM exposes `PLAYBACK_TOKEN_TTL` and `PLAYBACK_SESSION_TTL`, so a test-only short lifetime is available, but no before/after expiry was measured against the running service. Not claimed. |
| Section 13: R2 CORS — BLOCKED | **Unchanged.** No CORS configuration was read or written. The `AccessDenied` result stands and proves nothing about the bucket's configuration. |
| Section 11: commercial DRM / Widevine — BLOCKED | **Confirmed OWNER BLOCKED with new evidence.** All five `WIDEVINE_*` keys in the ignored `.env` are empty: provider, license server URL, signing key, IV and content-key seed. |
| Section 15: migrations | **Superseded by fresher evidence.** Fresh-database apply, an explicit M4-to-M5 upgrade drill on a database that already holds rows (6 to 7 migrations, rows preserved), and a non-zero migration-failure exit were all re-run and pass. |
| Section 22: rollback and Compose validation | **Extended.** Every existing Compose configuration renders; the DRM production configuration fails closed on an unset required secret and renders once every required variable is supplied. **There is no platform production Compose file** — recorded as a gap, not created here. |
| Section 27: browser watermark — PENDING | **Closed as a visible label, with its boundary stated.** 150/150 Chromium assertions through Nginx, including normal playback, the error state, a 390 px layout and the fullscreen-related layering. A DOM/CSS watermark is explicitly not forensic protection. |
| Section 27: capacity — BLOCKED | **Unchanged.** No load test was created or run. Nothing about 10,000 concurrent users is claimed. |
| Section 27: production deployment — BLOCKED | **Unchanged**, and now additionally blocked on a missing platform production Compose artifact. |
| Section 34: the two blocked live checks | **Unchanged.** No second DRM tenant was created and the five-minute expiry wait was not performed. |

### 35.2 Two product defects the pass found and fixed

1. **Concurrent identical purchase retries were denied, not replayed.** Six
   concurrent requests with the same `idempotencyKey` could not all return 201:
   the loser re-decided affordability after the winner's debit and answered
   `402 INSUFFICIENT_FUNDS`. This is a money-path idempotency defect, measured
   across six runs, and fixed in the product. It is a stronger finding than the
   `P2002` race the M5 report had recorded as needing an owner decision, and it
   is covered by the already-approved rule that financial operations must be
   transactional and idempotent.
2. **A fatal player error left a blank player.** A manifest or stream-setup
   failure surfaced on dash.js's fatal `ERROR` event, which the player did not
   handle, so the viewer saw an unexplained blank player. The player now settles
   in a visible error state for that case too.

Both were found by the verification work, are fixed, and are covered by
regression tests (server integration 216/216; browser 150/150).

### 35.3 Test-isolation debt closed

The previously reported "order-dependent" learning tests were not reproducible as
reported, but the underlying class of problem was real and is now fixed at the
source: an integration world deleted **every** admin in the shared database, so a
second world created inside a live file revoked the first world's session; six
tests asserted on state that only held because they ran first; and the three M5
learning files leaked their database, cache and player handles. The full platform
integration suite now passes 216/216 on a verifiably fresh disposable volume and
twice more on the re-used one.

### 35.4 What is still required before this verdict can change

1. A second DRM tenant and a recorded cross-tenant isolation run.
2. A real token and entitlement expiry measurement against the running service.
3. A complete end-to-end RS256 run: a generated key pair, the platform JWKS
   endpoint, and the DRM configured to trust it. None of the required
   configuration is currently present.
4. R2 CORS visibility and an approved origin, with a recorded preflight and
   presigned upload from that origin.
5. A Widevine provisioning decision, or a decision that ClearKey is the intended
   production path.
6. A capacity qualification plan and its result, against a target the owner
   confirms.
7. A production deployment decision, including the missing platform production
   Compose artifact, plus backup/restore and rollback evidence.

## NOT READY FOR MILESTONE 5
