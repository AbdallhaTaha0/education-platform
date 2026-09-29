# M3 implementation report — catalog, administration, and platform-side DRM HTTP integration (corrected)

Date: 2026-09-29 (correction round 2 + final independent review + manager checkpoint). Scope: Milestone 3 (WP3) only. M1 accepted at `fce352f`, M2 accepted at `b8080a8`, DRM deletion prerequisite accepted at nested `6e1e01c`. The accepted DRM recovery/job-status work was subsequently committed locally as `5293917`; this report is included in the local platform M3 checkpoint. Nothing was pushed or deployed, and no production-readiness, capacity, or live-R2 claim is made.

Final-review note: this report now incorporates an independent final review pass that reproduced all suites in Docker from the current uncommitted tree, verified the frontend correction claims by source and build, and re-verified the nested DRM suites including the manager's deterministic recovery-test correction. No platform production file was changed by the final review; the only platform-level addition is report text. The old upload-URL contract blocker is lifted (recovery independently verified + platform proven compatible); only the live-R2 blocker remains.

This revision corrects the prior M3 report after independent manager review. It removes previously undemonstrated claims (complete admin editor, complete browser lifecycle/upload/archive/deletion verification, replica-safe reconciliation) and replaces them with actually executed evidence below. New defects found by the reviewer (dummy upload fallback, network I/O inside transactions, unconfigured-deletion side effects, stale course markers, non-transactional `SKIP LOCKED`, weak DRM schemas, oversized modules, incomplete admin UI and browser coverage) are fixed and re-verified here.

Correction round 2 fixes three independently reproduced defects: (1) course-scoped concurrency now lock-then-validates everywhere via `withCourseLock`; (2) replica-safe deletion ownership uses a renewing lease on the request path; (3) registration recovery fails safe when the external DRM omits `uploadUrl` on idempotent repeats.

## 1. Starting revisions and environment

- Platform `main` HEAD: `bad064f53390c3c75be12b2c2f89bde358470c4f`
- Platform `origin/main`: `bad064f53390c3c75be12b2c2f89bde358470c4f`
- Nested DRM HEAD: `6e1e01c09d4f5a8e6827750d2430321d5acf8827`
- Nested DRM `origin/main`: `6e1e01c09d4f5a8e6827750d2430321d5acf8827`
- Platform gitlink for `education-drm-service`: `6e1e01c09d4f5a8e6827750d2430321d5acf8827`
- Accepted M2: `b8080a8d892b0a7de585c1a1f86c1c19da3efd81`
- Accepted M1: `fce352f`
- Correction round started from the uncommitted M3 tree (all valid M1/M2 behavior and valid M3 work preserved; no reset/clean/discard/amend).
- Docker Engine: `29.6.2, build dfc4efb`
- Docker Compose: `v5.3.1`
- Development stack throughout: `docker-*` project healthy; dev DB carried M1+M2+M3, then upgraded to the correction migration (see §13).

## 2. Changed and untracked files

`git diff --check` clean. `.env` ignored and never committed. The nested
`education-drm-service/` contains the separately owner-authorized upload-recovery
and job-status corrections, locally committed after acceptance as `5293917`.
The final platform review did not edit that package; its evidence is separated
in §19 and the dedicated DRM reports.

Modified:

