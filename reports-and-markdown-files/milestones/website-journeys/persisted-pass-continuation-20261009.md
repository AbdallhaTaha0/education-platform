# Persisted assessment pass continuation — 2026-10-09

Status: VERIFIED PLATFORM REPAIR; browser continuation completed within the owner's restrictions. Delivery is on dev. This is not milestone acceptance, production deployment or full-site certification. This report supersedes the earlier Brave connection block and initial fixture checkpoint.

## Preservation and repair

The A: drive is absent. Used the available C: repository, fetched dev and started at `13303d65b03ce6bfce594ac3ca9c32b875a77842`. Read AGENTS.md, required core documents, design.md and all assigned journey documents. Preserved the existing nested DRM checkout difference outside delivery. No DRM edit, credential reset, owner-content change, upload, external message or real payment.

AssessmentPage now renders focused bilingual previous-pass feedback and manual Continue when the API reports passed and there is no current result or pending check. It does not reconstruct grading, scores, correct answers or checks from saved answers. Current attempts retain their actual result. Continue retains the original course, lesson and resume=1 destination; no automatic redirect. Existing practice retries remain allowed. A new incorrect practice attempt displays its real failure; reloading honestly reports the earlier pass, including after publishing revision two.

The disposable seed initializes a missing zero wallet through the platform ledger helper without overwriting an existing wallet or password. The mocked regression now covers required/optional persisted passes, saved choices, reciprocal language switching, refresh, focus, history and manual navigation without new submissions.

## Automated passes (Docker)

- Client: 347 Vitest plus 10 Node checks (357 total), and TypeScript passed. Current source was mounted read-only into the client test image with network disabled.
- Current client/SSR, server/SSR, migration and server-test images built. Existing bundle/import warnings remain. New images were used only in the synthetic stack; the owner preview was not recreated or migrated.
- Ten backend integration suites: 109 checks passed. Nine original suites passed 91 (identity/auth/session, catalog role protection, wallet purchase/review/integrity, assessments, learning entitlement, indefinite learning); the additional academic/package suite passed 18. These cover concurrency, immutable review, idempotency, progression, retained passes, expiry and roles. They are API/database checks, not browser concurrency evidence, real DRM playback or suspended-IDE qualification.
- Mocked handoff UI matrix: 48 cases passed at measured 1280x900, 1920x1080, 390x844 and 360x800. Mock responses are not real grading evidence. Initial history activation during smooth scrolling was a harness input race; keyboard activation resolved it.

## Actual Brave website passes

Brave became available after the owner connected it. The authorized synthetic origin 127.0.0.1:8082 was accessible without a permission rejection. Created two test tabs for Admin and Student. The connected profile shares cookies, so roles were exercised sequentially; this is not proof of simultaneous isolated sessions. No alternate origin/browser bypass was used. Viewport measurements were read from the rendered page; supported tab-scoped device metrics were used for the Admin tab where the browser override targeted only Student.

| Journey | Actual website observations | Coverage |
|---|---|---|
| Quiz authoring | Admin created, saved and published bilingual two-question required and one-question optional quizzes. Unchanged publication disabled. Revision two published; submission filters and answer details retained original grading/version. | Synthetic Admin, AR/EN |
| Required progression | Wrong answer produced real Incorrect and question checks; correct retry produced real success and focused panel. Next initially blocked, then enabled. First/last lesson boundaries correct. | Synthetic Student |
| Optional progression | Next remained available before optional pass. Correct submission produced real success. | Synthetic Student |
| Persisted pass | Saved answers, honest prior-pass panel, focus and absence of invented checks after reload/language change. No automatic navigation. | 16 cases: two quizzes x two languages x four measured sizes |
| Manual destination/history | Continue opened the same canonical course and original lesson with resume=1. Both earlier submissions retained. | 16 cases, both quizzes/languages/four sizes |
| Fresh grading | 16 actual correct submissions, real checks, focused bilingual congratulation, disabled Submit. | Both quizzes/languages/four sizes |
| Revision and retry | Pass survived revision two. Later incorrect retry showed failure; reload restored prior-pass feedback without claiming new success. History pagination showed original attempts; restored correct saved choices without another submission. | EN actual controls |
| Working copy | Independent draft retained edits across reload; public original unchanged until publishing. Section/lesson moves persisted; boundary controls disabled; original order restored. Added/renamed bilingual section/lesson. New lesson selected and focused. Incomplete processing rejected; READY fixture enabled publish to original canonical course. | 8 Admin layout cases, AR/EN/four measured sizes |
| Archive | Archive removed public detail; unarchive restored publication. Delete lesson confirmation named the target; Cancel preserved it. | Disposable content only |
| Profile | Blank name and invalid ID triggered native validation/focus. Changed display name persisted; restored original synthetic name. | EN |
| Notifications | Publication unread count, automatic page reading, mark unread and unread filter observed. | EN; no external delivery |
| Home/catalog | Four FAQs keyboard opened/closed; grade filter and clear; catalog grade/year/term/type/search and empty results, Clear restored filters/results. RTL/LTR and no horizontal overflow. | Each 8 cases, AR/EN/four sizes |
| Recharge review | Cancel preserved pending request; approval disabled without receipt confirmation. Empty rejection reason rejected; valid reason persisted terminal Rejected with no further review controls. | AR synthetic review |
| Recharge configuration/form | Required receiving address validated; synthetic address and bilingual no-transfer instructions saved. Student form loaded it; populated request Cancel created no new request. | AR/EN controls; no upload |
| Insufficient funds | Purchase review showed missing funds and no confirmation. | 8 cases, AR/EN/four sizes |
| Enrollment | Actual paid 20 EGP, free 0 EGP and package 10 EGP actions produced receipts/access. Package listed three courses and preserved longer existing access. | Synthetic controls; no real funds |
| Course expiry | Exact synthetic subscription expiry was forced, then dashboard showed Expired and Renew; learning page denied access with renewal. Quiz exposed no questions/pass/Continue. Restored exact original expiry afterward. | Quiz denial 8 cases, AR/EN/four sizes; learning EN |
| Session expiry | Forced only the synthetic student's session absolute expiry. Protected learning denied access and header offered login. Existing credentials signed in normally; restored entitlement, saved choices and prior-pass Continue returned. | EN |
| Roles/logout | Student Admin page showed Not allowed and no Admin data; logout denied protected quiz with Sign in to continue. Invalid Admin password rejected before valid login. | Student Admin denial 8 cases, AR/EN/four sizes; anonymous quiz EN |
| Roster/directory | Search empty/matching results, student details, roster period controls, coverage explanation and missing guardian contact observed. WhatsApp disabled; Devices surfaced failure/retry when DRM unconfigured. | EN, no access changes/message |

