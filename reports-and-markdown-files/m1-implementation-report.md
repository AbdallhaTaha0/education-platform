# M1 implementation report — Docker foundation + bilingual frontend shell

Date: 2026-09-27. Scope: Milestone 1 only (WP1). No business features
(auth, wallet, catalog, purchases, media, notifications) were implemented.
Stop condition observed: work ends here; M2 is not started.

## 1. Directory and service structure

```
education-platform/
  package.json                  Root convenience scripts only (no workspaces;
                                client/ and server/ are independent npm
                                projects with their own lockfiles, so the
                                external DRM package can never be matched by
                                a workspace/build glob).
  .env.example                  Documented placeholder contract (server-only
                                vs VITE_ browser-safe vs optional DRM).
  .gitignore / .dockerignore    Root .dockerignore explicitly excludes
                                education-drm-service/ from every platform
                                build context.
  client/                       React 18 + TypeScript + Vite 6 shell.
    src/{main.tsx,App.tsx,i18n.tsx,api.ts,components.tsx,styles.css}
    Dockerfile  (node build -> nginx-unprivileged static runtime)
    nginx.conf  (SPA fallback, unprivileged port 8080)
  server/                       One modular Express/TypeScript application.
    src/{index.ts,app.ts,config.ts,logger.ts}
    src/infra/{checks.ts,postgres.ts,redis.ts,drm.ts}
    src/middleware/{requestId.ts,errorHandler.ts}
    src/routes/health.ts        GET /health/live, GET /health/ready
    prisma/{schema.prisma,migrations/20260927090000_m1_init/,README.md}
    tests/unit/*  tests/integration/*
    Dockerfile  (targets: prod-deps, build, runtime, migrate, test)
  docker/
    compose.dev.yml             Local stack (persistent volumes).
    compose.test.yml            Isolated test stack (disposable volumes).
    nginx/{Dockerfile,nginx.conf}  Platform entry point.
  reports-and-markdown-files/
    m1-implementation-report.md (this file)
    m1-evidence/{m1-ar-desktop.png,m1-en-desktop.png,m1-ar-mobile.png}
```

Services (dev project): `postgres`, `redis`, `migrate` (one-shot),
`server` (same-image replicas), `client`, `nginx` (sole published port).
Internal DNS names: `postgres:5432`, `redis:6379`, `server:3000`,
`client:8080`. Nginx strips the `/api` prefix (`/api/health/live` ->
backend `/health/live`); `/` proxies to the frontend.

## 2. Chosen runtime/dependency versions (pinned in lockfiles)

Base images: `node:22-bookworm-slim` (+ `openssl` via apt for Prisma
engines), `nginxinc/nginx-unprivileged:1.27-alpine` (client runtime and
platform proxy; fully non-root), `postgres:16-alpine`, `redis:7-alpine`.
Node 22 LTS chosen as the supported active LTS; React 18.3.1 (stable,
mature typings); Express 4.22.3 (stable middleware ecosystem);
Prisma 6.19.3 (`@prisma/client` 6.19.3, classic `schema.prisma` +
`migrate deploy` pipeline); Vitest 2.1.9; Vite 6.4.3; TypeScript 5.9.3;
`pg` 8.23.0, `ioredis` 5.11.1, `helmet` 8.3.0, `cors` 2.8.6,
`pino` 9.14.0, `pino-http` 10.5.0, `dotenv` 16.6.1, `supertest` 7.3.0.

Built image IDs (final): server `066ea9eda9cf` (765MB), migrate
`825a30004e53` (758MB), client `0ff5fdd71913` (73.9MB), nginx `edb704578a39`
(73.7MB); test variants `b35dc26c1615` / `8f274317a811`.

## 3. Commands (repository root)

```powershell
docker compose -f docker/compose.dev.yml config --quiet
docker compose -f docker/compose.dev.yml build
docker compose -f docker/compose.dev.yml up -d --wait
docker compose -f docker/compose.dev.yml logs -f            # follow logs
docker compose -f docker/compose.dev.yml down               # stop, keep data
docker compose -p education-platform-test -f docker/compose.test.yml build
docker compose -p education-platform-test -f docker/compose.test.yml up -d --wait migrate
docker compose -p education-platform-test -f docker/compose.test.yml run --rm test
docker compose -p education-platform-test -f docker/compose.test.yml down -v
```

Migration-failure drill (expects exit 1; dependents never start):
```powershell
docker compose -p education-platform-test -f docker/compose.test.yml run --rm `
  -e DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5999/nope migrate
```

## 4. Local URLs and ports

- Public entry: `http://localhost:8080/` (frontend shell, Arabic default).
- API via proxy: `http://localhost:8080/api/health/live` (200, no deps),
  `http://localhost:8080/api/health/ready` (200 ready / 503 not_ready).
- Only `8080:8080` is published. PostgreSQL/Redis have no host ports;
  inspect via `docker compose -f docker/compose.dev.yml exec postgres …`.

## 5. Migration behavior

- `20260927090000_m1_init` applies `SELECT 1;` only: proves `migrate
  deploy` executes in the one-shot container and gates startup
  (`depends_on: service_completed_successfully`), without inventing
  User/Wallet/Course/Subscription tables. Verified applied:
  `_prisma_migrations` contains the row.
