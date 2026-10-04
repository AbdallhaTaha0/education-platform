# Course-learning UI handoff (agent 2 — frontend)

**Coordinator follow-up (2026-10-04):** Combined real-API integration is now complete. [The final report](course-materials-and-dual-repository-delivery-20261004.md) records boundary/CRLF/stale-state fixes, the duplicate React-key fix, 19 real browser checks and the retained demo update. Mocked worker checks below remain distinct historical evidence.

2026-10-04, Africa/Cairo. Frontend half of the course-learning enhancements,
implemented against the frozen shared API contract
(`course-learning-parallel-contract.md`) while agent 1 builds the real
endpoints concurrently. Implemented locally and stopped for coordinator
review. No production deployment, capacity certification, DRM edit,
commit/push or milestone acceptance. Self-completion is not milestone
acceptance.

## Assigned scope and result

| Plan item | Delivered |
| --- | --- |
| 1. Lesson/section-title search on subscribed offer + learning pages | Shared `CoursePlan` search over the already-authorized outline only. Arabic/English, case-insensitive, Arabic-diacritics-insensitive. Clear action, accessible result count (`role="status"`), empty state, matching sections expanded, pre-filter expand state restored on clear. Selected lesson, completion/resume, required-assessment links, section counts and disabled locked lessons preserved. Filtering only narrows rows; it never calls playback, writes progress or bypasses access. No public curriculum endpoint created. |
| 2. Actual nullable `durationSeconds` display | `m:ss`/`h:mm:ss`, `Math.round` consistently. Per-lesson labels plus section/course totals that render complete only when every duration is known, partial (`+ (partial)` / `+ (جزئي)`) when some are known, and unknown labels otherwise. Legacy payloads with missing duration stay unknown; nothing is guessed from titles, counts, player progress or fixtures. |
| 3. ADMIN caption-pair/resource authoring | `AdminLessonMaterials` per lesson in the existing course-management outline workspace, using the contract endpoints with cookie/CSRF session. Bilingual pair rule and file limits explained inline, form values preserved on failure, validation/upload/removal/retry status with `role="alert"`/`role="status"` errors. ADMIN picks every file explicitly; no storage provisioning, no provider credentials in the client. |
| 4. Student captions + protected resources | Arabic/English/Off selector and resource list (bilingual labels, MIME/size, authenticated downloads). Caption bytes fetched with cookies, validated as WebVTT, attached via short-lived Blob URLs revoked on lesson change/unmount/access loss. Selector and `<track>` live inside the whole-player fullscreen frame with the watermark. Unavailable/loading/failure states never break playback. Plain-text rendering only, no HTML insertion. Downloads use temporary Blob URLs; no permanent public links, no stored auth/playback tokens, no invented API security, no fake success. |

Preserved: Arabic-first RTL / English LTR, FAYQ semantic tokens, dark/light
themes, desktop/mobile safe-area dock, accessible focus/keyboard, native
fullscreen + expanded fallback, resume/previous/next, server-driven
assessment gates, the JavaScript IDE, cookie authentication, one business
backend and exactly STUDENT/ADMIN. No progress reset, no fabricated quiz
passes/purchases.

## Changed files (agent 2 ownership only)

New:

- `client/src/features/learning/search/normalize.ts` (+ `.test.ts`, 6 tests)
- `client/src/features/learning/materials/duration.ts` (+ `.test.ts`, 6 tests)
- `client/src/features/learning/materials/types.ts` (frozen-contract shapes,
  limits, label/size formatters)
- `client/src/features/learning/materials/captions.ts` (+ `.test.ts`, 3 tests;
  WebVTT validation, Blob URL create/revoke, safe download names)
- `client/src/features/learning/materials/api.ts` (typed student + ADMIN
  clients: materials GETs, caption bytes, resource download, caption-pair
  upload/delete, resource upload/delete; cookies + CSRF, no embedded secrets)
- `client/src/features/learning/materials/useLessonMaterials.ts` (fetch,
  on-demand caption Blobs, revocation on lesson/unmount/access-loss)
- `client/src/features/learning/materials/LessonMaterials.tsx`
  (`CaptionControls`, `ResourcesPanel`)
- `client/src/features/learning/materials/AdminLessonMaterials.tsx`
- `docker/course-learning-ui/compose.ui.yml` (disposable harness, project
  `fayq-course-learning-ui-20261004`, loopback port `8091`)
- `docker/course-learning-ui/course-learning-ui-flow.mjs` (33 browser checks)
- `docker/course-learning-ui/run.mjs` (guarded start/fixture/flow/cleanup)

Edited (all inside `client/`):

