# Student and ADMIN progress indicators — 2026-10-05

Owner request: find every progress bar and make it work for students and admins. Base platform revision: `538a0f9da6b654f31a10aa2db457fda080bada19`. Changes are uncommitted; no production deployment or milestone acceptance is inferred.

## Inventory and behavior

| Surface | Verified behavior |
| --- | --- |
| Student course learning plan | Saved lesson completion updates its percentage and lesson state without interrupting playback. |
| Subscribed course offer plan | Reads the same persisted completed-lesson percentage. |
| Student dashboard subscription cards | Refresh on focus and successful progress saves; persisted percentages match learning. |
| Student account overview | Uses the same dashboard progress and shared accessible bar. |
| ADMIN lesson video upload | Shows measured storage bytes, then indeterminate confirmation/processing; only the status API reporting READY completes preparation. |

Source search covered progress/percentage/width indicators across client and server. Decorative homepage lines are not progress indicators. Native video seeking remains browser-controlled. ADMIN summary pages do not currently contain course-progress bars; this work does not invent new analytics.

Course percentage still counts completed lessons. Partial viewing saves a resume position. Existing server completion rules (90% viewing threshold or reported completion) and required assessment progression are unchanged. Bilingual course-plan copy explains this distinction.

## Repairs

- Learning requests use the shared cookie-session refresh transport. An expired access cookie can refresh once and retry with current CSRF. Entitlement denial, revoked sessions, CSRF rejection, network errors and server failures are not blindly replayed.
- Player captures its last position before DASH teardown, binds writes to the correct lesson and flushes on navigation/page exit. Playback grant instances have separate player lifetimes. Final progress saves remain subject to server authorization.
- Failed saves show a bilingual retry action while preserving playback. Out-of-order responses cannot undo completed state or the furthest position. Dashboard/account updates follow successful writes.
- Shared progress bars clamp finite percentages, expose accessible labels and values, and support an indeterminate state with reduced-motion-aware styling.
- ADMIN upload uses XHR byte events for the presigned PUT without platform cookies. HTTP failure/abort cannot produce false success. Processing has no invented percentage; bounded polling is followed by manual status refresh when needed. Long-upload registration/completion/status calls support the same bounded authentication refresh, without replaying storage transfer.

## Docker verification

- Frontend runtime TypeScript/Vite build passed. Existing large-bundle warning remains.
- 155 frontend unit tests and 2 DASH compatibility checks passed, including session refresh, denied-request non-replay, progress merge, byte progress, HTTP failure and abort.
- `node docker/ide/modes-verify.mjs --progress-only`: 17 browser checks passed. Covers failed save/retry, last position after navigation, expired-cookie refresh, completion across all student surfaces/reload, measured ADMIN upload at 25%, indeterminate processing after transfer, manual READY synchronization and no browser errors.
- Browser verification uses disposable synthetic identities with real platform authentication, progress API and database persistence. Video events and storage upload/status responses are simulated; this is not new real DRM playback or real storage-transfer certification. Screenshots were visually inspected. Material storage is intentionally unavailable in that disposable progress fixture.
- Evidence: ignored `docker/browser/evidence/ide-modes/progress-flow.log`, `progress-student.png`, `progress-admin.png`. Runner cleanup proved zero disposable containers, networks and volumes.

Page-exit writes are best effort; offline closure cannot guarantee delivery. The visible retry retains unsaved snapshots in memory while the page is open.

## Retained local app

Updated only client and recreated Nginx on `fayq-local-preview`. Tested/running client image: `sha256:b4352c8ae47e3f4990eb6b18a07ebb35ce1a6f8050726bd6b4a5f3e204bfb76e`. Home and readiness return HTTP 200; client/proxy are healthy. Guard checks confirm retained platform/DRM volumes. Backend, grading, database, Redis, material storage and DRM services kept their existing containers. No schema, retained-account fixture or nested DRM source change.

Previous client image is preserved as `fayq-platform-client:before-progress-fix-20261005` (`sha256:c657726f5ddaff28f37d5976a7ceffa37bf0259730efe59f25193a79d172efc1`). To roll back, retag it to `fayq-platform-client:0.9.0-m9`, run the retained preview guard, then recreate only client and Nginx with the retained Compose files and environment files. Do not remove volumes.

Refresh the browser to load the updated app at http://localhost:8080/.
