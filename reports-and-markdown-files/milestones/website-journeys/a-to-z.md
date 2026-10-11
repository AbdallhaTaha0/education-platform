Latest delivery authority: [owner-requested commit/push](delivery-20261010.md). Earlier uncommitted/no-push statements below describe their historical checkpoints. Remaining verification and credential handoff are unchanged.

# Student and Admin A-to-Z Journeys

Owner request: 2026-10-09. English communication; run the local website and
exercise real controls, not just describe them. Existing-data navigation is
authorized; uploads remain deferred by the earlier clarification. Record every
control in progress.md, including persistence, focus, loading/error feedback and
desktop/mobile Arabic/English results. This document is the execution sequence,
not a completed-test claim.

## Student Journey

| Step | Actions | Required outcome |
|---|---|---|
| S01 | Home, grade selector, course links, FAQ, support, policies | Real destinations; accurate course information; no fabricated content |
| S02 | Catalog search, grade/year/term/type filters, clear, pagination | Correct counts/results; clear restores initial state |
| S03 | Course and package details; language switch and browser Back | Same selected offer preserved; correct price and access dates |
| S04 | Register/login, invalid inputs, protected-page redirect | Specific errors; cookie authentication; intended destination restored |
| S05 | Account overview/profile and saved-field validation | Persisted edits; sensitive credentials entered by owner only |
| S06 | Insufficient balance and wallet navigation | Cannot debit unavailable funds; payment destination/instructions visible |
| S07 | Wallet instructions/copy, recharge form/cancel/history | Correct details; cancel makes no request; receipt upload deferred |
| S08 | Free/paid course/package review and enrollment | Exactly-once access/debit; synthetic isolated financial tests only |
| S09 | Receipt/history and dashboard Resume | Correct entitlement, dates, progress and selected lesson |
| S10 | Start/pause/seek/rewind/forward; speed/quality/volume | Real video effect, bounded seeking, clear unavailable-state feedback |
| S11 | Fullscreen, exit/Escape, watermark | Entire protected player included; controls accessible; no overlap |
| S12 | Curriculum search, section expand, previous/next | Correct ordering/disabled boundaries; URL and refresh agree with selection |
| S13 | Optional/required assessment: choices, unanswered submit, draft | Specific question errors; saved draft; no unanswered graded submission |
| S14 | Wrong attempt/retry, correct attempt, manual Continue | Honest feedback; no timer redirect; correct lesson destination |
| S15 | Attempt history/pagination and lesson materials | Accurate history; protected files; no extra data exposed |
| S16 | Notifications, unread filter, read/unread, refresh/deep links | Persisted counts; correct destination; reversible checks restored |
| S17 | Expired access, session expiry, logout and protected reload | Backend denies expired/anonymous access; usable recovery guidance |

## Admin Journey

| Step | Actions | Required outcome |
|---|---|---|
| A01 | Admin login, overview navigation/refresh | ADMIN-only access; real summary totals |
| A02 | Catalog search/filter and course selection | Correct results, status and currently selected course |
| A03 | Create form and bilingual/slug/academic validation, cancel | Field-specific errors, retained values; no unintended writes |
| A04 | Existing course editor, working-copy opening | Published course remains intact; one editing draft |
| A05 | Course name/description/classification edit/save/reopen | Persisted values; correct student-facing version |
| A06 | Add/edit sections and lessons | New item selected/focused; correct order and pagination |
| A07 | Move lesson/section up/down, first/last boundary | Persisted ordering; boundary disabled with explanation |
| A08 | Delete dialog and cancel | Named target; cancel preserves records; owner-data deletion not executed |
| A09 | Existing video status, sync/retry controls | No overlapping requests or endless spinner; truthful terminal state |
| A10 | Quiz authoring, multiple questions/choices, correct keys | Bilingual required fields; clear invalid-question feedback |
| A11 | Quiz draft/publish/edit/version/submissions | Published change takes real effect; unchanged publish explained |
| A12 | Lesson resource list/rename/download controls | Protected access, clear filenames; uploads/removals deferred |
| A13 | Plans/free price/duration/end date and packages | Accurate EGP/access terms and course membership |
| A14 | Course publish/archive/restore states | Live/draft separation; guarded synthetic lifecycle tests |
| A15 | Recharge filters, review proof, confirmation, cancel | Viewport-safe review; actual receipt verification required; no real credit |
| A16 | Synthetic approve/reject, duplicate-click/concurrency | Exactly-once credit; immutable review/history evidence |
| A17 | Student search/detail/roster and devices | Correct access boundaries; no credential, role or device-access changes |
| A18 | Reports: period/course filters, short/detailed preview | Honest incomplete coverage; no external WhatsApp sending |
| A19 | Notifications, support/settings validation and cancel | Persisted authorized edits; errors identify fields |
| A20 | Logout and unauthorized student/anonymous admin access | UI and server enforce role; no protected information leaked |

