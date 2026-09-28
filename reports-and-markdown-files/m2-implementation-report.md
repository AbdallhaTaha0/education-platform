# M2 implementation report — identity and bilingual shell

Date: 2026-09-28. Scope: Milestone 2 (WP2) only. M1 accepted at `fce352f`;
M1 behavior (health, redaction, migration ordering, non-root images, Nginx
routing, readiness, graceful shutdown) is preserved and re-verified. No
commit, push, M3 work, deployment, or production-readiness claim. No local
admin password appears anywhere in this report or any tracked file.

## 1. Changed files

Backend (`server/`):
- `src/modules/identity/{errors,validation,password,tokens,store,cookies,csrf,rateLimit,middleware,service,routes,bootstrap,index}.ts` (new internal module)
- `src/bootstrap.ts` (new; first-admin CLI, `npm run bootstrap:admin`)
- `src/infra/prisma.ts` (new Prisma singleton), `src/infra/redis.ts` (added `ensureRedis`)
- `src/{app,config,index}.ts`, `src/middleware/errorHandler.ts`, `src/logger.ts` (extended)
- `prisma/schema.prisma`, `prisma/migrations/20260928091356_m2_identity/` (new), `prisma/README.md`
- `package.json` 0.2.0 (+argon2, jsonwebtoken, libphonenumber-js), lockfile
- `vitest.config.ts` (`fileParallelism: false`, 30s timeouts)
- tests: `unit/{identity-validation,identity-crypto,identity-cookies}.test.ts` (new);
  `unit/{config,health,logging}.test.ts`, `integration/health.test.ts` (extended);
  `integration/{identity-helpers,identity-auth,identity-security,identity-admin}.test.ts` (new)

Frontend (`client/`): `src/{auth,screens}.tsx` (new), `src/{App,i18n,main}.tsx`,
`src/styles.css`, `package.json` 0.2.0 (no new runtime deps; hash routing).

Platform: `docker/compose.{dev,test}.yml` (0.2.0-m2 tags, auth env, `NGINX_PORT`,
browser profile), `docker/browser/{Dockerfile,package.json,package-lock.json,run.mjs}` (new),
`.env.example` (auth contract), root `.env` (ignored; local secret only).

Docs: this report + `reports-and-markdown-files/m2-evidence/` (3 PNGs).

## 2. Requirement mapping

- R01 (bilingual): Arabic-default RTL / English LTR identity screens, localized
  machine-readable error codes, LTR-isolated email/phone/password inputs,
  `ar-EG`/`en-US` date formatting, focus management, 44px targets.
- R02 (two roles): native PG `Role` enum + app whitelist; public registration
  forces STUDENT; role fields rejected (400); STUDENT→403 on `/admin/users`.
- R09 (stack): same React/Express/Prisma images; identity is an internal
  module (`server/src/modules/identity/`), not a service.
- R10 (Docker): all builds/tests/browser runs containerized; isolated
  `education-platform-test` and `education-platform-browser` projects.
- R13 (cookie auth): HttpOnly access/refresh cookies, no tokens in bodies,
  storage, logs, or bundles; server sessions; immediate revocation.
- R16 (first-admin bootstrap + ADMIN-only creation): one-time Docker bootstrap
  succeeds once then refuses (exit 1, concurrent-safe via advisory lock);
  only authenticated ADMIN creates later admins; STUDENT/anonymous attempts
  fail (403/401); no recovery endpoints; local credentials handed to owner
  outside tracked files.

## 3. Data/session invariants

- `User`: uuid id, normalized unique email/phone, Argon2id hash, display
  name, `Role`, timestamps. Email lowercased/trimmed; phone canonical E.164
  (Egypt default region; Arabic-Indic digits converted; valid international
  kept; no Egypt-only rule).
- `AuthSession` (family): owner, CSRF digest, absolute 30-day expiry,
  `lastUsedAt`, `revokedAt`/`revokeReason`. One row per login.
- `RefreshToken`: per-credential SHA-256 digest (unique), consumed flags.
  Raw secrets and plaintext passwords never persist.
- Rotation is one transaction (`SELECT … FOR UPDATE`): a credential succeeds
  at most once; concurrent losers observe consumption → family revoked;
  reuse of a consumed credential revokes the family; absolute expiry never
  extends. Reuse is detected BEFORE the CSRF check so stale-bound replays
  still revoke.
