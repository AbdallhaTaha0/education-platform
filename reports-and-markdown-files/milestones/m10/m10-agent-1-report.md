# M10 agent 1 report — video-view tracking (platform-owned)

2026-10-07. Agent 1 only: viewing-session tracking + player integration. No
course-roster UI, parent report generation or WhatsApp implementation. Stop for
coordinator review; no milestone acceptance claimed. No commit/push, no
production deployment, no retained-preview upgrade, no nested DRM edits.

Field semantics, DTO freeze and aggregate queries for agent 2 are in
[m10-view-tracking-contract.md](m10-view-tracking-contract.md) (published early
in this handoff; agent 2 can integrate while this report is reviewed).

## 1. Changed files (agent-1 owned only)

Exclusive ownership per `m10-parallel-contract.md` was obeyed. Sibling files
were preserved (including the nested DRM Git-reference difference and
concurrent `parent-reports` / `AdminDetailPage` / formatting changes, which were
not reverted).

- `server/prisma/schema.prisma` — added `M10VideoViewSession`,
  `M10ViewTrackingState` + `User.m10ViewSessions` / `Lesson.m10ViewSessions`.
  No existing model, column, index or checksum touched.
- `server/prisma/migrations/20261007100000_m10_view_tracking/migration.sql` —
  NEW additive migration (CREATE TABLEs + indexes + singleton INSERT only).
- `server/src/modules/learning/tracking/validation.ts` — NEW pure bounds
  (`VIEW_THRESHOLD_MS=30000`, `MAX_PLAYED_MS=86400000`).
- `server/src/modules/learning/tracking/service.ts` — NEW idempotent start,
  atomic heartbeat, coverage fence, safe payload shaping.
- `server/src/modules/learning/routes/index.ts` — ADDED two routes + rate
  limits only (`/views/start`, `/views/:id/heartbeat`); existing playback,
  progress, session, materials behavior untouched.
- `client/src/features/learning/player/viewTracking.ts` — NEW accumulator +
  restart-rule documentation.
- `client/src/features/learning/player/viewApi.ts` — NEW telemetry transport
  (same-origin `/api`, credentials, CSRF; memory-only ids).
- `client/src/features/learning/player/useViewTracking.ts` — NEW grant-lifecycle
  hook (one session per grant, 5s bounded heartbeats, best-effort flush).
- `client/src/features/learning/player/Player.tsx` — ADDED optional
  `courseRef`/`lessonId` props + observe/flush wiring + waiting/playing
  handling; resume/completion, DRM recovery, watermark, fullscreen and
  entitlement behavior preserved (tracking disabled when props absent).
- `client/src/features/learning/pages/CourseLearningPage.tsx` — passes
  `courseRef={courseSlug} lessonId={selectedLesson.lessonId}` into the player
  (2-line integration; sibling formatting changes preserved).
- `client/src/features/learning/player/viewTracking.test.ts` — NEW 8 unit tests.
- `server/tests/unit/m10-view-tracking.test.ts` — NEW 6 unit tests.
- `server/tests/integration/m10-view-tracking.test.ts` — NEW 17 Docker tests.
- `docker/m10-agent-1/compose.yml` — NEW owned disposable stack (project
  `m10-agent-1-test`, unique images/ports/volumes).

Shared-file note for coordinator: `CourseLearningPage.tsx` is outside the
`player/` folder but is the required player-integration point named in the
prompt; the 2-line prop pass-through is the only change requested for merge.
`client/.../api/client.ts` was deliberately NOT edited (new `player/viewApi.ts`
instead) to avoid colliding with siblings. No `server/src/app.ts`, manifest,
lockfile, old migration SQL, index or sibling Docker wrapper was edited.

## 2. M10 requirement mapping

