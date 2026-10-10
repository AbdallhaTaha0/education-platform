Latest delivery authority: [owner-requested commit/push](delivery-20261010.md). Earlier uncommitted/no-push statements below describe their historical checkpoints. Remaining verification and credential handoff are unchanged.

# Resumed website browser verification — 2026-10-10

Latest continuation of [the UX report](ux-continuation-20261010.md). This report supersedes that report's current browser-interruption, pending expiry/session/package, automated total and resource-state statements. Its earlier evidence remains historical. Base remains dev at 47274ac57d3e898b25a328b0645da2d1d647f59f. New work is uncommitted/unpushed; no full-site completion or milestone acceptance.

## Fixed issues

All five assigned UX repairs remain recorded in the preceding report. Actual resumed session checks exposed a second affected learning surface: DashboardPage still offered Retry after session expiry. Added a shared bilingual SignInRequired component to course learning and the dashboard; auth errors remove Retry and stale learning actions, and link manually to login. Unrelated failures retain Retry. No access, grade, wallet or session policy changed.

## Actual website evidence

Only the connected Brave profile at 127.0.0.1:8082 was used. Admin and Student authenticated sequentially; simultaneous isolated sessions and browser concurrency remain unproved. Arabic/English measured CSS viewports were 1280×900, 1920×1080, 390×844 and 360×800 where the matrices below apply. Layout rows are not complete journey passes.

- Expired quiz: eight language/size views showed bilingual renewal guidance and a manual dashboard link, denied quiz input and did not redirect automatically. Clicking the Arabic link opened the expired dashboard card; its existing renewal control opened the wallet. Subscription dates were restored exactly after each forced synthetic expiry.
- Session recovery: eight course views and eight dashboard views showed sign-in guidance with no Retry or stale learning controls. Forced expiry was actually triggered for the Arabic course and, after a fresh login, English dashboard; other matrix views include anonymous token loss after language changes. These are not sixteen independent forced-expiry triggers. Manual sign-in opened login and normal login recovered. No decoded active video was running.
- Retained required pass: English 360px refresh and Arabic switch retained honest previously-passed feedback without fabricated checks. Manual Continue reached the correct course/lesson and resume=1. No new grading submission.
- Package authoring: created a bilingual synthetic DRAFT package with three classified monthly DRAFT members, 30 EGP and common Cairo deadline 31 Jan 2027 20:00. Reload/edit retained values. Duplicate members were rejected with generic feedback. Saved price 31 EGP and member order 3/1/2, verified reload; unsaved price 999 cancelled. Archive persisted and edit restored DRAFT. Eight language/size editor views had no horizontal overflow. No publication or purchase.
- Support: eight language/size empty-contact validation views focused invalid email. Known synthetic contacts saved, normalized phone +201000000000 and email persisted after Reload details and public-help navigation. Help's wallet link opened wallet. No email/call was sent. Full dirty-navigation cancellation remains pending.
- Policies: Admin draft review and three public policy links at 360×800 English/Arabic showed unadopted notices and no adoption/editor controls (six public views). No policy adopted; this is not an all-size policy matrix.
- Payment settings: Arabic 360×800 InstaPay and Vodafone Cash enabling with empty account was denied and focused the corresponding field. Checkboxes were restored to disabled and Reload details used. No actual receiving details, QR upload or transfer.
- Financial offers: English 360×800 classified synthetic month 1 created Free/30 days, 10 EGP/UNTIL_REMOVAL, 15 EGP/TERM_END with Cairo deadline 31 Jan 2027 20:00, and 25 EGP/YEAR_END with Cairo deadline 30 Jun 2027 20:00. All four survived full reload and selecting access again. Course remained DRAFT, no purchase. This supplements preceding paid-duration evidence; edit/retirement/conflict and all-size offer matrices remain pending.
- Mobile course switcher: English 360×800 expand, filter Synthetic month 2, switch to its UUID route, and automatic collapse passed. Dirty-form selector cancellation and all-language/size switcher matrix remain pending.
- Registration: Arabic 360×800 blank submission produced generic validation and marked reg-name invalid without focusing it. No account created. English 360×800 non-credential synthetic fields prepared for owner handoff; password fields left blank and no submit performed. New credential entry/submission requires owner takeover under browser-control policy. Successful registration, duplicate identity and post-registration role checks remain pending.

