# Playback-recovery improvements — implementation and handoff

2026-10-04, Africa/Cairo. Bounded implementation of the three assigned
improvements: **ADMIN device management**, **explicit own-session recovery**,
and **clearer playback controls/errors**. Implemented locally, Docker-verified,
stopped for coordinator review. No commit, push, production deployment,
milestone acceptance, DRM edit, limit increase, or retained-preview update.

## Correction pass — coordinator review findings (all addressed)

The independent [coordinator review](playback-recovery-coordinator-review-20261004.md)
reproduced two defects (audit loss on idempotent retry; `onRecovered` after
NOOP) and raised six further findings against the actual tree. All eight are
fixed and regressed below in this same bounded result:

1. **Durable release audit (P1).** `devices/service.ts` now persists a
   `DEVICE_RELEASE_REQUESTED` intent in the existing append-only `AuditEvent`
   trail BEFORE crossing the external boundary (one pending intent per
   student/reference), completes `DEVICE_RELEASE` after external success, and
   reconciles pending intents on every later release call for that student
   (idempotent retry + bounded inspection sweep). Refusals close the intent
   with `DEVICE_RELEASE_REFUSED`. A successful external release is never
   reversed and no exactly-once guarantee is claimed. No new migration was
   needed: the durable mechanism IS the existing audit table (justification
   in the migration section).
2. **Truthful session recovery (P1).** `OwnSessionRecovery` offers restart
   ONLY after CONFIRMED, through an explicit Start-again action. QUEUED shows
   pending with a Check-status refresh that promotes to the offer only when
   the reference is durably closed; NOOP shows an honest nothing-ended
   message, clears the selection, never calls back. Selections validate
   against the loaded list (stale discarded with notice); a list sequence
   guard drops stale responses; one end request at a time.
3. **Current-page cleanup only (P1).** The `visibilitychange` tab-hide
   termination is removed; only `pagehide` + unmount close this page's own
   grant, with the listener removed on cleanup. Unload delivery remains
   best-effort (durable retry is the guarantee).
4. **Blocking reference first (P2).** `listOwnSessions` returns recoverable
   rows (ACTIVE, pending termination, exhausted retries — oldest first)
   before recent history, still bounded to ten with honest lifecycle fields.
5. **Player promise categories (P2).** `NotAllowedError` → gesture hint with
   the grant preserved; `NotSupportedError` → `UNSUPPORTED_PROVIDER`
   guidance (the old branch swallowed it into gesture). Stale promises after
   teardown/lesson change are ignored via a grant-identity guard. The exact
   classifier the toggle executes is unit-covered; the browser drives the
   real toggle with synthetic rejections.
6. **Uncertain ADMIN outcome (P2).** A release timeout/error shows an
   unconfirmed state, auto-refreshes the inspection with controls disabled,
   then reports still-listed (safe retry) or likely-released (verify audit
   log) — or unconfirmed-no-inspection when the refresh also fails. Success
   vs audit-partial outcomes stay distinct.
7. **Real harness guards (P1).** `run.mjs` now inspects every owned
   container's labels + resolved mounts, network/volume identities against
   the exact disposable configuration, fails closed on any mismatch or
   command failure, removes the labeled browser-runner explicitly, and only
   then runs scoped `compose down -v` plus a zero-resource re-verification.
8. **Strong browser assertions (P2).** The flow requires the real frame and
   exactly one control with a grant, and exercises CONFIRMED/QUEUED/NOOP,
   stale discard, gesture/unsupported rejection, tab-hide silence,
   unmount-once, pause/resume, fullscreen/fallback with retained
   time/captions/watermark, and grant-count invariance — 44 checks across
   Arabic/English, desktop/mobile, dark/light with keyboard/Escape. Mocks stay
   explicitly labeled; no real advancing playback is claimed.

## Scope and coordination

- Read `AGENTS.md`, `README.md`, `agent.md`, `rules.md`, `decisions.md`,
  `design.md`, `m6-owner-acceptance.md`, M9 contract/schema/runbook/report,
  `course-video-device-limit-20261004.md`, `course-video-recovery-20261004.md`,
  `course-learning-parallel-contract.md`, both course-learning worker reports.
