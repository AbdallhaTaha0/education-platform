# Assessment save validation — 2026-10-05

The owner requested a fix after the assessment editor showed a generic draft-save error, an inline required-field warning, and an English browser validation popup for an unanswered required/optional dropdown.

The editor now presents two visible choices, Required and Optional, with Arabic/English explanations of the progression effect. New assessments retain an explicit choice rather than silently selecting a policy. Existing drafts continue to load their saved choice. An unanswered choice produces one specific inline warning and receives focus, preserving all entered content. Client validation no longer emits the duplicate generic error toast; server failures continue to use the existing error feedback. Save is an explicit button action, and native invalid popups are suppressed within the editor.

No backend, schema, grading or progression-policy change was made. The captions/files panel remains removed as separately requested.

Docker frontend build/typecheck passed. The real-browser regression passed **11 checks** covering Arabic/English choices, no silent default, no invalid save request, preservation of entered values, one localized inline warning without a generic toast, focus recovery, actual successful Optional and Required saves with the chosen boolean persisted by the server, and no browser runtime errors. Only isolated synthetic courses/admins were used. The existing guarded runner verified no owned containers, networks or volumes remained after success or the initial harness failure. Evidence is retained in the ignored local Docker browser evidence directory.

Commands included the frontend Docker build and `node docker/ide/modes-verify.mjs --assessment-save-only --browser-only`. The local frontend/proxy were refreshed without database migration; root page and readiness returned 200. Temporary test images and unused build cache are removed after checking image usage. Owner data, unrelated local edits and external DRM remain preserved; no commit, push or deployment was performed.