## Execution Gates

Use existing records for read-only and clearly reversible checks. Account
creation, grading submissions, deletion, payment integrity, access expiry and
concurrency need synthetic accounts/data in the owned disposable Docker project.
Restore reversible preferences and record any draft/progress change. Never
change the owner's credentials or bypass a browser access block.

Repeat applicable controls at 1280x900, 1920x1080, 390x844 and 360x800, in Arabic
and English. Validate actual viewport dimensions, rather than assuming an
override was applied. Test keyboard focus, wrapping, overlay scrolling and
confirmation/cancellation. Web responsive checks are not native-app certification.

Current gate (latest continuation, 2026-10-09): the connected Brave extension
successfully inspected and operated the existing localhost:8080 tab. Chrome is
not connected and native desktop controls are disabled. No alternate hostname,
port, browser, permission change or automation bypass was used. Earlier saved
permission blocks remain historical evidence. The complete journey is IN PROGRESS,
not PASS; actual-control checks and their limits are recorded in progress.md.

## Source-Level Repair Progress

| Journey steps | Work completed | Verification boundary |
|---|---|---|
| S03 | Language-switch destination preserves active public course/package | Four URL-helper regressions; actual hash A.I.M course link preserved on English-to-Arabic switch |
| S12 | Selected playable lesson reflected in the URL without restarting the player | Five URL-helper regressions; actual previous/next, refresh of both lessons and language switch preserve selection |
| S13 | Unanswered choice preflight, named error, focused question and inline accessible feedback | Six helper regressions; actual empty and partial validation, eight exact bilingual responsive cases; zero submissions before synthetic graded attempts |
| S14/S15 | Saved-pass feedback and manual Continue recover without reconstructing grading results; practice retries retained | Implemented in source; Docker checks recorded in persisted-pass-continuation-20261009.md; actual Brave refresh/language/focus/history journey remains pending |
| Student/admin page rendering | Page error boundary keeps header/footer and provides manual reload with unsaved-change warning | Three rendering/unit checks; actual bounded wallet-module failure and manual recovery passed in both languages, with eight responsive checks |
| A09 | READY video registration explains replacement/draft requirements | Actual Arabic/English existing-video state inspected; no upload or replacement performed |
| A15 | Completed recharge reviews show the immutable decision without approve/reject controls | Eight Arabic/English responsive read-only review checks; no financial decision submitted |
| S10 | Volume adjustment available through compact playback settings | Four actual 360/390px Arabic/English checks: mute, 5%, and restore 100%; desktop inline control retained |
| Student/admin destinations | 35 route mapping/identity/resume checks | Route contract only; not authorization or persisted CRUD evidence |

Latest continuation: 347 Vitest checks plus 10 Node checks (357 total), passed
again. TypeScript and matching client/server SSR image builds passed. Repairs
remain uncommitted/unpushed and are now applied to the retained local preview.
See progress.md for actual browser checks; these results do not mark complete
end-to-end steps PASS.

## Final bounded continuation

See [persisted-pass final evidence](persisted-pass-continuation-20261009.md) for
actual Brave coverage, automated passes and remaining controls. Two roles were
sequential in the connected profile; viewport matrices are scenario-specific.
Synthetic authoring/purchases/expiry checks do not qualify real playback,
uploads, bank receipt approval or external delivery. The broader sequence above
remains an inventory, not a blanket pass claim.

## Current continuation — 2026-10-10

Use [the latest UX continuation](ux-continuation-20261010.md) before resuming.
A06 section creation focus and selected A15 rejection validation have actual
eight-case matrices; Admin panel navigation has 56 layout/control cases.
A13 duration-offer creation is partially verified; package authoring and other
offer modes remain. A19 support controls are partial. S04 registration and S17
actual retests of the new expiry/login guidance are still pending. This does not
replace the earlier delivered coverage or qualify other controls in these groups.

Reconnect the same authorized Brave browser after its dialog/connection stall;
no permission bypass or fallback browser. The disposable Docker stack was cleaned
and a local ignored synthetic dump saved. Recreate/restore only inspected isolated
resources, preserving owner preview. Browser viewport/tab cleanup was not confirmed.
New repairs are uncommitted/unpushed and require explicit delivery authorization.


## Resumed browser checkpoint — 2026-10-10

[Latest resumed evidence and handoff](resumed-browser-20261010.md) supersedes the preceding current interruption/pending statements. Expiry/session guidance, draft package authoring and four offer modes now have bounded actual evidence. Final Docker client total is 391 plus TypeScript and matching runtime builds. Registration awaits owner credential-entry handoff; other controls remain partial. Owned test stack remains running for that handoff, owner preview preserved. New work uncommitted/unpushed; no full-site completion or acceptance.
