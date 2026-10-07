# M10 agent 2 report — course rosters and temporary report APIs

## Coordinator completion — 2026-10-07

Owner instructed the coordinator to finish Agents 2 and 3. This section supersedes
the initial delivery/review status below while preserving historical evidence.
No commit/push/deployment, schema/migration change, DRM edit or retained preview
upgrade was performed by this worker; milestone acceptance remains owner-owned.

All six backend findings repaired:

- Per-lesson negative status requires full tracking and subscription-union
  coverage, an existing lesson/current READY mapping before the week, and no
  replacement evidence. Partial/preactivation/gapped/new-media coverage is
  unavailable; positive current-mapping counted evidence stays viewed. Mapping
  update timestamps conservatively reset negative coverage because historical
  readiness state is not persisted.
- Deduplicated period summaries show current assessment status at generation.
  Constituent weeks show immutable attempts and only pass events inside that
  week. A Week-4 pass never becomes a Week-1 achievement; mutable grading states
  are not fabricated as historical week states. Assessment labels are numbered
  and include the published title and lesson.
- Every production generation read uses one PostgreSQL REPEATABLE READ snapshot;
  view windows use countedAt half-open boundaries. A real-database concurrency
  test writes a counted view and grading pass after the first report read: both
  appear only in the next generation.
- Admin detail uses platform MediaMapping.id, preserves all-version lifetime
  totals/mediaVersions, and adds currentMediaViews/currentMediaLastViewedAt for
  the live version alone. One old version is PARTIAL. Roster totals are null
  before activation, never fabricated zero. Existing historical roster rules and
  stricter current published-generation eligibility are documented separately.
- Final contextual/numbered parts are at most 1000 UTF-16 units and 3800 encoded
  text characters. Oversized Arabic/emoji lines preserve content without splitting
  surrogate pairs; lone invalid surrogates normalize to U+FFFD. Course changes
  reset repeated week context. Real combined Arabic four-week API output fits
  a 4000-character wa.me URL including a 15-digit synthetic recipient.
- Invalid query arrays, oversized search, null/malformed bodies, unknown/cross
  course lesson cursors and unknown roster cursor rows return validation errors.

Changed files: parent-reports/reportServer.ts, reportService.ts, routes.ts,
text.ts, viewFacts.ts; integration/m10-parent-reports.test.ts, m10-view-fixture.ts;
new unit/m10-parent-report-text.test.ts; API contract and this report. The fixture
now requires the real migration and cannot manufacture missing tables. No extra
configuration or persistence was introduced. Frontend received the additive DTO
and URL budget contract; coordinator owns integrated browser evidence.

Docker verification used project `m10-finish-backend`, PostgreSQL16/Redis7 and
retained reusable test/migration images. All 25 real migrations applied. Initial
17-case rerun exposed one obsolete fixture using external identities; the fixture
was corrected to actual platform mapping IDs. Final source/test typechecks PASS;
23 report API tests + 3 text tests + 6 identity security + 6 session tests =
**38/38 PASS, no skips/failures**. Commands actually run:

```powershell
docker compose -p m10-finish-backend -f docker/m10-agent-2/compose.test.yml up -d --wait postgres redis
docker compose -p m10-finish-backend -f docker/m10-agent-2/compose.test.yml run --rm migrate
docker compose -p m10-finish-backend -f docker/m10-agent-2/compose.test.yml run --rm --no-deps -e LOG_LEVEL=silent --volume 'A:/Projects/Work Projects/education-platform/server/src:/review-src:ro' --volume 'A:/Projects/Work Projects/education-platform/server/tests:/review-tests:ro' --entrypoint sh test -c 'cp -R /review-src/. /srv/server/src/ && cp -R /review-tests/. /srv/server/tests/ && npm run typecheck && npx vitest run tests/integration/m10-parent-reports.test.ts tests/unit/m10-parent-report-text.test.ts tests/integration/identity-security.test.ts tests/integration/identity-session.test.ts'
```

Rollback: revert only these bounded application/test edits and rebuild. Never
delete applied migrations, stored view facts or retained databases to roll back
reporting code. No remaining backend blockers; integrated/browser review remains
the coordinator's responsibility.