- `.env.example` (M3 DRM docs + `SERVICE_VERSION 0.3.0-m3`)
- `client/package.json`, `client/package-lock.json` (Tailwind 3.4.14 + postcss 8.4.49 + autoprefixer 10.4.20, pinned local build)
- `client/Dockerfile` (copies the local Tailwind/PostCSS configuration into the production build stage)
- `client/tailwind.config.js`, `client/postcss.config.js` (new, pinned toolchain)
- `client/src/App.tsx` (Tailwind shell, feature routes)
- `client/src/routes.ts` (new, extracted hash routes)
- `client/src/i18n.tsx` (thin provider; strings split into `locales/ar.ts`, `locales/en.ts`)
- `client/src/screens.tsx` (re-export shim over `features/identity/pages/*`; M2 behavior preserved)
- `client/src/styles.css` (Tailwind entry + tokens/base only; 87 lines)
- `client/src/components.tsx` (deleted; replaced by `components/ui/*` + `components/layout/Header.tsx`)
- `docker/browser/Dockerfile`, `docker/browser/package.json`, `docker/browser/run.mjs` (full M3 workflow harness)
- `docker/browser/fixtures/sample.mp4` (new, test-only 2KB upload bytes, never in prod images)
- `docker/drm-fixture/` (new: test-only labeled fixture service + Dockerfile; browser profile only)
- `docker/compose.dev.yml` (`0.3.0-m3` tags, DRM timeout/retry env, `drm-fixture` browser-profile service, fixtures + `m3-evidence` mounts)
- `docker/compose.test.yml` (`0.3.0-m3` test images, DRM timeout/retry)
- `server/package.json` (0.3.0)
- `server/prisma/schema.prisma` (`CatalogDeletionOperation.courseId`)
- `server/src/app.ts` (redis added to catalog context)
- `server/src/config.ts` (DRM base-URL validation in every env; HTTPS-only in production)
- `server/src/index.ts` (reconciler with Redis lease)
- `server/src/logger.ts` (extended redaction + `sanitizeForLog`)
- `server/src/modules/catalog/` (decomposed; god files `service.ts`, `deletion.ts`, `routes.ts` removed):
  `types.ts`, `audit.ts`, `locks.ts`, `validation.ts`, `errors.ts`, `index.ts`, `drmClient.ts`, `drm/schemas.ts`, `courseTx.ts`,
  `courses/service.ts`, `hierarchy/service.ts`, `plans/service.ts`, `lifecycle/policy.ts`, `lifecycle/service.ts`,
  `media/intentService.ts`, `media/completionService.ts`, `media/syncService.ts`,
  `deletion/scopes.ts`, `deletion/requestService.ts`, `deletion/lease.ts`, `deletion/reconciler.ts`, `deletion/finalizer.ts`, `deletion/readService.ts`,
  `routes/shared.ts`, `routes/guards.ts`, `routes/public.ts`, `routes/courses.ts`, `routes/hierarchy.ts`, `routes/media.ts`, `routes/deletion.ts`, `routes/index.ts`
- `server/tests/unit/config.test.ts`, `health.test.ts`, `logging.test.ts` (M3 updates)
- `server/tests/unit/drm-schemas.test.ts` (new), `server/tests/fixtures/drmFixture.ts` (presigned PUT exempt from app credentials)
- `server/tests/integration/catalog-deletion.test.ts` (lease-aware calls), `catalog-deletion-unconfigured.test.ts` + `catalog-deletion-visibility.test.ts` + `catalog-media-intent.test.ts` + `catalog-replica-lease.test.ts` + `catalog-deletion-ownership.test.ts` + `catalog-course-lock.test.ts` (new), `drm-contract.test.ts` (presigned-PUT regression)
- `client/src/components/ui/{Button,Card,Field,Notice,Dialog}.tsx`, `components/layout/Header.tsx`
- `client/src/features/catalog/{types/models,api/client,hooks/usePublicCourses,hooks/useAdminCourse,components/PriceDisplay,components/OrderingControls,pages/*}` (12 pages/components)
- `client/src/features/identity/{components/IdentityForm,pages/RegisterPage,LoginPage,AccountPage,AdminUsersPage}.tsx`
- `client/src/features/home/pages/HomePage.tsx` (home-route composition with one primary landmark and heading)

Migrations (additive only; accepted M1/M2 and applied M3 migrations untouched):

- `20260929093000_m3_catalog` (original M3 catalog)
- `20260930093000_m3_corrections` (new; adds `CatalogDeletionOperation.courseId` + backfill + index + active-per-course partial unique)

## 3. Requirement / decision mapping

Same scope as before (R01 bilingual, R02 two roles, R03 EGP fixed-duration plans, R07 admin content/prices/uploads/removal, R08 API-only DRM, R09 one modular Express app, R10 Docker, D04/D11/D14/D15/D16/D17/D18/D19). Exclusions unchanged (no wallets, recharge, purchases, subscriptions, entitlement, lesson lists, playback, progress, expiry, refunds/coupons, live classes, extra roles, recovery, deployment, capacity). Public APIs expose only offers+plans.

## 4. Corrected file structure