New follow-ups: registration generic feedback/no focus; package duplicate-member generic feedback; previous support/offer generic validation limitations. These were documented, not silently marked repaired.

## Automated passes

Final offline Docker client suite: 381 Vitest checks in 45 files plus 10 Node checks = **391 PASS**, TypeScript PASS. Ten new mocked dashboard render cases cover four auth codes in both languages plus unrelated failure in both languages. Prior 20 mocked course-learning renders remain separate from browser evidence. Matching current client/SSR and server runtime builds PASS, with existing bundle/import warnings. Backend 109 and mocked UI 48 are historical results, not rerun here. No automated result establishes a browser concurrency pass. Suspended IDE remains disabled; pure tests do not reopen or accept it.

## Fixture preparation and operational observations

Verified and restored the actually retained ux-continuation.dump (150394 bytes, SHA256 34424C8D12CD845AC68EF0FEE0470272967755691BF5073BFC1FC8990693E4EA) only into inspected isolated journey_test. Missing final Oct9 evidence and 70 EGP ledger were not restored; current fixture wallet is zero. Existing credentials unchanged. Forced expiry/restore/session helper modes were used only on the synthetic student; original subscription dates restored, normal login used after session expiry. Expiry jobs produced synthetic notifications; these are incidental fixture effects.

Initial stale server SSR references pointed to absent rebuilt client chunks. Actual dashboard lazy-load failed. Rebuilt both matching client and server images, then recreated only isolated server/client/nginx. No source workaround; this is a fixture build mismatch. Rebuild both images after every client change.

Native datetime Playwright fill changed displayed DOM without committing React state in package authoring; keyboard segment entry also produced an invalid year and failed save. Supported fresh AX setValue supplied the correct date and actual save/reload proved it. CDP Input was unsupported and performed no action; no browser permission block was bypassed. Do not count failed date entry as successful authoring.

## Retained evidence and current handoff state

Ignored local directory: docker/browser/evidence/journey-ux-20261010. JSON files actual-recovery-matrices, actual-package-matrix, actual-support-matrix and actual-policy-controls contain measured scenario observations; JPEGs include session recovery, package, persisted offers and prepared registration. These artifacts are unavailable merely by pulling Git. The full-page offer screenshot was visually inspected; screenshot image scaling is not the measured CSS viewport.

New local resumed-browser.dump: 152828 bytes, SHA256 C1BAB34D88D93D66068B019992C806F4EE5EC4163936CA57655DC89200164AF0. pg_restore --list passed. It precedes any new registration and contains the draft package/offers; no new restore rehearsal is claimed.

Owned project fayq-journey-ux-20261010 is currently RUNNING for the credential handoff, loopback 8082, IDE disabled and DRM unconfigured. Synthetic Admin logged out. Brave test tab 430329453 marked handoff at English registration, measured 360×800. No cleanup or viewport-reset claim for this resumed checkpoint. Inspected PostgreSQL volume fayq-journey-ux-20261010_journey-pg and Redis volume 613e0b559a5280c4544019088947ab6f786f6e930d8cccec776c942ab227286d belong only to this project. Save a fresh backup and inspect ALL mounts/labels before exact-project down -v after handoff completes or is stopped; preserve evidence/images, verify recorded volumes/network gone. No global prune.

All five owner-preview containers remain healthy with original data mounts; no recreation, owner data change or nested DRM edit. Materials MinIO preserved. No upload, real payment, receipt approval, external delivery or deployment.

## Remaining qualification

Complete remaining support/settings, registration handoff/positive and identity validations, financial edit/conflict controls, package publication/version-conflict controls and dirty-navigation cancellation with actual per-control matrices. Admin creation requires separate security-sensitive authorization; adopted policies require owner decision/confirmation. Cover upload is still required for successful new-course creation; no exemption.

Real playback/fullscreen Escape/rendition switching/active expiry/device enforcement/uploads, real receipt approval, guardian report generation, external delivery and browser concurrency races remain untested or unqualified. Synthetic READY metadata proves none of them. Suspended IDE remains outside verification. Obtain explicit commit/push authorization for reviewed new work; no previous delivery authorization reused.