- Agent 1 (backend/materials/migrations) reports complete;
  Agent 2 (frontend) reports complete with mocked-harness scope and a pending
  real-API rerun. Both handoffs present, so backend/frontend edits are now
  allowed. All pre-existing dirty changes preserved; nothing reset, stashed,
  or discarded. No `education-drm-service/` edit in this task.
- Architecture preserved: `client/` + one modular Express `server/`,
  STUDENT/ADMIN only, Arabic primary/English secondary, cookie auth/CSRF,
  subscription/publication/expiry/lesson-unlock enforced server-side,
  recorded videos only. Tokens/secrets never in browser storage/URLs/logs;
  only the non-credential installation ID remains in storage.
- Shared-file dependencies recorded:
  - Agent 1's materials admin routes are mounted as
    `/learning/admin/learning/...` (inside the `/learning` router) while its
    tests and the parallel contract expect `/admin/learning/...`. Left
    untouched to avoid taking over its implementation; new ADMIN device routes
    use a correctly mounted separate admin router (see below). Coordinator
    should schedule Agent 1's mount correction with its pending migration.
  - Agent 1's schema (`MediaMapping.durationSeconds`, `LessonCaption`,
    `LessonResource`) had no migration, blocking every learning test with
    `P2022`. Added the unique additive migration below after its handoff to
    unblock verification; no platform behavior change beyond creating its
    tables.

## Changed files (this task only)

Backend (`server/`):

- `src/modules/learning/errors.ts` — added stable codes
  `DEVICE_INSPECTION_UNAVAILABLE` (503), `DEVICE_RELEASE_ACTIVE` (409),
  `DEVICE_RELEASE_REVOKED` (409), `DEVICE_RELEASE_UNAVAILABLE` (503).
- `src/modules/catalog/drm/schemas.ts` — `validateDeviceInspectionResponse`,
  `validateDeviceReleaseResponse` (bounded, ISO dates, UUID refs, no IP/secret).
- `src/modules/catalog/drmClient.ts` — `inspectUserDevices`,
  `releaseUserDevice` (application credentials, idempotent, bounded body);
  extended denial capture for `DEVICE_ACTIVE`/`DEVICE_REVOKED` on the release
  path without forwarding raw provider diagnostics.
- `src/modules/learning/devices/service.ts` (new) — resolves platform
  student → opaque external user id from trusted records only; computes
  ACTIVE-only counts with honest truncated handling; durable audit via
  `DEVICE_RELEASE_REQUESTED` intent (pre-boundary) + `DEVICE_RELEASE` outcome
  + `DEVICE_RELEASE_REFUSED` terminal, all in the existing `AuditEvent`
  trail, with per-reference and bounded student-scope reconciliation;
  missing reference is idempotent `{released:false}`.
- `src/modules/learning/sessions/service.ts` (new) — `listOwnSessions`
  (max 10, own `studentId` scope, recoverable-first ordering, safe
  course/lesson labels + lifecycle times, never external ids/tokens/URLs/
  browser names).
- `src/modules/learning/routes/admin.ts` (new) — `GET
  /admin/learning/students/:studentId/devices`, `POST
  /admin/learning/students/:studentId/devices/:deviceReference/release`
  (ADMIN-only, Origin+CSRF on mutation, UUID validation, rate-limited).
- `src/modules/learning/routes/index.ts` — added `GET /learning/sessions`
  (STUDENT-only, rate-limited); preserved materials mount.
- `src/modules/learning/index.ts` — exposes `adminRouter` alongside `router`.
- `src/app.ts` — mounts `learning.adminRouter` at `/admin` (student router
  stays at `/learning`).
- `tests/fixtures/drmFixture.ts` — labeled device surface (`devices` map,
  `deviceMaxDevices=2`, `deviceTruncated`, fail flags, `seedDevice`);
  `reset()` now also clears devices. Fixed test-isolation footgun: new
  integration file uses device-only reset (never wipes READY assets).
- `tests/integration/learning-helpers.ts` — removed duplicate `adminPost`
  import (Agent 1 added local helpers with Origin/CSRF options).
- `tests/integration/playback-recovery.test.ts` (19 tests: 5 ADMIN +
  4 durable-audit + 4 recovery + 6 concurrency/attribution/fairness, incl.
  blocker-priority with 12 newer completed rows) and
  `tests/unit/playback-recovery.test.ts` (5 tests: 3 contract + 2
  durable-audit with synthetic doubles mirroring the coordinator probe
  shape).
