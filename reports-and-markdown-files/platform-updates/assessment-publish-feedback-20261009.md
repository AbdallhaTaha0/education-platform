# Assessment publish feedback - 2026-10-09

Owner reported that clicking publish revision appeared to do nothing. Sanitized
local logs show six successful publish requests; the screenshot already showed
PUBLISHED, revision 6. Publication was working, but the UI had no action success
feedback and the unchanged row invited repeated publication.

## Scoped Repair

`client/src/features/assessments/AdminAssessmentPanel.tsx` now uses the publish
response immediately to update the displayed revision/status, shows a success
toast and row-local message naming the revision, and clears stale draft-save
feedback. A failed list reload after successful publication is reported as a
refresh problem, not a failed publication. Rejected mutations show row-local
errors as well as the existing error feedback.

For non-PROGRAM publishing, the confirmed content/requirement/kind snapshot
disables same-page repeated publication until saved draft changes differ.
This is UI repeat protection, not server idempotency: a page reload clears the
snapshot and direct API calls retain the existing version creation behavior.
Archive/republish remains possible. No historic versions were removed or edited.
Existing PROGRAM preparation/review guards and backend policy are unchanged.

## Verification

Docker client/server runtime builds passed and the matching preview images
were refreshed; proxy restarted. Full frontend suite: 294 Vitest tests across
36 files plus 10 Node security/build-tool patch tests passed.

Docker Chromium with synthetic fixtures verified Arabic desktop success,
one publish request despite another click, a new saved draft re-enabling publish,
English mobile successful publication followed by failed reload, and rejected
publication retaining its prior version with visible error and retry availability.
Screenshots in ignored `docker/browser/evidence/` were inspected. Real owner
assessments were not mutated by verification. All owned test containers used
`--rm` with `assessment-feedback-test=20261009`; none remain. No test volumes or
networks were created. No migration, DRM edit, deployment, commit or push.

Rollback is limited to this panel change and a matching Docker preview rebuild;
preserve all earlier local fixes and retained data.
