Current implementation update, 2026-10-01: the approved FAYQ academic structure now includes both grades with two terms, monthly/revision offers, three-member packages (unpublished members labeled), Cairo fixed deadlines and explicit no-expiry course access until permanent removal. See ../m8-04-completion-report.md for completed implementation and verification. The retained read-only preview uses academic-demo-content.json; earlier generic prototype/demo examples and planning status below are historical.
# FAYQ M8 — whole-site redesign brief

Later academic direction, 2026-10-01: [the school catalog/access contract](../m8-school-catalog-contract.md) supersedes the generic discovery/demo examples: first/second secondary selection, first-secondary terms, monthly explanation and revision courses, three-specific-course packages with one common ADMIN-selected package deadline, and standalone ADMIN-selectable duration or term/year expiry. Specify remaining date/renewal/overlap details before purchase implementation; content month is separate from access validity.

Implementation follow-up, 2026-10-01: [M8-02 shell/landing implementation](../m8-02-shell-landing-report.md) is complete with same-agent verification after the direct owner assignment. The initial planning-only/source-audit notes remain historical; the later report records runtime browser evidence and its limits.

Owner direction recorded 2026-10-01: FAYQ targets **15–18-year-old secondary students**. Redesign the website's structure around that audience, adopt the attached mobile bottom-navigation pattern, use the supplied FAYQ logo/brand board, make the landing page feel real, and use dummy data for development/testing. Both student and admin areas are included; reports begin with summaries, CSV later.

This extends the M8 planning assignment. The artifacts here are a design prototype, source-based audit, demo content and a bounded implementation prompt. The actual React application has not been redesigned in this pass. Existing approved architecture, purchase/access rules and M7 release gates remain in force.

## 1. Design idea

**A place to understand programming and build your first things.** Lead with achievable projects and a clear next step. Use confident short copy, strong editorial hierarchy, restrained code motifs, warm desk lighting and a personal learning area. Avoid both a generic business dashboard on student screens and a childish game interface. Student progress should encourage without public rankings, invented streak pressure or fake success statistics.

The age range describes the intended audience, not a new registration age gate or permission to collect birth dates. Parents/guardians can understand the offer through clear pricing, recorded-lesson access and payment explanations; no parent role or new consent/legal policy is inferred.

Retain FAYQ's forest/lime/amber/cream/charcoal identity. Arabic is primary; English is equally complete. Dark is the initial theme; light is deliberately designed with cream surfaces and forest text. Keep brand colors semantic. Student and admin use the same visual language with different information density.

## 2. Mobile navigation from the owner's reference

Use a floating rounded bottom dock, four labeled icons, and an active icon that rises within its own highlighted circle. Match the reference's shape, rhythm and selection treatment; use FAYQ colors rather than importing the reference's purple palette. A small top bar holds the logo, language/theme controls and a notifications entry when signed in. Eliminate the horizontally scrolling mobile header menu.

Proposed student destinations: **Home / Discover / My learning / Profile**, mirrored in Arabic. Discover leads to course discovery; My learning opens the existing dashboard; Profile provides account, wallet, purchase history, saved courses when implemented, and logout. Notifications remain readily reachable from the top bar. The reference's History label is a visual example, not authority to create a new browsing-history collection feature.

Anonymous My learning/Profile routes give a clear login path and retain the intended destination where supported. Do not manufacture authenticated data. Proposed admin dock: **Overview / Courses / Recharges / Account**, with reports linked from Overview. The admin prototype is a layout concept, not implemented report endpoints.

Technical acceptance: 44px minimum interactive area under the existing design contract, safe-area bottom inset, adequate content/scroll padding, visible keyboard focus and active state, no overlap with dialogs, keyboard, final page actions or video controls. Suppress the global dock in fullscreen; coordinate player focus mode with its controls without terminating playback. Do not reproduce a fake OS home-indicator line from the screenshot. Test keyboard-open behavior on a real mobile browser where possible; desktop viewport emulation alone does not prove it.

The accessibility basis includes [W3C focus-not-obscured guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) and [target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). The project's 44px target is its design requirement, not a claim that WCAG's minimum criterion always requires 44px.

## 3. Landing-page structure

