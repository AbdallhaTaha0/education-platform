# OpenCode prompt — device management, session recovery and player controls

Copy the assignment below into OpenCode after the course-learning backend/frontend workers have handed off shared files. Preparing this prompt does not launch a worker or deploy anything.

---

Implement these three bounded improvements in the existing education platform: **ADMIN device management**, **explicit recovery of a student's own previous playback session**, and **clearer playback controls/errors**. Complete local implementation, Docker verification and a reviewable handoff. Do not commit, push, deploy to production or accept a milestone.

## Read and preserve before editing

Read `AGENTS.md` and `reports-and-markdown-files/README.md`, `agent.md`, `rules.md`, `decisions.md`, `design.md`, `m6-owner-acceptance.md`, the current M9 implementation contract/schema/API/runbook/report, `course-video-device-limit-20261004.md`, `course-video-recovery-20261004.md`, `course-learning-parallel-contract.md`, and both course-learning worker reports when present. Inspect actual code and current dirty changes; reports alone are not verification.

Coordinate shared files before editing. Agent 1 owns backend/materials/migrations until its handoff; agent 2 has completed its frontend handoff. If agent 1 is still working, continue read-only analysis and prepare player changes in nonconflicting files; do not overwrite its work or silently start migrations against incomplete backend code. Record any dependency and preserve all existing changes, including captions/resources/search/durations, assessment gates, installation identity and the authorized external device-recovery API. Never reset, stash away or discard another worker's changes.

Architecture remains `client/` plus one modular Express `server/`, STUDENT and ADMIN only, Arabic primary/English secondary, cookie authentication/CSRF, current subscription/publication/expiry rules and recorded videos. Tokens/secrets never enter browser storage, URLs, screenshots or logs. The non-credential shared browser installation ID is permitted in storage. Consume external DRM HTTP APIs only; platform code never accesses its database.

**Do not edit `education-drm-service/` in this assignment.** Existing device-recovery approval is bounded, not permission for heartbeat leases, session-timeout changes, provider changes or unrelated maintenance. A new external maintenance proposal can be reported separately. Do not increase device/stream limits or weaken DRM.

Own platform changes required by these three features, new `docker/playback-recovery-review/` harness files, and `reports-and-markdown-files/playback-recovery-improvements-report.md`. Avoid unrelated materials, grading, wallet, recharge and course-authoring refactors. Use a unique additive migration only if necessary, after the sole current migration owner has handed off.

## 1. ADMIN device management

Add a bilingual section to the existing ADMIN student-management/detail context; reuse existing student lookup and navigation. ADMIN selects an existing STUDENT account. Resolve its external user ID from trusted platform records, never from an arbitrary client-supplied external user/application ID.

Use the external APIs already delivered:

- `GET /v1/admin/users/:externalUserId/devices`.
- `POST /v1/admin/users/:externalUserId/devices/:deviceReference/release`, empty JSON body.

Add small typed methods to the existing server-side DRM client and ADMIN-only platform routes consistent with the repository. Keep application credentials server-side. Require cookie/session/ADMIN authorization, Origin and CSRF on mutation; validate platform student/reference parameters. Map only expected safe upstream errors; never forward raw provider diagnostics.

Display configured maximum, ACTIVE registration count/free slots, last-seen date, registration status, and active-playback state. Count ACTIVE registrations only; REVOKED entries remain visible as banned and are not releasable. Explain that active playback cannot be released. Handle unknown/unavailable/truncated inspection honestly; do not calculate a complete slot count from a truncated list. Use dates/times understandable in Arabic and English.

Provide an explicit **Release inactive device** action for the selected opaque registration. Explain the effect before submission: it frees a registration slot, preserves history and allows that legitimate browser to register normally again within the limit. Do not auto-release devices, unban a device or terminate playback to force a release. The external service must recheck inactivity under its lock even if the UI inspection was stale.

Record successful ADMIN release in the platform's existing audit conventions, identifying actor, selected student and opaque registration reference; no secret/raw browser identity. Preserve the existing external transaction/audit. Handle duplicate requests and ambiguous network outcomes safely: refresh/reconcile state before showing success or resubmitting; do not invent exactly-once cross-service guarantees. If a separate platform audit write fails after external success, report/reconcile that partial outcome using an established durable mechanism, rather than falsely claiming the external release rolled back.

Test wrong role, missing/invalid CSRF, arbitrary-user overrides, tenant/cross-student isolation, stale activity becoming active, revoked refusal, repeated release, provider outage and truthful counts. UI disabling alone is not access control.

## 2. Explicit own-session recovery for abandoned playback

Reproduce the current close/navigation/retry lifecycle first. Improve best-effort normal navigation/page-exit closure using existing supported requests where appropriate; retain durable termination retries and replica-safe reconciliation. Closing/unloading a browser cannot guarantee delivery, so do not claim it does.