- PostgreSQL is the per-request durable authority; Redis holds only
  revocation tombstones (`sessrev:{sid}`, 15-min TTL) and rate-limit
  counters — no positive session cache, hence no stale window. Tombstones
  are written on logout, logout-all, reuse-revocation, and lazily when a
  revoked row is observed.
- Indexes: `User(email)`, `User(phone)`, `User(role)`,
  `AuthSession(userId)`, `AuthSession(absoluteExpiresAt)`,
  `RefreshToken(tokenHash)` unique, `RefreshToken(sessionId)`; FK cascades.

## 4. Endpoint matrix (backend mounted at `/auth`, `/admin`; `/api` stripped by Nginx)

| Method & path | Guards | Success | Notes |
|---|---|---|---|
| GET /auth/csrf | — | 200 + readable cookie | Rebinds when already authenticated; no credential |
| POST /auth/register | rate-limit, origin, anonymous CSRF | 201 STUDENT + cookies | Role fields → 400; conflicts → 409 |
| POST /auth/login | rate-limit, origin, anonymous CSRF | 200 + cookies | One identifier; uniform 401 shape |
| POST /auth/refresh | rate-limit, origin, in-tx session CSRF | 200 + rotated cookies | No tokens in JSON |
| POST /auth/logout | origin (+CSRF iff credential present) | 200, clears cookies | Idempotent |
| POST /auth/logout-all | origin, auth, session CSRF | 200 + revoked count | Revokes all families of the user |
| GET /auth/me | auth | 200 safe profile | 401 codes by cause |
| POST /admin/users | rate-limit, origin, auth, ADMIN, session CSRF | 201 ADMIN | STUDENT → 403; role field → 400 |

Envelope `{data}` / `{error:{code,message,requestId,details?}}`; 401 for
missing/invalid/expired/revoked, 403 for role/CSRF/origin denial, 409 for
taken identifiers, 429 with `Retry-After` for limits.

## 5. Cookie, CSRF, and origin policy

- `edu_access`: HttpOnly, SameSite=Lax, Path `/api`, Max-Age 900, Secure in prod.
- `edu_refresh`: HttpOnly, SameSite=Lax, Path `/api/auth`, Max-Age = remaining
  session life (≤30d). No `Domain` anywhere; clearing matches paths + epoch.
- `edu_csrf`: readable synchronizer only (256-bit hex), SameSite=Lax, Path `/`.
  Pre-session bootstrap uses a one-day lifetime; once a session exists its
  Max-Age is capped at that session's remaining absolute lifetime. The value
  is session-bound via a stored SHA-256 digest.
- Origins: exact allowlist match required on state-changing routes; missing or
  unlisted → 403 (no Referer fallback, no wildcards — enforced in config).
- CORS unchanged (same-origin only, no credentialed wildcard).

## 6. Environment/configuration contract (all server-only)

`AUTH_JWT_SECRET` (required, ≥32 chars), `AUTH_ISSUER`/`AUTH_AUDIENCE`
(required, non-empty, no `*`), `ALLOWED_ORIGINS` (required CSV of http(s)
URLs, no `*`), `COOKIE_SECURE` (production refuses to start unless `true`;
dev explicitly `false`), `ARGON2_MEMORY_KB/TIME_COST/PARALLELISM`
(defaults 65536/3/4; reduced only in isolated test compose),
`BOOTSTRAP_ADMIN_{NAME,EMAIL,PHONE,PASSWORD}` (bootstrap CLI only).
`.env.example` holds placeholders; real local secret lives in ignored root
`.env` (Compose needs `--env-file .env` since it otherwise reads `docker/`);
test compose carries distinct test-only secrets. Nothing secret is VITE_-
prefixed or bundled (bundle scan: only the public `edu_csrf` name present).

## 7. Migration name and compatibility

`20260928091356_m2_identity` (additive; generated via `migrate dev` in Docker
against a throwaway database, then destroyed). Applies on top of accepted M1
schema — verified on the real dev volume (`m1_init` + `m2_identity` rows).
M1 migration untouched. Rollback: previous images remain compatible (M2 code
only adds tables); never `migrate reset`; never `down -v` on dev.

## 8. Exact Docker commands (repo root; PowerShell)