- Write capability is proven by `tests/integration/db-write.test.ts`
  against the isolated test DB using a transient (unmigrated) table.
- Failure drill exits 1; Compose will not start `server`/`test` when
  `migrate` fails (verified: exit 1 with unreachable DATABASE_URL).

## 6. Persistent vs disposable data

- Dev (`compose.dev.yml`): named volumes `pgdata`, `redisdata`; survive
  `down` and container restarts (verified: migration row count 1 before
  and after `down`/`up --wait`, stack returns to `ready`).
- Test (`compose.test.yml` with `-p education-platform-test`): project-
  prefixed disposable volume; removed with `down -v` (verified: only
  `docker_pgdata`/`docker_redisdata` remain afterwards).

## 7. External DRM connection expectations (M1: boundary only)

- `DRM_BASE_URL`/`DRM_CLIENT_ID`/`DRM_CLIENT_SECRET` are server-only env
  vars, unset by default. `GET /health/ready` reports
  `drm: {mode: "optional-external", configured: false, …}` and readiness
  never gates on DRM. No DRM source is in any image (root `.dockerignore`
  excludes `education-drm-service/`); no DRM database access exists;
  no R2 credentials are required for startup. Real upload/playback
  integration belongs to a later milestone against an independently
  operated DRM distribution.

## 8. Non-destructive rollback

1. `docker compose -f docker/compose.dev.yml down` (never `-v` on dev).
2. Re-tag/re-pull the previous `edu-platform-server/client` images or
   `git checkout` the prior milestone state and
   `docker compose -f docker/compose.dev.yml build server client`.
3. `docker compose -f docker/compose.dev.yml up -d --wait`; confirm
   `/api/health/ready` is `ready`.
4. Data rollback = restore the `pgdata` volume from backup; the M1
   migration is additive-empty, so older code remains compatible.
Never run `prisma migrate reset`, `down -v` (dev), or touch DRM data.

## 9. Verification results (all executed, Docker Engine 29.6.2)

| # | Check | Result |
|---|-------|--------|
| 1 | Compose files parse (`config --quiet`, dev + test) | PASS |
| 2 | Frontend/backend/nginx images build reproducibly (`npm ci` from lockfiles) | PASS |
| 3 | Services start in order (`up -d --wait`; migrate exit 0 gates server) | PASS |
| 4 | Frontend loads through Nginx (`/` 200, `lang=ar dir=rtl`) | PASS |
| 5 | Arabic default; English toggle updates `lang`/`dir`/copy (headless Chrome, fresh profiles) | PASS |
| 6 | RTL/LTR at 1440px + 390px (screenshots `m1-evidence/`) | PASS |
| 7 | `/health/live` 200 without deps; `/health/ready` 200 with deps up | PASS |
| 8 | Readiness 503 with redis stopped; 503 with postgres stopped; `ready` after recovery; live stays 200 | PASS |
| 9 | Migration failure drill exits 1; dependents blocked by `service_completed_successfully` | PASS |
| 10 | Dev DB survives `down`/`up` (migration row persists, `ready` returns) | PASS |
| 11 | TypeScript checks pass in containers (client via build `tsc -b`; server `typecheck` in test image) | PASS |
| 12 | No privileged config in browser assets (`grep` dist for connection strings/secret names; scan of `/health/ready` body) | PASS |
| 13 | External DRM unchanged (clean status, HEAD `6135bf5…`, 132 files, combined SHA256 identical before/after) | PASS |
| 14 | Unit 13/13 + integration 5/5 on real postgres/redis in isolated project | PASS |
| 15 | Graceful shutdown (SIGTERM → connections closed, exit, 0.8s) | PASS |
| 16 | Non-root runtimes (`app` for server/migrate/test, `nginx` for client/proxy) | PASS |

Screenshots: `reports-and-markdown-files/m1-evidence/m1-ar-desktop.png`
(Arabic RTL), `m1-en-desktop.png` (English LTR, mirrored nav),
`m1-ar-mobile.png` (390px Arabic). Browser DOM assertions: default
`lang=ar dir=rtl`; after toggle `lang=en dir=ltr`; status cards read
“متاح/Available” live.

## 10. Known limitations and decisions

- Docker Desktop service was initially stopped on this host; started
  locally to run verification (no repo impact).
- Server runtime image is 765MB, dominated by `node:22-bookworm-slim` +
  production deps including multi-platform Prisma engine binaries
  (`typescript`/`prisma` present in prod `node_modules` only as transitive
  deps of `@prisma/client` 6.19.3 — verified via `npm ls`, not a leak).
  Slimmed ~33% during this milestone (`COPY --chown` instead of `chown
  -R` layers); further engine-target trimming deferred.
- No automated browser harness is committed in M1; browser evidence was
  produced with headless system Chrome + throwaway `puppeteer-core` in
  `%TEMP%` (outside the repo). A committed browser-test step is M-later.
- `postgres`/`redis` publish no host ports by design; host-side DB checks
  use `compose exec`.
- Dev `.env` is not committed (only `.env.example`); Compose defaults are
  safe local placeholders, overridable via environment.
- Conflict reporting (per owner instruction): none found — `design.md`
  tokens/typography/spacing/RTL rules were followed as specified; no
  `design.md` edits were made.
