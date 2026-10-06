# Admin assessment editor safety — 2026-10-02

The owner approved the proposed question-editing package with “okay do all”: actionable error popups, linked field highlighting, preserved input, unsaved-change warnings, cancellation cleanup, and saved/unsaved status. This package implements those six items. The broader website recommendations remain in the [UX inventory](../../platform-updates/ux-review-20261002/report.md); this is not a redesign of every admin page or milestone acceptance.

## Delivered behavior

- Save identifies missing bilingual titles/instructions, question text, correct-choice selection, invalid typed values, function names, numeric ranges, missing reference/generator code, and invalid planned case totals. Common errors are caught before sending a write. Backend validation remains authoritative.
- The persistent popup names the action and question/field. Its field links open enclosing collapsed sections, scroll to the control and focus it. Inline messages and outlines are associated through `aria-describedby` and `aria-invalid`, without changing the builder's existing grid.
- Changing a field clears obsolete validation feedback. A rejected server save preserves the current question, choices, code and typed input for correction/retry. Controls are inert while the save is pending, preventing competing edits.
- Edited assessment drafts require confirmation before closing the editor, switching assessments, opening submissions, or leaving via hash navigation and browser history. Cancelling that confirmation keeps the draft. Reload/tab-close requests register a native `beforeunload` safeguard; browsers control its wording and whether it is displayed. Drafts are held in memory until saved, with no new browser-storage persistence.
- Confirmed Cancel closes the editor and clears its popup/field errors. Opening a fresh editor starts clean.
- The editor distinguishes a new draft, unsaved changes, saving, and an unchanged saved draft. Successful saving confirms that the draft is on the server. A subsequent list-refresh failure is reported separately from a failed write.

The shared popup from the previous package still covers existing admin action errors. These new field links and draft safeguards apply to the assessment editor; they do not claim unsaved-change protection for every unrelated form.

## Files and preservation

Changed `client/src/App.tsx`, `client/src/features/assessments/AdminAssessmentPanel.tsx`, `ProgramSettings.tsx`, and `client/src/styles.css`; added `client/src/components/ui/UnsavedChanges.tsx` and `client/src/features/assessments/EditorFeedback.tsx`. Expanded `docker/ide/ui-flow.mjs` and linked this report from the documentation index.

Platform HEAD remains `1113aab0519053ecfde5d3204903f0abb3a48c1e`. All earlier transferred/uncommitted changes remain intact. External DRM stays at `bad0c1df9f5d5844fe365c402fcccfee33ab6906` with a clean working tree. No backend/schema changes, grading-policy changes, record conversions, production deployment, capacity spending, commit or push were performed.

## Verification and evidence

- Final Docker client typecheck and production build pass. Existing frontend suite passed **88 tests plus 2 DASH compatibility checks** during this package; it was not repeatedly rerun after UI-only corrections. The final browser run exercises those corrections against the rebuilt image.
- Final isolated Docker Puppeteer/controller flow: **96/96 checks**, including **18 additional assertions** beyond the prior 78-check flow. Checks cover exact field messages, no invalid write, accessible descriptions, focus links, preserved typing, cancelled navigation/discard/Back, registered unload prevention, cancellation cleanup, new/saved/unsaved status, Arabic RTL at a real 390×844 viewport, popup/navigation clearance, failed-save retention and retry. Existing real private preparation, submission/grading, progression, allowance, choice and typed-value flows still pass. No React/browser page errors were reported.
- The failed-save check intercepts one request with a synthetic 503 in the disposable browser, then retries against the real backend. The unload check dispatches a cancellable event to prove guard registration; it is not proof that every browser displays a close/reload dialog.
- Early runs caught a real controlled-input issue: clearing validation in the capture phase reset the typed value before its change handler. Moving feedback clearing to bubbling events fixed it; the final check verifies the complete typed string survives. Test selectors were corrected to exclude inline descriptions from field names, the desktop viewport was made explicit, and the Back check was corrected to pass the same-route entry created by a previously cancelled link. Every completed failed run also cleaned its test project.
- The optional inspection CLI remains unavailable (`Event stream closed` in the earlier review). This run explicitly used the direct browser/controller flow; the CLI is skipped, not reported as passed. Unchanged backend suites were not rerun.
- Visually inspected [English desktop errors](../../platform-updates/admin-editor-safety-20261002/errors-en-desktop.png) and [Arabic mobile errors](../../platform-updates/admin-editor-safety-20261002/errors-ar-mobile.png). The popup can scroll through multiple errors while remaining visible above mobile navigation.

## Local preview and cleanup

The retained preview guard confirmed project `fayq-local-preview`, its two retained volumes and localhost:8080 before refreshing only client/Nginx. Backend, grading controller, PostgreSQL/Redis, owner records, real media and independent DRM were preserved. Final homepage and readiness checks returned HTTP 200.

The test runner verified Compose project labels and resolved mounts before teardown. Project `fayq-m9-ui` ends with **0 containers, 0 networks and 0 volumes**; its synthetic fixture JSON is removed. The transient frontend test container was automatically removed. Sanitized logs remain in ignored `docker/browser/evidence/m9`; the two selected screenshots above are retained for review. No global Docker prune was used.

There is no blocker to reviewing this package at http://localhost:8080. Work remains uncommitted pending explicit owner milestone acceptance. The next proposed bounded UX package is the focused course-editor workflow from the inventory; it has not been silently implemented here.