```powershell
docker compose -f docker/compose.test.yml config --quiet
docker compose -p education-platform-test -f docker/compose.test.yml build
docker compose -p education-platform-test -f docker/compose.test.yml up -d --wait migrate
docker compose -p education-platform-test -f docker/compose.test.yml run --rm test
docker compose -p education-platform-test -f docker/compose.test.yml down -v
docker compose --env-file .env -f docker/compose.dev.yml build
docker compose --env-file .env -f docker/compose.dev.yml up -d --wait
docker compose --env-file .env -f docker/compose.dev.yml run --rm --no-deps -e BOOTSTRAP_ADMIN_NAME=.. -e BOOTSTRAP_ADMIN_EMAIL=.. -e BOOTSTRAP_ADMIN_PHONE=.. -e BOOTSTRAP_ADMIN_PASSWORD=.. server node dist/bootstrap.js
docker compose -f docker/compose.dev.yml build browser
$env:NGINX_PORT='8081'; $env:ALLOWED_ORIGINS='http://localhost:8080,http://nginx:8080'
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml up -d --wait
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml run --rm --no-deps -e BOOTSTRAP_ADMIN_*=.. server node dist/bootstrap.js
$env:BROWSER_ADMIN_EMAIL=..; $env:BROWSER_ADMIN_PHONE=..; $env:BROWSER_ADMIN_PASSWORD=..
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser run --rm browser
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml down -v
```
(Ellipses stand for environment-supplied values; no real credential is stored
in any command file. Full values for the local dev admin are in the handoff
message only.)

## 9. PASS/FAIL/BLOCKED results

| # | Check | Result |
|---|---|---|
| 1 | Compose validation (dev, test, browser profile) | PASS |
| 2 | Clean M2 builds (server incl. argon2 native + Prisma gen, client `tsc -b`, nginx, browser) | PASS |
| 3 | M2 migration applies over accepted M1 schema on dev volume | PASS |
| 4 | Server/client typechecks (host + test-image container) | PASS |
| 5 | Unit 45/45 (validation, crypto, cookies, logout durability, config fail-closed incl. Argon2 bounds, health, logging) | PASS |
| 6 | Integration 52/52 on real PG/Redis (auth, session lifetime, redis concurrency, security, admin/bootstrap, health, write-smoke) | PASS |
| 7 | Normalization/conflicts/policy: EG local + Arabic-Indic + international phones canonicalized; duplicate email/phone rejected with distinct codes; 12–256 char password, no composition rules | PASS |
| 8 | Rotation/reuse/concurrency: rotation issues fresh credentials; replay returns TOKEN_REUSED with `revokedAt`/`revokeReason=reuse` persisted, zero outstanding credentials, winner credential fails; concurrent pair allows exactly one success | PASS |
| 9 | Revocation: logout revokes immediately (tombstone + PG); access-only logout revokes via verified sid; logout-all revokes all user sessions only; PG stays authoritative after tombstone deletion | PASS |
| 10 | Rate limiting: Redis fixed-window login/register/refresh/admin limits shared across replicas; 429 + Retry-After; every `rl:*` key has bounded TTL (atomic Lua INCR+EXPIRE) | PASS |
| 11 | Role isolation: STUDENT→403 FORBIDDEN on `/admin/users` (UI gate + API); anonymous→401; native enum rejects third roles | PASS |
| 12 | Browser storage absence: HttpOnly access/refresh, readable CSRF only; localStorage holds only `edu-platform-lang`; sessionStorage/IndexedDB empty; no cookie values in storage | PASS |
| 13 | Secret redaction: M1 header paths + `x-csrf-token`; regression tests with dummy values; live Docker logs contain no tokens/cookies/secrets; bundle holds only the public `edu_csrf` name | PASS |
| 14 | CSRF/origin: exact-origin allowlist enforced (missing/hostile→403); missing/mismatched/cross-session CSRF→403; valid same-origin passes | PASS |
| 15 | Cookie attributes: dev `HttpOnly`/`SameSite=Lax`/paths/max-ages without `Secure`; production-mode app sets `Secure` on all three | PASS |
| 16 | Bootstrap: CLI succeeds once (safe JSON, exit 0), refuses repeats/invalid input (exit 1, silent), concurrent pair yields exactly one ADMIN; admin email+phone login verified through Nginx | PASS |
| 17 | Browser 20/20 through Nginx: registration, email/phone login, logout/all, admin creation, Arabic RTL + English LTR + 390px mobile, screenshots in `m2-evidence/` | PASS |
| 18 | M1 regressions: health/live/ready, 503 on dead deps, migration-failure drill (exit 1), graceful shutdown behavior unchanged | PASS |
| 19 | Restart persistence on dev: `down`/`up` preserves users, sessions, migration history; stack returns healthy | PASS |
| 20 | Production fail-closed: weak secret, `COOKIE_SECURE=false`, wildcard origins, weak/absurd Argon2 all refuse startup | PASS |
| 21 | DRM before/after: clean status, HEAD `6135bf5`, 132 files, combined SHA256 identical | PASS |

