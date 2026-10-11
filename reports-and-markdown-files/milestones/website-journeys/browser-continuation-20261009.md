# Existing-data browser continuation — 2026-10-09

Status at browser checkpoint: substantial actual-control coverage completed;
complete A-to-Z remains IN PROGRESS. This report supersedes earlier browser-blocked
and preview-pending status only for the checks described here. The owner then
requested stop and commit/push with a friend handoff; see friend-handoff-20261009.md
and the final progress entry for the isolated grading evidence and newly open bug.
No production release.

## Access and retained runtime

The available connected browser was Brave (extension browser 2), using the
existing localhost:8080 tab. Chrome was absent; native desktop APIs were disabled.
The in-app browser was available but unused. Normal interaction succeeded; no
alternate hostname, port, browser, permission change or automation bypass was
used. The owner performed ADMIN and then STUDENT sign-in using the website.
Credentials were never handled in chat or automation.

Read AGENTS.md, the documentation index, agent responsibilities, rules, decisions,
design and journey documents before implementation. Existing dirty source and
reports were retained. External DRM source was not edited.

The retained five-service local preview was rebuilt with matching client and
server SSR images and only those two services recreated. Nginx was restarted to
refresh upstream resolution. PostgreSQL/Redis data services were not recreated;
no migrations, reseeding, credential reset, data deletion or volume removal.

Playback initially failed because the four existing external DRM containers were
stopped (exit 255). Started those same PostgreSQL, Valkey, API and worker
containers with their retained mounts, without recreation or nested source edits.
Actual decoded video playback then worked. This is local dependency recovery,
not a DRM implementation repair.

## Actual website controls and evidence

Evidence directory: docker/browser/evidence/journey-brave-20261009/. JSON matrix
counts below are individual navigation/layout/control cases, not completed
end-to-end journeys or full certification of every feature on those pages.

| Area | Actual checks and outcome | Evidence/boundary |
|---|---|---|
| Admin overview/catalog | Refresh real totals; search A.I.M from eight records to one; open existing editor | No creation or saved metadata edit |
| Admin editor | Seven tabs in both languages at four sizes: 56 checks; select both READY lessons; inspect translated metadata, assessments, resources, prices and lifecycle controls | admin-matrix.json; tab navigation/layout only, not full authoring or publishing |
| Admin submissions | Open lesson 02 required assessment submissions; empty state, close and disabled pagination inspected | No assessment revision or grade change |
| Admin roster/reports | Select existing student, two-week period and View details; inspect per-video coverage/counts | No report sending or WhatsApp action |
| Admin delete | Open named lesson 01 delete confirmation and Cancel; both lessons remain | No confirm/delete; narrow capture does not certify all dialog geometry |
| Admin recharge | All has four approved records; Pending empty; inspect proof and completed review | recharge-readonly-matrix.json: eight language/size checks; no financial review submitted |
| Admin settings | Reload saved settings and follow Help | No settings Save |
| Catalog | Six published courses; grade, term, year, type, no-match search and Clear: 48 checks | public-matrix.json; expected counts restored; no horizontal overflow |
| Course language | Open A.I.M through notification hash while base path is /en/courses, switch to Arabic | Actual destination /ar/courses/aim; student-aim-language-preserved.jpg |
| Dashboard/account | Existing active A.I.M, 50% / one of two lessons, access deadline and balance; Resume selects lesson 02 | No profile save or new enrollment |
| Lesson address | Previous/next selects actual lesson IDs; reload each lesson; language switch preserves lesson 02; last/first boundaries disabled | Existing selected lessons only |
| Curriculum | Search existing lesson, Clear and navigation boundaries in eight language/size cases | lesson-matrix.json; Arabic singular search label correctly recognized |
| Quizzes | Existing optional six-question quiz and four historical attempts; required one-question quiz with saved answer; expand history | No new Submit or draft change; unanswered/fresh success not verified live |
| Student wallet | Open recharge form, inspect methods and Cancel in eight language/size cases; saved balance unchanged | wallet-matrix.json; no transfer, proof upload or request submission |
| Purchase history | Existing free A.I.M receipt and 90-day access terms; no packages purchased | Read-only, no purchase/debit |
| Notifications | Mark existing course item unread, Refresh retains count one, then Mark all read restores zero; course deep link works | Reversible state restored; no messages sent |
| Role boundary | Student normal admin-summary address shows access denied, without admin totals | UI evidence only; not independent backend authorization certification |
| Page recovery | Bounded CDP block of one already-observed wallet JS module triggers real page boundary; focused bilingual heading, retained header/footer, manual Reload restores wallet after unblock | page-recovery.json and page-recovery-matrix.json: eight language/size checks; Network blocking cleared and disabled |
| Real playback | Completed lesson 01 decoded; Play/Pause in eight language/size cases; speed 1.5 then restore 1; seek/rewind/forward bounded; desktop volume mute/full restored | playback-matrix.json; playback may save resume position, no completion change |
| Fullscreen | Actual protected frame includes video, controls and watermark; Exit button works | student-fullscreen-ar.jpg; automated Escape did not exit native fullscreen and remains unverified |
| Quality | 720p option selection reflected in UI, restored Auto | Actual rendition change not independently verified |
| Compact volume | New settings volume slider: Home mutes, ArrowRight shows 5% and actual video unmuted, End restores 100% in Arabic/English at 360/390 | volume-matrix.json: four passes; player-volume-ar-360.jpg visually inspected; main menu fits narrow player |
| Public policies/FAQ | Terms, privacy and refunds linked in both languages, show truthful unadopted-policy notice; English recorded/access FAQ answers opened | policies.json; not adopted legal terms; full home/FAQ matrix pending |
| Existing package review | Navigate from catalog; translated package identity, 250 EGP, common deadline, existing balance and unpublished member warning at all four sizes | package-review-matrix.json: eight layout checks; Confirm purchase untouched |
| Support | Bilingual contact/instructions and wallet/dashboard destinations at all four sizes; actual wallet link navigates correctly | support-matrix.json: eight checks; no email/phone contact action |