- Typecheck unblocks (no behavior change): `tests/unit/health.test.ts`,
  `tests/unit/logging.test.ts` (storage timeout/retry fields from Agent 1's
  config), `tests/unit/materials-service.test.ts` (dangling `subscriptions`
  reference).
- `prisma/migrations/20261004010541_playback_recovery_materials_sync/` (new,
  additive) — creates `CaptionState`, `MediaMapping.durationSeconds`,
  `LessonCaption`, `LessonResource` + indexes/FKs for Agent 1's pending
  schema; also carries Prisma-drift index renames already required to sync.
  No data loss; existing rows preserved.

Frontend (`client/`):

- `features/learning/api/client.ts` — `listOwnSessions`, `adminDevices`,
  `adminReleaseDevice`; `endPlayback(referenceId,{keepalive})`.
- `features/learning/types/models.ts` — `OwnSession`, `DeviceEntry`,
  `DeviceInspection`, `DeviceRelease`.
- `locales/ar.ts`, `locales/en.ts` — bilingual device/recovery/player strings,
  incl. NOOP/stale/check-status and unconfirmed/likely-released/still-listed.
- `features/learning/devices/AdminStudentDevices.tsx` (new) — ADMIN section
  with max/ACTIVE/free (null + truncated notice when incomplete), last-seen,
  status, active-playback, REVOKED-as-banned, explicit release with effect
  explanation + confirm, refresh-before-resubmit, honest partial outcomes;
  uncertain release shows an unconfirmed state, refreshes with controls
  disabled, then still-listed/likely-released/unconfirmed-no-inspection
  guidance.
- `features/learning/sessions/OwnSessionRecovery.tsx` (new) — manual flow
  listing own bounded references with course/lesson labels/times/state,
  explicit select + end with interruption warning, CONFIRMED-only restart
  offer via explicit action, QUEUED pending + check-status promotion, NOOP
  truthful reconcile, stale-selection discard, list-sequence race guard,
  progress/pass preservation note, no force-end-all.
- `features/identity/pages/StudentDirectoryPage.tsx` — per-student Devices
  toggle rendering the new section; existing search/pagination unchanged.
- `features/learning/player/Player.tsx` — single accessible Play/Pause/Resume
  **inside** the whole-player fullscreen frame (safe-area padding above native
  controls), `aria-label`/`aria-pressed`, `needsGesture` hint; rejected
  `video.play()` promise handled via the exact `classifyPlayRejection`
  classifier (`NotAllowedError` → gesture hint with grant preserved,
  `NotSupportedError` → `UNSUPPORTED_PROVIDER`, else `PLAYBACK_ERROR`, no
  uncaught rejection) plus a grant-identity stale guard; outer duplicate
  toggle removed (same testid kept inside); retry kept only for media errors.
- `features/learning/player/playRejection.ts` (new) — pure classifier +
  stale guard used by the real toggle.
- `features/learning/player/PlayerChrome.tsx` — exported `errorDetail`
  mapping gesture/unsupported/network without provider internals; overlay shows
  detail under the phase label; watermark order unchanged.
- `features/learning/player/playback-recovery.test.ts` (now 6 tests: label
  mapping + exact toggle classifier branches + stale guard).
- `features/learning/hooks/useLearning.ts` — `end(opts:{keepalive})`.
- `features/learning/pages/CourseLearningPage.tsx` — `pagehide` + unmount
  keepalive ends for this page's own grant only (tab-hide termination
  removed; listener removed on cleanup); bilingual grant-denial messages
  with next actions; `PLAYBACK_STREAM_LIMIT` renders `OwnSessionRecovery`
  and restarts only via its explicit post-confirmation action; media
  `onRetry` still ends previous grant first (no silent extra session).
  Existing coordinator Button/`disabledReason` conventions untouched.

Harness (task-owned, in `docker/playback-recovery-review/`):

- `compose.test.yml` (PG/Redis on 127.0.0.1:5434/6381), `compose.ui.yml`
  (full stack on 127.0.0.1:8092), `run.mjs` (fail-closed inspect-then-remove
  guards, browser-runner handling, zero-resource re-verification),
  `playback-recovery-flow.mjs` (44 stateful browser checks, harness-only
  mocks explicitly labeled).

