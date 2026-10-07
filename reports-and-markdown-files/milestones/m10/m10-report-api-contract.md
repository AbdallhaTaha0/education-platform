# M10 report API contract (agent 2)

Date: 2026-10-07. Owner-frozen shared contract from m10-parallel-contract.md;
this file is agent 2's authoritative handoff for agent 3 and the coordinator.
Paths are mounted under `/admin` inside the single Express app with the normal
`{data: ...}` success envelope and existing error shape.

## Auth, CSRF, cache, size bounds

- Read routes: `requireAuth` + `requireAdmin` (+ Redis rate limiting on the
  generation route only). Write route: `requireOrigin` → `requireAuth` →
  `requireAdmin` → `requireSessionCsrf`, fixed-window limit 30 req/60 s per IP.
- All responses on these routes are `Cache-Control: no-store` (also set
  globally in app.ts). Report bodies, guardian numbers and recipient-bearing
  click-to-chat URLs are never logged; the redaction list already covers
  `parentPhone`.
- Validation bounds: `limit` integer 1–50 (default 20), `q` ≤ 100 chars,
  `courseIds` 1–50 UUID strings, reportType `WEEK|TWO_WEEKS|FOUR_WEEKS`,
  language `ar|en`. Global JSON body ceiling stays 256 KiB.

## Canonical roster eligibility (shared)

A roster row is valid iff there is at least one `Subscription` for the
(studentId, courseId) pair, with the following canonical scope:

- the course is canonical: `Course.revisionOwnerId IS NULL` and
  `Course.deletionRequestedAt IS NULL` (hidden working copies and historical
  copies never surface),

Rosters and view detail include historical memberships and canonical courses
regardless of current publication status. Current report selection/generation
additionally requires `Course.status = 'PUBLISHED'` and entitlement at the
cutoff: any subscription with `expiresAt IS NULL` or `expiresAt > cutoff`.

The same-course rule set from existing entitlement logic is reused verbatim
(`learning/access/entitlement.ts`); agent 2 does not extend, shorten or
fabricate access terms. Registration alone is not enrollment: students without
a subscription row never appear. One row per actual student even when several
subscription rows exist (standalone + package grant deduplicate). Expired
memberships remain visible in rosters as lifetime evidence but are excluded
from `report-courses` and generation.

## GET /admin/courses/:courseId/students

