Latest delivery authority: [owner-requested commit/push](delivery-20261010.md). Earlier uncommitted/no-push statements below describe their historical checkpoints. Remaining verification and credential handoff are unchanged.

# Website Journey Progress

## Persisted-pass continuation — current delivery

Verified honest persisted-pass feedback and manual Continue from dev 13303d6.
Actual Brave required/optional fresh and restored passes, saved answers, focus,
manual destinations and history passed in Arabic/English at measured 1280x900,
1920x1080, 390x844 and 360x800. Authoring, revision retention, synthetic paid/free/
package enrollment, ledger reconciliation, expiry/session recovery and role checks
have bounded actual-control evidence. Automated checks: 357 client, TypeScript,
109 backend and 48 mocked UI cases; current Docker builds passed.

Owner data and nested DRM differences preserved. Isolated environments cleaned;
final synthetic backup retained locally. Two Brave tabs shared profile cookies,
so Admin/Student roles were sequential. Remaining UX findings and untested uploads,
real playback, receipt approval, creation and messaging flows are explicitly listed
in [the final evidence report](persisted-pass-continuation-20261009.md).
This supersedes the earlier connection block and supplements historical rows below;
it does not mark all website journeys complete or accept a milestone.

## J01: Manual assessment handoff

2026-10-09 owner clarification supersedes the three-second automatic redirect.
Successful results must stay visible until the student clicks Continue.

| ID | Control/state | Expected effect | Status/evidence |
|---|---|---|---|
| J01-01 | Correct answer result | Inline bilingual success, focused/scrolled into view; no timed navigation | PASS, mocked UI matrix |
| J01-02 | Continue after success | Navigate only on click; retain course, lesson and resume query | PASS, mocked UI matrix |
| J01-03 | Submit during successful result | Disabled; no duplicate submission | PASS, mocked UI matrix |
| J01-04 | Incorrect result | Stay on assessment; retry enabled; no Continue | PASS, mocked UI matrix |
| J01-05 | Leave success page | No late return to lesson | PASS, mocked UI matrix |
| J01-06 | Draft save, pending, history, pagination, required locks | Real supported API effects and error/retry behavior | NOT RUN |

Regression: docker/browser/assessment-manual-handoff.cjs. Its intercepted API
responses qualify UI behavior only, not real grading or progression. Real
isolated-backend grading/progression checks remain pending.
The complete mocked UI matrix subsequently passed 32 scenarios: four cases in
each Arabic/English and 1280x900, 1920x1080, 390x844, 360x800 combination.
Success remained on the assessment for at least 6500 ms until an explicit click.
Screenshots were inspected for narrow Arabic and English layouts. No horizontal
overflow was observed in these result screens.

The first expanded run clicked during smooth result scrolling and timed out.
A focused diagnostic passed; the harness now verifies button position and hit
target are stable before clicking. The complete rerun passed without an app
change for this harness issue. This does not qualify actual backend grading.

## Prior evidence to revisit

The local A.I.M authoring task separately verified save, publish version 8,
reopen persistence, six questions and bilingual choices through the real admin
UI. See platform-updates/aim-practice-questions-20261009.md. It is not blanket
coverage of J07 or evidence of all user journeys passing.

## Next execution batch

Create the isolated journey fixture environment, enumerate individual controls
for J03-J05, then exercise create/edit/move and a real video upload through the
supported API boundary. Do not run those mutations on the retained owner course.

## J02: First real-backend read-only batch

Docker Chromium ran against the retained local preview without mocked API
responses or owner-data mutations. Both Arabic and English passed at 1280x900
and 390x844. This is partial J02 coverage, not full-site acceptance.

| ID | Action and observed effect | Result |
|---|---|---|
| J02-01 | Home renders, correct RTL/LTR document direction | PASS in this batch |
| J02-02 | Theme button changes theme; preference survives reload | PASS in this batch |
| J02-03 | Each of four FAQ controls opens and closes its answer | PASS in this batch |
| J02-04 | Real public catalog endpoint returns six published courses | PASS in this batch |
| J02-05 | First/second secondary filters produce matching course titles and counts | PASS in this batch |
| J02-06 | Nonmatching search produces zero cards | PASS in this batch |
| J02-07 | Clear search/filters empties search and restores courses | PASS in this batch |
| J02-08 | Course offer button navigates to a real titled offer | PASS in this batch |
| J02-09 | Catalog horizontal overflow and uncaught page errors | None observed in this batch |
| J02-10 | Other links, remaining filters/options, pagination, mobile dock, restricted/error states, all sizes | NOT RUN |