Not edited: `education-drm-service/`, shared Compose/preview, retained data,
other workers' harnesses/reports, production config.

## Exact route/error contract

All JSON success uses `{data:...}`; errors use safe `{error:{code,message}}`.
Auth is cookies; mutations require approved Origin + session CSRF. ADMIN
routes require ADMIN role; STUDENT routes require STUDENT (ADMIN gets 403).

- `GET /admin/learning/students/:studentId/devices` → `200
  {data:{devices:{studentId,maxDevices,activeCount:number|null,
  freeSlots:number|null,truncated,unavailable:false,devices:[{reference,
  status,createdAt,lastSeenAt,activePlayback,releasable}]}}}`.
  `activeCount`/`freeSlots` are `null` when `truncated:true`. REVOKED rows
  have `releasable:false`. Unknown student → `404 LESSON_NOT_FOUND`;
  non-STUDENT → `400 VALIDATION_ERROR`; STUDENT caller → `403`; provider
  outage → `503 DEVICE_INSPECTION_UNAVAILABLE`. No raw diagnostics.
- `POST
  /admin/learning/students/:studentId/devices/:deviceReference/release`
  (empty JSON body) → `200 {data:{release:{released,auditPending}}}`.
  `released:false` means idempotent missing/already-gone. Active playback →
  `409 DEVICE_RELEASE_ACTIVE`; REVOKED → `409 DEVICE_RELEASE_REVOKED`;
  outage → `503 DEVICE_RELEASE_UNAVAILABLE`; wrong role/CSRF/Origin →
  `403`; malformed ids → `400/404`. Pre-boundary intent
  `DEVICE_RELEASE_REQUESTED` is always persisted first (at most one pending
  per student/reference); success completes `DEVICE_RELEASE`, refusals close
  with `DEVICE_RELEASE_REFUSED`, idempotent already-gone reconciles a pending
  outcome, and `auditPending:true` means the intent row is retained for a
  later retry — never a rollback claim and never a cleared flag.
- `GET /learning/sessions` → `200 {data:{sessions:[{referenceId,
  courseSlug,courseTitleAr/En,lessonId,lessonTitleAr/En,status,
  terminationStatus,pendingEndReason,createdAt,tokenExpiresAt,
  sessionExpiresAt,endedAt}]}}` (max 10, own scope only, recoverable
  ACTIVE/pending/exhausted rows oldest-first before recent history). No
  external ids, tokens, URLs, or browser names.
- `POST /learning/playback/:referenceId/end` (existing, reused) → `200
  {data:{ended:true,closure:CONFIRMED|QUEUED|NOOP}}`. Foreign/guessed
  reference → `NOOP` (never affects another student). CONFIRMED alone proves
  the slot freed and alone offers restart; QUEUED stays pending until a
  refresh shows durable closure; NOOP reconciles with a refresh and an
  honest nothing-ended message. No force-end-all; no auto-end on login/tab/
  retry/reload/navigation/start, and hidden tabs never end playback.
- Player categories (stable, bilingual): gesture/autoplay refusal
  (`PLAYBACK_GESTURE_REQUIRED` → press Play), unsupported provider
  (`UNSUPPORTED_PROVIDER` → supported-browser guidance), transient network
  (`PLAYBACK_ERROR`/`DASH_*`/`STREAM_SETUP_ERROR`/`PLAYER_INIT_FAILED` →
  bounded retry without new grant), expired (`PLAYBACK_SESSION_EXPIRED` →
  renewal), device limit/revoked/stream (`PLAYBACK_DEVICE_LIMIT/REVOKED/
  STREAM_LIMIT` → support or own-session recovery). No auto-retry loops for
  access/device/concurrency denials.

## Audit/migration/configuration impacts

- Audit: `DEVICE_RELEASE_REQUESTED` intent + `DEVICE_RELEASE` outcome +
  `DEVICE_RELEASE_REFUSED` terminal, all in the existing append-only
  `auditEvent` (sanitized `{deviceReference[, reason]}` only). External DRM
  audit preserved (its own transaction). No exactly-once claim; duplicates
  prevented by checking for an existing outcome first.