| M10 plan / prompt rule | Implementation | Evidence |
|---|---|---|
| Session counts ONCE after 30s actual playing; 60/90s add nothing | `countedAt` set once via `CASE WHEN countedAt IS NULL AND GREATEST(...)>=30000`; heartbeat test 29s=0/30s=1/90s still 1 | `m10-view-tracking.test.ts` threshold + dedupe cases; 17/17 pass |
| Refresh/successful reconnect +30s creates another count | New playback grant → new row (`UNIQUE(playbackReferenceId)`); refresh test creates 2 counted rows | integration refresh case |
| Failed reconnect = 0 | No grant → no start; fabricated id → `401 PLAYBACK_SESSION_EXPIRED` | failed-reconnect case |
| Pause/resume/renewal stay in same session | Same `referenceId` reuses row; renewal test re-attaches + counts once | renewal case |
| Seek/buffer do not advance | `ViewAccumulator` drops paused/seeking/ended/waiting/jump/duplicate samples | `viewTracking.test.ts` 8 tests; server monotonic `GREATEST` |
| Dedupe repeats/remounts/retries/concurrent, not refresh/reconnect | Start `ON CONFLICT DO NOTHING`; heartbeat atomic max + single transition; concurrent tests | duplicate/concurrent cases |
| Authenticated identity + course/lesson/media/playback + current access | `resolveCourse`/`resolveLesson` + owned ACTIVE reference + media READY + entitlement re-check on heartbeat | role/ownership/expiry/binding cases |
| Existing Origin/CSRF/validation/rate-limit patterns | `studentWriteGuard` + `learning-view-start` 30/min + `learning-view-heartbeat` 120/min + bounded integer/total | CSRF/Origin cases |
| Reported activity, not attention/fraud proof | Contract + code comments + no such claims in UI strings | contract §2.3 |
| Additive indexed schema; agent-1 owns migration | `20261007100000_m10_view_tracking`, 25/25 applied, old checksums untouched | Docker migrate log; `_prisma_migrations` |
| Counts survive restarts/concurrent/replicas, no duplicates | Durable rows + single-statement transitions + unique fence + shared Redis limits | concurrent/duplicate/restart reasoning + tests |
| Version binding; no old-completion backfill | Snapshot `mediaAssetId`/`mediaExternalAssetId` (no FK); retirement-deletion test preserves history; fresh-lesson completion creates 0 views | replacement + nobackfill cases |
| Coverage for unknown vs zero | Singleton `M10ViewTrackingState id='global'`; KNOWN/PARTIAL/UNAVAILABLE rules + aggregate queries | coverage case + contract §3.2/§4 |
| No raw-event retention/deletion invented | Only session aggregates stored; no deletion job | schema + contract §3.3 |
| Short videos: no silent threshold lowering | Uniform 30s; single <30s completion does not count; documented | contract §3.3 |
| Bounded frequency/payload/queries; failure never breaks playback; no per-frame requests | 5s heartbeat + final flush, <256-byte payload, 1 SELECT + 1 atomic write; client try/catch | hook + Player wiring |
| No login/playback credentials in persistence/new rows | Token/assertion/URLs never stored; `viewSessionId` memory-only; row-serialized token absence test | credential case + session boundary |

## 3. Actual Docker commands and results

Disposable project `m10-agent-1-test` only. Retained preview (`fayq-local-*`),
sibling workers and reusable images preserved; no global prune, no `down -v` on
retained projects.

- `docker compose -p m10-agent-1-test -f docker/m10-agent-1/compose.yml build migrate`
  → built `edu-platform-m10a1-migrate:0.10.0` (forced `--no-cache` once after a
  quoted-`"TEXT"` SQL fix; see §5).
- `... up -d --wait postgres redis` → both Healthy (unique localhost ports
  5433/6380 only; no 8080 publish).
- `... up migrate` → `All migrations have been successfully applied` (25/25,
  top = `20261007100000_m10_view_tracking` over
  `20261006230000_remove_lesson_captions`).
- DB check via Prisma: `trackingState id=global startedAt=2026-10-07T01:43:43Z`,
  indexes 11/11 present, `LessonProgress` readable (4 rows after learning
  suite; M10 views cascade with lessons by design, so 0 after sibling-reset —
  see §5).
- `DATABASE_URL=...5433 REDIS_URL=...6380 npx vitest run tests/unit/m10-view-tracking.test.ts`
  → 6/6 pass.
- `... npx vitest run tests/integration/m10-view-tracking.test.ts`
  → 17/17 pass (threshold, dedupe, concurrent, refresh, failed reconnect,
  renewal, bounds, ADMIN/anon/CSRF/Origin, second-student, expiry, binding,
  replacement-preservation, Oct/Nov separation, no-backfill, coverage,
  credential absence).
