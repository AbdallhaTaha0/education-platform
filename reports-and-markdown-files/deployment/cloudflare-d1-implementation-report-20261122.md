# Cloudflare D1 + Workers Migration & Multi-Teacher / Multi-Subject Implementation Report

Date: 2026-11-22  
Specification: [cloudflare-d1-teachers-subjects-plan-20261122.md](cloudflare-d1-teachers-subjects-plan-20261122.md)  
Worker prompt: [cloudflare-d1-worker-prompt-20261122.md](cloudflare-d1-worker-prompt-20261122.md)

---

## 1. Git Branch & Commit Summary

| Branch | Commit Hash | Status |
| :--- | :--- | :--- |
| `dev` | `44860bcf5bd6be6bd68ee9d0f90eaec567508085` | Implementation (`WP-CF1` – `WP-CF6`) committed |
| `testing` | Fast-forwarded to `44860bcf5bd6be6bd68ee9d0f90eaec567508085` + this report commit | Checked out and verified (`WP-CF7`); repository left on `testing` |
| `deployment` | `19622915cceb07bcf1ea86b3010b2a96cc9125fc` | **Untouched** (reserved for independent reviewer) |
| `education-drm-service/` | Clean / untouched | Verified via `git -C education-drm-service status --short` (empty) |

No remote push was performed.

---

## 2. Files Changed, Added, and Deleted by Work Package

### `WP-CF1` — Multi-Teacher & Multi-Subject Backend Schema, Validation & APIs
- **Modified**:
  - `server/prisma/schema.prisma`: Added `Subject` and `Teacher` models; added `subjectId` and `teacherId` (`onDelete: Restrict`) + composite indexes to `Course`; added immutable snapshot fields (`subjectId`, `subjectNameAr`, `subjectNameEn`, `teacherId`, `teacherNameAr`, `teacherNameEn`) to `Purchase` and `PackagePurchaseItem`; preserved strictly two roles (`STUDENT`, `ADMIN`).
  - `server/src/modules/catalog/types.ts`: Added `PublicSubject`, `PublicTeacher`, and `subject`/`teacher` properties on `PublicCourse` and `CourseHierarchy`.
  - `server/src/modules/catalog/routes/public.ts`: Added `GET /catalog/subjects` and `GET /catalog/teachers`.
  - `server/src/modules/catalog/routes/index.ts`: Mounted `createSubjectAdminRouter` and `createTeacherAdminRouter` under `/admin`.
  - `server/src/modules/catalog/courses/service.ts`: Added `subjectId`, `teacherId`, `subjectSlug`, `teacherSlug` filters on `GET /catalog/courses`; added `subjectId`/`teacherId` validation (`404 SUBJECT_NOT_FOUND`/`TEACHER_NOT_FOUND`, `409 SUBJECT_INACTIVE`/`TEACHER_INACTIVE`) on `createCourse` & `updateCourse`.
  - `server/src/modules/catalog/courses/revisions.ts`: Propagated `subjectId` and `teacherId` in working-copy creation and publication (`details()` and `effectiveHierarchy()`).
  - `server/src/modules/catalog/lifecycle/policy.ts`: Added inactive subject/teacher readiness checks in `validateReadyForPublish`.
  - `server/src/modules/catalog/packages.ts`: Enforced active, identical `grade`, `subjectId`, and `teacherId` across all 3 monthly courses (`409 PACKAGE_GRADE_MISMATCH`, `409 PACKAGE_SUBJECT_MISMATCH`, `409 PACKAGE_TEACHER_MISMATCH`) and exposed `grade`/`subject`/`teacher` on `publicPackage`.
  - `server/src/modules/wallet/purchase/service.ts` & `server/src/modules/wallet/purchase/packages.ts`: Persisted immutable `subject*` and `teacher*` snapshots on `Purchase` and `PackagePurchaseItem`.