- Tailwind v3 pinned toolchain (`tailwindcss 3.4.14`, `postcss 8.4.49`, `autoprefixer 10.4.20`), compiled locally via `tsc -b && vite build` (64 modules, CSS 13.05KB gzip 3.57KB in the final manager build). No CDN. Tokens come from `tailwind.config.js` + `:root` CSS variables mirroring `design.md` provisional palette; Arabic `Noto Sans Arabic` / Latin `Inter`; RTL via `lang/dir` + logical utilities (`ms-/me-`, `ps-/pe-`, `start-/end-` where needed); focus-visible ring, 44px targets, `prefers-reduced-motion` preserved.
- Frontend feature layout: `features/catalog/{api,types,hooks,components,pages}`, `features/identity/{components,pages}`, `components/ui/*`, `locales/{ar,en}.ts`. Decomposed pages: PublicCatalogPage, OfferPage, AdminListPage, CourseForm, PlanEditor, SectionEditor, LessonEditor (+LessonList), OrderingControls, MediaUploader, LifecycleControls, ArchiveControls, DeletionPanel, StatusBadge/Notice/Loading/EmptyState/ConfirmDialog.
- Backend cohesive modules as listed in §2 (routes split into public/courses/hierarchy/media/deletion; services split into courses/hierarchy/plans/lifecycle-policy+service/media-intent+completion+sync/deletion-scopes+request+lease+reconciler+finalizer+read). One Express app; transactions use typed `TxClient` + parameterized `Prisma.sql`; no `any` in new catalog code except narrowly justified test helpers; no `$queryRawUnsafe`/`$executeRawUnsafe` remain in catalog code; no `never` casts except one forward-compatible `as never` for the not-yet-generated `courseId` create field (removed after generate; verify: `grep -rn "as never" server/src/modules/catalog` returns nothing).
- Largest handwritten files (lines): backend `drmClient.ts` 200, `courses/service.ts` 193, `validation.ts` 177, `deletion/reconciler.ts` 147, `plans`/`lifecycle` ≤131; frontend `PlanEditor.tsx` 146, `AdminDetailPage.tsx` 107 + siblings ≤127, `screens.tsx` 5 (shim), `auth.tsx` 241 (pre-existing M2, below 250). No file above 250 lines; nothing above 300.

## 5. API route / authorization matrix

Unchanged envelope and M2 guards. Additions: `GET /admin/catalog/courses/:id/lifecycle-actions` (derived valid actions + disabled reasons for the UI). Deletion request/retry now thread Redis through the catalog context (`app.set('catalog', { prisma, redis, config, drmFactory })`). All catalog mutations remain origin+auth+ADMIN+sessionCSRF; reads auth+ADMIN; public discovery unauthenticated and leak-free.

## 6. Lifecycle transition matrix

Unchanged policy (DRAFT→PROCESSING→READY→PUBLISHED, reversible ARCHIVED with prior-status revalidation, 409 otherwise; structural/media mutations DRAFT-only). UI now derives actions from `GET lifecycle-actions` and explains disabled reasons instead of showing every button unconditionally.

## 7. DRM configuration and contract

- All-or-none core settings in every env; dev validates HTTP/HTTPS base URLs; production requires HTTPS + full credentials; unconfigured mutations fail closed 503.
- `DrmClient` validates every response against explicit schemas (`drm/schemas.ts`): UUID asset/deletion IDs, known status enums, valid HTTP/HTTPS upload URLs (no credentials in URL), required fields; oversized (>256KB), empty, malformed, unknown-status, wrong-type, and unsafe-URL responses fail `DRM_MALFORMED`. Adapter methods return only validated fields (no raw response objects). Timeouts/retries/categories unchanged (POST never auto-retried).
- Presigned browser uploads require no application credentials (fixture + contract test updated to match the real contract; previously both fixtures wrongly demanded them).

## 8. Registration durability (corrected)