Regression: docker/browser/public-journey-smoke.cjs. Screenshots and offer-control
inventory JSON are under ignored docker/browser/evidence/journey-*. Its theme
selector initially assumed a switch role; corrected to the actual pressed button
before the passing rerun. This was a test-harness correction, not an app defect.

## Local build and suite

Matching client/server runtime builds passed. The full client suite passed 294
Vitest tests across 36 files plus 10 Node patch tests. The local preview was
refreshed; no schema or configuration migration was required.

All containers labelled website-journey-test=20261009 were absent at the final
cleanup check. No test network or volume was created; existing local preview,
owner records and ignored screenshot/JSON evidence were preserved. No commit,
push or production deployment. Rollback of the UI behavior requires reverting
only the current manual-handoff changes and rebuilding client and matching SSR;
do not revert unrelated dirty files or prior fixes.

## Delivery and hands-on Brave continuation

Owner requested push on 2026-10-09. Platform checkpoint 8b85530 was pushed to
origin/dev, and bounded DRM checkpoint c38c3b4 to its independent origin/main.
No production deployment. The owner then clarified that the next journey batch
must be performed visibly in Brave using mouse/form controls, as with the A.I.M
question authoring, not just automated browser scripts.

An isolated Docker project fayq-journey-authoring-20261009 was created from
journey.compose.yml, with fresh PostgreSQL, Redis, current platform/client/proxy
images, migrations and two synthetic users. The UI was opened in Brave at
http://127.0.0.1:8082 (loopback-only). The distinct hostname keeps test cookies
separate from the retained localhost owner session. No owner database/media or
DRM data was mounted. The synthetic seed was made idempotent after a second
startup exposed a duplicate-email seed failure; the subsequent startup passed.

| ID | Actual Brave control/action | Observed result |
|---|---|---|
| J10-B01 | Admin email/password fields and Login button | Real synthetic login succeeded; admin workspace displayed |
| J03-B01 | Header Courses link | Opened admin catalog with zero courses |
| J03-B02 | Create course button | Opened the real form |
| J03-B03 | Image file-picker control | Picker opened; setting local fixture blocked by extension permission |
| J03-B04 | Invalid A.I.M slug and Create | Inline error identified slug; keyboard focus returned to slug |
| J03-B05 | Correct slug, bilingual title/description fields, Create without image | Form retained values; missing-image error; zero courses persisted |
| J03-B06 | Academic classification checkbox | Exposed grade/year/term/type/month fields |
| J03-B07 | Academic year field | Accepted displayed 2026/2027 value |
| J03-B08 | Course-type menu, arrow/Enter to Revision | Revision selected; month field disappeared |
| J03-B09 | Navigate to recharge with unsaved changes | Browser asked whether to leave |
| J03-B10 | Cancel leave dialog | Stayed on catalog; all entered values preserved |
| J03-B11 | Save/reopen/edit/move/image/video upload | BLOCKED for continuation; not marked passed |

These checks used the actual UI/backend and no intercepted requests or direct
course writes. Only Arabic desktop has been exercised in this hands-on batch.
No course was saved, so edits/moves/publication were not exercised yet.

Brave's extension requires Allow access to file URLs before the tool can choose
the synthetic receipt.jpg image through the picker. The owner was asked to enable
that explicit permission; no permission change or alternate upload bypass was
performed. Source file: docker/browser/fixtures/receipt.jpg, not owner media.
The broad audit still requires all remaining stages and the mobile/English matrix.

Cleanup completed with compose down -v for this exact disposable project.
Verified zero remaining project containers/networks, absence of its PostgreSQL
volume and recorded anonymous Redis volume, and all five retained owner-preview
services still healthy. Recreate the saved compose/seed once permission is
available. No owner data or production deployment was changed.

## Existing-Data Brave Batch

The owner subsequently deferred uploads and requested testing the existing local
data. The retained localhost:8080 tab was signed in as STUDENT, not ADMIN.
No upload, purchase, recharge submission, content deletion or credential change
was performed. The owner was asked to sign in as admin for the next admin batch.

