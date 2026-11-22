# Worker Prompt — Cloudflare D1 + Workers Migration & Multi-Teacher / Multi-Subject Implementation

Read `AGENTS.md`, `reports-and-markdown-files/README.md`, `reports-and-markdown-files/agent.md`, `reports-and-markdown-files/rules.md`, `reports-and-markdown-files/decisions.md`, `reports-and-markdown-files/design.md`, and the authoritative contract **`reports-and-markdown-files/deployment/cloudflare-d1-teachers-subjects-plan-20261122.md`** before making any changes.

## Mandatory Branch Workflow (`dev` → `testing`, NEVER `deployment`)

1. **Write on `dev`**:
   - Confirm you are on branch **`dev`** (`git branch --show-current` — already fast-forwarded to baseline `1962291`).
   - Implement all code, schema, migration, UI, and Cloudflare Worker changes (`WP-CF1` through `WP-CF6`) on **`dev`**, and commit your implementation work to **`dev`**.
2. **Test and report on `testing`**:
   - Checkout **`testing`** and merge **`dev`** into **`testing`** (`git checkout testing && git merge --ff-only dev`).
   - Run the complete verification suite (`WP-CF7`) on **`testing`**.
   - Clean up all disposable test environments per the 2026-10-01 cleanup rule.
   - Write your complete implementation report to **`reports-and-markdown-files/deployment/cloudflare-d1-implementation-report-20261122.md`**, update `reports-and-markdown-files/README.md`, and commit the report on **`testing`**.
3. **Do NOT touch `deployment`**:
   - Leave the repository checked out on **`testing`**. Do **not** checkout or merge into `deployment` and do **not** push to remote. Merging `testing` → `deployment` is reserved strictly for the independent reviewer after reviewing and verifying your work on `testing`.

## Assigned Scope

Implement the complete specification in **`reports-and-markdown-files/deployment/cloudflare-d1-teachers-subjects-plan-20261122.md`** across work packages **`WP-CF1` through `WP-CF7`** in sequence:

1. **`WP-CF1` — Multi-teacher & multi-subject backend schema, validation, and APIs**:
   - Keep roles strictly `STUDENT` and `ADMIN` (no `TEACHER` login role).
   - Add admin-managed bilingual `Subject` and `Teacher` models to `server/prisma/schema.prisma`, `subjectId` and `teacherId` (`onDelete: Restrict`) to `Course`, and immutable snapshot fields (`subjectId`, `subjectNameAr`, `subjectNameEn`, `teacherId`, `teacherNameAr`, `teacherNameEn`) to `Purchase` and `PackagePurchaseItem`.
   - Implement `GET /catalog/subjects`, `GET /catalog/teachers`, `GET/POST /admin/subjects`, `PATCH/DELETE /admin/subjects/:id`, `GET/POST /admin/teachers`, `PATCH/DELETE /admin/teachers/:id`, and extend `GET /catalog/courses` with `subjectId`, `teacherId`, `subjectSlug`, and `teacherSlug` filters.
   - Propagate `subjectId` and `teacherId` in working-copy creation and publication (`server/src/modules/catalog/courses/revisions.ts`).
   - Enforce in `server/src/modules/catalog/packages.ts` (`lockedMembers` and `publicPackage`) that all 3 monthly courses in a `CoursePackage` have active, identical `grade`, `subjectId`, and `teacherId` (`409 PACKAGE_SUBJECT_MISMATCH`, `409 PACKAGE_TEACHER_MISMATCH`).
   - Snapshot `subject*` and `teacher*` on standalone course purchases (`server/src/modules/wallet/purchase/service.ts`) and package purchases (`server/src/modules/wallet/purchase/packages.ts`).

2. **`WP-CF2` — Multi-teacher & multi-subject bilingual UI**:
   - Update `client/src/locales/ar.ts` and `client/src/locales/en.ts` with all required Arabic/English labels and disabled-action explanations.
   - Add Subject and Teacher filters and badges on `HomePage.tsx`, `PublicCatalogPage.tsx`, `OfferPage.tsx`, `PackagePage.tsx`, and `PurchaseHistoryPage.tsx`.
   - Add Admin Subject and Teacher management panels in `AdminListPage.tsx`, required Subject and Teacher selectors in `AdminDetailPage.tsx`, and same-grade/subject/teacher filtering and disabled-action explanations (`aria-describedby`) in `AdminPackagesPage.tsx`.

3. **`WP-CF3` — R2 binary offload (`RechargeProof`, `CourseCover`, `InstaPaySettings`) & WebCrypto password hashing**:
   - Replace native C++ `argon2` in `server/src/modules/identity/password.ts` with Worker-compatible WebCrypto `PBKDF2-SHA256` (`$pbkdf2-sha256$i=<iterations>$<saltB64Url>$<hashB64Url>`) using constant-time digest comparison, and remove `"argon2"` from `server/package.json`.
   - Offload all three binary models to private R2 when `StorageClient` is configured (falling back to nullable `bytes`/`qrBytes` only for unconfigured-storage unit tests) to keep D1 100% free of binary blobs under the 5 GB D1 quota:
     - `RechargeProof.storageKey` (`recharge-proofs/<requestId>`, up to 5 MiB, with durable `MaterialObject` tracking and 180-day R2 deletion in `server/src/modules/wallet/cleanup/service.ts`).
     - `CourseCover.storageKey` (`course-covers/<coverId>`, up to 128 KiB).
     - `InstaPaySettings.qrStorageKey` (`payment-qr/instapay-<version>`, up to 128 KiB).