No network I/O inside any database transaction. Registration: short tx creates/reuses an intent row (stable `externalAssetId` + `idempotencyKey`, `assetId` null) → commit → DRM call outside tx → short tx conditionally records `assetId`. P2002 races converge on the existing intent. Failure/uncertainty retains a retryable intent with a safe error category; repeats reuse identifiers; lost-write retries converge on the same DRM asset (fixture idempotent on `externalAssetId`). **Correction round 2:** when a DRM provider omits `uploadUrl` on an idempotent repeat, the platform fails safe with 409 `UPLOAD_URL_UNAVAILABLE` — it records the converged `assetId`, audits `MEDIA_REGISTER_FAILED`, and never returns success-with-null, never creates a second asset, never stores or fabricates a URL. The accepted DRM recovery change now returns a freshly signed URL for eligible `UPLOADED` repeats, so this compatibility guard is no longer a current blocker. Completion: reads mapping outside tx → DRM complete outside tx → short tx records; timeout/uncertainty reconciles via status first; 409 already-completed converges via status instead of fabricating failure.

## 9. Deletion coordination (corrected)

- Unconfigured adapter with externally registered media fails 503 BEFORE any mutation: exact regression creates a READY mapping with a DRM asset ID, requests deletion unconfigured, and asserts 503 + zero operations + null `deletionRequestedAt` + unchanged target/mapping + zero audit delta. No-media targets still complete platform-only.
- Course-scoped operations via new `courseId` column (correction migration with backfill): at most one active operation per owning course (service check + partial unique index); section/lesson deletion temporarily hides the course; on success the marker is cleared when no other active op for that course remains (the completing op is excluded from the idle check); on failure the course stays hidden while retryable; course deletion needs no cleanup; positions recompacted transactionally; evidence/audits retained. No cancellation mechanism invented.
- Replica-safe reconciliation via token-checked Redis `SET NX PX` (30s) leases (`deletion/lease.ts`): background ticks, immediate post-request reconciles, and explicit retries all acquire the same per-operation lease; only the owner performs external DELETE/status calls; crashed owners expire and others resume; release is Lua token-checked; Redis failure fails closed leaving durable state retryable; no DB transaction spans HTTP. The old non-transactional `SKIP LOCKED` claim is removed (selection is a plain bounded query; ownership comes from the lease).
- **Correction round 2:** the request path now uses `runDeletionCycle` under a renewing lease (`withRenewingLease` heartbeat every TTL/3). The lease is acquired before any external call, renewed while work exceeds the TTL, and re-verified before each external call and before finalization. A delayed initial request racing a reconciler produces exactly one external DELETE. Stale tokens cannot renew or release a newer owner's lease.

## 10. Frontend routes, screens, and upload behavior (corrected)

- Complete admin controls implemented and browser-proven: bilingual course edit, plan create/edit/remove with previous-price toggle + strict-greater validation, section/lesson create/edit, deterministic section+lesson reorder with conflict display, validation/conflict failure display, media register/upload/sync with READY polling, lifecycle actions derived from server state, archive/unarchive with confirmation, course/section/lesson permanent-deletion request + status polling + failure/retry.
- Upload requires a real selected file: supported MIME validated (`video/mp4`, `video/webm`, `video/quicktime`/`.mov`), the file's own MIME is sent (never hard-coded), registration is blocked without a file, signed-URL PUT responses are checked and abort on non-2xx, progress + retryable errors shown, completion never follows failed upload, no dummy bytes anywhere, no DRM credentials exposed, fixtures stay in test-only code/images.
- Browser regression proves zero network upload/completion calls without a selected file (fetch-interception probe: `media=0 put=0`).

## 11. Docker commands actually run

Repo root, PowerShell (representative):

