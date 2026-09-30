# Docker and operations plan

Current local verification status (2026-10-01): see [manager continuation review](m5-manager-continuation-review.md) and [the bounded recorded-manifest repair](drm-recorded-manifest-repair-proposal.md). The owner-authorized static recorded-manifest repair and 65-check real-browser journey passed; closure changes await owner acceptance. The verification stack at the approved localhost port 8082 is healthy, uses isolated volumes, and the API TTL has been restored to 300 seconds. No production release is approved.

Platform development, tests and deployment use Docker. External DRM remains unchanged and is consumed through its API.

| Service | Requirement |
| --- | --- |
| client/ | Separate platform frontend image/container |
| server/ | Separate modular Express image; replicas use that same image |
| Nginx | Platform reverse proxy/load balancing |
| PostgreSQL | Platform database container/persistence; Prisma migrations own platform schema only |
| Redis | Platform cache/session/job/realtime infrastructure per approved contracts |
| Migrations/tests | One-shot jobs and isolated test volumes |
| Confirmed platform workers | Separate container/image when required by approved work package |
| External DRM | Independently operated package; reference API endpoint and server credentials, no internal edits |
| Browser evidence | Accepted M2–M4 screenshots live in `reports-and-markdown-files/m3-evidence/` and are never overwritten by later runs; M5 screenshots go to `reports-and-markdown-files/m5-evidence/` via the browser service's second evidence mount (`M5_EVIDENCE_DIR`) |
| Object storage | Cloudflare R2 through external DRM in development and production; SeaweedFS only in isolated disposable DRM regression tests. Real-R2 status and open blockers are tracked in the Pre-M5 report. |

For local real media integration, connect to the unchanged external DRM distribution via a reachable API URL. Its own existing containers remain its responsibility. Do not copy its code into platform images or merge its database. A Docker contract double is permissible for isolated platform tests only and cannot prove real video security. Cloudflare's hosted service is not assumed to run inside Docker.

## Foundation acceptance

Provide documented clean build/start commands, separate logs, pinned dependencies, health/readiness, startup ordering, persistent development volumes and disposable test volumes. Basic platform startup should work without paid/live service credentials. Storage-specific and real-DRM tests must clearly state their external/local dependency requirements.

Development volumes default to `docker_pgdata` / `docker_redisdata` to preserve the accepted database when the stable project `education-platform` is used. Every disposable verification project must set `PGDATA_NAME` / `REDISDATA_NAME` to isolated names so `down -v` never deletes development data. Never run `down -v` on `education-platform`, `education-drm-service`, or `education-drm-service-production`, and never run `down -v` before inspecting the resolved names.

Inspect resolved names first (read-only, safe). Set the disposable overrides once
as **PowerShell session variables** before the first `-p` command, so that every
later `config`, `up`, `run` and `down -v` in the same shell receives them. The
POSIX `PGDATA_NAME=... command` prefix form is not PowerShell and silently
leaves the development defaults in place.

```powershell
# Development defaults must render docker_pgdata / docker_redisdata
docker compose --env-file .env -f docker/compose.dev.yml config | Select-String 'name: (docker_|education-)'

# Disposable browser project: session-scope the overrides once
$env:PGDATA_NAME    = 'education-platform-browser_pgdata'
$env:REDISDATA_NAME = 'education-platform-browser_redisdata'
$env:NGINX_PORT     = '8081'
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser config | Select-String 'name: (docker_|education-)'

# Immediately before any `down -v`, assert the disposable names are resolved
$rendered = docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser config | Select-String 'name: (docker_|education-)'
$rendered
if ($rendered -match 'docker_pgdata|docker_redisdata') { throw 'REFUSING down -v: a development volume name is resolved' }
if (-not ($rendered -match 'education-platform-browser_pgdata' -and $rendered -match 'education-platform-browser_redisdata')) { throw 'REFUSING down -v: disposable volume names not resolved' }
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser down -v

# Clear the session overrides
'PGDATA_NAME','REDISDATA_NAME','NGINX_PORT' | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
```

Expected: development renders `docker_pgdata` / `docker_redisdata`; the
disposable project renders unique `education-platform-browser_*` names. With the
overrides cleared, the disposable project falls back to the development names —
which is exactly what the guard above exists to prevent. The full documented
sequence lives in the browser comment block of `docker/compose.dev.yml`.

## Live verification harness (test-only)

`docker/verification/` holds the Pre-M5 live-verification harness. It is
operator tooling, not an application component:

- No Dockerfile copies this directory, so it cannot reach a runtime image or a
  frontend bundle.
- It imports no platform application package and uses only the public
  DRM/platform HTTP contracts plus provider-standard S3 requests, so it cannot
  couple the platform to DRM internals.
- Credentials come from the environment only. Both output streams use the same
  allow-list and redact configured secrets, URLs, signed queries and bearer
  material; raw exception messages and response bodies are not emitted.
- Every direct test-object mutation is enforced at the S3 client boundary under
  `<root>/<runId>/<purpose>/`. The legacy cleanup has a separate exact-name
  guard for the one historical object. DRM-owned upload and packaged objects are
  created/deleted only through the public DRM contract and are checked by exact
  object key or asset prefix; there is no bucket-wide or broad-prefix delete.

Run the credential-free self-test first; it needs no configuration and no
network:

```powershell
node docker/verification/pre-m5-live-lifecycle.mjs selftest
node --test --test-isolation=none docker/verification/tests/offline.test.mjs
```

The final live proof must run as one `all` process so playback tokens remain
memory-only and active-session negative cases execute before cleanup. Individual
stages are diagnostics, not final closure evidence. No live stage must start
until the owner has
confirmed that the exposed R2 credential pair was revoked and the replacement is
in place. A valid second DRM tenant, owner-approved CORS origin/visibility and a
throwaway platform admin are also required. Exact invocations and evidence are
recorded in the Pre-M5 report.