- `features/learning/types/models.ts` — added optional nullable
  `durationSeconds` to `OutlineLesson` (tolerates legacy payloads).
- `features/learning/components/Learning.tsx` — `CourseOutline` gains
  controlled section expansion and per-lesson/per-section duration labels.
- `features/learning/components/CoursePlan.tsx` — search state/filtering,
  result count/empty/clear, expand-match + restore-browsing, course total.
  Shared by the subscribed offer page and the learning page unchanged.
- `features/learning/pages/CourseLearningPage.tsx` — materials hook wired
  before all early returns (hook-order safe), caption controls passed inside
  the player frame, resources panel below the player, access-loss revocation.
- `features/learning/player/Player.tsx` — optional caption Blob URLs,
  selected-language `<track>`, caption-controls slot inside the fullscreen
  frame; watermark order and all existing behavior unchanged.
- `features/catalog/pages/LessonEditor.tsx` — `AdminLessonMaterials` per
  lesson beside the existing uploader/assessments/deletion controls.
- `locales/ar.ts`, `locales/en.ts` — matching bilingual strings for
  search/durations/captions/resources/admin panels.
- `styles.css` — FAYQ-token-scoped additions only: search input containment,
  `video::cue` readability, caption-controls backdrop inside the frame.

Not edited: `server/`, Prisma/migrations, existing shared Compose files,
plan/contract/index/design docs, `education-drm-service/`, or agent 1's
`docker/course-learning-backend/` and backend/materials files, all of which
were observed but left untouched. The pre-existing dirty tree (shared
curriculum/fullscreen, device-identity/error fixes) was preserved; no reset,
stash, discard or overwrite of another worker's changes. `App.tsx`,
`OfferPage.tsx`, `useLearning.ts`, `routes.ts`, `docker/ide/*` and the
report index/design diffs in the working tree are pre-existing, not mine.

Contract conflicts: none. No contract change was made or is requested. One
integration note for the coordinator: the materials-payload `durationSeconds`
is fetched but not separately displayed — the authorized outline remains the
single duration source for plan labels, so outline and materials durations
cannot disagree in the UI.

## Rule traceability

| Source | Compliance |
| --- | --- |
| `AGENTS.md` / `rules.md` / D01 / D12 | Frontend-only diff; one Express backend preserved; external DRM consumed through its API only; no nested-package edit or persistence access. |
| D09 | Cookies + readable CSRF synchronizer only; caption Blob URLs and the playback token stay in memory; language/theme remain the only browser-storage values. |
| D11 | Search filters the protected outline already returned after authorization; anonymous/unsubscribed refusal unchanged; no public syllabus endpoint. |
| M8/M9 contracts | Finite/indefinite entitlement, publication/deletion protection and required/optional assessment locks untouched and re-verified in the browser flow. |
| `design.md` | FAYQ tokens via CSS variables, Arabic/English RTL/LTR, dark default + light, responsive plan/player, keyboard/focus discipline, native fullscreen with expanded fallback. |
| Owner cleanup rule | Unique `fayq-course-learning-ui-*` names, port `8091` (not `8080`, not the existing `8084` harness), label/mount guards before every removal, only owned resources removed, no global prune. |
| Device-limit diagnosis (`course-video-device-limit-20261004.md`) | Device-identity fix and safe denial categories preserved; playback-denial messages untouched. |

## Docker verification actually run

Test image `fayq-course-learning-ui-test:20261004`
(`sha256:78d9062901da658eebc56d83cab30f4ab73abac30bb42f72e97a8ba42393d5bf`):

```text
docker build -f client/Dockerfile --target test -t fayq-course-learning-ui-test:20261004 .
docker run --rm --network none --label fayq.owner=course-learning-ui-20261004 fayq-course-learning-ui-test:20261004 npm run typecheck
docker run --rm --network none --label fayq.owner=course-learning-ui-20261004 fayq-course-learning-ui-test:20261004 npm test
docker build -f client/Dockerfile --target runtime -t fayq-course-learning-ui-client:20261004 .
```

| Check | Result |
| --- | --- |
| Client typecheck | PASS |
| Client unit suite | 108 PASS (16 files),incl. 6 search + 6 duration + 3 caption-validation tests; pre-existing 93 preserved |
| Production client build | PASS; existing large-chunk advisory unchanged |
| Isolated browser proof | 33/33 PASS (`COURSE_LEARNING_UI_CHECKS=33`), zero uncaught errors |
| Retained preview guard | `preview.mjs check` PASS; `http://127.0.0.1:8080/health/ready` → 200 after all work |