1. Compact brand header with course discovery and a working primary action.
2. Hero: **افهم الفكرة. اكتب الكود. ابنِ حاجة ليك.** / **Understand it. Code it. Build something yours.** Pair readable HTML copy with the illustrated teenage learner. Main action opens courses; secondary action scrolls to how learning works. The English/Arabic slogans retain their approved wording.
3. Three concise benefits: clear explanations, applying what you learn, and recorded lessons with saved progress. Claims must match delivered course content.
4. Featured published courses with distinctive programming artwork, bilingual descriptions, prerequisites/outcomes where supported, explicit EGP price and access duration. Demo content is visually realistic and visibly labeled in the isolated demo; production uses actual published API records.
5. A practical project/outcome block: show what a learner can make, without implying a built-in coding editor, assignment submission or certification.
6. Honest how-it-works flow: choose a course → submit manual recharge if needed → admin verifies/credits → explicitly purchase → learn during fixed access. Keep the payment process concise but correct.
7. Useful FAQ: starting experience, recorded format, subscription duration/renewal and funding. Answers must follow approved policy.
8. A focused final course-discovery action and accessible footer. Support/contact/legal links require real destinations and owner-approved content; no placeholder external contact details.

Remove process/database health cards from the marketing landing page; existing health endpoints remain operational interfaces. Do not advertise an AI assistant from the mood board. AI course marketing is appropriate only for real corresponding course content. Do not invent testimonials, student counts, employment guarantees, star ratings or limited-time urgency to make the page feel real.

## 4. Every existing route: audit and redesign target

Audit method: inspected the route union, App shell, Header/Wordmark/HomePage, and the existing feature-page structures/forms/actions. This is a source audit. The in-app browser could not initialize (`failed to write kernel assets`, OS path error); no claim is made that authenticated existing pages were opened live. The separate design prototype is tested in isolated Docker Chromium.

| Current route / principal source | Observed structure | Redesign target |
| --- | --- | --- |
| home / HomePage.tsx | Brand hero, repeated benefit cards, catalog, how block, health cards | Editorial project-led story; custom imagery; clear outcomes/FAQ; remove health cards from student marketing |
| courses / PublicCatalogPage.tsx | Repeated course-card grid, generic code banner, no search control | Distinct course artwork and useful offer metadata; discovery/search in its approved feature package |
| course-detail / OfferPage.tsx | One large offer card containing description and plan rows | Course identity/outcomes above fold; separate readable plan review; meaningful subscription-gated message; no protected outline leak |
| register / RegisterPage.tsx | Existing labeled identity form | Focused onboarding, short copy, clear errors and required email/phone; no invented age/role field |
| login / LoginPage.tsx | Existing either-identifier form | Clear returning-student screen; email-or-phone instruction; no password-recovery promise without an approved channel |
| account / AccountPage.tsx | Profile/session actions in form-card layout | Profile hub with wallet/history/settings links; safe logout/all-session controls; no social/public profiles |
| admin / AdminUsersPage.tsx | Admin-only user-creation form and administration links | Separate admin overview/navigation from the preserved admin-creation task; summary metrics only after real authorized APIs exist |
| wallet / WalletPage.tsx | Balance, channel instructions and recharge-history cards | Clear balance hero, one recharge action, readable transfer instructions and timeline/status; no card-payment styling |
| wallet-recharge / RechargePage.tsx | Large funding form and submitted state | Guided form sections, selected-channel instructions, proof affordance, pending-review confirmation; preserve fields/file limits and CSRF |
| purchases / PurchaseHistoryPage.tsx | Repeated purchase cards | Readable receipt/history list, course titles, EGP amounts, purchased duration and timestamps; never editable financial rows |
| purchase / PurchasePage.tsx | Review/confirm/receipt phases in centered cards | Focused order review with current balance, exact price/duration and resulting access; explicit purchase/recharge actions |
| admin-recharge / AdminRechargePage.tsx | Status buttons, queue and decision dialog | Triage workspace with clear selected-request detail/proof and verified-receipt controls; readable confirmation and immutable decision states |
| dashboard / DashboardPage.tsx | Active/expired card grids and empty states | Prominent continue section, real progress, expiry cues, relevant renewal action; saved area only when backed by its API |
| notifications / NotificationsPage.tsx | Unread/count/read controls and notice list | Compact inbox with clear read state and sensible grouping; preserve read-all fence, privacy and no dismissal |
| learn / CourseLearningPage.tsx | Protected outline beside player and progress merging | Focused learning layout with lesson navigation, visible access/error/renewal states; no remount on cosmetic/filter changes |
| admin-catalog / AdminListPage.tsx | Search form and status/course cards | More scannable course workspace, accurate lifecycle/bilingual/readiness cues and purposeful create action |
| admin-course / AdminDetailPage.tsx + editors | Sequential forms for metadata, lifecycle, plans, sections, lessons, repeated deletion panels | Group into Overview / Curriculum / Pricing / Publication; keep destructive actions in an explicit advanced area with truthful states |

