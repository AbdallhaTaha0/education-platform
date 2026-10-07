# M10 parallel worker contract

2026-10-07. The owner explicitly requested three agents working simultaneously. This supersedes the earlier sequential prompt order. These are prepared assignments, not agents already launched. Product rules remain in m10-parent-reports-plan.md. Contract details below are coordinator engineering choices, not new business policy.

## Ownership: avoid shared-file collisions

| Worker | Exclusive implementation scope |
| --- | --- |
| Agent 1 | server/prisma/schema.prisma and new M10 tracking migration; server/src/modules/learning/ tracking and route registration; client/src/features/learning/ player telemetry; tracking tests; docker/m10-agent-1/ |
| Agent 2 | New server/src/modules/parent-reports/; server/src/app.ts route mounting if needed; report/roster backend tests; docker/m10-agent-2/ |
| Agent 3 | New client/src/features/parent-reports/; catalog AdminDetailPage.tsx and AdminCourseTabs.tsx integration; only required frontend localization/styles; frontend/browser tests; docker/m10-agent-3/ |

Do not edit another worker's files, shared package manifests/lockfiles, existing migration SQL, root documentation indexes or another worker's Docker wrapper. Reuse existing dependencies. A necessary shared-file change must be described in the worker report for coordinator application, not silently made. Each worker edits only its own report and optional own contract notes; this shared contract remains coordinator-owned. No agent changes DRM, commits/pushes, upgrades retained previews or starts another agent. Distinct Docker project names and evidence directories are mandatory; avoid shared mutable build tags and retained volumes.

## Tracking persistence contract: agent 1 supplies, agent 2 reads

Prisma model/table M10VideoViewSession: id (platform-issued UUID), studentId, courseId, lessonId, mediaAssetId (platform MediaAsset ID), startedAt (server DateTime), countedAt (nullable server DateTime), playedMilliseconds (nonnegative integer). One row per logical playback start/restart; countedAt becomes non-null once at the 30-second threshold. Agent 1 may add fields/indexes/relations required for validation/idempotency without changing these meanings. Repeated telemetry cannot re-count that row. Refresh and successful reconnect start new rows after authorization; plain token renewal/pause/resume do not.

M10ViewTrackingState: singleton id='global', startedAt (server DateTime), set once when tracking is activated. No fabricated pre-activation counts. Expose known coverage/version gaps explicitly if additional metadata is required. Keep both facts in platform persistence; agent 2 creates no migration and must not access DRM persistence. Exact cleanup/cascade of course-owned facts follows existing course deletion boundaries without deleting financial/audit data.

Agent 1 freezes its telemetry HTTP DTOs in m10-view-tracking-contract.md early; only agent 1's player integration consumes them. Agent 2 can query these fixed platform tables with typed parameterized Prisma raw SQL, avoiding a temporary dependency on regenerated model delegates. Test-only fixture schema/readers must be labeled and never installed as production substitutes. Final tests must apply the real agent-1 migration.

## ADMIN API contract: agent 2 supplies, agent 3 consumes

Use /api prefix and existing envelope/error/ADMIN cookie/Origin/CSRF conventions. Domain JSON DTOs below are returned inside the normal success data envelope; do not invent a second envelope.

- GET /admin/courses/:courseId/students?limit=20&cursor=&q=: {students:[{studentId,name,guardianContactAvailable,lastViewedAt,totalViews}],nextCursor}. Maximum page size 50; q is bounded name search, stable keyset pagination. No plaintext guardian number in roster.
- GET /admin/courses/:courseId/students/:studentId/views?limit=20&cursor=: {studentId,courseId,trackingStartedAt,lessons:[{lessonId,title:{ar,en},mediaAssetId,totalViews,lastViewedAt,coverage:'KNOWN'|'PARTIAL'|'UNAVAILABLE'}],nextCursor}. Current lesson counts must identify media versions; no assumption old media was unseen.
- GET /admin/students/:studentId/report-courses: {courses:[{courseId,title:{ar,en}}],nextCursor} with bounded paging via limit/cursor; only currently eligible canonical memberships, including package grants. Use existing entitlement rules without modifying them.
- POST /admin/parent-reports/generate: {studentId,courseIds,reportType:'WEEK'|'TWO_WEEKS'|'FOUR_WEEKS',language:'ar'|'en'}. Return {studentId,courseIds,reportType,generatedAt,period:{start,end,timeZone:'Africa/Cairo'},guardian:{phone:string|null},parts:[{index,total,text}]}. All dates ISO; start inclusive/end exclusive. One cutoff per generation, parent text has video status and assessment results, not numeric views. Course selection max 50 per request is a resource bound, not a population cap; expose actionable limit validation.
- GET /admin/students/:studentId/report-contact: {phone:string|null}; authorized selected-student contact recheck immediately before handoff. Missing/changed contact requires regenerating/reviewing recipient safely, not opening an old number.

No-store on report/contact/private roster responses; no report/body/recipient URL logging or persisted generated reports. Errors use existing HTTP 400 validation, 401 session, 403 role/origin, and 404 unavailable membership/student/course patterns. Define concrete safe error codes in agent 2's early contract notes; agent 3 must preserve fallback for unknown errors.

## Parallel execution and completion

All workers begin immediately within their ownership. Agent 2 tests aggregation against labeled synthetic view readers/fixtures until the real migration exists. Agent 3 uses test-only HTTP fixtures with these DTOs while building a production client that calls the real routes. Never ship a fixture fallback. Freeze examples early in each own handoff file; report requested contract changes to the coordinator before changing it.

Each agent completes unaffected work while peers finish. Once prerequisites exist, agent 2 reruns real-database migration/API tests and agent 3 reruns real API/browser/player integration. Record pending integration as BLOCKED/PENDING, not PASS. Coordinator reviews all three diffs and combines final evidence before milestone acceptance. Each worker must perform its prompt's mandatory owned Docker cleanup on success/failure/stop.