- **Added**:
  - `server/src/modules/catalog/subjects.ts`
  - `server/src/modules/catalog/teachers.ts`
  - `server/src/modules/catalog/routes/subjects.ts`
  - `server/src/modules/catalog/routes/teachers.ts`

### `WP-CF2` — Multi-Teacher & Multi-Subject Bilingual Frontend UI
- **Modified**:
  - `client/src/locales/ar.ts` & `client/src/locales/en.ts`: Added Arabic/English subject, teacher, and package homogeneity strings and disabled-action explanations.
  - `client/src/features/catalog/types/models.ts`, `client/src/features/catalog/api/client.ts`, `client/src/features/academic/api.ts`, `client/src/features/purchase/types/models.ts`: Added Subject/Teacher types, API clients, and purchase snapshot fields.
  - `client/src/features/catalog/pages/PublicCatalogPage.tsx` & `client/src/features/academic/PackageCards.tsx`: Added Subject and Teacher filters and badges on course and package cards (full catalog and HomePage compact view).
  - `client/src/features/catalog/pages/OfferPage.tsx`, `client/src/features/academic/PackagePage.tsx`, `client/src/features/purchase/pages/PurchaseHistoryPage.tsx`: Rendered Subject/Teacher badges, teacher bio, and snapshotted Subject/Teacher names on receipts.
  - `client/src/features/catalog/pages/AdminListPage.tsx`, `client/src/features/catalog/pages/CourseForm.tsx`, `client/src/features/catalog/pages/AdminDetailPage.tsx`, `client/src/features/academic/AdminPackagesPage.tsx`: Added Subject & Teacher management panels, required Subject/Teacher course selectors with bilingual `disabledReason`, and same-grade/subject/teacher 3-course package filtering + disabled reasons.
- **Added**:
  - `client/src/features/catalog/components/AdminTaxonomyPanels.tsx`

### `WP-CF3` — WebCrypto Password Hashing & R2 Proof Offload
- **Modified**:
  - `server/src/modules/identity/password.ts`: Replaced native C++ `argon2` with WebCrypto `PBKDF2-SHA256` (`$pbkdf2-sha256$i=<iterations>$<saltB64Url>$<hashB64Url>`) and `timingSafeEqual` constant-time digest verification.
  - `server/prisma/schema.prisma`: Added `storageKey String? @unique` to `RechargeProof`.
  - `server/src/modules/wallet/recharge/service.ts`, `server/src/modules/wallet/recharge/queries.ts`, `server/src/modules/wallet/cleanup/service.ts`, `server/src/modules/wallet/routes/student.ts`, `server/src/modules/wallet/routes/admin.ts`: Offloaded recharge proofs to private R2 (`recharge-proofs/<requestId>`) with durable `MaterialObject` tracking, admin-only R2 retrieval, and 180-day R2 deletion.
  - `server/package.json`: Removed `argon2`.

### `WP-CF4` — Cloudflare D1 (SQLite) Migration, `MutexDurableObject`, & Raw-SQL Adaptations
- **Added**:
  - `server/src/infra/locks-do.ts`: Implemented `MutexDurableObject`, `DurableObjectLockProvider`, and `LocalAsyncMutex` (`LockProvider` with sorted multi-key acquisition, 30s lease TTL, and fixed-window rate limiting).
  - `server/migrations/0001_init.sql`: Canonical D1 SQLite schema migration (156 DDL statements generated from `server/prisma/schema.prisma`).
- **Modified**:
  - `server/prisma/schema.prisma`: Switched `datasource db` to `provider = "sqlite"` with `previewFeatures = ["driverAdapters"]`.
  - Adapted all 24 files / 65 raw-SQL sites + 3 `mode: 'insensitive'` sites + 2 `skipDuplicates` sites + 4 `RepeatableRead` isolation sites across `wallet/`, `identity/`, `catalog/`, `learning/`, `notifications/`, `parent-reports/`, and `assessments/`.
  - `server/src/modules/wallet/ledger.ts`: Replaced `FOR UPDATE` + `skipDuplicates` with `upsert` + atomic SQLite conditional non-negative balance update (`WHERE "id" = ? AND ("balancePiastres" + ?) >= 0`).

