# Friend handoff — stopped at owner request

Continue in A:\Projects\Work Projects\education-platform, branch dev. Speak
English. Read AGENTS.md and reports-and-markdown-files/{README,agent,rules,decisions,
design}.md, then this directory's README.md, a-to-z.md, progress.md, runbook.md and
browser-continuation-20261009.md. Preserve all existing changes and data.

## Current verified state

Docker development/verification is required. The retained owner preview remains
at http://localhost:8080/ar, with five healthy services. Matching client/server
images contain the verified language-route, lesson-address, error-recovery,
unanswered-choice, completed-recharge-review, READY-video explanation and compact
volume repairs. Final source check passed 357 tests, TypeScript and builds.
Actual controls in Arabic/English and desktop/mobile were exercised; full A-to-Z
is still incomplete. The detailed report explains every coverage boundary.

The owner additionally authorized a completely separate disposable Docker dataset
and normal Brave interaction at http://127.0.0.1:8082/ar, expressly for synthetic
write tests. This does not authorize bypassing any browser permission block. At
handoff, browser auto-review rejected final evidence/cleanup after the owner said
stop; do not retry/reset/switch access methods based on this earlier session.
Check available tools/access first and get current authorization to resume browser
testing. Chrome was absent, Brave extension browser 2 was connected, native
desktop controls disabled. The owner preview tab was STUDENT; passwords were
entered by the owner. Do not reset credentials.

## First bug to fix and verify

Real synthetic quiz grading exposed an unfinished UX bug:

1. A required two-question quiz receives a wrong attempt and shows retry feedback.
2. Correct both answers and submit: success is focused, Submit disabled, and
   manual Continue to lesson appears. No automatic redirect occurs.
3. Switch language or reload: the backend still reports Passed and restores the
   saved answers, but the success/Continue panel disappears and Submit becomes
   enabled again. In the observed run Arabic success disappeared on switching to
   English. Do not claim English fresh-success verification passed.

Inspect client/src/features/assessments/AssessmentPage.tsx. Loading sets result
null; success/Continue renders only for result.state === CORRECT. Provide honest
persisted-pass recovery with a manual Continue control after language switch and
reload. Do not fabricate a current attempt/result or change retake policy without
checking decisions. Retain the correct course/lesson destination and prohibit
automatic redirect. Verify fresh success, language switch, reload, focus, manual
Continue destination and history in both languages at measured 1280x900,
1920x1080, 390x844 and 360x800. Test required and optional quizzes separately.

Actual unanswered/partial validation passed eight exact language/size cases:
inline errors, first missing question focus, no overflow. Disposable DB had zero
submissions before grading; final state is two submissions (one wrong, one correct),
one pass and one saved draft. Evidence: unanswered-matrix.json,
synthetic-unanswered-ar-360.jpg, synthetic-success-ar-360.jpg and
synthetic-final-state.log under docker/browser/evidence/journey-brave-20261009/.

## Disposable state and startup

Only the disposable project fayq-journey-authoring-20261009 was removed, including
its verified named PostgreSQL volume and anonymous Redis volume. Owner preview,
materials, DRM containers and data remain. The synthetic DB was saved first:
docker/browser/evidence/journey-brave-20261009/journey-handoff.dump (custom pg_dump,
147691 bytes). This ignored local artifact is not pushed. On another machine,
reseed synthetic records instead or request this synthetic-only dump separately.

docker/browser/journey.compose.yml uses the matching repaired images
fayq-player-controls-client:20261006 and fayq-player-controls-server:20261006,
isolated DB journey_test, loopback port 8082 and its own network/volume. Build the
current platform images in Docker if those tags are absent or stale. Start with:

    docker compose -p fayq-journey-authoring-20261009 -f docker/browser/journey.compose.yml up -d --wait

For local restoration, stop only isolated server before restore; copy the saved
dump to isolated postgres and run pg_restore -U postgres -d journey_test --clean
--if-exists against that container only. Restart isolated server afterward. Never
restore this dump into the owner preview. Verify DB name and compose labels first.

Synthetic account emails are journey-admin@example.test and
journey-student@example.test; the plainly labelled test password is in
journey-seed.cjs. The restored course slug is journey-synthetic-20261009 and id
c15288b6-b19a-48e7-82fa-4041697a4894. Quiz id is
adbd0f43-8c5e-4afd-b9eb-463812d087c1. A fresh seed creates the course/three lessons
but not the manually authored quiz. Recreate that quiz via Admin controls or
restore the dump. Synthetic READY media records are placeholders, never playback
evidence; do not point them at external DRM or upload media.

The synthetic student currently lacks a Wallet row because the initial seed
created User directly. Before financial tests, initialize a zero wallet through
the platform ledger helper in this isolated DB; use auditable synthetic credit
fixtures only. Account balance Unavailable in this initial fixture is not proof of
a platform wallet regression. Do not credit or modify owner wallets.

## Remaining journey work

- Complete persisted bilingual course edits, section/lesson add/edit/move and
  boundaries; editing-copy/published separation; archive/restore on disposable
  content. Creation validation passed, but successful creation requires a cover
  image and uploads are deferred. Do not invent a cover-policy exemption.
- Verify quiz edit/version/submissions and required/optional progression. Draft
  save and revision publication, lesson rename, move-down/reload/move-up, and
  Draft → Processing → Ready → Published transitions already passed in isolated
  website controls. Current published fixture remains after dump restoration.
- Complete synthetic payment/recharge review, duplicate/concurrency, free/paid
  course/package access and receipts. No real payments. Receipt uploads remain
  deferred; prepare existing synthetic proof fixtures if required.
- Complete profile validation, invalid login, expiry/session recovery and actual
  student/anonymous role boundaries. Admin logout and anonymous protected-page
  sign-in notice were observed, not a full backend security certification.
- Finish full home/FAQ, directory and admin notifications controls. Public package
  review and support each passed eight language/size layout checks; purchase was
  untouched. Mobile admin chooser plus seven vertical tabs consumes excessive
  space; document/refine and verify if appropriate.
- Native fullscreen Escape and actual quality rendition switching remain
  unverified. Real A.I.M playback/Play/Pause passed on the retained preview;
  existing stopped external DRM services were restarted, with no nested edits.

Use only the website's actual controls for browser journey evidence. Backend/unit
checks supplement them; never label mocked responses or unit tests as full live
journey verification. Measure actual dimensions: original owner tab had 90% zoom,
new fixture tab had 100%; applying the same override compensation gave wrong sizes
until corrected. Observe after resizing, and use keyboard activation if coordinate
clicks race layout. One synthetic answer was incidentally selected/autosaved during
the resize harness; it was included in partial-answer verification, not concealed.

No external DRM edits, owner deletion, credential reset, actual payments, owner
publishing or production deployment. Do not send WhatsApp/email. Commit/push
future repairs only with the owner's explicit authorization; the current stop
request authorized this handoff delivery. Keep evidence, verification and pending
issues distinct. Clean up only your exact disposable Docker project after saving
needed evidence; inspect all mounts and labels, never prune globally.