Implement a **manual recovery flow using existing platform ownership and external termination APIs**, without changing DRM timeout policy. When a student encounters the concurrent-stream denial, offer a clearly labelled way to review and end **their own selected previous playback session**. List bounded safe platform references with available course/lesson labels, started/expiry times and honest platform lifecycle state. Do not expose external session identifiers, tokens, storage URLs or inferred browser names. Platform ACTIVE state alone does not prove that someone is currently watching or that a session is abandoned; make that limitation clear.

Require an explicit student action explaining that ending the selected session can interrupt its playback. Reuse the existing owner-checked end operation and durable termination queue. Query/update references with authenticated `studentId` scope; foreign or guessed references must never affect another student. Do not add a force-end-all button or terminate another session automatically on login, new tab, retry, reload, navigation or start. Do not change device revocation, add a role or release device registrations from this flow.

Only offer starting playback again after confirmed closure, or show a truthful pending-recovery state when termination is queued. A queued response is not proof that the external stream slot has been freed. Make repeated recovery safe and preserve progress and assessment passes. Recovery never bypasses subscription/publication/expiry/lesson-unlock checks.

If automatic heartbeat-based abandonment recovery is still desirable, write a separate proposal listing required external API changes, heartbeat/lease semantics, background-tab/offline behavior, grace periods, races and owner decisions. **Do not select or implement new timeout/grace-period values in this task.** Deliver the explicit self-session flow and document its remaining limitations.

Verify normal navigation, reload/abrupt close, duplicate termination, timeout/outage followed by durable retry, confirmed versus queued recovery, foreign-reference refusal, an actively playing second session left alone unless its owner explicitly selects it, and subscription expiry during recovery. Use synthetic disposable accounts; never interrupt the owner's live preview sessions to run these tests.

## 3. Clearer playback controls and errors

Put an accessible custom Play/Pause/Resume control **inside the whole-player fullscreen frame**, alongside captions and the watermark, with sufficient spacing for native controls and mobile safe areas. Retain native controls and the existing fullscreen/expanded fallback. Keep the user's selected caption language and current time through fullscreen entry/exit. Avoid duplicate active controls that confuse keyboard/screen-reader use. Do not hide or detach the watermark.

Handle the rejected `video.play()` promise and media initialization failures explicitly. Distinguish a browser gesture/autoplay refusal, unsupported protected playback, transient network failure, expired access, device limit, revoked device and concurrent-stream limit using stable safe categories and bilingual plain-language messages. No uncaught promise rejection, generic fake success or provider internals in the UI.

Show the useful next action for each case: a user play gesture, supported-browser guidance, bounded retry, renewal, ADMIN/support assistance for device slots, or the explicit own-session recovery above. Avoid automatic retry loops for access/device/concurrency denials. Retrying media on an existing grant should not silently create another device/session; if a new grant is needed, preserve existing end/renewal safeguards.

Test desktop/mobile, Arabic RTL/English LTR, dark/light, keyboard focus and Escape, native fullscreen/fallback, captions/watermark containment, play refusal, pause/resume, and error recovery without progress reset or duplicate sessions.

## Docker verification and handoff

Use Docker for development and verification. Create unique project/image names beginning `fayq-playback-recovery-` and choose an unused loopback test port after inspecting existing listeners/projects. Do not overwrite localhost:8080, shared image tags or another worker's stack. Test real platform authorization/persistence with disposable PostgreSQL/Redis; label external HTTP fixtures explicitly. Reuse the independently deployed DRM only for a separately labelled real-provider verification using task-owned synthetic accounts/assets/sessions. No destructive tests against owner data.

Run relevant typechecks/builds, unit and integration regressions, plus real-browser checks. Cover protected-device API behavior, ownership/CSRF/tenant isolation, queued termination retries, unchanged limits, interrupted/abrupt-close cases and player errors. Use a sufficiently long synthetic recorded-video fixture to test renewal and advancing playback; short/mocked fixtures do not prove these. Never manufacture quiz passes or complete the owner's assignments. Record true versus mocked DRM/storage evidence and all failures/skips.

Retain sanitized screenshots and a report with changed files, exact route/error contract, audit/migration/configuration impacts, rules traceability, Docker commands actually run, test counts, real playback facts, recovery limitations and rollback. Review the complete integrated captions/resources/search/duration flow for regressions without taking over its unrelated implementation. Source changes are not permission to update the retained preview; hand off for the coordinator's guarded integration.

**Mandatory cleanup after success, failure or stop:** inspect project/container labels and every resolved mount first. Remove only task-owned disposable containers/networks/volumes/fixtures. Explicitly close task-owned playback sessions through supported APIs; identify them by recorded creation responses, not a guessed latest session or timestamp. Release only task-owned inactive verification devices through the protected API. If cleanup is queued/refused, report the exact safe limitation and preserve active owner sessions. Never reset owner accounts, wallet, courses, subscriptions, passes, progress or uploaded media. Preserve other workers' resources, retained preview/DRM/data, reusable images and saved evidence. No global Docker prune. Record final zero-owned-resource checks and any outstanding cleanup obligations, then stop for coordinator review.
