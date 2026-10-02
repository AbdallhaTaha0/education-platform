# FAYQ UX implementation — 2026-10-02

Dashboard/navigation follow-up: [completed hybrid desktop/mobile workspace and centred form actions](../dashboard-navigation-20261002/worker-report.md) are now served on localhost:8080, with fresh Docker/browser evidence and preserved retained data.

Support follow-up: the owner subsequently supplied the public email/phone and requested editable settings. See [the bounded support package](../support-contact-settings-20261002.md); support configuration is now implemented. Historical references below to pending contact details describe the earlier UX delivery. Policy adoption remains pending.

The owner requested completion of [the website UX review](../ux-review-20261002/report.md), including optional features after clarification. This report maps that review to the implementation. The original audit remains historical evidence; its “proposed” wording describes the earlier review date.

## Decisions and boundaries

- Password recovery stays through admin assistance until a delivery provider is ready. Login links to recovery help. The owner-provided support contacts are now configured and editable; no message is falsely reported as sent and no unapproved admin-reset or identifier-verification process was added.
- Authenticated account editing permits display name and password only. Password changes verify the current password and revoke other sessions, preserving the current session. Email, phone and role cannot be edited through this API.
- Bilingual terms/privacy/refund drafts are available to ADMIN for review. Public pages say the policies have not been adopted. Support contact details were subsequently supplied and made editable; approved policy wording remains an owner input.
- One Express backend, React client, cookie credentials, STUDENT/ADMIN roles, external DRM API boundary, existing pricing/access rules and private grading remain. No production, capacity or milestone acceptance is inferred. No commit/push.

## Review findings implemented

| Original recommendation | Delivered behavior |
| --- | --- |
| Visible, actionable admin errors | Persistent dismissible popups, precise question-field links/inline feedback, preserved values and obsolete-editor-error cleanup from the preceding safety package. |
| Unsaved drafts | Server-save status and leave confirmation for assessments; dirty guards for course metadata, offers, section/lesson creation and renaming, and account changes. Native unload protection remains. |
| Course-page overload | Four course workspaces: lessons/video, details, pricing/access, publishing/actions. Only the selected workspace is mounted. |
| Unsafe deletion presentation | Collapsed actions under their named entity, impact explanation, slug versus UUID labels and exact typed confirmation. Existing API protections remain. |
| Arabic raw labels/typo | Business status/media/deletion labels and lifecycle explanations translated. Removed the stray Russian word. Code/identifiers remain LTR. |
| Admin catalog/list-first | Creation is a separate primary action; search plus state/grade/term filters, counts, clear reset and no-results guidance. These filter the loaded catalog; no capacity claim or speculative pagination rewrite. |
| Lifecycle clutter | Available next transition, readiness checklist and one archive control. Server transition checks remain authoritative. |
| PROGRAM workflow/private distinctions | Focused full-screen authoring, keyboard focus containment/background isolation, explicit Save → Prepare → Review → Publish, current revision context, exact-draft preparation and review before enabling publication. Reference solution and optional shared starter have distinct labels. |
| Package eligibility/refresh | List-first creation, three matching monthly-course guidance, management link, disabled impossible creation and separate refresh/retry labels. Existing package rules retained. |
| Submissions | Focused review, bounded summaries and one selected answer. Student/result filters explicitly apply to the current page; pagination remains. |
| Admin recharge | Loaded-request search/date filters and no-results guidance; focused details/proof, transfer date and reference. Approval requires independent verification and completed review disables another confirmation. No bulk approval. |
| Overview/navigation | Consistent ADMIN navigation, actionable pending recharge link, management links on relevant metrics and correctly named Create admin page. Wallet balance remains explicitly distinct from revenue. |
| Allowance management | Selected student's name/email, action-specific success, invalid-limit disablement and existing recurring-reset explanation. |
| Login/signup | Mutual links, identifier examples, password visibility preserving input, recovery-help link. |
| Owned course/purchases | Student-facing offer wording, continue-learning actions on owned offers/checkout, course identity and receipt reference in purchase history. Current catalog identity is shown alongside unchanged historical paid terms; unavailable identity has a fallback. |
| Recharge configuration | `PAYMENT_UNCONFIGURED` becomes a clear unavailable state with disabled inputs; transient instruction failures retain retry. Selected proof filename/size and manual-review next step are explained. |
| Student learning/help | Direct links to assessments blocking a lesson; local Run versus official Submit explanation; beginner practice example, counted-Run guidance and existing draft-save status. Contextual notification empty link and account shortcut hierarchy. |
| New optional pages/features | Bounded, searchable ADMIN student directory; own display-name/password changes; bilingual support FAQ; ADMIN policy drafts/public pending-policy pages; useful not-found route. |

## Complete page coverage

