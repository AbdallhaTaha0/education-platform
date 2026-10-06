# Published course editing — return to draft

**Historical, superseded on the same date:** the owner subsequently required the previous published version to remain available during editing. See [the working-copy implementation](published-course-working-copies-20261005.md). The in-place hiding behavior described below is no longer the intended workflow.

Date: 2026-10-05. Owner request: fix inability to make a published course a draft for editing.

## Cause and correction

The platform enforced a forward-only lifecycle (`DRAFT → PROCESSING → READY → PUBLISHED`). Its transition validator rejected `PUBLISHED → DRAFT`, and the dashboard exposed no return action. This was a missing workflow, rather than a disabled form or stale image.

The ADMIN transition API now permits the specifically requested `PUBLISHED → DRAFT`. It runs inside the existing course lock and transaction, clears current `publishedAt`, retains `firstPublicationAt`, and records a sanitized `COURSE_TRANSITION` audit. Pending deletion and archive restrictions still apply; other backward transitions and direct draft publication remain rejected.

The course's **Publish, archive & delete** tab now shows **Return to draft for editing** / **إعادة الكورس إلى مسودة للتعديل**. A bilingual confirmation explains that the course is hidden from the public catalog and students cannot open its lessons until it is republished. Purchases, subscription expiry dates, progress and video references remain intact. Expiry dates are not paused or extended. Draft-only structural editing then becomes available through the existing controls.

Republishing follows the full original lifecycle and revalidates translations, offers, hierarchy and media readiness. Retaining first-publication evidence prevents this editing cycle from becoming a new first publication. No video reupload is required when the existing media remains READY.

The external DRM package and its existing session/token behavior are unchanged. This work verifies catalog/outline visibility and restored access after republishing; it does not claim immediate interruption of an already issued DRM playback session.

## Files

- `server/src/modules/catalog/validation.ts`: allow the requested transition.
- `server/src/modules/catalog/lifecycle/policy.ts`: accept/advertise DRAFT for a published course.
- `server/src/modules/catalog/lifecycle/service.ts`: transactional draft state and audit.
- `client/src/features/catalog/types/models.ts` and `pages/LifecycleControls.tsx`: typed action and confirmation.
- `server/tests/unit/catalog-validation.test.ts`: updated lifecycle matrix.
- New `server/tests/integration/catalog-draft-return.test.ts`: access/preservation, concurrency/role, archive/deletion tests.
- `docker/ide/catalog-editor-flow.mjs`: real confirmation, cancel, draft editing and republishing checks.

No schema, migration, configuration, role or dependency change. The preceding course-workspace UX and review-report changes remain preserved in the working tree.

## Docker verification

| Check | Result |
| --- | --- |
| Backend and frontend serving image builds | PASS |
| Catalog lifecycle/validation unit tests | 9/9 PASS |
| Full catalog integration suite, real disposable PostgreSQL/Redis | 64/64 PASS, including 3 new draft-return cases |
| Catalog editor browser flow | 41/41 PASS, including 5 new workflow checks |
| Local root/readiness | 200/200 |
| Served browser bundle contains the new action | PASS |
| Disposable cleanup | 0 containers, 0 networks, 0 volumes |
| Diff whitespace and browser-harness syntax | PASS |

New integration evidence proves unchanged purchase, subscription, progress and media rows across draft/edit/republish; unchanged first-publication timestamp; public/outline denial while draft and restored subscribed outline access after publication; one concurrent winner; student denial; repeated-transition rejection; archived and pending-deletion gates.

The existing guarded Docker runner reproduces the integration/browser checks:

```text
node docker/ide/modes-verify.mjs --catalog-only
```

All fixtures are synthetic in the disposable project. No owner course was moved to draft or republished for testing. No real video operation was performed. Logs remain in the ignored browser evidence directory.

## Local delivery and rollback

Available at `http://localhost:8080/#/admin/catalog`. Open a published course, select **Publish, archive & delete**, choose **Return to draft for editing**, confirm, and return to **Sections & lessons** or **Edit course details**.

The retained-project ownership/volume guard passed. Only server, frontend and Nginx proxy were recreated; no migration or data-service command ran. PostgreSQL, Redis and grading container identities remain unchanged. The independent DRM sources remain clean and its services were untouched.

Serving images:

- `fayq-course-draft-server:20261005`: `55d891e80d986b1233a8aa9953fa72acdc4a2927094785aef6c5e61645294ff3`.
- `fayq-course-draft-client:20261005`: `b777247c51f561a3b6fcb8a09942980969542e235063c35587656de34a8c8bf9`.

They are also tagged under the retained serving aliases. Rollback aliases are `fayq-platform-server:before-draft-return-20261005` and `fayq-platform-client:before-draft-return-20261005`. Restore both serving aliases and recreate only server/client/proxy with the same guarded retained-preview configuration if needed. Rolling back code does not change a course already returned to DRAFT; it can still be republished through the forward lifecycle.

No production deployment, milestone acceptance, commit or push performed.