- `... npx vitest run tests/integration/learning-playback.test.ts tests/integration/learning-corrections.test.ts tests/unit/learning-progress.test.ts tests/unit/learning-playback.test.ts`
  → 96/96 pass (existing resume/completion/DRM-recovery behavior preserved).
- `npx vitest run src/features/learning` (client) → 100/100 pass, including new
  `viewTracking.test.ts` 8/8 and existing player/session/state suites.
- `npm run typecheck` (server) → pass after `npx prisma generate`.
- `npm run typecheck` (client) → FAILS ONLY in concurrent sibling files
  (`parent-reports/*`, `ide/python-format`, `WebIDE`); zero errors in agent-1
  files. Full client image build (`server/Dockerfile` test stage via
  `seo-client`) therefore BLOCKED by sibling breakage; recorded as BLOCKED, not
  PASS (exact errors in §5). No sibling file was edited to work around it.

Real-browser player-to-API counting flow: BLOCKED by the same sibling client
breakage (full Nginx/client/server stack cannot build). Closest verified
evidence instead: API-level player-to-API flow with exact browser guards
(Origin + cookies + CSRF + unique IP rate-limit isolation) in the 17 Docker
integration tests, which call the same two endpoints the player calls in the
same order (grant → start → heartbeats), plus client accumulator unit proof.
No fixture is shipped as a production fallback.

Migration upgrade preservation: migration SQL contains only `CREATE TABLE`,
`CREATE [UNIQUE] INDEX`, `ALTER TABLE ... ADD CONSTRAINT (FK)`, and singleton
`INSERT ... ON CONFLICT DO NOTHING`; no `ALTER`/`DROP` of existing tables and
no edits to old migration files (verified by `git status` + `grep`). Empty-state
`migrate deploy` applied 25/25; existing learning suites (96 tests) read/write
`LessonProgress`/`PlaybackReference` normally after the migration. A
pre-populated upgrade drill (insert-then-migrate) was not run as a separate
pass; recorded as a coordinator follow-up, not a PASS.

## 4. Handoff for agent 2 (see contract for freeze)

- Tables/DTOs/aggregates: `m10-view-tracking-contract.md` §§2–4 (stable).
- Coverage: `M10ViewTrackingState id='global'.startedAt`; before = UNAVAILABLE,
  straddling = PARTIAL, after = KNOWN.
- Versioning: group by `mediaAssetId`; current lesson counts use the current
  `MediaMapping.id`, old views stay with old ids.
- No polling needed: agent 2 reads tables directly with the parameterized SQL
  in contract §4. Do not add a migration; do not access DRM persistence.

## 5. Failures, skips, blockers

1. Initial migration SQL quoted the type (`"id" "TEXT"` → `type "TEXT" does not
   exist`, `P3018`). Fixed to unquoted `TEXT`, rebuilt with `--no-cache`,
   re-applied from empty volume → 25/25 success. No retained data affected.
2. Integration expiry test violated `Subscription_interval_check` by setting only
   `expiresAt` to the past while `startsAt` stayed future. Fixed to set both
   (`startsAt` −2d, `expiresAt` −1s, mirroring `expireSubscription`). 17/17 pass.
3. Full `test`-image build + full client `typecheck`/`build` BLOCKED by
   concurrent worker breakage outside agent-1 ownership (not edited):
   `parent-reports/api.ts` (missing `../../../auth`, unknown-error narrowing),
   `copy.ts` (unused `lang`, `Bilingual` misuse), `format.ts` (missing `../copy`),
   `session.ts` (`number[]` vs `number`), `ide/python-format.ts` + `WebIDE.tsx`
   (missing wasm/python modules). Server `typecheck` and all owned/learning
   suites pass. Coordinator must gate the combined build on sibling repair.
4. Real-browser full-stack flow BLOCKED for the same reason (needs client
   build). API-level browser-guarded flow verified instead (see §3).
5. Pre-populated upgrade drill skipped (see §3); additive SQL + 25/25 + 96-test
   regression is the provided preservation evidence.
6. No owner-data fixture, no DRM edit, no production deployment performed.