| ID | Actual UI operation | Observed result |
|---|---|---|
| J13-L01 | Start existing A.I.M lesson 01 | Previously displayed start error cleared; real video rendered and played |
| J13-L02 | Pause | Time stopped at about five seconds; control changed to Play |
| J13-L03 | Speed menu: 1.5x then 1x | Selected labels updated; restored original speed |
| J13-L04 | Quality menu: 720p | Label updated; actual rendition switch during moving playback not independently qualified |
| J13-L05 | Search 02 then Clear | One lesson result, then both lessons restored |
| J13-L06 | Next lesson | Lesson 02 and its existing video loaded at retained resume position; Next disabled at last lesson |
| J01-L01 | Open required assessment | Existing question and four choices displayed |
| J01-L02 | Submit unanswered | Blocked with generic field-validation toast; needs question-specific guidance |
| J01-L03 | Expand attempt history | Zero attempts displayed; no graded submission made |
| J11-L01 | Open wallet | Initially blank because an old dynamically imported WalletPage bundle failed to load; one full refresh recovered |
| J11-L02 | Wallet data | Current balance, two approved requests and payment instructions visible |
| J11-L03 | New recharge then Cancel | Real form opened; Cancel returned to wallet without submission |
| J12-L01 | Purchase history | Existing A.I.M receipt and learning link visible |
| J14-L01 | Unread filter then All | Empty unread view then all three existing notifications restored |
| J14-L02 | Mark course notification unread then Mark all read | Header/page count changed 0 -> 1 -> 0; original read state restored |
| J14-L03 | Notification View course | Opened A.I.M course with current progress |
| J02-L01 | Language switch from hash course detail | English catalog opened instead of preserving course detail; route-loss finding |
| J02-L02 | English catalog search A.I.M then Clear | One of six courses then six of six restored |
| J02-L03 | Mobile-size catalog | Header/bottom navigation and filters rendered without observed horizontal overflow |
| J10-L01 | Mobile My learning and account-section menu | Dashboard rendered; menu opened and Wallet destination worked |
| J11-L04 | Mobile English wallet | Balance/actions/payment sections rendered; no payment executed |
| J10-L02 | Return to desktop and Arabic from wallet | Viewport override reset; wallet route preserved |

The requested mobile override was 390x844, but the Brave DOM reported innerWidth
434 and documentWidth 417. Treat this as a narrow-window smoke check, not exact
390px breakpoint certification. Desktop screenshots also inspected real video
pixels and wallet recovery. No persistent screenshot file was saved for this batch.

Incidental effects: playback may persist a resume position; selecting the first
answer while inspecting the required assessment autosaved a draft (Saved shown),
but attempt history remained zero. Notification read state was restored. Video
quality was selected at 720p. No owner course content or wallet balance changed.

Findings remain open: stale-bundle blank page with no visible recovery control;
generic unanswered-question validation; hash course-detail language switch loses
context. Lesson-next changed displayed lesson while the observed URL still carried
the first lesson ID; refresh/deep-link consistency needs a focused follow-up.
Admin edit/move/publish and remaining journey stages are still pending, not passed.

## Source-Only Continuation While Browser Access Is Blocked

The owner requested Chrome and continuation. Connected-browser inventory showed
Brave and the in-app browser, but no Chrome. Earlier attempts were explicitly
blocked by a saved localhost permission. No alternate browser, raw automation,
HTTP access to the site or permission modification was used to bypass that block.

Fixed the evidenced public hash-route language loss in source: the header now
derives the translated public URL from the active public fragment instead of the
initial SSR catalog path. Private routes retain the existing language handler.
Added four regressions for reciprocal course links, package/home links, SSR and
anchor-only paths, and private-route boundaries.

Verification used fayq-session-client-test:20261009 with current client/src mounted
read-only at /srv/client/src, --network none and --rm. Full client suite passed:
298 Vitest checks in 37 files plus 10 Node patch checks (308 total). TypeScript
typecheck passed. Both language-20261009-labelled test containers were absent at
the final check. No networks or data volumes were created and no owner records
were mounted. This is source-level evidence, not browser retest or preview update.
The repair is uncommitted and not deployed/pushed at this checkpoint. The broader
admin/mobile journey, validation guidance and stale-chunk recovery remain pending.

## A-to-Z Restart and Validation Repair