- Migration: one pre-existing additive file
  `20261004010541_playback_recovery_materials_sync` (Agent 1 schema, already
  applied; untouched by this correction). No new migration is appended: the
  durable intent/outcome mechanism reuses the existing `AuditEvent` table,
  so no schema change was justified. Populated-data upgrade and repeat-deploy
  behavior of that file remain a combined-verification item (see blockers).
  Rollback: leave additive schema in place; do not drop volumes.
- Configuration: none. No new env vars, secrets, ports in committed code.
  Harness uses disposable `5434/6381/8092` only. No Nginx/Compose change
  outside the new disposable harness.

## Rules traceability

- `AGENTS.md`/D01/D12: platform consumes external DRM HTTP only; no nested
  edit, no persistence access; one Express app preserved.
- D09: cookies + readable CSRF only; playback token stays in memory; language
  remains the only storage value besides the non-credential installation ID.
- D10/D11: expiry/subscription/publication/lesson-unlock rechecked on
  sessions/end/renew/materials; Arabic primary/English secondary throughout.
- `rules.md`: server-side authorization on every sensitive operation (UI
  disabling is not control); no secrets in browser/logs; retry-safe durable
  termination (replica-safe reconciler retained); no DRM weakening; no
  destructive tests against owner data; disposable Docker projects only.
- Device-recovery approvals (`course-video-device-limit/recovery-20261004`):
  ACTIVE-only counts, REVOKED preserved, active playback never released,
  limits unchanged, truncation honesty, audit/concurrency preserved.
- M9 contracts: assessment gates/progression/passes preserved; no grading,
  wallet, recharge, or authoring refactor.

## Docker verification actually run

Unique names `fayq-playback-recovery-*`, ports `8092/5434/6381` (not `8080`,
not `8091`/`8084`). `node docker/playback-recovery-review/run.mjs`:

- `docker build -f server/Dockerfile --target test -t
  fayq-playback-recovery-server-test:20261004 .`
- `docker build -f client/Dockerfile --target test -t
  fayq-playback-recovery-client-test:20261004 .`
- `docker build -f server/Dockerfile --target runtime -t
  fayq-playback-recovery-server:20261004 .`
- `docker build -f client/Dockerfile --target runtime -t
  fayq-playback-recovery-client:20261004 .`
- `docker build -f server/Dockerfile --target migrate -t
  fayq-playback-recovery-migrate:20261004 .`
- `docker compose -p fayq-playback-recovery-20261004 -f
  docker/playback-recovery-review/compose.test.yml up -d --wait`
- `migrate-deploy` via Docker migrate image (disposable PG).
- Server typecheck (Docker): PASS. Client typecheck (Docker): PASS.
- Guard unit on host node (pure logic): **10/10 PASS** incl. negative cases
  (wrong-source bind, wrong volume mapping, mode flip, count mismatch,
  substring image, foreign project/service, foreign volume label, unrelated
  network consumer, anonymous hex volume).
- Server unit (Docker): **225 PASS** (26 files), incl. 3 device-contract
  tests + 2 durable-audit tests with synthetic doubles (coordinator probe
  shape: outage-then-retry re-attempts the outcome instead of clearing it;
  retry-success completes exactly one outcome) + existing suites.
- Client unit (Docker): **114 PASS** (17 files), incl. exact toggle
  classifier branches (gesture vs unsupported vs generic) + stale guard.
- Focused integration (real disposable PG/Redis + labeled HTTP fixture, 600s
  durations): `playback-recovery.test.ts` **19/19 PASS** — wrong role,
  missing/invalid CSRF, arbitrary-id/cross-student isolation, stale-active
  refusal, revoked refusal (+REFUSED audit, no RELEASE), truncated honesty,
  provider outage, audit-outage-then-retry completion with a single outcome,
  timeout-after-success reconciliation, duplicate single-outcome, 4×
  simultaneous releases → 1 intent + 1 outcome, 4× simultaneous reconciling
  retries → 1 outcome, actor A/outage/actor B attribution
  (`intentId`/`originActorUserId`/`reconciledBy`), truncated sweep writes
  nothing and reports `complete:false`, old pending found behind 21
  completed pairs with `complete:true`, 5× repeat retries → single outcome,
  own-session safe labels, foreign-refusal NOOP, duplicate safe end,
  outage→QUEUED→reconciler retry, second session untouched,
  expiry-blocks-renewal, blocker-priority (older ACTIVE first past 12 newer
  completed rows, foreign excluded).