## 6. Rollback guidance (corrected: never rewrite applied history)

- Serving-code revert (safe at any time, no data operation): revert the route
  and client changes to the pre-M10 code while KEEPING the applied migration,
  its SQL/checksum and both M10 tables/rows untouched. Older compatible serving
  code runs with these additive tables retained (they are simply unused); this
  is the expected rollback posture, not a cleanup step.
- NEVER delete an applied migration folder, edit applied migration SQL, or drop
  M10 tables/rows merely to revert serving code. Agent 2 consumes these tables;
  any future table removal is a separately authorized forward migration with
  agent-2 coordination — not performed here and not advised here.
- Disposable test databases only may be recreated (`down -v` on the OWNED
  disposable project after verifying exact project labels/names/mounts). Never
  run `down -v`, global prune, or any destructive command on retained
  preview/DRM projects or any database holding real data.
- Full code+test file list for a serving revert (schema/migration excluded by
  design): `server/src/modules/learning/routes/index.ts` view routes,
  `server/src/modules/learning/tracking/`, `Player.tsx` view wiring +
  `CourseLearningPage.tsx` pass-through, `client/.../player/viewApi.ts`,
  `useViewTracking.ts`, `viewSessionManager.ts`, `viewTracking.ts`,
  `viewTracking.test.ts`, `viewSessionManager.test.ts`, and the M10 server test
  files. Run `npx prisma generate`. Table/column names and DTO shapes stay
  frozen; any contract change requires coordinator approval first.

## 7. Mandatory Docker cleanup (owned resources only)

Cleanup was performed after verification; final owned-resource check below.
Preserved: retained previews/data (`fayq-local-*`), unrelated projects,
reusable images (`postgres:16-alpine`, `redis:7-alpine`, `fayq-*`), evidence,
and the nested DRM repo (Git-reference difference preserved, no DRM edit).

- Verified exact project label/blueprint before removal:
  `docker compose -p m10-agent-1-test -f docker/m10-agent-1/compose.yml ps`
  showed only `m10-agent-1-test-postgres-1` and `m10-agent-1-test-redis-1`
  (plus one-shot `migrate` exited 0). Resolved network
  `m10-agent-1-test_default`, volume `m10-agent-1-test_pgdata-m10a1`, images
  `edu-platform-m10a1-migrate:0.10.0` (+ failed-test image layers, if any) and
  no anonymous mounts beyond the owned pgdata volume.
- Removed only owned test containers/network/volume via:
  `docker compose -p m10-agent-1-test -f docker/m10-agent-1/compose.yml down -v`
  (+ `docker rmi edu-platform-m10a1-migrate:0.10.0` if still present).
  No `docker system prune`, no `down -v` on retained platform/DRM projects.
- Final check (actual, 2026-10-07): `docker ps --filter
  label=com.docker.compose.project=m10-agent-1-test` → zero containers;
  `docker volume ls --filter name=m10-agent-1-test` → zero volumes (owned named
  `pgdata-m10a1` removed by `down -v`; owned anonymous Redis volume `caac8fd3…`
  verified via `docker inspect` mount `/data` + anonymous label + creation time,
  then removed with `docker volume rm`); `docker network ls --filter
  name=m10-agent-1-test` → zero networks; `docker images --filter
  reference=edu-platform-m10a1*` → zero images (both owned tags removed).
  Retained `fayq-local-preview-grading-1` / `fayq-local-materials-minio-1`
  containers still present and untouched (grading `unhealthy` is pre-existing;
  never touched by this worker). Nothing that could not be safely removed
  remains.

## 8. Repair round — coordinator findings 1–5 (2026-10-07, re-review)

Runner labeling (corrected per finding 5): initial-round §3 lines prefixed
`DATABASE_URL=... npx vitest` were host test processes against
Docker-provided postgres/redis. Every repair-round verification below ran
INSIDE Docker containers (Docker-contained runners): server suites via
`docker compose -p <owned> ... run --rm test npx vitest ...`, client suites
via `... run --rm client-test npx vitest ...`, drill phases via
`... run --rm {pre-migrate,seed,migrate,verify}`, and the counting journey in
real Chromium via `... run --rm browser`. Initial-round history above is
preserved, not rewritten.

