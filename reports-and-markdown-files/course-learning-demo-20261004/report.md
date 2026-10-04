# Learning demo and owner testing guide — 2026-10-04

Owner follow-up: video playback is currently blocked by the external service's device limit, despite READY processing state. [Diagnosis, tested platform repair and bounded recovery proposal](../course-video-device-limit-20261004.md) supersede any implication that readiness proves playback. Quiz/assignment content remains available. Recovering already-used device slots awaits explicit external-maintenance authorization; new uploaded assets are preserved.

The owner requested demo data to try video playback, quizzes and assignments while reviewing [the four-feature proposal](../course-learning-enhancements-plan.md). This report covers demo population and same-agent verification, not implementation or approval of those proposed features.

## Open the demo

- Student offer: [Learning demo: video, quiz and assignments](http://localhost:8080/#/courses/fayq-learning-demo-20261004).
- Student learning: [Open the demo learning page](http://localhost:8080/#/learn/fayq-learning-demo-20261004).
- ADMIN: [Manage the demo course](http://localhost:8080/#/admin/courses/d1cde073-59dc-4e8f-a185-e7dafbdae654).
- Selected existing account: `m8-final-39b72377-c7fe-42aa-b0c2-126324446131-student@example.test`. Use its existing password; none is included in this report.

The course is clearly labelled test content. Its normal offer is **1 EGP**, access **until permanent removal**. Population initially confirmed that the selected student was not subscribed and the protected outline returned 403. Later read-only browser verification found an active subscription to this course. The population/review scripts do not purchase, submit, grant access, modify wallet balance, or complete lessons on the student's behalf. The existing subscription is sufficient to open Continue learning; no repeat purchase is needed.

## Content and things to try

1. Open **JavaScript basics and video playback**. Start the video, use fullscreen, pause/resume and expand/collapse the curriculum. Both lessons have a real uploaded 20-second synthetic color/movement test video with tone audio. This is a playback sample, not a programming lecture or owner-supplied copyrighted course.
2. Open **Quick quiz: variables and output**, the required two-question quiz. Try an incorrect answer and submit; then correct it and resubmit. Topics: `let` versus `const`, and multiplication output.
3. Open **Required assignment: square a number**. Read one integer using `readline()` and print its square using `console.log()`. Public sample: input `3`, output `9`. Starter code reads the number and leaves the computation for you. Run locally, then Submit for official checking.
4. The second lesson remains blocked until both required assessments pass. Required assessment links are available in the curriculum. Quiz/assignment completion unlocks the lesson; it is distinct from video completion progress.
5. Open **Next lesson and optional practice**, then **Optional assignment: double a number**. Public sample: input `3`, output `6`. This optional assignment does not add a required progression gate. Try saved drafts, submission history and an incorrect/correct official submission.

No required work was passed automatically for the selected account. The scripts intentionally leave playback and grading submissions to the owner, preserving the owner's fresh testing experience and ongoing activity.

## Creation and verification evidence

- Used the existing cookie/CSRF-protected ADMIN platform APIs to create one new course, one section, two lessons and a normal priced plan. Existing courses were not edited. Course id: `d1cde073-59dc-4e8f-a185-e7dafbdae654`; slug: `fayq-learning-demo-20261004`.
- Generated an original test MP4 in a disposable Docker container using the installed worker image's FFmpeg binary. Probed source duration: **20.000 seconds**, 640×360 H.264 video plus AAC audio. Reused the same sample for both lessons; registered two distinct external assets through platform media APIs, PUT real bytes to signed upload URLs, completed uploads, and synchronized each to **READY** through the external API. Uploads were Node HTTP requests inside Docker, not ADMIN browser upload verification.
- Published a required QUIZ and required/optional input/output PROGRAM assignments. Both PROGRAM assessments reached **READY** through real isolated controller preparation before publishing; generated reference solutions and hidden cases remain private. No student official grading submission was created by this task.
- Advanced the new course through DRAFT → PROCESSING → READY → PUBLISHED using existing lifecycle APIs. Existing publication notification behavior applies; no notification-policy change.
- Initial protection checks: anonymous outline **401**, authenticated unsubscribed outline **403**. Later browser reads confirmed active ownership; subscribed offer displayed protected curriculum and Continue learning.
- Chromium Docker review: **10 checks passed**, no page errors. Confirmed selected student offer, current ownership/Continue learning, curriculum, Arabic mobile RTL/no horizontal overflow, all three ADMIN assessments and both lesson titles. Inspected [Arabic mobile screenshot](offer-ar-mobile.png); [English desktop screenshot](offer-en-desktop.png) is also retained.
- Video processing readiness and coding preparation are real. Actual browser playback, fullscreen with this uploaded sample, owner quiz submissions and lesson unlocking were deliberately left to the owner; these checks are not claimed as passed here. The prior [course UX report](../course-ux-20261004/report.md) documents its separate synthetic browser coverage.

All execution/verification used Docker. No platform schema migration, source implementation, DRM nested-package edit, external database access, fake recharge, quota change, production deployment or new role. No commit/push or milestone acceptance.

## Harness corrections and retention

Browser harness retries corrected package resolution, an assumed subscription-button label, handling of the subscription that appeared between creation and review, an extra debug-expression parenthesis, and opening existing collapsed ADMIN assessment panels before assertions. The final run passed all 10 checks; failed runs are not counted as successes. Debugging reads did not change the student account.

Private ignored evidence: `docker/browser/evidence/course-learning-demo-20261004/` contains the MP4, retry checkpoint, population/review scripts and receipts. Credentials come only from the existing ignored account fixture; passwords, cookies and signed URLs are not printed or included in reports. Signed URLs are neither stored in the checkpoint nor committed.

All task containers carried `fayq.task=course-demo-20261004`, exact repository/evidence bind mounts, and `--rm`; generation/probing used no network. Final Docker label checks found **zero task containers, networks and volumes**. No global prune or deletion of retained data. The new published demo, processed external assets, current preview and existing platform/DRM volumes remain intentionally available for owner testing.