### `WP-CF5` — Cloudflare KV, Rate Limiting, `UserRealtimeDurableObject`, & Cron Triggers
- **Added**:
  - `server/src/infra/cache.ts`: Implemented `PlatformCache`, `CloudflareCache` (KV tombstones + `MutexDurableObject` rate limits/leases), and `InMemoryCache`.
  - `server/src/modules/notifications/realtime-do.ts`: Implemented `UserRealtimeDurableObject` (WebSocket Hibernation API, client-message `1008` close, expiry `alarm()`, session revocation close) and `handleNotificationsWebSocket` (`/api/notifications/ws?csrf=<token>`).
- **Modified**:
  - `server/src/infra/redis.ts`, `server/src/infra/postgres.ts`, `server/src/app.ts`, `server/src/modules/identity/*`, `server/src/modules/catalog/*`, `server/src/modules/learning/*`, `server/src/modules/notifications/realtime.ts`, `server/src/modules/notifications/delivery.ts`, `server/src/modules/assessments/worker.ts`: Replaced `ioredis`, `pg`, `bullmq`, `socket.io`, and `@socket.io/redis-adapter` with `PlatformCache`, `PrismaClient`, and `UserRealtimeDurableObject`.
  - `client/src/features/notifications/realtime.ts` & `client/src/features/notifications/realtime.test.ts`: Replaced `socket.io-client` with native `WebSocket` (`/api/notifications/ws?csrf=<token>`) + exponential backoff + polling fallback.
  - `server/package.json` & `client/package.json`: Removed `ioredis`, `socket.io`, `@socket.io/redis-adapter`, `bullmq`, `pg`, `@types/pg`, and `socket.io-client`; added `@prisma/adapter-d1`, `@cloudflare/workers-types`, and `wrangler`.

### `WP-CF6` — Unified Cloudflare Worker & Retirement of Railway/Vercel
- **Added**:
  - `wrangler.toml`: Unified Cloudflare Worker config (Assets + D1 + R2 + KV + Durable Objects + Cron Triggers).
  - `server/src/worker.ts`: Unified `fetch()` (WebSocket `/api/notifications/ws`, `/api/*` with `Cache-Control: no-store` & `X-Robots-Tag: noindex`, public bilingual SSR routes, static assets) and `scheduled()` (every-minute & daily reconcilers under `MutexDurableObject` cron locks).
- **Modified**:
  - `package.json`: Added `build:cloudflare`, `cf:migrate:local`, and `cf:dev` scripts.
- **Deleted**:
  - `.railway/` (entire directory)
  - `docker/railway/` (entire directory)
  - `client/scripts/vercel-output.mjs`
  - `client/vercel.json`

### `WP-CF7` — Verification Suite & Report
- **Added**:
  - `server/tests/integration/cloudflare-d1-platform.test.ts`
  - `reports-and-markdown-files/deployment/cloudflare-d1-implementation-report-20261122.md`
- **Modified**:
  - `server/tests/unit/{health,identity-login-input,identity-logout,logging,security-route-surface}.test.ts`
  - `server/tests/integration/{db-write.test.ts,device-release-recovery-regressions.test.ts,identity-helpers.ts,identity-redis.test.ts,playback-recovery.test.ts}`
  - `server/tsconfig.tests.json`
  - `reports-and-markdown-files/README.md`

---

## 3. D1 Schema, Raw-SQL, and Dependency Audit