Cleanup completed after checking exact project labels, every container mount,
network/volume labels and Redis anonymous-volume exclusivity. Removed only
`m10-finish-backend-{postgres,redis}-1`, its default network, named
`m10-finish-backend_pgdata-m10a2` and Redis anonymous volume
`567389a1604290bcec3df539d8ca04c13c96f48e4719c5070b2647d1853a0422` via
`docker compose -p m10-finish-backend -f docker/m10-agent-2/compose.test.yml down -v`.
Final project container/network/volume filters and exact anonymous-volume filter
all returned zero resources. One-off test/migration containers used `--rm`.
No image was created by these runs or removed; reusable images, retained
previews/data, DRM and sibling/coordinator resources were preserved. No global prune.

## Initial worker delivery (historical)

Date: 2026-10-07. Ownership: agent 2 only (server/src/modules/parent-reports/,
server/src/app.ts mount, tests, docker/m10-agent-2/, this report +
contract). No client UI, no DRM edits, no Prisma schema/migration changes
(the schema/M10 tables are agent 1's), no commit/push.

## What was delivered

- `server/src/modules/parent-reports/` (new):
  - `routes.ts` — ADMIN router with read/write guards, bounds, no-store.
  - `reportService.ts` — canonical course filter (`revisionOwnerId: null`,
    `deletionRequestedAt: null`, `status PUBLISHED`, entitlements via the
    existing rule), bounded keyset roster (grouped-by-student query, no
    N+1), per-student lesson aggregates with per-media-version coverage,
    `reportCourses`.
  - `reportServer.ts` — transient parent-report generation with one
    server-authoritative cutoff, half-open 7/14/28-day window, exact
    consecutive 168-hour weekly sections, Cairo-date labels, clipped and
    labeled pre-tracking/pre-membership/expiry time, earned-pass vs
    period-attempt separation, assessment status precedence
    (passed > checking > serviceError > notSubmitted > notYetPassed).
  - `text.ts` — Arabic/English FAYQ templates, compact weekly sections,
    numbered bounded parts (~1000 chars).
  - `viewFacts.ts` — typed parameterized readers over agent 1's frozen
    tables via `Prisma.$queryRaw` (`M10VideoViewSession`,
    `M10ViewTrackingState`), avoiding a dependency on the client regenerate
    step.
  - `index.ts` — public surface.
- `server/src/app.ts` — mount: `app.use('/admin', createParentReportsRouter(...))`
  behind the existing JSON/cookie/CORS/no-store scaffolding.
- `server/tests/integration/m10-parent-reports.test.ts` (17 tests) with
  labeled fixture mirror `server/tests/integration/m10-view-fixture.ts`.
- `docker/m10-agent-2/compose.test.yml` — disposable project
  `education-platform-m10-agent-2`, distinct image tags
  (`edu-platform-*-m10a2:0.4.0`), own DB + volume.

## Verification

- `npm run typecheck` — clean.
- M10 integration suite, real disposable PostgreSQL (Docker):
  `tests/integration/m10-parent-reports.test.ts` **17/17 passed**, including
  ADMIN-only access, zero-activity roster rows, package+standalone
  deduplication, expired/indefinite membership visibility vs report-courses
  exclusion, hidden working-copy exclusion, keyset paging bounds and q
  search, `limit`/`cursor` 400s, missing tracking state labeled
  unavailable (not zero), video replacement (`PARTIAL`, old asset sessions
  preserved), exact boundary/DST labeling across the 2026-10-29 transition,
  WEEK/TWO_WEEKS/FOUR_WEEKS composition, attempt vs earned-pass semantics,
  checking/service-error/not-submitted distinction, multi-course isolation,
  invalid input matrices, missing/changed guardian contact, and absence of
  any persisted report table.
- Full integration suite through the same test container: **437 passed,
  20 skipped, 1 fixture-guard skip** (`learning-materials` requires a
  differently-named disposable DB; unrelated to M10).
- Full unit suite: **572 passed**.
- The run used the REAL agent-1 migration `20261007100000_m10_view_tracking`
  (the `migrate` service applies it; the fixture mirror detects the real
  tables and does not substitute). Earlier fixture-only checks were also
  run while the migration was being prepared.

## Period semantics (codified)

- Cutoff = request time; window `[cutoff - 7/14/28d, cutoff)` half-open,
  start inclusive, end exclusive. Weekly sections are exact consecutive
  168-hour intervals ending at the cutoff. Labels are exact Cairo dates via
  `Intl.DateTimeFormat` formatToParts; 2026-10-29 DST end changes only
  wall-clock labels, never the 168-hour length.
- Precedence for time before tracking activation, membership start or after
  membership expiry: clipped and labeled; never rendered as zero activity.

## Contact handling

- `guardianContactAvailable` boolean in rosters; no plaintext phone in
  rosters. `GET .../report-contact` returns the current
  `StudentProfile.parentPhone` (or null) for the authorized ADMIN only; the
  generation response echoes the same current phone in
  `guardian.phone`. A changed number flips availability and invalidates any
  pre-prepared recipient at preview time. Missing contact permits preview
  text but prevents chat handoff (no recipient). Never logged: the existing
  pino redaction list already masks `parentPhone`, and report bodies are
  never serialized into request logs.

## Privacy / persistence

- No persisted generated-report model, archive, sending log, scheduler,
  queue or third-party API. Reports exist only in the HTTP response;
  underlying facts remain for regeneration with a new cutoff. Responses
  carry `Cache-Control: no-store`. Guarded by `requireOrigin` +
  `requireAuth` + `requireAdmin` + `requireSessionCsrf` with a 30/60 s
  fixed-window rate limit on generation. Global 256 KiB JSON cap; q/limit/
  course-selection bounds; invalid memberships rejected with 404.
- Parent-facing text never contains numeric view counts, national IDs,
  wallet data, raw assessment answers or media URLs.

## Data semantics preserved

- Registration ≠ enrollment: no roster row without a subscription row.
- Package+standalone subscriptions deduplicate to one row per student.
- Finite expanded into expiry comparison; indefinite (`expiresAt` null)
  allowed without dates. No subscription extension or invented dates.
- Previous-course evidence and media-version identity are preserved via
  per-lesson media-version totals (`PARTIAL` coverage for replaced videos).
- `AssessmentPass` records are never forfeited; later failed attempts show
  period attempts separately.
- Working copies (`revisionOwnerId` set) and historical course copies are
  excluded from canonical roster/eligibility surfaces.

## Open dependencies / blockers

- None blocking. Agent 1's real migration is applied and the whole M10
  path runs against it. A coordinator decision may be needed if agent 1
  later extends the frozen table with additional NOT NULL columns:
  `insertViewSession` mirrors the current column set
  (id, studentId, courseId, lessonId, mediaAssetId, mediaExternalAssetId,
  playbackReferenceId, startedAt, countedAt, playedMilliseconds).
- `security-route-surface.test.ts` has an explicit protected-route
  inventory: agent 2 proposes adding the five new admin paths there, but
  left that edit to the coordinator as a shared-file change.
- No capacity claim is made; no production access.

## Rollback

- Remove `server/src/modules/parent-reports/` and revert the two-line
  `app.ts` import/mount additions; delete the two test files and
  `docker/m10-agent-2/`; remove the test container/volume:
  `docker compose -p education-platform-m10-agent-2 -f docker/m10-agent-2/compose.test.yml down -v`.

## M10 requirement mapping (design.md + m10-parent-reports-plan.md)

- M10-03 (rosters/admin views): `courseRoster`, `studentCourseViews`,
  `reportCourses`, `report-contact`.
- M10-04 (transient report generation): `generateParentReport`.
- Admin-facing tracking counts; parent-facing no-numeric-counts; no
  persistent report snapshot anywhere in the delivered path.

## Fixture compatibility note

`server/tests/integration/m10-view-fixture.ts` mirrors the frozen columns
for the isolated phase and detects+skips when the real table exists. Final
evidence: 17/17 with the real migration applied (volume reset on 2026-10-07,
full migrate from scratch, tests passed on the same DB).

## Owned Docker resources — final cleanup check

- Containers: `education-platform-m10-agent-2-{postgres,redis,migrate}-1`
  removed via
  `docker compose -p education-platform-m10-agent-2 -f docker/m10-agent-2/compose.test.yml down -v`.
- Network `education-platform-m10-agent-2_default` and volume
  `education-platform-m10-agent-2_pgdata-m10a2` removed by the same
  command. Anonymous redis volume bound to the agent-2 test container was
  removed with the stack; no stray `m10-agent-2`/`m10a2` containers,
  networks or volumes remain (verified with `docker ps -a`, `docker
  volume ls`, `docker network ls` filters).
- No global prune; no `down -v` against agent 1 / agent 3 / DRM / nginx /
  local-preview projects. The agent-1 (`m10-agent-1-*`, `m10a1`,
  `m10-agent-1-browser`, `m10-agent-1-drill`, `m10-agent-1-repair`),
  agent-3 (`m10-agent-3*`), `fayq-local-preview-*`,
  `education-drm-service-*` and `m8-owner-preview-*` resources, plus
  anonymous volumes used by them, were inspected and preserved. Built test
  images (`edu-platform-*-m10a2:0.4.0`) are retained for evidence, not
  leaked into other projects.
