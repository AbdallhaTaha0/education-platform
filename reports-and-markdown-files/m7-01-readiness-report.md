# M7 package 01 — readiness and dependency audit report

Date: 2026-10-01. Worker package: `reports-and-markdown-files/m7-01-open-code-worker-prompt.md`.
Scope: read-only readiness and lockfile audit. No application changes, no lockfile changes,
no DRM edits, no commits/pushes, no production deployment, no external load.
This report does not claim independent acceptance.

Manager review completed subsequently: [review findings and reproduction](m7-01-manager-review.md). The manager corrected serving-image Prisma exposure and stale external-verification wording below. Package 01 is accepted as readiness preparation with those corrections; M7 production qualification remains open.

## 1. Revisions and working-tree state (actual)

Platform checkout (repository root):

- Command: `git rev-parse HEAD` → `31ca60d3a2d832b704423060f3d55da7eae65ee3`
- Command: `git log --oneline -5` →
  `31ca60d feat: complete accepted M6 realtime notifications`,
  `4b949cc feat: add verification scripts and documentation for DRM tenant credentials and packaging`,
  `b04d84f feat: implement M5 learning and FAYQ experience`, plus two older entries.
- Command: `git rev-list --left-right --count HEAD...origin/main` → `0 0`
  (local `main` equals `origin/main`; the accepted M6 commit is present locally and on the remote).
- Command: `git log -1 --format=%H -- reports-and-markdown-files/m6-owner-acceptance.md` →
  `31ca60d3a2d832b704423060f3d55da7eae65ee3` (acceptance record is in the M6 milestone commit).
- Pre-M6 platform checkpoint on record: `4b949cc394636c2df928d0b7642122da61e5301c`.
- Command: `git status --short --branch` → only `## main...origin/main`, no file entries.
- Commands: `git diff --stat HEAD` and `git diff --cached --stat HEAD` → empty.
- Result: working tree was clean at the baseline and audit checkpoints, before writing
  this report and its README index row. Those two documentation changes are uncommitted.
  The prompt's
  "do not require a clean tree" allowance was not needed on this machine.

External DRM (independently deployed dependency, read-only in this package):

- Command: `git ls-files -s education-drm-service` →
  `160000 bad0c1df9f5d5844fe365c402fcccfee33ab6906 0 education-drm-service`
  (matches the assigned pin `bad0c1df9f5d5844fe365c402fcccfee33ab6906`).
- Inside `education-drm-service/`: `git rev-parse HEAD` → `bad0c1df9f5d5844fe365c402fcccfee33ab6906`;
  `git log --oneline -3` → `bad0c1d feat: add manifest validation and ensure static live MPD generation for recorded courses`, plus two older entries.
- Inside `education-drm-service/`: `git status --short --branch` → only `## main...origin/main`.
- Result: DRM checkout is at the pinned revision with a clean tree. No DRM file was read for editing
  and none was modified. (`git submodule status` reports no submodule mapping; the nested
  package is tracked as a gitlink, which is the expected layout here.)

## 2. Docker availability and pre-run inspection

Docker:

- Command: `docker version` → Client 29.8.0, Server Docker Desktop 4.92.0 (240144),
  Engine 29.8.0, linux/amd64, context `desktop-linux`.
- Cached images used (no pull in this package): `node:22-bookworm-slim`,
  `postgres:16-alpine`, `redis:7-alpine`, plus existing `edu-platform-*` build outputs.

Existing containers/volumes were inspected BEFORE running any audit container:

- Command: `docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'` →
  six containers in project `education-platform-rs256`, all expected from the guarded
  port-8082 preview stack: `rs256-server-1` (healthy), `rs256-client-1` (healthy),
  `rs256-migrate-1` (Exited 0), `rs256-nginx-1` (healthy, `0.0.0.0:8082->8080`),
  `rs256-postgres-1` (healthy), `rs256-redis-1` (healthy).
- Command: `docker volume ls` → exactly two volumes:
  `education-platform-rs256_pgdata`, `education-platform-rs256_redisdata`.
- Command: `docker network ls` → `education-platform-rs256_default` plus default bridge/host/none.
- Command: `docker compose --env-file .env -f docker/compose.dev.yml config | Select-String 'name: (docker_|education-)'` →
  default development names render `docker_pgdata` / `docker_redisdata` for project
  `education-platform`; no `docker_pgdata` volume object currently exists (the default dev
  stack is not running; only the `rs256` disposable/guard volumes exist).
- No existing container was stopped, restarted, or exec'd. No volume was deleted.
  The `rs256` data was preserved per `docker-and-operations.md`.