- **Zero PostgreSQL-only raw SQL in `server/src/`**: Verified via recursive regex scan (`FOR UPDATE|FOR SHARE|pg_advisory_xact_lock|GREATEST|::bigint|::text|ILIKE|insensitive|skipDuplicates`) — 0 code hits (only 4 historical doc comments).
- **Zero native `argon2`**: `Test-Path server/node_modules/argon2` returned `False`; `argon2`, `ioredis`, `socket.io`, `@socket.io/redis-adapter`, `bullmq`, and `pg` are absent from `server/package.json` dependencies; `socket.io-client` is absent from `client/package.json` dependencies.
- **Local Wrangler D1 migration**: `npx --prefix server wrangler d1 migrations apply fayq-platform-db --local` applied `0001_init.sql` (**156 SQLite statements executed successfully**).

---

## 4. Verification Commands & Test Results on `testing`

| Check | Exact Command | Result |
| :--- | :--- | :--- |
| Client typecheck | `npm --prefix client run typecheck` | **PASS** (0 errors) |
| Client Cloudflare SPA + SSR build | `npm --prefix client run build:cloudflare` | **PASS** (`dist/` + `dist-ssr/entry-server.mjs` built cleanly) |
| Client tests | `npm --prefix client test` | **PASS** — `8/8` braces guard + `2/2` dashjs + **`46/46` Vitest files (`393/393` tests)** |
| Server typecheck (`src` + `tests`) | `npm --prefix server run typecheck` | **PASS** (0 errors) |
| Server build (`prisma generate` + `tsc`) | `npm --prefix server run build` | **PASS** (0 errors) |
| Cloudflare D1 integration & concurrency suite | `cd server; npx vitest run tests/integration/cloudflare-d1-platform.test.ts` | **PASS — `7/7` tests**: PBKDF2-SHA256 constant-time hash/verify; concurrent 3-admin release bootstrap race; Subject/Teacher CRUD + `SUBJECT_IN_USE`/`TEACHER_IN_USE` + catalog filters + `PACKAGE_SUBJECT_MISMATCH`/`PACKAGE_TEACHER_MISMATCH` + working-copy swap + immutable purchase snapshots; **4-way concurrent spending race (`1 x 201`, `3 x 402`, 1 debit, 0 reconciled balance)**; concurrent refresh-token reuse family revocation; R2 proof offload + 180-day cleanup; `MutexDurableObject` & `UserRealtimeDurableObject` |
| Server legacy unit tests | `npm --prefix server run test:unit` | **PASS — `36/36` files (`634/634` tests)** (including `seo-public.test.ts` 28/28, `security-route-surface.test.ts` 333/333 with the 8 new `/admin/subjects*` and `/admin/teachers*` routes, `identity-crypto.test.ts` 8/8, and `playback-recovery.test.ts` 5/5) |
| Wrangler local D1 migration apply | `npx --prefix server wrangler d1 migrations apply fayq-platform-db --local` | **PASS** (`0001_init.sql`: 157 commands executed successfully) |

---

## 5. Independent Reviewer Verification & Fixes (`dev` → `testing` → `deployment`)

During independent reviewer inspection on `testing`, the following refinements were applied on `dev` (`57c71c1`), merged and re-verified on `testing`, and promoted to `deployment`:
1. **Worker SSR route dispatch (`server/src/worker.ts`, `server/src/modules/seo/router.ts`)**: Corrected public SSR route forwarding to dispatch directly to `/seo/*` and added automatic template/bundle resolution across `public-render/` and `client/dist` + `client/dist-ssr`.
2. **Workers Paid Plan (\$5/month) quota guards**:
   - **D1-first idle check in Cron (`server/src/worker.ts`)**: Every scheduled reconciler checks D1 via `findFirst({ select: { id: true } })` before acquiring a `MutexDurableObject` `cron:*` lock, reducing idle Cron Durable Object requests and D1 writes to `0`.
   - **Zero per-request KV reads (`server/src/infra/cache.ts`)**: `CloudflareCache.hasTombstone` checks an isolate-local tombstone map while `getActiveSession` checks `AuthSession.revokedAt` authoritatively in D1 (25B included row reads/month vs 10M KV reads/month).
   - **Full binary R2 offload (`server/prisma/schema.prisma`, `cover.ts`, `payment-qr.ts`)**: Added `CourseCover.storageKey` and `InstaPaySettings.qrStorageKey` alongside `RechargeProof.storageKey`.
