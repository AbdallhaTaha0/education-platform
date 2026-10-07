# M10 view-tracking contract (agent 1, frozen for agent 2)

2026-10-07, repaired 2026-10-07 (coordinator review findings 1–5; tables/DTO
meanings unchanged). Platform-owned video-view tracking + player integration.
Only agent 1's player integration consumes the telemetry DTOs below. Agent 2
reads the fixed platform tables with typed parameterized Prisma raw SQL (no
dependency on regenerated model delegates). This file freezes the HTTP DTOs,
restart rules, tables/indexes, coverage meaning and aggregate queries.

Stability promise (agent 2 relies on this): the additive migration SQL,
its checksum, the table/column/index names and the DTO shapes below are never
rewritten or deleted to revert serving code. Older compatible serving code
runs with these additive tables retained (they are simply unused). Any future
table removal is a separately authorized forward migration, never a
history rewrite, and requires agent-2 coordination first.

Product rules remain in m10-parent-reports-plan.md. Reported playback activity
is not proof of human attention; never claim fraud-proof tracking.

## 1. Session-counting rules (owner-approved)

- One logical playback start/restart = one `M10VideoViewSession` row.
- The row counts ONCE when accumulated actual playing time reaches
  30,000 ms (`countedAt` becomes non-null exactly once, server time).
- Continued playback at 60/90s adds nothing for the same row.
- A page refresh, successful playback reconnect (new playback grant with a new
  `referenceId`) or later new viewing session starts a NEW row with a fresh
  30-second threshold, after authorization.
- Failed reconnect attempts create no row (no new grant exists to bind).
- Pause/resume and platform-mediated token renewal (same `referenceId`, DASH/EME
  untouched) stay in the SAME row.
- Playing time is ELAPSED wall time, never media progress. The client credits a
  monotonic clock (`performance.now()`) only while the element reports actual
  playback. Playback rate therefore cannot fast-forward the threshold: 15
  elapsed seconds at 2x credit 15 seconds (uncounted); 30 elapsed seconds at
  0.5x credit the full 30 (counted). Skipped footage is never counted because
  media position is never used as duration. Seeking and buffering never advance
  `playedMilliseconds` (pause/seek/end/buffer events clear the clock anchor;
  the next playing sample establishes a new anchor without crediting the idle
  gap; duplicate/backward clock readings credit nothing; per-sample
  credit is capped at 4s and sampling gaps over 10s (backgrounded tabs) credit
  nothing — the safe direction is undercounting). The server only accumulates
  the reported monotonic total via `GREATEST`.
- Repeated telemetry, React StrictMode remount effects (same `referenceId`) and
  transport retries within one session converge via `UNIQUE(playbackReferenceId)`
  on start and via atomic `GREATEST` + single `countedAt` transition on
  heartbeat. They never create a second count for the same session, and they
  never suppress the owner's intentional refresh/reconnect counts (new grant =
  new row).

Successful-reconnect detection from the real player lifecycle (`Player.tsx` +
`useViewTracking.ts` + `viewSessionManager.ts` + `useLearning.ts`):

- NEW countable session starts only when `playback.start(lessonId)` succeeds and
  yields a NEW grant (`referenceId` changes) followed by actual playback.
- The following do NOT start a new session: dash.js MPD/MediaSegment retries
  (`retryAttempts: 2`), license retries, `renewPlayback` (same `referenceId`),
  pause/resume, seeking/buffering, remount with the same grant (server dedupes
  via UNIQUE(playbackReferenceId)), heartbeat retries (server `GREATEST`
  converges).
- FAILED reconnect (`startPlayback` rejects, grant null, player phase
  error/expired) mints no grant, so no view start is attempted.
- Page refresh loses the transient playback token AND the in-memory view session
  id by design, so the next successful grant starts a new row.
- Tracking-start uses bounded retry for transient failures only
  (transport/network errors, 429, 5xx): at most 5 attempts (1s/2s/4s/8s),
  cancellable on grant/navigation change or teardown, one server row per grant.
  Terminal failures (400/401/403/404/409) stop immediately for that grant.
  Playing time accumulates from grant attach even while start is pending, so a
  late success still reports the whole session; every attach/detach bumps a
  generation counter, so late starts/retries/heartbeats from a previous grant
  can never write into a newer session's state.