- Existing regression (same Docker PG/Redis + fixture):
  `learning-playback.test.ts` **28/28 PASS**.
- UI stack `fayq-playback-recovery-ui-20261004` on `127.0.0.1:8092` with
  synthetic admin/student/course (disposable DB only); browser via
  `fayq-m9-browser:0.9.0` with harness-only interception for grants,
  devices/sessions/end and stalled mock media:
  **PLAYBACK_RECOVERY_BROWSER_CHECKS=52 PASS** — admin directory/search/
  devices/slots/banned, uncertain-release unconfirmed → disabled-controls →
  still-listed reconcile, CONFIRMED-only restart with single new grant,
  QUEUED pending with FAILED/null/PENDING non-promotion and zero
  grants/callbacks then COMPLETED promotion with exactly one callback/grant,
  NOOP truthful reconcile with no grant, stale-selection discard,
  missing-reference silence, unavailable-list error with no offer/grant,
  exact-one in-frame control with grant, overlay containment,
  gesture-preserving vs unsupported rejection via the real toggle, tab-hide
  silence, unmount-once, pause/resume, fullscreen fallback with retained
  time/captions/watermark, Escape exit, no duplicate grants; Arabic/English,
  desktop/mobile, dark/light, keyboard focus; zero uncaught page errors.
- Client production build: PASS (via test image build).

Evidence classes (kept distinct): worker Docker evidence above is
worker-reported; the coordinator's independent probes (synthetic service
probe, standalone NOOP UI probe) are independent evidence and are now
superseded by the production-suite regressions that fail on the old
behavior (old service loses the audit on retry; old component restarts on
NOOP; old toggle misroutes NotSupportedError; old list hides blockers).
True vs mocked: API auth/persistence/ownership/CSRF/audit/termination-retry
evidence is **real platform + disposable PG/Redis + labeled fixture** (not
real DRM). Browser proof uses **real auth/outline/navigation/fullscreen
mechanics** + **explicit harness-only mocks** for grants, device/session
list/end and media bytes (never production fallback). Real advancing
protected playback (0.196→9.894s, native fullscreen, watermark) remains the
prior retained-preview evidence in `course-video-recovery-20261004.md`; this
task adds no new real-DRM playback claim and performs no destructive
real-provider test. Long-fixture coverage uses 600s synthetic durations +
renewal/expiry paths; short/mocked fixtures are not presented as renewal
proof. No quiz pass manufactured; owner sessions never touched.

Skipped: real-provider advancing playback with task-owned synthetic
assets/sessions (not performed; prior retained evidence stands, no new
claim). No other skips.

Failures fixed during correction (both passes): client idempotent retry
converging before the service sees ambiguity (fixture now fails every attempt
of the flagged reference until cleared); Prisma delegate rebinding in test
proxies (delegate through the real client; route `$transaction` through the
proxy so locked paths honor failing writes); order-dependent audit-create
counting (action-based outage proxy; short-id vs full-id network comparison
in guards); same-hash navigation no-op in the flow (explicit `reload()`);
render race on the end button (wait-before-click helper); unconfirmed-state
observability (mocked inspection latency); synthetic double constant row ids
collapsing distinct intents (unique ids); retry-after-success writing
redundant rows (short-circuit on existing RELEASE outcome). All green on the
final run.

Screenshots (ignored evidence, sanitized, no secrets/URLs/tokens):
`docker/browser/evidence/playback-recovery/playback-recovery-admin-devices.png`,
`playback-recovery-learning-ar-mobile.png` (fixture file removed after run).

## Recovery limitations and heartbeat proposal (separate)

Delivered explicit self-session flow documents that `QUEUED` is not proof the
external slot freed; `ACTIVE` alone does not prove watching; close/unload
cannot guarantee delivery (durable retry is the guarantee); recovery never
bypasses entitlement/publication/locks and never auto-ends another session.