## 10. Review-corrections round (2026-09-28, second verification pass)

Blocking review findings were corrected without expanding scope; no M3 work,
no commits, no design.md edits, no DRM changes.

1. **Durable replay revocation**: `rotateRefreshCredential` now returns a
   typed `RotationOutcome` (`rotated`/`reused`/`revoked`/`expired`/`invalid`)
   instead of throwing inside the transaction. Replay commits
   `revokedAt`/`revokeReason='reuse'` plus consumption of every outstanding
   family credential; the Redis tombstone and `TOKEN_REUSED` follow the
   commit. Live proof on dev: register→200, rotate→200, replay→401
   `TOKEN_REUSED`, winner retry→401, DB row `revokeReason=reuse, revoked=t`,
   outstanding=`0`.
2. **Concurrency-safe lazy Redis**: `ensureRedis` shares one pending attempt
   per client (`WeakMap`) and observes `connect`/`connecting`/`reconnecting`
   via `ready`/`end`/`close` instead of duplicate `connect()` calls; genuine
   failures reject all waiters (fail closed, no bypass). Tests: 20
   simultaneous first-connects resolve together; 10 parallel cold
   registrations return 201 with zero 500s; dead Redis yields controlled
   500 `internal_error` on writes and reads.
3. **CSRF session lifetime**: session-bound CSRF cookies live at most the
   remaining absolute session life (rotation rebinds a fresh value each
   time); `GET /auth/csrf` with a valid session rebinds to that same
   session, and refuses (401, no cookie) on stale access credentials.
   Tests: refresh after 2 idle days succeeds; mid-session bootstrap keeps
   refresh working; Max-Age never exceeds remaining life; cross-session and
   null-binding values fail closed.
4. **Argon2 minimums**: dev/production reject anything below 65536/3/4;
   every environment rejects absurd values above 1048576/10/16; reduced
   values allowed only under explicit `NODE_ENV=test`. Live proof: dev
   startup with `1/1/1` and with `99999999` memory both fail closed.
5. **Truthful logout**: PG revocation failure propagates as controlled 500
   (unit-proven with stubbed persistence); access-cookie-only logout revokes
   via the verified sid; tombstone failure stays best-effort after the
   durable commit; frontend keeps the authenticated state on logout failure
   instead of faking success. Tests: normal, access-only, failure, idempotent,
   and post-tombstone-deletion revocation.
6. **Atomic rate limiting**: single Lua `INCR`+conditional `EXPIRE`+`TTL`
   step; every created `rl:*` key verified with positive bounded TTL.

Re-verification environment: Docker Desktop 4.93.0, Engine 29.8.1, Compose
5.5.1. Docker volumes were destroyed by the Desktop reinstall and recreated;
M2 migration applied cleanly to the fresh dev database (`m1_init` +
`m2_identity` rows verified), all data above was regenerated, and a fresh
dev admin was bootstrapped (credentials in handoff message only).

Final image IDs (`:0.2.0-m2`): server `ad6d8addc5b9`, migrate `02d6b0920d42`,
client `1243bbfea9c3`, nginx `b7246fe52059`, server-test `fa2335699e34`,
migrate-test `f40d68256b9b`, browser `fb569d06d80f`.

Fresh results: unit 45/45, integration 52/52 (7 files), browser 20/20 — zero
FAIL, zero BLOCKED. Development stack left healthy (`ready`); disposable
`education-platform-test` and `education-platform-browser` projects removed
with `-v` (only `docker_pgdata`/`docker_redisdata` remain).

## 11. Independent acceptance review

Accepted on 2026-09-28 after an independent source review and reproduction in
separately named disposable Docker projects. The reviewer reran all 45 unit
tests, all 52 integration tests against fresh PostgreSQL and Redis instances,
and all 20 Chromium assertions through Nginx. The six correction regressions
passed, `git diff --check` passed, tracked-file secret scans found no local
admin credential, and the external DRM repository remained clean at
`6135bf5ca128886ad529cffff4f9be38b7fbbd99` with 132 files. Review containers
and their volumes were removed; the development stack remained healthy.