```powershell
docker compose -p education-platform-test -f docker/compose.test.yml build
docker compose -p education-platform-test -f docker/compose.test.yml up -d --wait migrate
docker compose -p education-platform-test -f docker/compose.test.yml run --rm test npm run test:ci --silent
docker compose -p education-platform-test -f docker/compose.test.yml run --rm test npm run test:unit --silent
docker compose -p education-platform-test -f docker/compose.test.yml run --rm test npm run test:integration --silent
docker compose -p education-platform-test -f docker/compose.test.yml down -v
docker compose --env-file .env -f docker/compose.dev.yml build
docker compose --env-file .env -f docker/compose.dev.yml up -d --wait
docker compose --env-file .env -f docker/compose.dev.yml exec postgres psql -U postgres -d education_platform -c 'SELECT migration_name FROM _prisma_migrations ORDER BY started_at;'
docker compose --env-file .env -f docker/compose.dev.yml exec server node -e "fetch('http://127.0.0.1:3000/health/ready').then(async (r)=>{console.log(await r.text())})"
docker compose -p m3-migfail2 -f docker/compose.test.yml up -d --wait postgres
docker compose -p m3-migfail2 -f docker/compose.test.yml run --rm -e DATABASE_URL=postgresql://bad:bad@127.0.0.1:5999/nope migrate
docker compose -p m3-migfail2 -f docker/compose.test.yml down -v
docker compose --env-file .env -f docker/compose.dev.yml build client browser drm-fixture
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser up -d --wait  # with NGINX_PORT=8081 ALLOWED_ORIGINS='http://localhost:8080,http://nginx:8080' DRM_BASE_URL=http://drm-fixture:8090 DRM_CLIENT_ID=fixture-client DRM_CLIENT_SECRET=fixture-secret-that-is-long-enough-0123456789
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml run --rm --no-deps -e BOOTSTRAP_ADMIN_*=.. server node dist/bootstrap.js
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser run --rm browser  # with BROWSER_ADMIN_* + same env
docker compose --env-file .env -p education-platform-browser -f docker/compose.dev.yml --profile browser down -v
docker images --no-trunc --format "{{.Repository}}:{{.Tag}} {{.ID}}"
```

`down -v` used only on disposable `education-platform-test`, `m3-migfail2`, `education-platform-browser` projects. Never on development volumes.

## 12. Correction-round image IDs (`:0.3.0-m3`, historical)

These images supported the correction round. The later final-review rebuilds
that supersede the changed client, browser, fixture, and test images are listed
with the final evidence in §19.

- server `e7cae80f392e` (`sha256:e7cae80f392efd2321dc7d431d8df61ec8db68891aec17741af8237de2eeeec4`)
- migrate `db38ea8c14ff` (`sha256:db38ea8c14ffbce92c53d26d3f217cc5cf99f9e394e8cbcfa6c21cbc7e9bf1bf`)
- client `431c2c4eefef` (`sha256:431c2c4eefeff60eaf91576ecdfa5e386ff3124928e8d756e4f709e28e1870e6`, Tailwind build)
- nginx `a30cc5c308d6` (`sha256:a30cc5c308d68bba7298fc614a78f3dc51c6e564fca6c1c4426fdc2ad4e98165`)
- server-test `bd5a81c5e345` (`sha256:bd5a81c5e345966129baf02c5901862357cb8b35ac5ebbe1e5dbb5e82c12753c`)
- migrate-test `29315fe833ed` (`sha256:29315fe833edeea632c8908688de71b29d78fd55951f3c63ee0ed830a2f84d94`)
- browser `b4205ec51a16` (`sha256:b4205ec51a16e839a6a1f41adbc1c164285ffe7e297be2428e252af992b7500c`)
- drm-fixture `58588df27396` (`sha256:58588df273968ac781641673e7ce5d59a9811673848912cb3249302dfe753441`, test-only, never in prod)

Prior `:0.2.0-m2` images remain for rollback. Prior `:0.3.0-m3` IDs from the uncorrected round are superseded by the builds above.

## 13. Test counts and PASS/FAIL/BLOCKED

All verification in Docker; fixtures labeled, never presented as external proof.

| Suite | Count | Result |
|---|---|---|
| Unit (13 files: M2 preserved + catalog-validation, drm-client, drm-schemas, catalog-logging, deletion-state, config extension) | 76/76 | PASS |
| Integration (20 files: M2 52 preserved + catalog-auth/ordering/publication/deletion/migration/unconfigured/visibility + media-intent + replica-lease + deletion-ownership + course-lock + deletion-intent-safety + drm-contract) | 110/110 | PASS (final-review reproduction) |
| Browser through Nginx with labeled fixture (M2 20 preserved + M3 38) | 58/58 | PASS |
| Fresh M1→M2→M3→corrections migration (empty disposable DB) | 4 applied | PASS |
| Upgrade from applied M3 state on dev (corrections migration) | applied, 4 rows, data preserved | PASS |
| Migration failure gates startup (bad URL → exit 1) | exit 1 | PASS |
| Dev restart persistence | healthy, 4 migrations | PASS |
| Backend readiness unconfigured (200, `configured:false`) | 200 | PASS |
| Prod config rejects partial/non-HTTP/non-HTTPS/missing DRM | throws | PASS |
| Runtime images exclude tests/src/fixtures, non-root `app`, no secrets in bundles | clean | PASS |
| Secret scans (logs with `[Redacted]`, bundles, image history, tracked files, `.env` ignored) | 0 hits | PASS |
| Dependency audits | server 4 high (no fix) + client postcss 1 high (pinned; build-time only) | Reported |
| Live Cloudflare R2 + real DRM upload/deletion | — | BLOCKED (see §15) |