Owner requested English, complete student/admin journeys and running the website.
The five existing preview services had stopped; restarted the same PostgreSQL,
Redis, server, client and Nginx containers without migrations, reseeding, changed
credentials or volume deletion. All five report healthy. Nginx retains only
127.0.0.1:8080. This checks service health, not application workflows or DRM health.

Browser inventory still contains no Chrome. A single permission check again
reported the saved localhost block. Broad conversational consent did not remove
that setting. No alternative browser, network request or automation was used to
access the blocked website. Hands-on A-to-Z execution remains BLOCKED.

Added a-to-z.md with 17 student and 20 admin steps, including invalid/cancel/retry,
persisted-effect, role and responsive requirements. Earlier upload deferral and
owner-data safety remain; financial/destructive tests require isolated synthetic
fixtures. The sequence is a plan, not 37 completed checks.

Repaired unanswered-choice UX in source: preflight verifies a selection belongs
to each choice question, blocks incomplete submission, names the first question,
focuses/scrolls to it and marks every unanswered fieldset with inline accessible
feedback. Selecting a choice clears that question's inline error. Coding/program
submission rules, backend authority, grading keys and manual Continue are intact.
Six new helper regressions cover empty, partial, valid and stale/cross-question
answers and unaffected coding/program questions.

Network-isolated Docker unit verification passed 304 Vitest checks in 38 files
plus 10 Node checks (314 total). Full TypeScript/client/SSR build passed; existing
large-chunk and duplicate static/dynamic import warnings remain. Source-only
mount was read-only; no owner volumes or website/network access. Both ephemeral
validation-20261009-labelled test/build containers were absent after completion;
no test networks or volumes created. The owner's running preview is preserved.

Source changes remain uncommitted, unpushed and not applied to the running preview.
Browser focus/visual/persistence retests, admin journey and stale-chunk recovery
remain pending. Existing preview runs its previously delivered images.

## A-to-Z Source Review: Recovery and Lesson Address

Continued without accessing the blocked website. Source review confirmed there
was no page error boundary around lazy-loaded destinations and lesson selection
updated only component state, leaving the old lesson URL.

Added PageErrorBoundary around page content, outside the retained header/footer,
with bilingual focused heading, accessible error and manual Reload page. It warns
about unsaved changes and uses existing navigation confirmation. No automatic
reload loop or raw technical error exposure. Route/language changes reset the
boundary. Actual lazy-load failure and keyboard-focus browser retests remain
pending. Three unit/rendering checks cover healthy content and both translations
without auto reload. The initial .test.tsx file was not discovered by the existing
Vitest include pattern; renamed to .test.ts, then actually executed and passed.

Added selectedLessonHash and synchronized only trusted playable selections using
history.replaceState, preserving course identity and resume intent. URL sync emits
no hashchange, remount or extra playback request. Five helper regressions cover
selection, bare route, encoded identity/parameters, invalid route and idempotence.
Mounted player/deep-link persistence retest remains pending.

Added 35 student/admin route mapping checks for protected/public paths, course
identity, selected lesson, resume and not-found. These are routing contract
checks, not role authorization tests or actual admin operations.

Final offline Docker suite: 347 Vitest checks in 41 files plus 10 Node checks,
357 total, passed. Client/SSR compilation and final TypeScript check passed;
existing large-chunk/static-dynamic-import warnings remain. Used
fayq-session-client-test:20261009, current source read-only, --network none and
--rm. No website access, owner data mount, new network or volume. All owned
recovery-20261009-labelled containers absent after verification. Retained preview
and data preserved. Repairs are uncommitted/unpushed/not applied to preview.
Complete A-to-Z and responsive/permission/persistence matrix remain blocked.

## Actual Browser Continuation — 2026-10-09

Brave access succeeded through the existing localhost tab; no saved permission
block bypass. Owner signed into ADMIN and then STUDENT. Earlier browser-blocked
entries are historical. Matching Docker preview builds now include pending route,
validation, error-recovery and lesson-address repairs, plus truthful READY media
registration, immutable completed recharge review, and compact-player volume.

Actual checks include 56 admin editor navigation/layout cases, 48 public catalog
filter cases, eight each for recharge read-only review, lesson search/boundaries,
wallet cancellation, error recovery and decoded Play/Pause, plus four compact
volume cases. Both languages and measured desktop/mobile sizes covered. These
counts are individual cases, not completed full journeys. Language-switch course
identity, lesson reload and real lazy-module failure/manual recovery passed.