Specific source observations: SectionEditor currently has an English literal `Sections`; include bilingual cleanup. OfferPage's subscription anchor uses white text over the lime primary background; verify and correct the actual contrast in the affected implementation. Admin course editing exposes repeated deletion panels in the main content flow; reduce their visual prominence while retaining required confirmations and external-deletion semantics. These observations do not replace runtime testing or claim reproduced defects.

Admin improvement is about workflow clarity, not disguising the recharge queue as an ordinary student course page. On mobile use stacked details/cards; on wider screens use bounded tables/workspaces where scan density helps.

## 5. Logo and assets

The user's actual reference files are preserved in [the reference folder](reference/fayq-brand-board.png) and [navigation reference](reference/mobile-bottom-nav.png), so another executor does not depend on the Downloads/OneDrive originals. Never render the entire brand board as a page background or a logo.

Current Wordmark uses plain HTML FAYQ and a custom rounded Q icon. The requested brand has angular FAYQ lettering, a distinctive Q tail and amber rays. [The vector concept](assets/fayq-wordmark-concept.svg) is an editable approximation built from those cues, **not an extracted original**. Compare it against the board at header/app-icon sizes before adoption. The production executor must use a clean original logo if available, or clearly document a faithful reconstruction and its visual differences. Keep an accessible name and one canonical reusable component; do not leave different Q designs across header/login/footer.

[The hero illustration](assets/fayq-learning-hero.png) is AI-generated marketing artwork, not a photo of a real student. Generated with the built-in Image Generation tool from the board as style reference; copied into this workspace and visually inspected. [Asset notes](assets/README.md) contain its exact prompt/provenance. Production should use optimized responsive assets with deliberate dimensions, alt/decorative handling and a loading strategy. Do not bake marketing text into the illustration. Existing self-hosted fonts remain the production source.

## 6. Dummy data and testing

[demo-content.json](demo-content.json) supplies illustrative bilingual course/plan content. The prototype embeds the same three course concepts; none is a production offer or real testimonial. Use synthetic `.example.test` identities in actual fixture tools, synthetic bank references, scoped receipt files and exact run ownership.

Actual app testing needs a separate, visibly labeled demo stack/database through supported platform APIs and reviewed helpers. Funding fixtures must exercise pending/approve/reject and real ledger effects; do not hardcode a balance into a live authenticated component. Learning fixtures cover active, expired, not-started and partly completed access. Course management fixtures cover DRAFT/PROCESSING/READY/PUBLISHED/ARCHIVED only through legitimate contracts: no invented external asset marked READY to bypass DRM. Public design-only sample cards can be local prototype data; actual runtime catalog remains API-backed.

No production seed on server startup, public credential endpoint, role bypass, global fixture deletion, fake media grant or merging of DRM database data. Do not seed or delete the existing port-8082 preview. The owner requested dummy data for testing, not fictional live claims.

## 7. Implementation sequence and review

Revise the prior M8 sequence to lead with visual foundations and a real-looking landing page:

1. M8-01: logo/assets, approved teen direction and screen/state contract; source/design audit plus prototype review.
2. M8-02: shared responsive shell, mobile dock, landing page and isolated demo fixtures; **stop for review**.
3. M8-03: academic/access contracts first, then actual grade/term/month/revision discovery; three-course package/access implementation is separately bounded; saved/search features follow agreed scope.
4. M8-04: student dashboard, account/wallet/purchase and identity UI in bounded subpackages if necessary.
5. M8-05: protected learning navigation/player UI and actual affected playback verification.
6. M8-06: admin overview, course editor and recharge review; split financial review from catalog editing when the diff is large.
7. M8-07: admin summary reports; CSV deferred.
8. M8-08: complete changed-journey regression and separate review/owner acceptance.

This pass creates an [implementation prompt for M8-02](../m8-02-codex-redesign-prompt.md), not a dispatch. It covers the first visual package only. Future packages receive their own prompts and scope decisions. Preserve OpenCode's M7 work and reread its reviewed baseline before changing application files.

## 8. Suggested additions for owner consideration

These are proposals, not activated features:

- A small **“What will I build?”** block per course, backed by admin-authored bilingual outcome content.
- A simple **“New to programming?”** path through course prerequisites, using honest metadata rather than a skill-placement test.
- Better payment understanding: a compact timeline from request submitted to approved balance to purchased course.
- A one-action resume card and calm expiry reminder based on existing subscription data; no new notification event by implication.
- An optional public sample lesson, only if the owner selects content and approves a separate public-preview/DRM access contract. Never use a full-course access bypass to create it.

Start with outcomes, navigation and workflow clarity. Additional gamification, quizzes, certificates, AI assistants and communications need their own scope and policies.
