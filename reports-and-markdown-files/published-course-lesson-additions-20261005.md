# Published-course lesson additions — 2026-10-05

The owner explicitly approved allowing ADMIN to add lessons to published courses after reviewing the disabled Add lesson control. This supersedes the draft-only addition restriction described in the earlier catalog editor report.

## Delivered behavior

ADMIN can append bilingual lessons to an existing section of a PUBLISHED course, register their video through the external DRM API, complete the upload, and synchronize processing status. The course remains PUBLISHED and existing lesson IDs, positions, subscriptions and playback remain intact. New media remains unplayable until READY and must pass the existing entitlement and assessment progression checks.

The existing per-course transactional lock serializes additions. An explicit insertion before existing lessons still requires DRAFT because it changes existing order. Rename, reorder and section-edit permissions remain unchanged. Initial uploads and incomplete-upload retries are permitted; existing media replacement remains rejected. Archived courses and pending deletions remain blocked, and PROCESSING/READY retain their previous edit restrictions. ADMIN authorization, CSRF/origin checks, audit records and required Arabic/English titles remain enforced.

Frontend creation and upload controls use the same bounded state rule. Other structural controls keep their own draft restriction. Arabic/English explanations now distinguish additions from those other edits.

No schema migration, API shape change, configuration change or DRM source edit was needed. This uses the existing one-Express backend and external DRM API boundary.

## Docker verification

- Backend build and source/test typechecks passed; 271 backend unit tests passed.
- Frontend build/typecheck passed; 173 frontend tests and two DASH compatibility checks passed.
- All 13 catalog integration files passed: **61 tests**, including eight new published-addition regressions.
- Real browser: **37 checks passed**, including published-course Add lesson through the actual form/API, enabled new-lesson video upload controls, Arabic mobile layout, and the previous course editor CRUD/archive/deletion sequence. No browser runtime errors.
- New integration coverage drives real API registration/completion/sync against the explicitly labeled HTTP DRM test fixture. It verifies existing subscriber playback while the new lesson is unready, refusal of unready playback, successful playback after READY, refusal of replacement, audit logging, concurrent append ordering, authorization/CSRF/bilingual validation and lifecycle/deletion guards. This is platform contract coverage, not a new qualification of actual external video processing/browser playback.
- Disposable test containers, network and volumes were verified absent by the guarded runner after completion.
- Temporary test image tags were removed after verifying no container used them. The previously approved cache cleanup reclaimed 1.073 GB from this verification run; build cache is zero. Retained runtime/rollback images and data volumes remain intact.

Commands run from the repository root included:

```text
docker build -f docker/browser/evidence/disk-cleanup/server-test.Dockerfile -t fayq-editor-server-test:20261005 -t fayq-ide-modes-server:test .
docker run --rm fayq-editor-server-test:20261005 npm run typecheck
docker run --rm fayq-editor-server-test:20261005 npm run test:unit
docker build -f client/Dockerfile -t fayq-platform-client:0.9.0-m9 .
docker build -f client/Dockerfile --target test -t fayq-catalog-client-test:20261005 .
docker run --rm fayq-catalog-client-test:20261005
node docker/ide/modes-verify.mjs --catalog-only
node docker/local-preview.mjs check
```

The ignored local runtime Dockerfile copies the verified compiled backend into the existing production-shaped runtime, retaining its dependencies, user and entry point. Only server/client and the proxy were refreshed locally, with no dependency recreation or database migration. Readiness and root page returned HTTP 200.

## Files and rollback

Changed platform source: catalog course guards, lesson creation, media intent/completion checks; frontend editability helper, AdminDetailPage, LessonEditor and bilingual messages. Regression coverage is in `catalog-published-additions.test.ts`, `editability.test.ts` and the existing isolated catalog browser flow. The decision register records the owner clarification. Earlier unrelated local edits remain preserved.

Previous local runtime images are retained as `fayq-platform-server:before-published-additions-20261005` and `fayq-platform-client:before-published-additions-20261005`. To roll back, retag those images to the normal local runtime tags and refresh server/client/proxy with the same retained compose configuration. No database rollback is needed.

No commit, push, production deployment, nested DRM maintenance, capacity certification or milestone acceptance was performed. Docker disk compaction remains subject to the previously reported Windows elevation limitation.

## Subsequent owner UI clarification

Later in the same conversation, the owner requested removal of the pictured captions and lesson files section. The course editor no longer renders that panel, and the workspace description no longer advertises file uploads. This is a frontend removal; existing saved captions/files and backend storage are preserved. The obsolete material-panel check was removed from the catalog browser flow. The frontend Docker build/typecheck passed for this follow-up; the 37-check browser result above precedes this panel removal.