Final source verification: Docker 357 checks, typecheck, client/SSR/server builds
passed. All changes remain uncommitted/unpushed. Retained database/cache containers
and data preserved; existing stopped external DRM services started without source
edits or recreation to restore actual playback.

Detailed results, evidence paths, incidental effects and untested boundaries:
[browser-continuation-20261009.md](browser-continuation-20261009.md).
Full A-to-Z remains IN PROGRESS: saved answered quizzes were not resubmitted,
owner CRUD/lifecycle/payment changes were not performed, and synthetic financial,
grading, expiry/session/concurrency coverage remains pending. Uploads deferred.

## Isolated Write Checks and Owner Stop

Owner approved isolated Docker fixtures and separately approved normal browser
interaction at 127.0.0.1:8082. Existing owner preview/data stayed intact. Isolated
Admin controls verified creation validation (cover required; upload deferred),
lesson rename, ordering persisted after reload, two-question required quiz draft
save/publication and Draft/Processing/Ready/Published lifecycle. Synthetic READY
media placeholders are not video playback evidence.

Actual unanswered/partial quiz validation passed eight measured language/size
cases. Database observation confirmed zero graded submissions before attempts.
Wrong then correct submissions produced real feedback; final disposable state:
two submissions, one pass, one draft. Arabic manual success/Continue stayed on
quiz across four sizes. English switch exposed a new unfinished issue: Passed
and answers persist, but success/Continue disappears and Submit is enabled again.
No repair for this new issue was made before the owner requested stop and push.

Saved synthetic DB to ignored local journey-handoff.dump, then removed only the
verified disposable project, named PostgreSQL and anonymous Redis volumes/network.
All project resources were absent. Browser auto-review rejected final
evidence/cleanup after the stop instruction; no retry or bypass. The final browser
tab/viewport cleanup could not be confirmed. Owner preview retained.

Exact continuation instructions: [friend-handoff-20261009.md](friend-handoff-20261009.md).
Current stop request authorizes commit/push of verified platform repairs and this
handoff. Full journeys remain incomplete; fresh English success, persisted-pass
recovery, remaining write/payment/session/role coverage must not be called PASS.

## UX continuation — 2026-10-10

Latest details: [UX repairs, actual evidence and interruption](ux-continuation-20261010.md).
Base `dev` remains 47274ac; current changes are uncommitted/unpushed. Previous
persisted-pass continuation supersedes the earlier historical stop above.

Implemented all five assigned UX changes. Actual Brave passed eight section
selection/focus cases, eight blank rejection-reason focus/error cases, and 56
course-panel navigation/layout cases, Arabic/English at measured 1280×900,
1920×1080, 390×844 and 360×800. Duration-offer creation/reload and selected
support save/reload/validation controls also have bounded actual evidence.
Expired quiz/session fixes have automated evidence only; actual retests pending.

Final offline Docker 381 client checks and TypeScript pass; client/SSR build
passes. No new backend integration, mocked-browser or browser-race passes.
Registration, package authoring, full support/settings and remaining offer modes
remain pending. Browser control stopped responding on an unsaved-support dialog;
same Brave connection retry after owner instruction failed. No permission bypass.
Browser logout/tab/viewport cleanup and retained screenshots could not be confirmed.

Latest synthetic dump was unavailable. Restored the actually available older
checkpoint into an isolated database, then saved a new local ignored dump; do
not claim the later 70 EGP balance was restored. No real transfer/upload/receipt
approval, owner data change or nested DRM edit. All owned disposable resources
removed after mount inspection, owner preview healthy. Suspended IDE untouched.
No full-site completion, milestone acceptance, commit or push authorization.


## Resumed browser checkpoint — 2026-10-10

[Latest resumed evidence and handoff](resumed-browser-20261010.md) supersedes the preceding current interruption/pending statements. Expiry/session guidance, draft package authoring and four offer modes now have bounded actual evidence. Final Docker client total is 391 plus TypeScript and matching runtime builds. Registration awaits owner credential-entry handoff; other controls remain partial. Owned test stack remains running for that handoff, owner preview preserved. New work uncommitted/unpushed; no full-site completion or acceptance.