4. **`WP-CF4` — Cloudflare D1 (SQLite) migration, `MutexDurableObject`, and all 65 raw-SQL adaptations**:
   - Switch `server/prisma/schema.prisma` to `provider = "sqlite"` with `previewFeatures = ["driverAdapters"]` and `@prisma/adapter-d1`, and generate D1 SQLite migrations under `server/migrations/`.
   - Implement `MutexDurableObject` (`server/src/infra/locks-do.ts`) + `LocalAsyncMutex` fallback for tests.
   - Adapt all 24 files / 65 raw-SQL sites listed in Section 3.4.2 of the plan (removing PostgreSQL `FOR UPDATE`, `FOR SHARE`, `pg_advisory_xact_lock`, `::bigint`, and replacing `GREATEST` with `MAX`), using sorted entity locks + atomic `D1.batch()` / `prisma.$transaction([...])` and conditional non-negative wallet balance updates.

5. **`WP-CF5` — Rate Limiting, `UserRealtimeDurableObject`, and D1-first Cron Triggers (Workers Paid Plan quota guards)**:
   - Replace `ioredis` with `PlatformCache`: rely directly on the authoritative D1 `getActiveSession()` check (`AuthSession.revokedAt !== null`) rather than per-request KV reads (preserving the 25B D1 row read quota over the 10M KV read quota), and route fixed-window rate limits through `MutexDurableObject` (`InMemoryCache` fallback for tests).
   - Replace `socket.io` + `@socket.io/redis-adapter` with `UserRealtimeDurableObject` (WebSocket Hibernation API at `/api/notifications/ws?csrf=<token>`) and update `client/src/features/notifications/context.tsx` to use native `WebSocket` with polling fallback. Remove `socket.io`, `@socket.io/redis-adapter`, `ioredis`, `bullmq`, and `socket.io-client`.
   - Wire the 4 background reconcilers (catalog deletion, learning expiry + materials cleanup, notification outbox delivery, and daily 180-day proof/notification cleanup) into the Worker `scheduled(controller, env, ctx)` handler. **Quota guard**: each scheduled job must run an indexed D1 `findFirst({ select: { id: true } })` check first and only acquire a `MutexDurableObject` `cron:*` lock when pending work actually exists (`0` Durable Object calls on idle cron ticks).

6. **`WP-CF6` — Unified Cloudflare Worker (Static Assets + SSR + API) & retirement of Railway/Vercel**:
   - Create root `wrangler.toml` and `server/src/worker.ts` unifying static assets (`env.ASSETS`), bilingual SSR (`entry-server.tsx`), and `/api/*` routing on one origin.
   - Retire `.railway/`, `docker/railway/`, `client/scripts/vercel-output.mjs`, and `client/vercel.json`.

7. **`WP-CF7` — Verification & Implementation Report on `testing`**:
   - Merge `dev` into `testing`.
   - Run full typechecks, unit tests, D1 integration tests (including the 4-way concurrent purchase spending race, refresh token reuse revocation, working-copy draft publication with `subjectId`/`teacherId`, and 3-course package validation), client tests, and Worker runtime probes on `testing`.
   - Write a complete implementation report to **`reports-and-markdown-files/deployment/cloudflare-d1-implementation-report-20261122.md`**, link it from `reports-and-markdown-files/README.md`, and commit on `testing`.

## Hard Guardrails

- **Never** edit or access `education-drm-service/`.
- **Never** add a `TEACHER` role to `enum Role`, never store auth tokens in `localStorage`/`sessionStorage`, and never use floating-point numbers for money.
- **Never** checkout or merge into `deployment`, and do **not** push to remote.

## Required Report Format (`reports-and-markdown-files/deployment/cloudflare-d1-implementation-report-20261122.md`)

When you finish on `testing`, write your report containing:
1. **Git commit hashes** on `dev` and `testing` (confirming `deployment` remains untouched at `1962291`).
2. **Changed, added, and deleted files** grouped by work package (`WP-CF1` – `WP-CF7`).
3. **D1 schema & migration summary**, confirming zero remaining PostgreSQL-only raw SQL (`FOR UPDATE`, `FOR SHARE`, `pg_advisory_xact_lock`, `GREATEST`, `::bigint`) and zero native C++ dependencies (`argon2`).
4. **Exact commands executed and test results on `testing`** (server typecheck, client typecheck, server unit tests, D1 integration tests, concurrency race results, client tests, and Worker SSR/API/WebSocket probes).
5. **Remaining blockers or unverified live cloud gates** (e.g., actual Cloudflare account IDs, production R2 bucket bindings, custom domain).
6. **Cleanup verification** (below).

## Owner-Required Docker & Test Environment Cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up any Docker or local `.wrangler/state` test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names, and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks, and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune (`docker system prune`) or delete unrelated data, existing previews, reusable images needed for review, or saved reports/evidence. Report the final cleanup verification in your implementation report.