## Object-storage credential handling

R2 and application credentials live only in ignored `.env` files. Never print, grep-print, echo, or `Select-String` their values; verify only presence and length. If a credential is ever exposed in output, treat it as compromised: stop all live object-storage operations and require owner rotation through the ignored file. Do not preserve, re-enter or test the exposed value; the owner's provider-side revocation confirmation is the evidence, and only the replacement is verified afterwards. The 2026-09-29 Pre-M5 run exposed an R2 key pair this way; rotation and post-rotation re-verification are owner actions recorded in the Pre-M5 report, which is why the R2 evidence there is marked pre-rotation and non-reproducible.

Validate browser/public URLs separately from Docker service names. Keep privileged credentials out of frontend build args and bundles. Do not expose production data-service ports. No local FFmpeg/Packager installation or platform video-worker implementation is required.

## Production review

Check non-root application users, runtime contents, graceful shutdown, resource limits, secret injection, TLS/proxy boundaries, cookie policy, network access and replica readiness. Verify Prisma migration ordering, failure recovery and app rollback compatibility. Containerization alone does not establish high availability.

Back up and restore platform data/configuration. Obtain separate external DRM/media/key recovery evidence from that dependency's operator; do not take over its database/key internals. Set recovery objectives with the owner.

Monitor API latency/errors, DB pool waits, Redis failures, job retries, manual approval audit, wallet reconciliation, subscription expiry and failed external termination, as well as observed DRM readiness/playback errors. External service metrics require an agreed monitoring contract.

No runtime verification is claimed by this documentation update; current verification evidence and open blockers live in the Pre-M5 production-readiness report.

## Migration drills

Two drills are reproducible and both live under `docker/verification/`. Neither
touches a development database.

```powershell
# 1. Upgrade drill: applies the six accepted M4 migrations, inserts representative
#    rows, then applies the M5 migration and proves the rows survived. It creates
#    and drops its own uniquely named database through the postgres maintenance
#    database, and refuses to run unless the name is clearly disposable.
docker compose -p education-platform-test -f docker/compose.test.yml run --rm `
  -e UPGRADE_WORKSPACE=/srv/server `
  -e UPGRADE_ADMIN_URL='postgresql://postgres:postgres@postgres:5432/postgres' `
  -e UPGRADE_MIGRATIONS_DIR='/srv/server/prisma' `
  -e UPGRADE_DB_NAME='upgradeprobe_m5' `
  -e UPGRADE_M4_PREFIX='20260930140000' `
  -v "${PWD}/docker/verification:/srv/server/verification-drill:ro" `
  --entrypoint sh test -c 'cd /srv/server && node verification-drill/upgrade-migration-drill.mjs'

# 2. Failure gate: an unreachable database must exit non-zero and leave the
#    dependent service unstarted.
docker compose -p education-platform-test -f docker/compose.test.yml run --rm `
  -e DATABASE_URL=postgresql://bad:bad@127.0.0.1:5999/nope migrate
```

## Credential presence, without reading values

`docker/verification/credential-presence-audit.mjs` reports, per key, only
whether it is present, its length, and a coarse category (`placeholder-like` or
`set`). It never prints a value, a prefix or a suffix, and never writes a file.
Use it to record exactly which gate is blocked by missing configuration:

```powershell
node docker/verification/credential-presence-audit.mjs .env education-drm-service/.env
```

This is the only sanctioned way to inspect ignored environment files during
verification. It is what established that Widevine is `OWNER BLOCKED` (all five
`WIDEVINE_*` keys empty) and that end-to-end RS256 is unconfigured on both sides.

## Integration-suite isolation contract

The integration suite shares one disposable database, so its isolation is
explicit and each rule is load-bearing:

- **A world must never touch another world's data.** `createCatalogWorld`,
  `createWalletWorld` and `createLearningWorld` clear only the tables they are
  about to assert on, and create their own `ADMIN` through `createTestAdmin`.
  Never reintroduce a global `user.deleteMany({ role: 'ADMIN' })`: it revokes
  the session of any world still in use and produces `401 TOKEN_INVALID` in
  unrelated tests.
- **A world created while a sibling is alive must pass `resetSharedState: false`.**
  The reset is global.
- **A test that asserts on a clean baseline establishes it itself.** Do not rely
  on running first. Reset the financial tables, the progress row, or the
  subscriptions the assertion depends on.
- **The D13 one-time bootstrap rule is global and is covered in exactly one
  place**, `identity-admin.test.ts`, which clears all admins itself in each test.
- **Every world must be closed in `afterAll`.** A leaked Prisma client, database
  pool, cache client or player fixture outlives its file.
- **The suite must be run against a verifiably fresh disposable volume.**
  `docker compose … run migrate` is a no-op when the one-shot migrate container
  is already up, so check `_prisma_migrations` and the row counts before trusting
  a "fresh" run.

Editing files that contain non-ASCII (Arabic labels, bidi text) must be
byte-exact. A shell text round trip can silently re-encode a UTF-8 file as
Windows-1252; a `node --check` will not catch it, but a browser assertion that
matches Arabic text will. Verify the code points after editing.

## No platform production Compose file exists

The platform has `docker/compose.dev.yml` and `docker/compose.test.yml` only.
The DRM has a production configuration, which fails closed on an unset required
secret and renders once every required variable is supplied. Creating a platform
production configuration is an open item that needs owner decisions on the host,
secrets injection, replica count and TLS termination; it was deliberately not
invented during the M5 gate-closure pass.