## 3. Dependency audit (isolated Docker containers, lockfiles unchanged)

Method (no upgrades installed, no lockfile writes):

- Mounts were read-only (`-v "${PWD}/server:/audit:ro"`, same for `client`), workdir `/audit`,
  image `node:22-bookworm-slim` with `--rm --pull=never --name m7-audit-server|m7-audit-client`.
- Smoke first: `ls -l /audit/package.json /audit/package-lock.json; node --version; npm --version`
  → lockfiles visible read-only, `v22.23.3` / `10.9.9`.
- Audit: `npm audit --audit-level=low --json` in each isolated container; exit `1` means
  findings (expected), not a tool failure. Registry access worked; there were no audit
  failures and no unavailable-registry condition to record.
- Lockfile identity (local, read-only):
  `server/package-lock.json` SHA256 `122D7260D48336657BEC61587DC3A4922DFBC04D1A06594D875DA227825A83A3`
  (154,579 bytes), `client/package-lock.json` SHA256
  `60A7F0FB167D3CC7FF4A354DAFD8987D89300CFBD36A3D3EA97D5036A074F582`
  (128,492 bytes), both `lockfileVersion 3`. Hashes were re-verified after the audits;
  both files are unmodified and `git status` remains clean.

### 3.1 Server (`@education-platform/server 0.4.0`)

- Audit metadata: 340 dependencies (prod 197, dev 143, optional 51); 8 vulnerabilities —
  critical 1, high 4, moderate 3, low 0, info 0.
- Manager correction: Vitest/Vite/esbuild findings concern test tooling, but the
  Prisma CLI/config/deepmerge-ts chain is also installed in the serving image through
  optional peer resolution. A reproduced `npm audit --omit=dev --json` returns three
  high rollup entries for that chain. Installation is verified; HTTP reachability of
  the vulnerable merge is not established. Do not classify the entire audit as dev-only:
  - `vitest 2.1.9` (direct dev) — critical + moderate. GHSA-5xrq-8626-4rwp
    (Vitest UI arbitrary file read/execution, CVSS 9.8, range `<3.2.6`) and
    GHSA-82fw-gwwq-j7x9 (mocker redirect path traversal, CVSS 5.9).
    Fix offered: `vitest 5.0.3`, `isSemVerMajor: true`. Exposure: developer/CI test
    runner only; not shipped in the `runtime` image (`npm ci --omit=dev` + copy-built-output
    assembly in `server/Dockerfile`). Compatibility risk: HIGH — major 2.x → 5.x may
    change config API, snapshot behavior, and Vite coupling; requires full unit+integration
    rerun in Docker before any acceptance.
  - `vite 5.4.21` (transitive via vitest) — high/moderate rollup: GHSA-fx2h-pf6j-xcff
    (Windows `server.fs.deny` bypass, CVSS 7.5), GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3,
    plus `esbuild` below. Fix offered: `vitest 5.0.3` (major). Exposure: test tooling only
    (the server has no direct `vite` dependency). Same HIGH major-upgrade risk as vitest.
  - `esbuild 0.21.5` (transitive) — moderate GHSA-67mh-4wv8-2f99 (dev-server request
    forgery/read, CVSS 5.3, range `<=0.24.2`). Fix via `vitest 5.0.3` (major). Same exposure/risk.
  - `@vitest/mocker` / `vite-node` — moderate, same vitest-major fix path.
  - `prisma 6.19.3` (direct dev/CLI) via `@prisma/config 6.19.3` via `deepmerge-ts 7.1.5` —
    high GHSA-ggr8-5vv4-36mx (stack exhaustion on recursive merge, range `<8.0.0`).
    `fixAvailable: true` as reported by npm (boolean form, no target version printed).
    Exposure: build/migration/test tooling AND installed serving-image packages.
    Manager reproduction found `prisma 6.19.3`, `@prisma/config 6.19.3` and
    `deepmerge-ts 7.1.5` in the running preview's runtime node_modules; the lockfile marks
    these `devOptional`. `npm ci --omit=dev` alone does not guarantee their exclusion.
    The three high audit entries roll up one underlying recursive-merge advisory;
    no remotely exploitable platform request path is proved here. `@prisma/client`
    itself has no direct advisory in this audit.
    Fix target and compatibility risk remain unverified: npm's boolean `fixAvailable`
    is not proof of a patched Prisma 6.x release or a safe transitive override. A separate
    package must evaluate supported updates/image exposure and verify generation,
    migrations, client construction and affected regressions before changing this chain.