Final observed database: 20 submissions (required 11: nine correct/two incorrect; optional nine correct), two retained passes. A guarded auditable synthetic credit of 100 EGP funded the purchase checks. Ledger entries were +100, -20 and -10 EGP, with reconciled balance 70 EGP. Three course purchase snapshots include the original seed entitlement; one package purchase contains exactly three items. Two recharge requests remain: pending 100 EGP and rejected 50 EGP. Neither placeholder receipt was approved or credited. Ledger observation corroborates browser actions; direct fixture preparation is not a browser authoring/approval pass.

## Fixture preparation and evidence

The prior-machine handoff dump is absent locally. Recreated the disposable seed and authored quizzes through Admin controls. Additional financial offers, pending recharge records, cover/receipt placeholders, classifications, READY media and forced expiry/session states were prepared through guarded isolated fixtures. The credit used the platform ledger transaction. Synthetic media and receipt PNGs are explicitly not real playback/transfer evidence. No upload or policy exemption was added. An initial fixture reference-normalization failure and a non-root restoration-file permission failure were corrected before their dependent checks; neither affected owner data.

Ignored local evidence directory: `docker/browser/evidence/persisted-pass-20261009/`. Includes actual-persisted-matrix.json, actual-history-destinations.json, actual-fresh-matrix.json, actual-admin-layout.json, actual-home-matrix.json, actual-catalog-matrix.json, actual-insufficient-matrix.json, expired-quiz-matrix.json, student-admin-role-matrix.json, actual screenshots, financial observation, automated logs and matching image overrides. Readable persisted-pass visual evidence includes actual-required-en-1920.jpg. Some extension screenshots after viewport changes are reduced or capture an earlier paint; measured DOM/AX observations are the asserted matrix evidence, not filename-implied screenshot dimensions. The final-restored-persisted-en-360x800.jpg capture is reduced and is not useful visual proof.

Final custom PostgreSQL backup `verified-synthetic-final.dump`: 155943 bytes; SHA256 `97B149C82C0C8D39F6B5FB9DA2CA797BFE75E18DD6EA5C606B0B94AC409EB262`. This contains actual authored quizzes, history and financial fixtures, unlike the earlier 144518-byte initial seed dump. Retained locally only, not committed. Exact subscription expiry was restored before this backup; synthetic sessions retain their test expiry/logout history.

## Remaining limitations (not passed/fixed)

- Real video playback, fullscreen Escape, rendition switching, active playback expiry/device enforcement and upload flows were not qualified. READY placeholders cannot qualify them. The suspended IDE was not reopened or accepted.
- Successful new-course creation needs a cover upload; no upload exemption was fabricated. Financial plans/package offers and request records were fixture-prepared, so their creation UI is not passed. Registration, guardian report generation, WhatsApp delivery, real receipt approval, refunds/real payments, full support/settings enumeration and every browser concurrency race remain untested here.
- Blank recharge rejection reason yields a generic field-validation toast and retains focus on confirmation instead of identifying/focusing the reason. New section addition does not automatically select/focus that section (new lesson does). Mobile Admin chooser/tabs require substantial vertical travel. These findings are recorded, not repaired in this delivery.
- Expired quiz access is enforced but the message is generic Request failed rather than a renewal explanation. Expired-session learning offers Retry checks before login; normal login works. No claim that this wording is fixed.
- Browser viewport matrices apply only to their listed scenarios, not every control/role combination. Automated concurrency and authorization tests are separately labelled. No full-site, capacity, production or milestone acceptance claim.

## Cleanup and delivery

After exact project-label and mount inspection, removed only owned isolated projects fayq-journey-integrity-20261009, fayq-journey-authoring-20261009 and fayq-journey-package-20261009 with their respective Compose files. Final inspection confirms no owned containers/networks/named volumes and no recorded anonymous Redis volumes remain. Test runners removed automatically. Images, dumps and evidence retained; no global prune.

Reset both temporary browser viewport overrides, signed out and closed only the two test tabs. All five retained owner-preview services remain healthy at localhost:8080 with existing images/volumes/data. Platform source and regression/report files are the only delivery scope; the nested DRM difference is excluded. Commit and push authorization comes from the owner's current explicit instruction; the exact delivered revision is recorded in Git history and the final response.