Browser proof (`node docker/course-learning-ui/run.mjs`, port 8091,
disposable Postgres/Redis/server/client/Nginx/grading): English search
narrowing, locked-match disabled state, required-assessment link while
filtering, empty state, clear-restores-browsing, Arabic diacritics-insensitive
matching, no-playback-on-filter, legacy unknown durations (no guessing),
partial/unknown totals, caption Off→Arabic Blob `<track>`, caption controls +
track + watermark inside native fullscreen, fullscreen exit continuity,
bilingual resource row with MIME/size, expiry/inactive renewal-without-leak,
ar-dark + en-light mobile direction/overflow, desktop screenshot.

Screenshots (retained local evidence, git-ignored under the harness evidence
dir; visually confirmed as non-trivial renders):

- `docker/browser/evidence/course-learning-ui/course-learning-ui-en-desktop-dark.png`
- `docker/browser/evidence/course-learning-ui/course-learning-ui-ar-mobile-dark.png`
- `docker/browser/evidence/course-learning-ui/course-learning-ui-en-mobile-light.png`

## Failures found and fixed

1. Flow-script React-state clearing: setting a controlled search input's
   `.value` directly plus an `input` event never reached React state and the
   locked-match step timed out. Fixed with a real keyboard
   select-all + Backspace helper. Verification-setup failure, not an
   application defect.
2. Real application defect — Rules-of-Hooks crash (minified React #310): the
   materials hook was first added after the loading/error early returns, so
   the learning page white-screened once data arrived. Reproduced with a
   temporary disposable-stack probe (debug script + screenshots, since
   removed), then fixed by calling `useLessonMaterials` unconditionally
   before all early returns. Full typecheck, unit suite, rebuilt client image
   and the complete 33-check browser flow pass after the fix.
3. Flow-script playback step: on the learning page, clicking a curriculum row
   starts playback immediately, so waiting for the pre-grant placeholder
   button timed out. Fixed to wait for the mounted player. Script-only issue.

No open application failures remain in the mocked-harness scope.

## Mock-versus-real distinction (read carefully)

The 33 browser checks run against REAL disposable-stack auth, outline,
progress, purchase-gating and admin-session APIs, plus EXPLICIT
TEST-HARNESS-ONLY request-interception mocks for endpoints the real backend
does not serve yet: `GET …/lessons/:id/materials`, `GET …/captions/:id`,
`GET …/resources/:id/download`, `GET /admin/learning/lessons/:id/materials`,
and the playback grant/manifest (the pre-existing explicit UI fixture
pattern). Mocks live only in `course-learning-ui-flow.mjs`; production code
has no mock fallback, fabricates no passes/purchases, and surfaces real
failures (verified: unmocked materials on the real backend render the
error-plus-retry state without breaking playback).

Backend-dependent checks PENDING real-API rerun after agent 1's handoff
(self-report is not acceptance): true outline `durationSeconds` rendering
and complete totals, real caption-pair upload/replace/remove round-trips,
real validation errors (`MATERIAL_*`), real storage-unavailable behavior,
real authenticated caption bytes timing in fullscreen, real protected
downloads (headers, filename, `private, no-store`), and advancing-time
real-video playback. The same UI flow (`run.mjs` with mocks deleted) is the
rerun vehicle. Coordinator: please schedule the combined real-API
integration after both handoffs; the retained port-8080 preview was
deliberately never overwritten by this worker.

## Dependency / configuration impacts

None. No new npm dependencies, no lockfile change, no environment-variable
or configuration additions, no migration, no Nginx/Compose change outside the
new disposable harness. Images
`fayq-course-learning-ui-client:20261004` (79.1 MB) and
`fayq-course-learning-ui-test:20261004` are retained for coordinator reuse.

## Cleanup proof and rollback

Every run verified project labels and resolved mounts before removal and
removed only owned resources. Final state: owned containers 0, networks 0,
volumes 0 (label-filtered counts). The temporary debug probe, its
screenshots and the fixture copy were deleted; harness screenshots/logs are
retained as ignored evidence, not tracked files. Owner preview, DRM/data
containers and volumes, the unrelated container observed on this host, and
all reusable images are preserved; no global prune was used.

Rollback (frontend-only, no data migration involved): rebuild the client
from the pre-change tree or retag the retained
`fayq-platform-client:before-course-device-fix-20261004` /
`fayq-platform-client:before-course-ux-20261004` lineage per the earlier
reports and recreate only `client` + `nginx` on the existing Compose
project/env. No database action is needed.

## Handoff request

Frontend scope is complete and stopped for review. Ask the coordinator to
schedule the combined real-API integration after agent 1's backend handoff,
rerunning `docker/course-learning-ui/run.mjs` with the harness mocks removed
against the real contract endpoints, plus the advancing-time protected-video
and protected-download evidence that belongs to final combined verification.