M2 suites (45 unit + 52 integration + 20 browser) all pass inside the larger totals. Zero FAIL. Evidence PNGs in `reports-and-markdown-files/m3-evidence/` (9 files: 3 M2 + 6 M3 including offer, upload-ready, deletion).

## 14. Regression evidence (reviewer findings, now proven)

- Unconfigured deletion: READY mapping + DRM asset ID, unconfigured adapter → 503 `DRM_UNCONFIGURED`, zero operations, null marker, unchanged target/mapping/audits; no-media lesson deletion still 202/COMPLETED.
- Visibility: no-media lesson/section deletion completes and clears the marker; media-backed lesson deletion clears it only after DRM COMPLETED; failure keeps the course hidden; retry-to-completion restores the survivor with marker null; second deletion in the same course while one is active → 409 `DELETION_IN_PROGRESS`; deleting one course never touches another.
- Registration intent: lost-write retry converges on one asset with identical identifiers and no extra fixture asset; registration timeout reuses identifiers; 5-way concurrent registrations yield one mapping + one fixture asset; completion timeout reconciles via status; `pg_stat_activity` shows zero `idle in transaction` during a delayed registration.
- Lease: two concurrent reconcilers yield ≤1 effective DELETE scheduling round; second owner skips its status poll; expired leases are re-acquired; stale tokens cannot release newer leases; concurrent reconciliation to completion emits exactly one `DELETION_COMPLETED` audit with no premature finalization.
- DRM schemas: non-UUID IDs, unknown statuses, missing fields, wrong types, and empty/unsafe/non-HTTP/credential-bearing upload URLs all fail `DRM_MALFORMED`.
- Browser no-file probe: register click without a file sends zero media/PUT requests and blocks with a validation message.
- Presigned PUT: credential-free `PUT {uploadUrl}` returns 200 against the fixture (contract test).
- Concurrency/ordering/restart/failure evidence from the prior round re-verified after refactor (contiguous positions under concurrency, exact concurrent price updates, complete-set reorder enforcement, dual-reconciler convergence, restart resume, `down -v` only on disposable projects).
- **Course-scoped concurrency (correction round 2):** deterministic regression proves T1 holding a course lock + archiving blocks T2's structural mutation, which then returns 409 `COURSE_ARCHIVED` with zero hierarchy/audit changes. All course mutations (course update, plan CRUD, section/lesson CRUD + reorder, lifecycle transitions, media intent/completion, deletion request/finalize) use `withCourseLock` lock-then-validate.
- **Replica-safe deletion ownership (correction round 2):** delayed initial request racing a reconciler produces exactly one external DELETE; lease renewal keeps ownership past the original TTL (competitor `acquireDeletionLease` fails throughout the post-TTL window); stale tokens cannot renew or release a newer owner's lease; restart recovery completes idempotently with a single `DELETION_COMPLETED` audit.
- **Registration recovery contract blocker (correction round 2):** idempotent repeat without `uploadUrl` fails safe with 409 `UPLOAD_URL_UNAVAILABLE` — no success-with-null, no second asset, no stored/fabricated URL, identifiers still converge. The exact idempotent-repeat shape (same asset, no `uploadUrl` key) is reproduced against the fixture.

## 15. Dependency-audit findings