Heartbeat-based abandonment recovery was **not** implemented and no
timeout/grace value was selected. If desired, a separate proposal must cover:
required external API changes (activity lease/heartbeat semantics,
server-authoritative expiry), background-tab/offline behavior, grace periods,
races with explicit recovery and renewal, owner decisions on lease duration
and enforcement latency, and migration/rollback. No provider, timeout, or
limit change is inferred here.

## Integrated captions/resources/search/duration review

Agent 2's search (diacritics-insensitive, expand-match, no playback on
filter), nullable `durationSeconds` totals (complete/partial/unknown, no
guessing), ADMIN pair/resource panels, and student Blob-URL captions/resources
were preserved and re-verified by the 114 client + materials unit suites and
the 52 browser checks. The materials admin mount mismatch and its pending
migration (now applied as the additive file above) are recorded as Agent 1
coordination items; no materials logic was rewritten here.

## Second correction pass — six further findings (all addressed)

The independent [second review](playback-recovery-second-review-20261004.md)
reproduced four audit defects plus a closure-predicate and a cleanup-guard
finding against the corrected tree, with historical probes retained in
`docker/playback-coordinator-review/`. All six are fixed in place below; the
credited work (durable intent, NOOP truthfulness, explicit CONFIRMED
restart, blocker-first ordering, pagehide-only termination, player
classification, ADMIN uncertainty handling) remains intact:

1. **Truncated inspection never implies release.** Sweep reconciliation now
   requires a complete inspection: absence from a truncated/failed list
   leaves work pending and marks the scan incomplete. Outcomes record
   `confirmedBy: direct | idempotent-retry | sweep` so observed absence is
   distinguished from proof this operation performed the release.
2. **Atomic intent/outcome dedup.** Intent creation and terminal-outcome
   writes run under a per-student User-row lock (`SELECT … FOR UPDATE`,
   same precedent as identity profile updates), so simultaneous
   requests/reconciliation create at most one pending intent and one
   terminal outcome per reference. Outcomes correlate explicitly via
   `intentId` (+ legacy reference/time match); the intent is still persisted
   before any external mutation; refusals and timeout-after-success recovery
   are preserved; no exactly-once external execution is claimed.
3. **Originating attribution preserved.** Outcome rows carry
   `actorUserId` = originating ADMIN with `intentId`, `originActorUserId`,
   and — only when different — `reconciledBy`. A reconciling ADMIN never
   silently replaces the requester.
4. **Fair reconciliation.** The sweep walks REQUESTED rows oldest-first by
   keyset (25/page, 4 pages, 10 reconciles), skipping completed history
   without inspection calls. It returns `{reconciled, pending, complete}` —
   `pending` covers scanned pages only and `complete:false` means more work
   may exist outside the subset; a global zero is never reported from a
   bounded scan.
5. **Confirmed closure only.** Promotion requires `TERMINATED` or
   `COMPLETED`; `ENDED/null`, `ENDED/FAILED`, `ENDED/PENDING` and missing
   references stay pending/uncertain with no offer and no callback. Browser
   coverage asserts FAILED/null/PENDING non-promotion, COMPLETED promotion
   with exact callback counts, missing-reference silence, and unavailable-list
   error handling.
6. **Fail-closed cleanup.** Pure guard module `guards.mjs` (unit-tested incl.
   negatives) checks exact image/labels, per-service source/destination/type/
   mode/count against `compose config` ground truth, volume identity, and
   network membership; `run.mjs` inspects before every removal, removes the
   labeled browser runner explicitly, verifies every mounted volume absent
   afterwards (catching anonymous volumes), and deletes only the exact
   fixture file. Wrong-source binds, wrong service-volume mappings, and
   unrelated network consumers abort removal.

Changed files this pass: `server/src/modules/learning/devices/service.ts`
(intent/outcome correlation, locks, fair sweep, truncated guard),
`server/tests/fixtures/drmFixture.ts` (`timeoutAfterDeviceRelease` fails
every attempt until cleared, defeating client idempotent retries),
`server/tests/integration/playback-recovery.test.ts` (19 tests: +simultaneous
releases, +simultaneous reconciling retries, +actor A/outage/actor B,
+truncated no-release, +old-pending-behind-21-completed, +5× repeat retries),
`client/src/features/learning/sessions/OwnSessionRecovery.tsx` (confirmed-
closure predicate + missing-stays-uncertain),
`client/src/features/learning/player/playRejection.ts` + `Player.tsx`
(unchanged this pass; already correct),
`docker/playback-recovery-review/guards.mjs` + `guards.test.mjs` (new, 10
tests) + `run.mjs` (config-ground-truth guards, guard-test step, fixture
removal) + `playback-recovery-flow.mjs` (52 checks). No schema change was
justified (all durability state reuses `AuditEvent`); existing migrations
untouched. Coordinator Button/`disabledReason`, IDE layout/colors, and Agent
1/Agent 2 materials files/contracts preserved; historical coordinator probes
retained unmodified.