- Flush-before-end ordering: the player waits up to 2s for a keepalive heartbeat
  on natural completion. Tracking failure or a stalled request cannot block
  the end callback indefinitely. A superseded or unmounted player never fires
  a late callback against a newer grant. Delayed final requests and
  unmount/pagehide races use the server's 120s fresh-ENDED grace (see §2.2).

## 2. Telemetry HTTP DTOs (frozen)

Base: same-origin `/api`, existing success envelope `{ data: ... }`, existing
error envelope. STUDENT-only. All writes require exact approved `Origin`,
authenticated session and session CSRF (`requireOrigin`, `requireAuth`,
`requireSessionCsrf`), plus per-scope Redis rate limits shared across replicas.

### 2.1 Start a view session

`POST /learning/courses/:courseRef/lessons/:lessonId/views/start`
Rate limit: `learning-view-start`, 30 req / 60s / IP.

Request body (JSON, ≤256 KiB global parser):

```json
{ "playbackReferenceId": "uuid-of-playback-grant-referenceId" }
```

Server validation (all server-side, browser contributes only ids):

- `resolveCourse` (entitlement at backend time) + `resolveLesson` (lesson belongs
  to course, unlocked, media READY). Wrong course/lesson/media → existing codes.
- `playbackReferenceId` required, string, ≤128 chars, must be an owned ACTIVE
  `PlaybackReference` for the same student/lesson/course/`externalAssetId`.
  Foreign/missing/non-ACTIVE → `401 PLAYBACK_SESSION_EXPIRED` (existence
  preserving, same as renewal). Mismatched binding → `400 VALIDATION_ERROR`.
- Media mapping at start must be READY, unretired and match the binding;
  otherwise `409 MEDIA_NOT_READY`.
- Insert is idempotent: `ON CONFLICT (playbackReferenceId) DO NOTHING`,
  concurrent starts converge on one row.

Success responses (inside `data`):

- `201` created, `200` deduplicated (same grant retried/remounted):

```json
{
  "view": {
    "viewSessionId": "uuid",
    "studentId": "uuid",
    "courseId": "uuid",
    "lessonId": "uuid",
    "mediaAssetId": "platform-MediaMapping.id-snapshot",
    "startedAt": "2026-10-07T01:43:43.831Z",
    "countedAt": null,
    "playedMilliseconds": 0,
    "counted": false,
    "thresholdMs": 30000,
    "trackingStartedAt": "2026-10-07T01:43:43.831Z"
  }
}
```

Error shapes (existing `LearningError` codes, no new codes):

- `400 VALIDATION_ERROR` — malformed body/binding mismatch/out-of-range.
- `401` session (`TOKEN_MISSING`/`SESSION_REVOKED`) — anonymous.
- `401 PLAYBACK_SESSION_EXPIRED` — foreign/missing/terminated grant.
- `403 FORBIDDEN` — ADMIN or non-STUDENT role; `403 ORIGIN_FORBIDDEN`/CSRF.
- `403 SUBSCRIPTION_REQUIRED` / `403 SUBSCRIPTION_EXPIRED` — no/current access.
- `404 LESSON_NOT_FOUND` — unknown course/lesson.
- `409 MEDIA_NOT_READY` — lesson has no READY unretired media.
- `429 RATE_LIMITED` — over scope limit.

### 2.2 Heartbeat accumulated playing time

`POST /learning/views/:viewSessionId/heartbeat`
Rate limit: `learning-view-heartbeat`, 120 req / 60s / IP.
Bounded frequency: client sends at most every 5s while actually playing, plus a
best-effort final flush on pause/end/unmount/pagehide. No request per frame.
Payload is one integer total.

Request body:

```json
{ "playedMilliseconds": 30000 }
```