- Server prod (`npm audit --omit=dev` in `edu-platform-server:0.3.0-m3`): 4 high via `deepmerge-ts → @prisma/config → prisma → @prisma/client` (`GHSA-ggr8-5vv4-36mx`). `No fix available`. No upgrade performed.
- Client (`npm audit` in `client/`): 1 high `postcss ≤8.5.22` (`GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, `GHSA-fxqj-rqcc-2cmp`, `GHSA-r28c-9q8g-f849`; fix `8.5.28` outside the pinned `8.4.49` range, would force a Tailwind-adjacent upgrade). Build-time only (attacker-controlled CSS comments in our own source); not remediated to preserve the pinned, tested toolchain.
- Browser harness `npm audit` shows 3 high (dev-only Chromium harness, not shipped).

## 16. Confirmations

- Development data survived: dev volumes never `down -v`; `_prisma_migrations` shows 4 rows after restart; stack healthy `ready`, `version 0.3.0-m3`.
- `design.md`, system-design JPEG, DRM PDF unchanged (no diff entries; tokens remain semantic for owner review).
- Nested DRM started and was reviewed at accepted baseline `6e1e01c`; after manager acceptance its bounded recovery/job-status changes were committed locally as `5293917`. The platform checkpoint records that new gitlink. `origin/main` remains `6e1e01c` because nothing was pushed.
- Client production build compiles Tailwind locally (64 modules, no CDN).

## 17. Remaining blockers and risks

`BLOCKED — live Cloudflare R2 and real external DRM upload/deletion verification could not be performed because the required DRM endpoint, application credentials, and R2-backed external configuration were not supplied.`

`RESOLVED (final review) — upload-URL contract: the owner-authorized DRM recovery change was independently verified (38/38 twice, first-registration and recovered uploads reaching READY through the real worker 7/7), and the platform integration is proven compatible (browser upload flow reaches READY via fixture; platform still fails safe with UPLOAD_URL_UNAVAILABLE/DRM_MALFORMED against incompatible providers). The old contract blocker is lifted.`

Local HTTP fixtures prove the platform contract only. They do not prove Cloudflare R2, protected playback, watermarking, commercial DRM, or production readiness. Additional risks: no 10k-user, Widevine, or production TLS claims; terminal-failure policy uses API retry rather than endless worker retries; fixture auto-advance stands in for real processing timing.

## 18. Rollback instructions

1. Stop M3 stack: `docker compose --env-file .env -f docker/compose.dev.yml down` (without `-v`).
2. Redeploy prior images `:0.2.0-m2` (server/migrate/client/nginx) or set `SERVICE_VERSION=0.2.0-m2`; `up -d --wait`.
3. Database: both M3 migrations remain (additive, unused by M2 code, harmless). Do not `migrate reset` or `down -v` on dev. Full schema revert requires a pre-M3 PostgreSQL backup (owner recovery objectives; no automatic restore performed here).
4. Verify `/health/ready` 200 and M2 suites (45/52/20) pass.
5. Disposable volumes already removed; dev `pgdata`/`redisdata` retained.

## 19. Final independent review evidence (2026-09-29)

The final review reproduced every suite from the current uncommitted tree
instead of trusting prior claims. No platform production file was changed;
the final-review worker made no nested DRM edits (the previously authorized
uncommitted DRM changes remained present and were reviewed read-only).

Platform reproduction (`education-platform-test` project, images
`edu-platform-server-test` `c566f5a0d` / `edu-platform-migrate-test`
`5f5bcfbdb`):

- Unit 76/76 (13 files), integration 110/110 (20 files, incl.
  `catalog-course-lock` 1, `catalog-deletion-ownership` 5,
  `catalog-deletion-intent-safety` 2, `catalog-media-intent` 6 with the
  `UPLOAD_URL_UNAVAILABLE` safe-failure case, `catalog-replica-lease` 5,
  `catalog-migration` 3 on the empty disposable DB).
- `typecheck` exit 0. Correction to prior wording: the server package has
  no `lint` script (`Missing script: "lint"`), so there is no lint baseline
  to be clean or dirty; static checking is typecheck, which passes.
- Fresh M1→M2→M3→corrections migration verified inside the integration run;
  dev DB holds all 4 migrations with data preserved; bad-URL migration
  exits 1 (failure gates startup).
- Server audit: 4 high via `deepmerge-ts → prisma` chain, no fix available
  (reported, not remediated). Runtime server image: uid 999, no
  tests/src, no secret env, logger redaction present.
  `git diff --check` clean (CRLF notices only).

Browser reproduction (`education-platform-browser` project on port 8081,
images client `d013f1e72`, browser `39b7c146a`, drm-fixture `6fd1a39af`,
server `e7cae80f392`, nginx `a30cc5c308d`):

- **BROWSER 58/58 passed**, incl. Arabic RTL/English LTR, UI
  register/login/phone-login/logout/logout-all, admin creation + role
  denial, bilingual course + plan/offer CRUD, deterministic section/lesson
  reorder, no-file probe (`media=0 put=0`), upload flow to READY via
  fixture, DRAFT→PROCESSING→READY→PUBLISHED, public offer privacy
  (lessons hidden, EGP shown), archive 404/unarchive 200, lesson deletion
  + failure-retry-to-completion, storage-only-language, no secrets in
  bundle.
- Environment incident (not a platform defect): the first browser attempt
  failed UI registration with HTTP 403 because a stale server container
  from a port-conflicted first `up` kept default
  `ALLOWED_ORIGINS=http://localhost:8080`. After `down -v` of the
  disposable project and a fresh `up` with
  `ALLOWED_ORIGINS=http://localhost:8081,http://nginx:8080` +
  `DRM_BASE_URL=http://drm-fixture:8090`, the full 58/58 passed with zero
  code changes. Recorded so the manager is not misled by the transient.
- Tailwind production proof: emitted CSS contains the semantic utilities
  (`bg-primary`, `rounded-control`, `text-muted`); Dockerfile copies
  `postcss.config.js` + `tailwind.config.js` into the build stage.
  Accessibility/responsive by source + browser: one `<main id="main">`
  per route, one primary `<h1>` per route, skip-link, Arabic default RTL,
  390px `overflow=0` on register + catalog, 44px targets, replaced footer
  in both locales.

Nested DRM reproduction (`drm-deletion-test` project, read-only review;
images api `d91c1e21d`, worker `b05c8a98`, migrate `c95f07caf`,
test-runner `cc96bd73a`):

- Processing 7/7 (repository `updateJobStatus` regressions + real
  worker-to-READY via first-registration and recovered URLs).
- Upload-recovery 38/38 twice consecutively **with the manager's
  deterministic `waitForReady` correction** (observe-READY-before-playback).
- Deletion 44/44 (first run 43/44 on the known transient SIGTERM-timing
  test, green on immediate re-run with zero changes — same flake profile
  as the prior round, recorded not hidden).
- Unit 48/48, integration/media/e2e scaffolds green, `tsc --build --force`
  clean, migration-failure exit 1, runtime images uid 1000 without test
  sources, 0 secret hits in api/worker logs. Lint remains the
  pre-existing missing-ESLint-config failure, unchanged.
- The `::varchar` job-status correction and the manager's deterministic
  test correction were both verified present and passing; the final-review
  worker did not edit the nested package.

Review outcome: no evidence-backed platform defect was found that requires
a code fix. The combined tree (platform M3 + DRM recovery + DRM job-status
fix + manager corrections) is internally consistent and fully green as
reproduced above. Acceptance remains the manager's decision. The only
remaining blocker is live R2/real-DRM verification (§17).

---

Final-review handoff before manager checkpoint: M3 changes uncommitted (platform HEAD `bad064f`,
nested HEAD `6e1e01c`, gitlink intact), no push/deploy/PR, no final-review DRM edits, no
dev volume removal, no live-R2 fabrication, disposable projects removed
with `down -v`. Reproduce with the `test` + `browser` suites in disposable
projects per §11 and inspect the diff + this report.

## 20. Manager ruling (2026-09-29)

The manager corrected the stale historical statements in §§2, 4, 8, 12,
16, and 19, then independently reran the platform's Docker unit suite
(76/76), integration suite (110/110), and typecheck (exit 0) from the current
uncommitted tree. `git diff --check` remains clean apart from informational
Windows line-ending notices. These results agree with the final review's
58/58 browser reproduction and the independently reproduced DRM processing,
recovery, deletion, and unit suites recorded above.

**Ruling:** the M3 implementation and the bounded DRM upload-recovery and
job-status prerequisites are accepted for the locally verified scope. No
evidence-backed code defect remains. This is not a production-readiness or
capacity certification: live Cloudflare R2 and real external DRM
upload/deletion verification remains blocked exactly as stated in §17.
After the owner authorized local checkpoints, the accepted DRM work was
committed as `5293917` and this platform tree was prepared for its M3 commit.
No push, deployment, PR, or development-volume removal was performed by the
manager.