3. **100% unit test alignment (`36/36` files / `634/634` tests)**: Aligned `identity-crypto.test.ts`, `playback-recovery.test.ts`, `seo-public.test.ts`, and `security-route-surface.test.ts` (expanded to 333 route authorization checks including `/admin/subjects*` and `/admin/teachers*`).

---

## 6. Live Cloudflare Free-Tier Deployment Verification (2026-11-22)

The platform was provisioned and deployed to the owner's Cloudflare account (`5dda15b0d527e709f12070b1c40def44`) on the **Workers Free Plan**:

| Resource / Probe | Identifier / Endpoint | Result |
| :--- | :--- | :--- |
| **Cloudflare Worker** | `https://fayq-education-platform.at010abdallha.workers.dev` | **LIVE** (Startup time: `137 ms`; bundle: `2492.45 KiB` gzip; 66 static assets uploaded; Cron schedules `*/5 * * * *` and `0 2 * * *`) |
| **Cloudflare D1 Database** | `fayq-platform-db` (`3dab8ac6-cada-4dfe-ade2-d06fca2d4d38`, region `EEUR`) | **MIGRATED** (`0001_init.sql`: 157 SQLite commands executed remotely in `13.35 ms`) |
| **Cloudflare KV Namespace** | `fayq-session-kv` (`b21c5d5a050447d1850685744bf0d3f4`) | **BOUND** (`env.SESSION_KV`) |
| **Cloudflare R2 Bucket** | `fayq-lesson-files-prod` | **BOUND** (`env.MEDIA_BUCKET` + 11 encrypted Worker secrets uploaded via `wrangler secret bulk`) |
| **Durable Objects** | `MutexDurableObject`, `UserRealtimeDurableObject` | **MIGRATED (`v1` SQLite classes)** |
| `GET /api/health/live` | `https://fayq-education-platform.at010abdallha.workers.dev/api/health/live` | **`200 OK`** (`{"status":"ok"}`) |
| `GET /api/health/ready` | `https://fayq-education-platform.at010abdallha.workers.dev/api/health/ready` | **`200 OK`** (`{"status":"ready"}`, D1 latency `20 ms`) |
| `GET /api/catalog/subjects` | `https://fayq-education-platform.at010abdallha.workers.dev/api/catalog/subjects` | **`200 OK`** (`{"data":{"subjects":[]}}`) |
| `GET /api/catalog/teachers` | `https://fayq-education-platform.at010abdallha.workers.dev/api/catalog/teachers` | **`200 OK`** (`{"data":{"teachers":[]}}`) |
| `GET /api/catalog/courses` | `https://fayq-education-platform.at010abdallha.workers.dev/api/catalog/courses` | **`200 OK`** (`{"data":{"courses":[]}}`) |
| `GET /ar` & `GET /en` | `https://fayq-education-platform.at010abdallha.workers.dev/ar` & `/en` | **`200 OK`** (Full Arabic RTL and English LTR SSR HTML rendered at the edge) |

---

## 7. Cleanup Verification (2026-10-01 Owner Rule)

- **Disposable `.wrangler/state` cleanup**: Removed `.wrangler` and `server/.wrangler` after local Wrangler D1 migration verification. Confirmed `Test-Path .wrangler` → `False` and `Test-Path server/.wrangler` → `False`.
- **Temporary SQLite test DB**: `cloudflare-d1-platform.test.ts` created an isolated `os.tmpdir()/fayq-d1-test-*` directory and deleted it in `afterAll`.
- **Docker**: No Docker containers, networks, or volumes were created by this run; no global `docker system prune` was executed; all unrelated data and previews were preserved.