- `playedMilliseconds`: required integer total of actual playing time for THIS
  session, `0..86,400,000` (24h). Sub-ms fractions truncated. Negative,
  non-finite, >max or non-numeric → `400 VALIDATION_ERROR`.
- `:viewSessionId` must be an existing row owned by the caller; unknown/foreign
  → `404 LESSON_NOT_FOUND` (no existence disclosure).

Server behavior (row-locked transaction, replica-safe):

- The owning playback reference must still be valid: owned, bound to the same
  lesson/course/external asset as the row, and ACTIVE — or a fresh viewer end
  (`ENDED` with `endedAt` within `FINAL_FLUSH_GRACE_MS = 120s`, covering the
  legitimate final flush racing the viewer's own end call). Terminated,
  revocation-like, superseded, missing, foreign or wrong/stale references →
  `401 PLAYBACK_SESSION_EXPIRED`, no count. Heartbeats past the grace are
  rejected as stale.
- Re-checks entitlement at backend time (`evaluateEntitlement` on current
  subscriptions). Lapsed/missing → `403 SUBSCRIPTION_REQUIRED/EXPIRED`, no count.
- The course must still be published and present (unpublished/withdrawn →
  `404 LESSON_NOT_FOUND`, mirroring the outline boundary).
- Verifies the lesson still belongs to the recorded course; moved/deleted →
  `404 LESSON_NOT_FOUND`, no count.
- Required-assessment locks are enforced on writes (`403 ASSESSMENTS_REQUIRED`
  when newly locked, `404 LESSON_NOT_FOUND` for unknown lessons).
- The media version must still be the READY version the session started on
  (mapping id + external asset equal the row snapshots, unretired); replaced
  or withdrawn media → `409 MEDIA_NOT_READY`, no count, history never rewritten.
- Monotonic advance plus exactly-once claim in one transaction: step 1 sets
  `playedMilliseconds = GREATEST(stored, reported)`; step 2 sets `countedAt`
  only where it is still NULL and the threshold is met, returning whether THIS
  caller won the transition. Concurrent threshold calls serialize on the row
  lock: exactly one observes `newlyCounted: true`; the durable count stays one.
  Duplicates/retries count at most once; 60/90s add nothing new.
- Heartbeats after `countedAt` still advance `playedMilliseconds` (observability)
  but never create a second count.

Success response (`200`, inside `data`):

```json
{
  "view": { "...same view payload, countedAt set once threshold met..." },
  "newlyCounted": true
}
```

- `newlyCounted` is true for exactly the one response whose database update
  performed the threshold transition (even under concurrent calls); false for
  `29s` (uncounted), repeats, post-count heartbeats and losing racers.
- Same error codes as §2.1, plus `404 LESSON_NOT_FOUND` for unknown views,
  `403 ASSESSMENTS_REQUIRED` for newly locked lessons and `409 MEDIA_NOT_READY`
  for replaced/withdrawn media.

### 2.3 What is NOT stored or claimed

- No login credential, playback bearer token, assertion, signing key, manifest/
  license URL, storage key or raw DRM body is stored in new rows or logs. The
  view id and playback `referenceId` are non-secret row identifiers already
  visible in the API responses the browser received.
- Browser persistence (localStorage/sessionStorage/IndexedDB/cookies/URL) holds
  no tracking state: `viewSessionId` lives in a React ref only. Theme/language
  storage rules unchanged.
- Client numbers are reported activity, not attention proof. Docs, UI strings
  and parent reports must say viewed/not-viewed (or tracking unavailable), never
  fraud-proof viewing or numeric view counts to parents.

## 3. Persistence contract (agent 1 supplies, agent 2 reads)

Migration (agent-1 owned, additive):
`server/prisma/migrations/20261007100000_m10_view_tracking/migration.sql`.
Applies cleanly on top of `20261006230000_remove_lesson_captions` (25/25 in
disposable Docker). Only `CREATE TABLE` + indexes + singleton `INSERT`; no
`ALTER`/`DROP` of existing tables, no checksum edits to old migrations.

### 3.1 `M10VideoViewSession` (table `"M10VideoViewSession"`)

One row per logical playback start/restart. `countedAt` non-null exactly once at
the 30s threshold.

| Column | Type | Semantics |
|---|---|---|
| `id` | TEXT PK (UUID) | Platform-issued view session id (`viewSessionId`). |
| `studentId` | TEXT FK `User.id` ON DELETE CASCADE | Owner; every access re-checks caller. |
| `courseId` | TEXT (no FK, like `LessonProgress`) | Course at session start; October/November courses are distinct ids so new-course activity never overwrites old-course evidence. |
| `lessonId` | TEXT FK `Lesson.id` ON DELETE CASCADE | Lesson; course-owned facts follow existing course-deletion cascades (deleting lessons/courses deletes their views, like progress). Financial/audit data untouched. |
| `mediaAssetId` | TEXT (snapshot, NO FK) | `MediaMapping.id` at session start (version binding). Survives retirement + deletion of the mapping row so replacements never misattribute old views. |
| `mediaExternalAssetId` | TEXT (snapshot) | `MediaMapping.externalAssetId` at start (version identity for agent-2 display). |
| `playbackReferenceId` | TEXT UNIQUE | Owning playback grant; idempotency fence. New grant = new row. |
| `startedAt` | TIMESTAMP(3), server time | Session creation instant. |
| `countedAt` | TIMESTAMP(3) NULL | Server instant the threshold was first met; null = uncounted. Set at most once per row. |
| `playedMilliseconds` | INTEGER ≥0, default 0 | Monotonic total of actual playing time; only moves forward via `GREATEST`. |

Indexes (all BTREE):

- `UNIQUE ("playbackReferenceId")` — idempotent start.
- `("studentId","courseId")`, `("studentId","courseId","lessonId")`,
  `("studentId","courseId","countedAt")`, `("courseId","lessonId","countedAt")`,
  `("lessonId","countedAt")`, `("mediaAssetId","countedAt")`, `("countedAt")`,
  `("startedAt")`, `("studentId","countedAt")`.

Relations added (no behavior change): `User.m10ViewSessions`,
`Lesson.m10ViewSessions`. Agent 2 must use parameterized raw SQL below, not a
temporary delegate dependency.

### 3.2 `M10ViewTrackingState` (table `"M10ViewTrackingState"`)

Singleton coverage fence. `id` is always `'global'`.

| Column | Semantics |
|---|---|
| `id` | `'global'` (PK). |
| `startedAt` | Server time tracking was activated (migration `INSERT ... ON CONFLICT DO NOTHING`, service `upsert` replica-safe). |

Coverage meaning for agent 2:

- Periods entirely before `startedAt` → `UNAVAILABLE` (unknown), never zero.
- Periods straddling `startedAt` → `PARTIAL` (clip to coverage, do not invent
  zero activity before activation).
- Periods entirely at/after `startedAt` with a current media binding → `KNOWN`.
- No pre-activation backfill exists: `LessonProgress` rows were never converted.
  Historical completion without a view row is not a view.

### 3.3 Version binding and short media

- Replacing a video creates a new `MediaMapping` (new `id`/`externalAssetId`);
  the old mapping is retired and eventually deleted. Existing view rows keep
  their snapshot `mediaAssetId`/`mediaExternalAssetId`; new sessions snapshot
  the new mapping. Agent 2 must group by `mediaAssetId` and surface the current
  lesson count against the current media version without assuming old media was
  unseen.
- Videos shorter than 30s use the SAME uniform 30s threshold (no silent
  lowering). A single natural completion of a <30s video does not count. The
  row counts only if accumulated playing time in that session reaches 30s (e.g.,
  replay/loop within the same logical session). Document short-video low counts
  as threshold behavior, not a bug.
- No raw-event retention/deletion policy is invented: only the session aggregates
  above are stored. No deletion job for views is specified.

## 4. Aggregate queries for agent 2 (parameterized Prisma raw SQL)

All counts use `countedAt IS NOT NULL` (counted views only). Date bounds are
`startedAt`/`countedAt` server times; periods use Africa/Cairo windows computed
by agent 2, passed as ISO bounds. Never sum lesson counts as repeat views.

```sql
-- Per-lesson counted views + last activity for one student/course (version-aware).
SELECT "lessonId", "mediaAssetId",
       COUNT(*) FILTER (WHERE "countedAt" IS NOT NULL) AS "totalViews",
       MAX("countedAt") AS "lastViewedAt"
FROM "M10VideoViewSession"
WHERE "studentId" = $1 AND "courseId" = $2
  AND "countedAt" IS NOT NULL
GROUP BY "lessonId", "mediaAssetId";

-- Student total + last activity in a course (roster line).
SELECT COUNT(*) AS "totalViews", MAX("countedAt") AS "lastViewedAt"
FROM "M10VideoViewSession"
WHERE "studentId" = $1 AND "courseId" = $2
  AND "countedAt" IS NOT NULL;

-- Weekly counted views in [start, end) for a student/course/lesson/media.
SELECT COUNT(*) AS "views"
FROM "M10VideoViewSession"
WHERE "studentId" = $1 AND "courseId" = $2 AND "lessonId" = $3
  AND "mediaAssetId" = $4
  AND "countedAt" >= $5 AND "countedAt" < $6;

-- Coverage fence (single row).
SELECT "startedAt" FROM "M10ViewTrackingState" WHERE "id" = 'global';
```

Pagination for rosters/reports uses keyset on `(countedAt, id)` or existing
student ordering; page size ≤50 per the parallel contract. Test-only fixture
readers must be labeled and never installed as production substitutes.

## 5. Bounds, safety and failure behavior

- Telemetry frequency: start once per grant (+cancelable bounded retries on
  transient failures only); heartbeat ≤1/5s while playing + final flush.
  Payload: one integer + ids (<256 bytes). Queries: indexed `SELECT`s for the
  rechecked protections + one row-locked transaction per heartbeat; no
  per-frame requests.
- Tracking failure never breaks playback: client catches all view errors and
  continues; player state, resume/completion, DRM recovery, watermark,
  fullscreen and entitlement behavior unchanged.
- Retries never inflate: start via `ON CONFLICT DO NOTHING` (same grant id);
  heartbeat via monotonic `GREATEST` + exactly-once conditional claim.
- Restart-safe: all counts are durable rows; `countedAt` transitions once.
- Replica-safe: unique fence + row-locked claim transaction + Redis rate
  limits shared across replicas.
- No new business API service, parent role, DRM source/database access,
  playback-security change or entitlement/purchase change.

## 6. Files owning this contract

- `server/prisma/schema.prisma` (models `M10VideoViewSession`,
  `M10ViewTrackingState` + `User`/`Lesson` relations; unchanged by the repair).
- `server/prisma/migrations/20261007100000_m10_view_tracking/migration.sql`
  (unchanged by the repair; checksum stable for agent 2).
- `server/src/modules/learning/tracking/validation.ts` (`VIEW_THRESHOLD_MS`,
  bounds).
- `server/src/modules/learning/tracking/service.ts` (idempotent start,
  rechecked heartbeat, exactly-once claim, coverage fence,
  `FINAL_FLUSH_GRACE_MS`).
- `server/src/modules/learning/routes/index.ts` (two routes + rate limits).
- `client/src/features/learning/player/viewTracking.ts` (elapsed clock +
  restart rules + failure classification), `viewSessionManager.ts` (grant
  lifecycle, bounded retry, stale guards), `viewApi.ts` (transport),
  `useViewTracking.ts` (thin hook wiring), `Player.tsx` (`courseRef`/`lessonId`
  props + elapsed observe + flush-before-end), `pages/CourseLearningPage.tsx`
  (passes binding through).
- Owned verification fixtures (never production code):
  `docker/m10-agent-1/compose.yml` (unit/integration stack),
  `compose.drill.yml` + `drill/{seed,verify}.cjs` (populated upgrade drill),
  `compose.browser.yml` + `browser/{probe/*,seed.cjs,driver.mjs,nginx.conf}`
  (real-Chromium counting probe).