Measured exact responsive CSS viewports were 1280x900, 1920x1080, 390x844 and
360x800, compensating for the browser's existing 90% zoom. Temporary overrides
were reset. No horizontal overflow in the recorded matrices. Occasional screenshot
capture timeouts occurred while DOM/actions remained available; no browser reset
or access-method change was used. Captures and individual matrices have the
specific limits above; a timeout is not an application failure.

## Fixes applied and verification

Earlier pending platform repairs now run in the preview: public language-route
preservation, unanswered-choice preflight/accessibility, page error recovery and
lesson URL synchronization. Language, URL and recovery have actual browser
verification above. Choice validation has unit evidence only: all existing quiz
drafts were already answered, and changing/submitting them would alter saved data.
The delivered success page still requires manual Continue; no auto redirect was
introduced. Fresh successful grading/Continue remains a live-test gap.

Three additional UI repairs:

- READY media registration explains Remove/replace or opening an editing draft,
  rather than falsely claiming a request is in progress. File control receives an
  accessible reason. Both translations inspected; no media writes.
- Completed recharge review shows saved immutable status and omits pending
  approve/reject/confirmation controls. Submission handler also guards completed
  requests. Eight browser cases passed; no balance or financial decision changes.
- Narrow players retain a labelled percentage volume slider in Playback settings,
  alongside speed/quality. Desktop inline volume remains. Four actual compact
  control cases passed and original volume restored.

After the last source edit Docker verification passed 347 Vitest checks in 41
files plus ten Node checks (357 total), TypeScript, and client/SSR/server image
builds. Logs: docker/browser/evidence/journey-volume-tests.log and
journey-volume-build.log. Existing bundle-size and static/dynamic-import warnings
remain. Test source mount was read-only, network disabled, ephemeral --rm
container; no owner data mount, test networks or volumes. Automated checks do not
replace the actual-control evidence or prove full A-to-Z.

## Remaining boundaries and follow-up

No owner records, credential, course/assessment content, published state, payment
or wallet credit were changed. Existing quiz drafts/history retained; notifications
restored; playback preferences restored (1x, Auto, unmuted 100%) and player paused.
Playback may persist resume on the already-completed lesson. Balance remains
805.50 EGP, course completion 50%, and no new grading attempts were submitted.

Complete journeys still require isolated disposable synthetic fixtures for
unanswered/fresh wrong/correct quiz attempts and manual Continue; create/edit/move
and lifecycle persistence; financial duplicate/concurrency checks; expired access,
authentication/session and broader role matrix. The owner requested existing-data
focus and preservation, so these were not silently executed on owner records.
Uploads remain deferred. Full public-home/FAQ, admin student
directory and notification functionality are not fully tested in this batch.

Open UX observation: the mobile admin course chooser plus seven vertically stacked
tabs consumes substantial space before editor content. This is documented but not
repaired or claimed verified. Native fullscreen Escape and actual rendition switching
also remain unverified. No full-journey PASS, milestone acceptance or capacity claim.

The owner subsequently approved preparation of a separate disposable Docker
dataset for remaining write tests. This does not convert pending cases into
passes; the retained owner preview and data remain intact while the fixture
environment is prepared.