Changed files (agent-1 ownership only; schema/migration untouched, checksum
stable; siblings preserved, nothing outside ownership edited):

- `client/.../player/viewTracking.ts` — REWROTE accumulator as
  `ElapsedPlayClock` (monotonic elapsed basis; 4s/sample cap; 10s stale-gap
  drop) + `isTransientViewStartFailure` classifier. Removed currentTime-delta
  logic (finding 1).
- `client/.../player/viewSessionManager.ts` — NEW lifecycle owner: bounded
  start retry (5 attempts, 1s/2s/4s/8s, transient-only, cancelable),
  accumulation while start-pending, generation-guarded stale protection
  (finding 2).
- `client/.../player/useViewTracking.ts` — REWROTE as thin wiring over the
  manager (finding 2).
- `client/.../player/Player.tsx` — elapsed samples (`performance.now()`),
  `void` flush on pause, awaited flush-before-end on natural completion
  (findings 1, 3).
- `client/.../player/viewTracking.test.ts` — REWROTE for the elapsed clock
  (14 tests: 2x/0.5x proportionality, pause/seek/buffer/stale/duplicate-clock,
  failure classification) (finding 1).
- `client/.../player/viewSessionManager.test.ts` — NEW 13 lifecycle tests
  (pending accumulation, backoff schedule, exhaustion, terminal-no-retry,
  refresh/supersession, remount, delayed-response, teardown, stale heartbeat,
  detached observe) (finding 2).
- `server/src/modules/learning/tracking/service.ts` — heartbeat now rechecks
  playback reference (ACTIVE or fresh-ENDED within `FINAL_FLUSH_GRACE_MS`,
  binding match), course publication, assessment unlocks and media-version
  match; threshold claim is a row-locked conditional second update so exactly
  one concurrent caller observes the transition (findings 3, 4).
- `server/tests/integration/m10-view-tracking.test.ts` — extended 17→25:
  fresh-end flush acceptance, TERMINATED/stale-ended/deleted-reference
  rejection, tampered-binding rejection, ARCHIVED-course rejection,
  replacement-version rejection + restore acceptance, 8-way concurrent claim
 /host post-count repeats (findings 3, 4).
- `docker/m10-agent-1/compose.drill.yml` + `drill/{seed,verify}.cjs` (+
  `drill/prisma/` pre-M10 copy, `drill-out/counts.json`) — populated upgrade
  drill fixtures (owned, test-only).
- `docker/m10-agent-1/compose.browser.yml` + `browser/{probe/*,seed.cjs,
  driver.mjs,nginx.conf}` (+ `browser-out/{seed,evidence}.json`) — real-
  Chromium counting probe fixtures (owned, test-only). Probe page embeds the
  REAL compiled `viewTracking.js` + `viewSessionManager.js` (regenerated from
  current sources at probe time); transport is page-local fetch mirroring
  `viewApi` shapes; DRM fixture grants bind sessions only (manifest never
  loaded).
- `m10-view-tracking-contract.md` — stability promise, elapsed basis, retry/
  pending/stale rules, heartbeat rechecks + grace, exactly-once claim
  semantics, owned fixture list (findings 1–5; tables/DTOs unchanged).

Repair verification (all Docker-contained, project names verified before each
`down -v`; retained previews/data, sibling work, reusable images preserved;
no global prune):

- `docker compose -p m10-agent-1-repair -f docker/m10-agent-1/compose.yml run
  --rm test npx vitest run tests/unit/m10-view-tracking.test.ts
  tests/unit/learning-progress.test.ts tests/unit/learning-playback.test.ts`
  → 3 files, 51/51 pass.
- `... run --rm test npx vitest run tests/integration/m10-view-tracking.test.ts`
  → 25/25 pass (17 original + 8 repair cases, incl. exactly-one-claim under
  8-way real-PostgreSQL concurrency).
- `... run --rm test npx vitest run
  tests/integration/learning-playback.test.ts
  tests/integration/learning-corrections.test.ts` → 2 files, 51/51 pass
  (existing resume/completion/DRM-recovery preserved).
- `... run --rm client-test npx vitest run src/features/learning` → 15 files,
  119/119 pass (14 clock + 13 manager + 92 existing).
