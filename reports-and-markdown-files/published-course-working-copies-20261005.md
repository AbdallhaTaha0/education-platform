# Published course working copies and video replacement

Date: 2026-10-05. Status: implementation verified in isolated Docker and serving the retained local preview on port 8080. The owner subsequently explicitly authorized commit and push; this report accompanies the platform delivery commit. No nested DRM changes are included.

## Owner requirements

Creating an editing draft keeps the previous published version available. Publishing the validated draft replaces that version atomically. Removing a draft video's attachment requires a ready replacement before publication. The owner authorized permanent deletion of unused superseded videos after published references and active playback no longer require them.

This supersedes [the historical in-place return-to-draft change](published-course-return-to-draft-20261005.md). It does not change subscription expiry, payment policies, DRM deployment, capacity approval or milestone acceptance.

## Implementation

The canonical course stays PUBLISHED. It points to one hidden working copy; repeated/concurrent requests reuse that copy. The copy contains editable bilingual metadata, plans, ordered sections/lessons and assessments. Existing video objects are referenced, not duplicated. Admin course tabs open the active draft, with explicit links to the published version. Live editors are blocked while the copy exists. A subsequent owner clarification restricts the create/open-draft action to published canonical courses and removes the earlier PROCESSING/READY reopen exception; no draft can create another draft.

Publication revalidates the complete hierarchy and media readiness, then merges under the canonical course lock and one transaction. Existing course, section, lesson, plan and assessment IDs remain stable. Purchases, subscription dates, progress, passes and immutable assessment history remain. Removed lessons and previous content are retained privately until permanent course deletion; they are not public courses. A failed publication leaves the live version unchanged. First-publication evidence is retained and the editing cycle does not issue another first-publication notification.

The lesson editor offers a confirmed Remove/replace video action. Removing inherited media changes only the working copy. New draft uploads are independent; publication is blocked when a retained lesson lacks a READY replacement. Unknown registration outcomes must be resolved before removal, avoiding orphaned assets. Unsaved editor and in-flight upload protections remain.

On publication, replaced mappings become retired records in hidden history. A bounded replica-leased reconciler checks inherited references and durable playback references before calling the existing DRM session-revocation and deletion APIs. Unknown active-session expiry fails closed. Still-active sessions retain their video; ended/expired references must have confirmed closure. Operation IDs, retries and retry timestamps survive restart. Completion removes the mapping; failed/missing deletion-operation lookups retry rather than claiming the media is gone. Playback admission is serialized with retirement, and a stale never-returned grant is revoked through the API.

Inherited captions and protected resources are visible in the draft with a retained/read-only label. New resources can be added; a new caption pair replaces the old pair only at publication. Whole-course permanent deletion includes linked drafts/history and their media. Platform code never queries DRM persistence; the nested package remains unchanged.

## Schema and affected areas

Additive migration `20261005180000_course_working_copies` adds course revision ownership/working-copy/history fields, trusted origin pointers, inherited media references, durable retirement fields and supporting indexes. Existing rows receive safe defaults; migration does not rewrite business content or course states.

Platform changes cover catalog revision/lifecycle/locking/deletion services, media removal and retirement, assessment/material mutation guards, playback admission, admin navigation/forms/media controls, integration/browser regressions, and guarded local verification/upgrade tools.

## Verification completed

- Fresh isolated PostgreSQL/Redis/DRM-fixture suite: **187/187 checks, 21/21 files PASS**. Includes catalog mutations/lifecycle/deletion, entitlement and playback, purchase/progress preservation, seven working-copy integration scenarios, concurrency, replacement, active-session retirement protection, assessment history and atomic slug-conflict rollback.
- Real Docker Chromium admin flow: **45 checks PASS**, including working-copy creation/reuse/navigation, published version retention, draft editing, republishing, remove-video confirmation, publication refusal without replacement and draft discard without deleting live media.
- Server/client/migrate images build successfully; frontend build and Prisma generation pass. Wrapper syntax and diff whitespace checks pass.
- Dedicated real PostgreSQL/Redis/private MinIO environment: **271/271 server unit tests and 76/76 integration tests PASS**, plus server typecheck and repeated migration deploy. The additional working-copy materials regression verifies inherited captions/resources, unchanged live bytes while editing, publication-time caption replacement and retention of original plus newly added files.
- Isolated main test project cleanup: **containers=0, networks=0, volumes=0**. No owner course/video/user/payment test mutations.

This is local contract/fixture evidence, not a new live R2 lifecycle, production release or 10,000-user certification. Existing frontend-workspace tests are recorded separately in the preceding report.