Verification this pass (Docker, `fayq-playback-recovery-*`, 8092/5434/6381):
both typechecks PASS; server unit **225/225** (incl. 2 durable-audit doubles);
client unit **114/114**; guard unit **10/10**; integration
`playback-recovery.test.ts` **19/19** on real disposable PG (simultaneous
4× releases → 1 intent + 1 outcome; simultaneous reconciles → 1 outcome;
A/outage/B attribution with `intentId`/`originActorUserId`/`reconciledBy`;
truncated → pending + `complete:false`; old pending found behind 21
completed pairs with `complete:true`; 5× retries → single outcome);
`learning-playback.test.ts` **28/28**; browser
**PLAYBACK_RECOVERY_BROWSER_CHECKS=52** PASS (added FAILED/null/PENDING
non-promotion with zero grants/callbacks, COMPLETED promotion with exactly
one callback/grant, missing-reference silence, unavailable-list error);
`ALL CHECKS PASSED`. Cleanup inspected before and after removal for both
projects (`containers=0 networks=0 volumes=0`, every mounted volume verified
absent, fixture file removed, screenshots retained as ignored evidence);
retained preview healthy; no global prune.

Skipped: real-provider advancing playback (prior retained evidence stands, no
new claim). Known test-isolation repairs made during verification (fixture
ambiguity vs client retries; proxy `$transaction` routing; action-based
outage proxy; same-hash navigation no-op; render-race waits; unconfirmed
observability latency; short-vs-full container-id comparison) are recorded in
this report, not hidden.

## Remaining blockers (not closed by this correction)

- Agent 1/Agent 2 materials gate untouched: materials ADMIN routes still mount
  beneath `/learning/admin/learning`, and the duration validator still reads
  only `durationSeconds` (per the coordinator reviews). Multipart, byte-exact
  storage, caption replacement, durable materials deletion/fences, response
  DTOs and frontend lesson/error-state findings keep their separate repair
  gate; this correction neither fixes nor regresses them.
- The additive `20261004010541` migration's assessment-FK drop/recreate and
  index renames still need explicit combined review with populated-data
  upgrade and repeat-deploy evidence.
- No real-provider advancing playback was performed here; any release still
  needs the combined real-API integration the parallel contract schedules.

## Cleanup and rollback

Mandatory cleanup done after success, failure, and every intermediate stop:
for each owned project the harness inspected every container's labels plus
every resolved mount, plus network/volume identities, against the exact
disposable configuration (fail-closed on any mismatch or command failure),
removed the labeled browser-runner explicitly, then ran scoped
`compose down -v` and re-verified zero resources. Final:
`containers=0 networks=0 volumes=0` for both projects (inspected before and
after removal). Task-owned playback sessions closed via supported end API
(recorded reference ids, never guessed latest); task-owned inactive
verification devices released only via protected API where applicable; no
owner session interrupted, no queued/refused cleanup outstanding. Retained
`localhost:8080` preview, DRM/data, other workers' resources, reusable images
(`fayq-m9-browser`, `fayq-platform-nginx`, `fayq-playback-recovery-*` kept for
coordinator reuse), and ignored evidence preserved. No global prune, no owner
account/wallet/course/subscription/pass/progress/media reset.

Rollback (platform only, no data action): rebuild server/client from the
pre-change tree (or retag retained pre-repair images per
`course-video-device-limit-20261004.md`), recreate only `server`/`client` +
`nginx` on the existing Compose project/env; leave the additive migration in
place. Restoring code revives the outer toggle/generic errors and removes the
device/session routes; it does not restore released registrations or close
external sessions (use the protected APIs for that). Stop for coordinator
review; do not update the retained preview from these source changes.