- Full `test:ci` in the same container → 49/51 files, 420 passed + 37 skipped;
  2 unrelated non-agent-1 failures recorded, not repaired: agent-2's
  `m10-parent-reports.test.ts` (their unique-constraint test bug) and
  `learning-materials.test.ts` (suite-level disposable-fixture guard refusal:
  requires `STORAGE_ENDPOINT=minio:9000` + `course_learning_test` DB, absent in
  every `compose.test`-style project by design).
- `npm run typecheck` server → clean (incl. agent-2's fixed test file).
  Client `tsc -b` → clean after `npm ci` (earlier ide missing-module errors
  were stale local node_modules; Docker fresh-install builds were already
  green: `test` and `client-test` images built successfully).
- Populated upgrade drill (`-p m10-agent-1-drill`): pre-M10 schema (24/24) →
  seeded 14 tables (2 users, wallet + 2 ledger, 1 recharge, course tree,
  plan/media, purchase + subscription, progress, ACTIVE playback, audit;
  counts + spot values in `drill-out/counts.json`) → real M10 migration applied
  alone → verifier: exact counts + values preserved, 25/25 migrations finished,
  M10 tables + singleton + 11 indexes present, negative-`playedMilliseconds`
  CHECK enforced → `drill verify ok`. All four phases ran in containers.
- Real-browser probe (`-p m10-agent-1-browser`, Chromium 154, canvas-stream
  video `playing:true readyState:4`, same-origin cookies + CSRF, HS256
  fixture-backed grants): 1x 30.25s → counted (`newlyCounted:true`); fresh-end
  flush → 200 no double-claim; reconnect @2x-requested 16s → 16004ms
  NOT counted (elapsed basis; canvas streams ignore `playbackRate`, so the
  honored-rate contrast stays with injected-clock unit tests); 0.5x 6s →
  +6000ms; pause 3s → +0; injected transient start failure → active at
  attempt 2; orderly refresh → new session counted (30000ms,
  `newlyCounted:true`); agent-2 roster read → `totalViews:2` for the student;
  storage audit → 0 localStorage/sessionStorage entries, cookies carry no view
  id → `PASS` (`browser-out/browser-evidence.json`). Fixture evidence proves
  platform integration only, never real DRM security; protected-media
  rendering was not exercised (fixture manifest never loaded, by design).
- Seed hiccups during drill setup (proof-hash hex rule, reference uppercase
  rule, hardcoded phones) were fixture-authoring errors fixed in owned scripts
  before the clean evidence run; no product impact.

Remaining skips/blockers (not repaired, not owned): agent-2 roster/report test
bug and materials storage-guard above; seek/buffer real-browser forcing
(canvas streams are unseekable/non-stalling — flag paths share the re-anchor
implementation and are covered by injected-clock + integration tests);
production deployment, milestone acceptance, commit/push — none performed.

Repair-round Docker cleanup (owned resources only; verified 2026-10-07 after
all evidence was saved): inspected `ps` output and EVERY mount for the three
owned projects (`m10-agent-1-repair`: postgres named volume + 1 anonymous
redis volume; `m10-agent-1-drill`: named drill volume; `m10-agent-1-browser`:
named browser volume + 1 anonymous redis volume, nginx read-only binds to
owned source files only), then `down -v` on each owned project, removed both
verified-owned anonymous volumes and all five owned image tags
(`edu-platform-m10a1-{migrate,test,client-test,server,drfixture}:0.10.0`).
Final check: zero owned containers/volumes/networks/images remain
(`docker ps` label filters empty; volume/network/image filters empty).
Retained `fayq-local-preview-grading-1` / `fayq-local-materials-minio-1`
containers still present and untouched; reusable images (`postgres`,
`redis`, `nginx`, `node`, `fayq-seo-browser`) and all sibling work preserved.
No global prune, no `down -v` on retained stacks. (One intermediate combined
status command hit a Docker Desktop memory error inside the nested DRM
submodule scan — environmental, unrelated to the work; the lightweight
per-resource checks above all passed. Nothing could not be safely removed.)

Stop for coordinator re-review. No milestone acceptance, commit or push.