Query: `limit` (1–50, default 20), `cursor` (opaque, base64url keyset over
`(displayName, studentId)` ascending), `q` (bounded case-insensitive
`ILIKE` search on displayName, `%`/`_`/`\` escaped).

Response data:

```json
{
  "students": [
    { "studentId": "uuid", "name": "...", "guardianContactAvailable": true, "lastViewedAt": "ISO-8601|null", "totalViews": 0 }
  ],
  "nextCursor": "string|null"
}
```

`totalViews`/`lastViewedAt` are counted sessions only (`countedAt` non-null),
all-time for that course. Zero-activity students appear with `0`/`null` once
tracking is activated; before activation `totalViews` is `null`, never zero.
`guardianContactAvailable` is boolean only — no plaintext guardian contact in
rosters. The course id itself must be canonical or 404.

## GET /admin/courses/:courseId/students/:studentId/views

Query: `limit` (1–50, default 20), `cursor` (opaque, keyset over lesson
position in canonical `(section.position, lesson.position)` order).

Response data:

```json
{
  "studentId": "uuid",
  "courseId": "uuid",
  "trackingStartedAt": "ISO-8601|null",
  "lessons": [
    { "lessonId": "uuid", "title": { "ar": "...", "en": "..." }, "mediaAssetId": "currentMediaMapping.id|null", "totalViews": 0, "lastViewedAt": "ISO-8601|null", "coverage": "KNOWN|PARTIAL|UNAVAILABLE", "currentMediaViews": 0, "currentMediaLastViewedAt": null, "mediaVersions": [] }
  ],
  "nextCursor": "string|null"
}
```

- `mediaAssetId` on the row is the current platform media asset id
  (`MediaMapping.id`, never external `assetId`); per-lesson lifetime counts sum every recorded media version
  of that lesson; old-version sessions are preserved, not assumed unseen.
- `coverage`: `UNAVAILABLE` when tracking was never activated
  (`M10ViewTrackingState.startedAt` missing) — counts are labeled unknown,
  never rendered as zero; `PARTIAL` when the lesson's counted sessions span
  more than one distinct `mediaAssetId`, or even one old-version identity differs
  from the current mapping; otherwise `KNOWN`. An unready/retired/missing current
  mapping without comparable evidence is `UNAVAILABLE`. KNOWN refers to counted
  facts since tracking activation; it does not imply pre-activation coverage.
- `mediaVersions` contains `{mediaAssetId,totalViews,lastViewedAt}` for every
  recorded platform version. `currentMediaViews` and `currentMediaLastViewedAt`
  refer only to the live platform mapping. Current count is null if tracking or
  the READY/current mapping is unavailable; otherwise zero or its observed count.
- Requires the student to hold (or have held) a subscription row for the
  course; otherwise 404.

## GET /admin/students/:studentId/report-courses

Query: `limit`, `cursor` (opaque offset codec over the eligibility-sorted
courseId list).

Response data:

```json
{ "courses": [ { "courseId": "uuid", "title": { "ar": "...", "en": "..." } } ], "nextCursor": "string|null" }
```

Only currently eligible canonical memberships (expiresAt null or future,
PUBLISHED, non-deleted, revisionOwnerId null), deduplicated by course and
sorted by courseId.

## GET /admin/students/:studentId/report-contact

Response data: `{ "phone": "string|null" }` — the current registered
`StudentProfile.parentPhone`. Admins recheck before WhatsApp handoff; a
changed number must trigger a new report review. Missing phone still permits
preview but no chat handoff. No plaintext exposure to non-admin roles.

## POST /admin/parent-reports/generate

Request body:

```json
{ "studentId": "uuid", "courseIds": ["uuid", "..."], "reportType": "WEEK|TWO_WEEKS|FOUR_WEEKS", "language": "ar|en" }
```

Response data:

```json
{
  "studentId": "uuid",
  "courseIds": ["uuid"],
  "reportType": "FOUR_WEEKS",
  "generatedAt": "ISO-8601",
  "period": { "start": "ISO-8601", "end": "ISO-8601", "timeZone": "Africa/Cairo" },
  "guardian": { "phone": "string|null" },
  "parts": [ { "index": 1, "total": 2, "text": "..." } ]
}
```

Generation is transient: no generated-report row, archive, sending log,
queue or scheduler exists. Regeneration re-reads current records with a new
cutoff.

### Period semantics

- One server-authoritative cutoff per request (`now`). Production generation
  runs every membership/curriculum/profile/view/grading read in a PostgreSQL
  REPEATABLE READ transaction, binding raw view reads to that transaction client.
  Concurrent writes after its first read appear only in a subsequent report.
- Interval is `[now - N·24h, now)`, half-open: start inclusive, end
  exclusive. `WEEK` = 7 days, `TWO_WEEKS` = 14, `FOUR_WEEKS` = 28 (month is
  not a calendar month).
- Weekly sections are exact consecutive 168-hour intervals ending at the
  cutoff (a 4-week report always renders Week 1/4..4/4).
- Section labels print exact `YYYY-MM-DD` dates via `Africa/Cairo`
  (`Intl.DateTimeFormat` formatToParts). 2026-10-29 Egypt DST end shifts only
  wall-clock labels, never the 168 h length.
- Time before M10 tracking activation (`M10ViewTrackingState` missing
  coverage), before membership start, or after membership expiry is clipped
  and labeled (`trackingUnavailable` / coverage notes) — never fabricated
  zero activity.
- Counted view events use `countedAt >= start AND countedAt < cutoff`, including
  sessions started before the window but counted within it. Parent viewing is
  positive only for the current platform mapping. With no positive evidence,
  `not viewed` requires the entire week covered by the subscription union,
  tracking activation and existing lesson/current READY mapping. The lesson
  creation and mapping creation/update timestamps must predate the week, and
  replaced-version evidence makes negative coverage unknown. Mapping updates
  conservatively reset negative coverage because historical readiness/change
  state is not persisted; no unavailable interval is fabricated as zero.

### Parent-text contract

- Each part is self-contained bounded text; parts are numbered
  (`— i/N —`) and never silently truncated. Final parts, including context and
  numbering, are at most 1000 UTF-16 code units and 3800 encoded text characters
  via encodeURIComponent. Oversized lines split at Unicode code-point boundaries
  without breaking surrogate pairs. Every part repeats student/report context and
  the current course/week continuation context (abbreviated there only; original
  headings and complete content remain in the payload). This bounds the text
  query of a wa.me URL; it is not a guarantee of every device/client URL limit.
- Parent lines per lesson: `viewed` / `not viewed` / `tracking unavailable`
  (never numeric view counts). Assessment lines:
  `passed` / `not yet passed` / `not submitted` / `checking` /
  `service error`(not scored as a wrong answer), with per-week attempt counts
  shown in the deduplicated period summary as current state at generation.
  Weekly sections contain immutable submission-attempt counts and pass events:
  `passed` only when passedAt is inside that week, otherwise `no pass recorded
  this week`. A Week-4 pass never appears as a Week-1 achievement. Mutable
  grading states are not presented as historical week states. An earned pass
  in the current summary is preserved across later failures/service errors.
- Arabic (default) layout: `FAYQ | تقرير ولي الأمر`, student name, period,
  one course section with weekly subsections; English counterpart
  `FAYQ | Parent Report` with the same information density.
- No national IDs, wallet details, raw assessment answers, credentials or
  media URLs appear in report text.

### Assessment status precedence (at cutoff)

1. `passed` if an `AssessmentPass` row exists with `passedAt < cutoff`.
2. `checking` if the latest submission created before cutoff is `PENDING` or
   `RUNNING`.
3. `serviceError` if the latest submission has `result.error =
   'CHECKING_UNAVAILABLE'`.
4. `notSubmitted` when no submission exists before cutoff.
5. `notYetPassed` otherwise.

Period attempt counts come from `AssessmentSubmission.createdAt` inside each
weekly section.
Distinct numbered assessment labels include the published assessment title and
lesson title. Attempt counts in the period summary cover the combined window
once, rather than duplicating each weekly record.

## Errors

Owner clarification, 2026-10-07: generation additionally accepts optional
`format: 'SHORT' | 'DETAILED'`; invalid values return VALIDATION_ERROR. SHORT
returns one compact part for all selected courses. Omitted format keeps the
detailed contract; ADMIN UI defaults to SHORT. See
[verification](m10-short-report-and-free-plans-20261007.md).

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | bad uuid, bad reportType/language, `courseIds` empty/>50, invalid limit/cursor, `q` overlong |
| 401 | `TOKEN_MISSING` / `TOKEN_INVALID` / `SESSION_EXPIRED` / `SESSION_REVOKED` | standard session failures |
| 403 | `FORBIDDEN` / `ORIGIN_FORBIDDEN` / `CSRF_INVALID` | role/origin/CSRF |
| 404 | `NOT_FOUND` | unknown student/course, unavailable membership (expired or inactive course in generation), non-canonical course on roster/views/report paths |
| 429 | `RATE_LIMITED` | generation limiter |
| 500 | `internal_error` | unexpected dependency/server errors handled by the existing shared handler |

## Test fixture reader note

Production Agent 2 code never writes `M10VideoViewSession`/`M10ViewTrackingState` and never
touches DRM persistence. Tests used a labeled fixture mirror
(`server/tests/integration/m10-view-fixture.ts`) while the real migration
landed; the final Docker run applied the real migration
`20261007100000_m10_view_tracking`. The repaired fixture requires that migration
and cannot manufacture missing tables. Coordinator completion adds per-lesson,
counted-event, media-version, malformed-input and concurrent snapshot regressions.
