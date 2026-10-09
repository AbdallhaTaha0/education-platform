# Website Journey Verification Milestone

Latest checkpoint: [persisted-pass repair and verification continuation](persisted-pass-continuation-20261009.md).
Bounded actual Brave verification is complete; the final report separates browser passes, automated checks, fixture preparation and remaining untested features.

Owner assignment: 2026-10-09. Test every available student and admin workflow,
including uploads, moves and edits, on desktop and mobile. Repair evidenced
platform defects, verify real effects, and keep an explicit coverage ledger.
This is a verification workstream, not acceptance of any prior milestone or a
production/capacity certification. The earlier e2e.tester.army setup remains
abandoned; use the existing Docker browser and test tooling.

## Acceptance method

Inventory each screen's links, buttons, tabs, inputs, menus, toggles, dialogs and
conditional controls. Each individual control gets a ledger row containing:
ID, route, role, prerequisite/state, viewport/language, action, expected UI,
expected API/persisted effect, observed result, evidence, issue and retest.
Enumerate controls in empty, populated, loading, invalid, failed, restricted and
successful states, not only the first loaded page. Expand groups below into
individual rows as their screens are exercised; this initial group inventory is
not a claim that every button has already been enumerated or tested.

For mutations, reload and verify the saved effect through supported APIs and UI.
Check duplicate clicks, cancellations, retry, navigation-away cleanup and stale
responses. A toast or HTTP 200 alone is not a pass. Verify visibility/disablement
and server authorization for anonymous, STUDENT and ADMIN independently.

Required matrix: Arabic RTL and English LTR; desktop 1280x900 and 1920x1080;
mobile web 390x844 and 360x800. Check keyboard focus, labels, scrolling, wrapping,
dialogs, overlays, feedback and disabled explanations. This repository exposes a
web app; these checks do not certify nonexistent native Android/iOS applications.

Statuses: NOT RUN, IN PROGRESS, PASS, FAIL, BLOCKED, INTENTIONALLY DISABLED.
Keep real backend end-to-end evidence separate from mocked UI regressions and
unit tests. A feature is complete only after all applicable individual rows and
its persistence/error/authorization checks pass. Record intentionally disabled
features explicitly rather than enabling them to manufacture a pass.

## Execution stages

| Stage | Journey and complete control groups | Initial status |
|---|---|---|
| J01 | Assessment solve, answer selection, draft save, submit, pending, wrong/retry, success, manual Continue, history/pagination | IN PROGRESS |
| J02 | Anonymous home, grade/term filters, catalog search/sort/pagination, course/package offers, FAQ, support, policies, header/footer links, language/theme, mobile dock, not-found/back | NOT RUN |
| J03 | ADMIN course search/filter/switch/create/cover upload-preview-remove, bilingual validation, academic classification, edit/save/cancel, persisted covers | NOT RUN |
| J04 | ADMIN sections/lessons add/edit/move up/down/search/select, pagination, new-item focus, boundary restrictions, delete-dialog cancel/confirm and retry | NOT RUN |
| J05 | ADMIN video choose/register/upload/process/status/reopen/retry/replace/remove, silent and audio sources, oversized/invalid files, expiry/multiple tabs, navigation during upload | NOT RUN |
| J06 | ADMIN course draft/working-copy/publish/archive/restore/lifecycle/deletion; unchanged live version during editing; durable retirement and permissions | NOT RUN |
| J07 | ADMIN assessment add/edit bilingual questions and choices, answer keys, limits, required/optional, draft/publish/version/archive, submissions/history; PROGRAM/IDE feature gates | NOT RUN |
| J08 | ADMIN lesson resources upload/list/rename/download/remove, type/size limits, failure/retry, protected access and translated labels | NOT RUN |
| J09 | ADMIN plans/price/free/duration/term-end, packages/member selection/edit/publish/archive, promotions and availability | NOT RUN |
| J10 | Register/login/logout/profile/security, validation, cookie refresh/concurrency, anonymous redirects, student directory/search/details/devices, session expiry | NOT RUN |
| J11 | STUDENT insufficient-balance to wallet, receiving details, recharge amount/date/reference/proof/submit/status/history; ADMIN filter/review proof/confirm receipt/approve/reject, exactly-once credit | NOT RUN |
| J12 | STUDENT free/paid course/package purchase/confirmation/history, duplicate-click integrity, access dates/expiry, dashboard and resume | NOT RUN |
| J13 | STUDENT protected playback start/pause/seek/rewind/forward/speed/quality/volume/fullscreen, watermark, saved progress, lesson search/previous/next, assessment locks, resources, expiry/device recovery | NOT RUN |
| J14 | ADMIN summary refresh, students/roster/period/course filters, short/detailed parent report generation/preview/WhatsApp handoff, notification read/bulk/pagination/live updates, settings/support/policies saves | NOT RUN |

Execution order starts J01, then authoring/upload J03-J08, followed by the
student consumption and financial journeys; J02/J09/J10/J14 complete the surface
inventory. Discoveries can change priority, not silently remove controls.

## Test data and safety

Use a separately named disposable Docker project and labelled containers,
networks, volumes and synthetic accounts/course/payment fixtures for destructive,
financial, authentication and concurrency journeys. Record resolved mounts and
ownership before cleanup. Clean owned test resources after success, failure or
stop; preserve existing previews, owner courses/accounts/media, credentials,
retained volumes, reusable images and saved evidence. Never global-prune.

Existing A.I.M and owner account are read-only references unless explicitly
assigned a content change. Do not submit student solutions, reset grades or buy
courses on the owner's behalf. No actual transfers, external WhatsApp sends,
production deployment, new exposure/security weakening or nested DRM maintenance
is inferred. Test external handoff URL/preview without sending messages. Consume
DRM through its API; report external defects and seek bounded authorization.

No change to roles, business policies or architecture. Unknown expected behavior
is an owner question, not permission to invent it. No commit/push implied.

## Evidence ledger

Follow [the student/admin A-to-Z sequence](a-to-z.md) for the role-based run.

See [current progress](progress.md). Add reproducible browser regressions for
confirmed fixes. [Rerun the initial checks](runbook.md) with the existing Docker
tooling. Save screenshot/API assertions and failure logs without secrets.
Do not close this milestone until the individual-control inventory is complete,
every applicable matrix row is verified, all functional defects are retested,
and remaining external/disabled limits are clearly acknowledged by the owner.