- Listed request-serving dependencies have no direct advisory entry in this run.
  This does not mean zero production-tree findings: the manager's production-only
  server audit reports three high Prisma-chain entries, with installed-image presence
  verified as above. The client's production-only audit reports zero entries.

### 3.2 Client (`@education-platform/client 0.4.0`)

- Audit metadata: 257 dependencies (prod 36, dev 219, optional 53); 3 vulnerabilities —
  high 1, moderate 2, critical 0.
- Runtime browser surface is clean in this run:
  `react 18.3.1`, `react-dom 18.3.1`, `dashjs 5.2.1` (pinned, see patch note below),
  `socket.io-client 4.8.3`, fontsource packages — none flagged.
- Findings are build/test tooling:
  - `postcss 8.4.49` (direct dev via Tailwind build) — high rollup of four advisories:
    GHSA-6g55-p6wh-862q (sourceMappingURL arbitrary file read, CVSS 7.5),
    GHSA-r28c-9q8g-f849 (previous-source-map traversal, CVSS 7.5),
    GHSA-fxqj-rqcc-2cmp and GHSA-qx2v-qp2m-jg93 (moderate). Installed `8.4.49` is below
    every fixed range. Fix offered: `postcss 8.5.28`, `isSemVerMajor: false`.
    Exposure: build-time CSS processing (and dev server source-map handling), not shipped
    browser JS logic; a malicious-CSS build-input scenario, not a student-request RCE.
    Compatibility risk: LOW — same major `8.x`, Tailwind `3.4.14` supports PostCSS 8;
    still requires production `vite build` + client tests + Chromium pass in Docker.
  - `vitest 3.2.7` (direct dev) + `@vitest/mocker` — moderate GHSA-82fw-gwwq-j7x9
    (CVSS 5.9, range `>=2.1.0 <4.1.11`). Fix offered: `vitest 5.0.3`,
    `isSemVerMajor: true`. Exposure: dev/CI only. Compatibility risk: HIGH — major
    3.x → 5.x; defer until a dedicated major-upgrade package with full client matrix.
  - Transitive `vite 6.4.3` / `esbuild 0.25.12` resolved in the client tree drew no
    separate audit entries in this run (server tree's older vite/esbuild did).

### 3.3 Compatibility guard: pinned dash.js patch

- `client/scripts/patch-dashjs.mjs` + `postinstall` + `scripts/patch-dashjs.test.mjs`
  enforce `dashjs === '5.2.1'` and a single exact ClearKey `cenc` signature; any other
  version or unexpected signature throws instead of patching.
- Audit recommendation protects this pin: the proposed `postcss` patch does not touch
  `dashjs`, and no `dashjs`/`react` upgrade is proposed in this package. Any future
  vitest-major work must re-run `node --test scripts/patch-dashjs.test.mjs` and a real
  packaged-playback check before claiming player safety.

No upgrades were installed and no lockfile was modified in this package.

## 4. Production-readiness gaps (verified against current code)

Only current-source verification is claimed below; historical blockers were re-checked in
code/config, not re-probed with live external traffic (none was sent in this package).

- Deployment / TLS / secrets — GAP, owner decisions required.
  Current code: only `docker/compose.dev.yml` and `docker/compose.test.yml` exist
  (glob confirms; no `compose.prod.yml`). `docker/nginx/nginx.conf` listens on `8080`
  HTTP only; no `443`/`ssl_certificate` block. `server/Dockerfile` uses non-root `app`,
  minimal `prod-deps` runtime assembly, startup gating (`migrate` →
  `service_completed_successfully`), and liveness/readiness healthchecks — good local
  posture, but no resource limits in Compose (grep finds no `deploy/resources/limits`).
  Secrets: `.gitignore` ignores `.env`; `server/src/config.ts` fails closed
  (`AUTH_JWT_SECRET` has no default; production requires explicit `COOKIE_SECURE=true`;
  `ALLOWED_ORIGINS` forbids wildcards). Cookie code (`server/src/modules/identity/cookies.ts`)
  uses HttpOnly `edu_access`/`edu_refresh` + readable `edu_csrf` synchronizer, SameSite=Lax.
  Missing and needing owner choice: hosting/site, replica count, secrets injection
  mechanism, TLS termination point, DNS, and production Nginx/TLS artifact.
- Monitoring — GAP, owner decision required.
  Current code: `GET /health/live` (process liveness, dependency-free) and
  `GET /health/ready` (bounded PostgreSQL+Redis checks; DRM reported informationally and
  never gates readiness) in `server/src/routes/health.ts`, wired at `/health` in `app.ts`;
  Compose healthchecks for postgres/redis/server/client/nginx; `pino` logging with
  CSRF-header redaction in `logger.ts`. No `/metrics` endpoint and no
  Prometheus/Grafana/OTel/alerting in code or Compose (grep over server/docker/verification
  finds only health/readiness and rollback references). External DRM/service metrics need
  an agreed monitoring contract.
- Backup / restore / rollback — GAP, owner decisions required (RPO/RTO/retention).
  Current code: migration ordering + failure gate (`prisma migrate deploy` one-shot;
  failure exits non-zero and blocks server start); reproducible drills in
  `docker/verification/` (`upgrade-migration-drill.mjs`, documented failure gate);
  prior-image rollback narrative in M3/M4 reports. No automated platform backup/restore
  script or schedule was found (`docker/verification` listing holds drills, fixtures, and
  harness scripts — no `backup`/`pg_dump` job). No backup was taken or restored here.
  External DRM/media/key recovery remains that operator's evidence; platform code must not
  take over DRM persistence.
- Commercial DRM and media path — BLOCKED, owner actions required.
  Sanctioned presence-only audit used (values never printed):
  `node docker/verification/credential-presence-audit.mjs .env education-drm-service/.env`.
  Result: all five `WIDEVINE_*` keys `present=false` (empty) — Widevine remains
  OWNER BLOCKED; ClearKey is the only exercised path and is not a production substitute.
  Also empty: `WEBHOOK_SECRET`, `DRM_DEMO_*`, `DRM_MASTER_KEYS`. R2/S3 keys are present in
  the ignored DRM env (presence only). Earlier reports' open R2 CORS, tenant isolation,
  token/entitlement expiry and end-to-end RS256 checks were superseded by successful
  historical M5 continuation evidence. The latest M5 report also proves visible masked
  watermark/fullscreen behavior in its final 65-check browser run. These were NOT rerun
  by this audit and do not prove commercial DRM or forensic watermark guarantees.
  Preserve their historical attribution instead of reopening them as missing local proof.
- Capacity — OPEN, owner decisions required.
  `rules.md` / `decisions.md` record 10,000 simultaneous users as the qualification target;
  no load test was run in this package and no load artifacts were added. Any future
  qualification needs agreed mix (viewers/browsing, devices, bitrate), latency/error/startup/
  rebuffer budgets, isolated infra, and explicit authorization before touching external
  services. No capacity is claimed.

## 5. Failures, blocks, and limits of this package

- Audit tool failures: none. Both `npm audit --json` runs completed over the default
  registry from isolated containers. No unavailable-registry condition occurred.
- Live external blocks re-verified by code/config only (not re-executed): Widevine empty,
  no platform production Compose, no monitoring/backup automation, no capacity evidence.
- This package intentionally performed no upgrades, no migrations, no browser runs, and no
  external probes, so it adds no new runtime evidence beyond the audit and code inspection.

## 6. Verified cleanup

- Command: `docker ps -a` after the audits → only the six pre-existing
  `education-platform-rs256-*` containers; no `m7-audit-server` / `m7-audit-client`
  remains (`--rm` honored).
- Command: `docker volume ls` after the audits → only
  `education-platform-rs256_pgdata` / `education-platform-rs256_redisdata`; no new
  volume created, none deleted. The `down -v` guard in `docker-and-operations.md` was
  never invoked.
- No image was pulled (`--pull=never`; reused cached `node:22-bookworm-slim`).
- At the pre-documentation audit checkpoint, `git status --short --branch` showed only
  `## main...origin/main`; lockfile hashes match the pre-audit values above. Final submission
  contains this untracked report and one modified README index row, as the worker reported.

## 7. Recommended next work package (ONE)

M7 package 02 — isolated `postcss 8.4.49 → 8.5.28` patch with Docker regression, majors deferred.

- Bounded task: in disposable containers only, bump client `postcss` to the audited
  non-major fix `8.5.28`, reinstall from lockfile in Docker, then rerun client typecheck,
  `patch-dashjs` test, client unit suite, production `vite build`, and the existing
  Chromium/Nginx browser pass. Keep `dashjs 5.2.1`, `react 18.3.1`, and all server
  dependencies pinned. Defer `vitest 2.1.9→5.0.3`, `vitest 3.2.7→5.0.3`, and the
  Prisma/`deepmerge-ts` chain to separate evidence-led remediation; its supported fix
  target and whether a major upgrade is necessary are not established by this audit.
- Attach (no implementation yet): owner decision checklist for production shape
  (host, replicas, secrets injection, TLS/DNS), monitoring contract, RPO/RTO/retention,
  Widevine/commercial-DRM path, and capacity workload/budgets.
- Stop before any production Compose, secret provisioning, external load, or DRM change.