## Failures and remaining verification

A publication test found negative temporary positions violated existing database constraints; staging now uses positive positions and the final suite passes. Running the materials suite in the catalog environment was correctly refused by its isolation guard; its dedicated PostgreSQL/Redis/MinIO environment is required. The local pinned MinIO fixture image was missing. During its rebuild Docker storage became read-only and containerd crashed. A first restart left a WSL already-attached disk condition; stopping Docker and terminating only its Docker WSL instance restored normal startup. No volumes were deleted/reset. The engine reported 29.8.2 after recovery (earlier checks used 29.8.1). Fixture compilation concurrency was limited to two jobs; the pinned fixture built successfully and the full materials run passed. Owned test cleanup verified **zero containers/networks/volumes**, including all three mounted volumes absent. Retained platform dependencies and DRM services were restarted with their existing images and volume attachments.

## Local preview and rollback

New serving artifacts are built under distinct `fayq-course-revisions-*:20261005` tags. The guarded preview upgrader takes a protected ignored binary database backup, stops writers, fingerprints **18** existing business tables excluding new additive fields, applies migration, verifies identical retained records and reached-lesson records, then starts the verified frontend/backend and refreshes Nginx. It neither removes volumes nor mutates owner course content. Backup and previous image tags are retained for recovery; additive columns should stay in place when rolling back serving images. Do not restore a database or remove history automatically.

Runtime upgrade: **PASS**. Protected ignored backup: `docker/browser/evidence/m9/preview-before-course-revisions-1791228466058.dump`; evidence: `preview-course-revisions-upgrade.json`. Migration applied once; all **18** retained business-table fingerprints and reached-lesson records remained unchanged. Server/client/grading/Nginx are healthy, platform live/ready and DRM health all return 200. A transient Docker Chromium smoke check rendered the login page with zero page errors; its container was auto-removed. No owner course was edited for verification.

Actual serving image IDs after Docker recovery:

| Artifact | Image ID |
| --- | --- |
| Server | `e3dbb9bc2626522fad889937100ecbd6a30675f8757f9257b9ca1ec3878ccda6` |
| Client | `79064756a96897b2996ebcf092de126c02d2d26d20201036881185d723e20358` |
| Migrate | `db8620d83550ad13f4f139a26621e48d5359e23814d6f87a8b13be2b1deb9cb7` |

Canonical serving aliases point at the verified `fayq-course-revisions-server/client/migrate:20261005` artifacts. Previous artifacts remain as `fayq-platform-server/client/migrate:before-course-revisions-20261005`. Runtime revision/retirement modules and completed migration were inspected directly. Nested DRM stays clean at `dd66be3`.

Read-only follow-up found **one canonical course already in DRAFT with first-publication history**, created under the preceding in-place workflow. Its content/status was deliberately preserved. That historical workflow did not save a separate last-published snapshot, so migration cannot reconstruct one or safely publish potentially unfinished edits. The owner should publish that existing draft once to establish the live baseline; subsequent editing uses the new working-copy workflow. No automatic restoration or invented historical content was performed.

## Owner follow-up: draft creation only from published courses

After delivery commit `9ef5f08`, the owner requested removing draft creation from other drafts. The UI now explicitly requires PUBLISHED for the create/open-draft action. The lifecycle API no longer enables or implements PROCESSING/READY working-copy reopening. The working-copy helper independently rejects non-published, revision-owned or historical inputs. Repeated published-root requests retain the existing idempotent one-copy behavior; no existing copies/content are removed.

Fresh Docker verification: **188/188 backend checks across 21 files and 48/48 browser checks PASS**, including DRAFT/PROCESSING/READY API rejection, unchanged states, zero nested revisions, hidden action in each preparation state, root reuse and successful draft publication. Owned test cleanup: **zero containers/networks/volumes**. Backend/frontend images rebuilt and port 8080 refreshed through the retained-volume guard, without new schema changes or nested DRM edits. The owner subsequently explicitly authorized committing and pushing this follow-up; this evidence accompanies its delivery commit.

Docker builds left the host C drive with approximately **55 MB free**. Only the task-owned 2.445 GB MinIO compiler cache record `wbcn8oaoo2btgm9zwcmhi2yv6` was removed, using an [exact-ID Buildx filter](https://docs.docker.com/reference/cli/docker/buildx/prune/); MinIO/test/serving and rollback images and all retained volumes were preserved. This reclaimed space inside Docker but did not compact its Windows virtual disk. Further host disk reclamation is a separate maintenance action, not represented as completed by this feature correction.
