# Website Journey Progress

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