Home keeps duration/deadline/no-expiry wording and adds signup discovery. Public catalog adds counts/reset/no-results; course offers and checkout handle existing ownership. Populated package detail retains included-course and unpublished-member explanations. Registration/login add navigation and visibility. Account adds protected settings. Dashboard retains next-lesson/progress and expiry context with corrected Arabic. Learning adds blocking-assessment links after entitlement checks. Practice and assessment add beginner/local-versus-official help. Notifications add a contextual empty link. Wallet/recharge distinguish missing configuration and show the manual verification path. Purchases retain paid snapshots with clearer course identity. All admin routes have management navigation and the course, assessment, submission, package, recharge, identity, directory and quota improvements listed above.

New routes are `#/admin/students`, `#/support`, `#/terms`, `#/privacy`, `#/refunds` and `#/admin/policies`. Unknown routes show a not-found page. Student directory access is guarded in the backend as well as the UI; policy drafts contain only labelled review text and require ADMIN in the UI.

## Backend review

`PATCH /auth/profile` uses existing origin/session/CSRF and rate-limit middleware. A strict field whitelist prevents identifier/role changes. Password hashing happens outside a transaction; the transaction locks the user, checks the active owning session and unchanged password hash, writes the new hash and revokes other session families atomically. A login verified against an old hash is fenced before session creation, including concurrent password changes. Returned users exclude hashes. Existing per-request durable session checks enforce revocation.

`GET /admin/students` requires ADMIN, bounds search length and returns 20 summaries plus a cursor. It selects only ID, display name, email and creation time. No passwords, proof bytes or session tokens are returned. Learning outline adds IDs from the existing server lock calculation; it does not bypass entitlement checks. No database migration or historical rewrite is needed.

## Verification and preservation

Docker verification passed: **189 backend unit tests, 306 integration tests, 88 frontend unit tests and 2 DASH compatibility checks**; backend/client type checks and final client production build passed. Six new integration tests cover profile authorization/CSRF, protected fields, wrong/current password, other-session revocation, concurrent changes/login fencing and bounded directory access/search. The existing learning test now also checks blocking-assessment IDs.

The existing critical browser/controller flow passed **96 checks**. The new website flow passed **39 checks**, including two populated courses with multiple sections/lessons, English desktop, Arabic at an actual 390×844 viewport, full-width mobile fields, packages/presale, named deletion confirmation, unsaved tabs, directory paging/search, owned continuation, protected policy pages, unavailable recharge, populated proof review, one-time synthetic approval, preserved failed-password input and revocation of a second browser session. No browser/React exceptions. Subsequent runs targeted only the new UX flow while fixing its selectors, fixtures and evidenced UI defects; unchanged grading suites were not repeatedly rerun. The optional inspection CLI remains skipped because its earlier event-stream connection was unavailable; this is not reported as a passing check.

Screenshot review exposed the mobile form-column issue and the browser exposed a missing direct recovery link plus the `PAYMENT_UNCONFIGURED` handling issue. These were fixed and affected checks rerun. [Screenshots](screenshots/) include [Arabic mobile course](screenshots/ux-course-ar-mobile.png), [publication readiness](screenshots/ux-course-publishing-en.png), [focused problem workflow](screenshots/m9-program-private-tests.png), [submission review](screenshots/m9-submission-review-mobile.png), [directory](screenshots/ux-directory-en.png), [recharge proof](screenshots/ux-recharge-proof-en.png), [account settings](screenshots/ux-account-settings-en.png), [package detail](screenshots/ux-package-detail-en.png) and [policy drafts](screenshots/ux-policy-drafts-en.png). All pictured records are synthetic; the proof is a placeholder, not a real receipt.

The retained preview upgrade created a protected ignored PostgreSQL backup, applied the migration command without new schema changes, and verified matching existing user/wallet/purchase/subscription/catalog/media fingerprints and reached-lesson preservation. It refreshed only platform services on **http://localhost:8080**. Platform HEAD remains `1113aab0519053ecfde5d3204903f0abb3a48c1e`; work is uncommitted. External DRM remains clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.

Docker verification uses isolated PostgreSQL/Redis and synthetic users, courses, packages and recharge proof. Fake READY video mappings permit outline checks; they are not a new proof of real playback. Execution code was not changed. Previous restricted execution evidence remains applicable to unchanged execution internals. The guarded test projects were cleaned after success and every failed run: owned containers/networks/volumes **0/0/0**; fixture JSON removed. Owner preview volumes, stopped unrelated projects, real media, historical quizzes/passes, financial records and prior uncommitted work were preserved. No DRM edit, commit or push.

The remaining owner input is reviewed policy adoption. Support contacts are now provided and editable. Provider-backed recovery and identifier changes remain outside the approved implementation. The original report's representative-admin usability study, conditional catalog pagination, additional programming languages/DOM preview, deployment and capacity qualification remain future work, not hidden completed claims.

Final retained-preview browser check passed: rendered content, readiness HTTP 200 and no page exceptions. Final diff whitespace check passed. No owned test or preview-check browser resource remains.
