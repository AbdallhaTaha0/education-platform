# Lesson creation and deletion UX - 2026-10-09

Owner request: adding a lesson must open the created lesson; deleting a lesson
must be easier. This is a platform frontend workflow change only.

## Changes

- Creation reads the existing server response's `data.lesson.id`. After reload,
  the new lesson becomes selected; search is cleared, its list page is revealed,
  the add form closes, and the lesson editor receives focus and scrolls into view.
- The reusable loaded-list pagination component accepts an optional reveal index.
  Existing consumers retain their default behavior.
- Lesson deletion uses a visible delete button and a named permanent-deletion
  dialog with cancel/confirm instead of requiring UUID transcription. Only the
  explicit confirmation click sends the existing server-derived target identifier.
- Server authorization, confirmation validation, durable deletion, DRM cleanup
  and financial-record retention are unchanged. Course/section confirmation
  forms are unchanged. Failed lesson deletion retains its retry control.

## Verification and Limits

Docker client/server runtime builds passed; the matching local preview images
were refreshed together and the proxy restarted. Full frontend tests passed:
294 Vitest tests across 36 files and 10 Node patch/security tests.

Docker Chromium used isolated synthetic API fixtures, not owner courses:
Arabic desktop (1280px) and English mobile (390px) each created lesson 11 while
search-filtered, selected its editor, revealed list page 2, cleared the filter,
closed the form and moved focus. Escape cancellation issued no deletion request.
Explicit permanent confirmation issued exactly one request with the correct
target confirmation and selected the surviving first lesson afterward. Dialog
screenshots were inspected; evidence is in ignored `docker/browser/evidence/`.

No real authored lessons were created/deleted by tests. No backend/schema/DRM
change, migration, deployment, commit or push. All earlier local edits remain.
Owned containers used `--rm` and label `lesson-ux-test=20261009`; no containers,
volumes or networks remain from these tests. Existing preview/data are preserved.

Rollback is limited to the lesson API wrapper, LessonEditor, lesson-specific
DeletionPanel branch and optional pagination reveal support, followed by matching
Docker image refresh; do not revert unrelated local fixes.
