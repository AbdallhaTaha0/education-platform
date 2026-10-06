Current implementation update, 2026-10-01: the owner authorized direct completion and resolved second-secondary terms, unpublished package members, fixed-deadline extension and explicit access until permanent removal. The approved academic/backend and student/admin UI are now implemented; see m8-04-completion-report.md for source scope, final Docker evidence and remaining release limits. Earlier planning/proposal paragraphs below are historical. Unapproved saved-course, practice/assessment, AI/chat and CSV policies remain deferred; they are not silently included. M8 owner acceptance and production qualification are separate from implementation.
# M8 plan — student learning, admin tools and UI improvements

Academic scope update, 2026-10-01: [the confirmed school catalog/access direction](m8-school-catalog-contract.md) now takes priority over generic course-discovery examples. First/second secondary, monthly courses, revisions, first-secondary terms, three-member packages with one common ADMIN-selected end date, and standalone admin-selectable duration/term/year expiry require **M8-03A academic/access contracts before M8-03B discovery**. Exact deadlines, renewal/overlap and remaining access details stay pending; saved/search features follow this structure rather than defining it.

M8-03A design follow-up: [the academic data and purchase design](m8-03a-academic-data-and-purchase-design.md) is source-reviewed and documented. Candidate schema/API, financial atomicity, legacy backfill and rollout are concrete. The owner confirmed overlap warnings without a purchase ban and explicit Cairo-time deadlines saved at purchase; unpublished-member eligibility remains under clarification before dependent implementation.

Execution update, 2026-10-01: the owner subsequently assigned Codex directly to work on M8. [The first application shell/landing package](m8-02-shell-landing-report.md) is implemented with same-agent Docker evidence, ready for review. The planning status below is historical; remaining feature contracts are still proposals, and whole-milestone acceptance is not recorded.

Planning date: 2026-10-01. Status: **working draft; planning only**. The owner requested M8 planning while OpenCode completes M7-04. No M8 implementation, worker dispatch, migration, deployment or milestone acceptance is authorized by this document.

Owner design clarification: target ages **15–18**, redesign the complete website with the supplied FAYQ brand/logo, use the supplied mobile bottom-navigation pattern, add dummy data for testing and make the landing page feel real. [The whole-site redesign brief](design/website-redesign-brief.md), [interactive design prototype](design/preview.html) and [bounded Codex implementation prompt](m8-02-codex-redesign-prompt.md) make that direction reviewable. The prototype is separate from the application; source files have not been redesigned in this planning pass. The clarification approves this design direction, not every proposed new feature or unfinished report policy.

## 1. Confirmed direction and remaining choices

The owner selected both new product features and UI improvements, then selected both student learning and admin tools, and both student and admin screens. The owner subsequently selected **summary screens first; CSV later**. These choices confirm the areas of work and reporting format. Individual feature rules, report definitions and visual changes below are proposals until approved.

**Proposed outcome:** students can find a course, save it, resume their learning and find the right subscribed lesson more easily; admins can manage courses and recharge requests with clearer screens and inspect accurate summaries of platform activity.

The existing roadmap ends at [M7 production qualification](../../plan.md). M8 adds product and UI work; it does not move unfinished TLS, recovery, monitoring, commercial DRM or 10,000-user qualification into a feature milestone or claim those gates are complete. Local M8 development can follow review of the M7 dependency changes without waiting for every hosting decision; any production release still requires the relevant M7 qualification and owner release decision. If M8 changes the qualified application, affected release checks must be repeated for that new revision.

Immediate choices:

| Choice | Current state | Proposed first version |
| --- | --- | --- |
| Student/admin coverage | Confirmed: both | Both workstreams below |
| UI coverage | Confirmed: both | Student dashboard/catalog/player and admin home/catalog/recharge/report screens |
| Concrete new features | Proposed | Saved courses, protected lesson search and admin summaries |
| Report format | Confirmed: summary screens first; CSV later | No CSV implementation in M8's first version |
| Report date boundaries and definitions | Unapproved | Explicit date range, stated timezone, separate purchase/recharge/balance measures |
| Saved-course behavior | Unapproved | Private signed-in list; saving grants no subscription or protected content |
| Visual direction | Confirmed: FAYQ for ages 15–18; supplied mobile-dock reference; whole-site redesign and realistic demo landing | Brand-specific page structures, bottom dock, consistent logo and sample content; retain approved palette |

## 2. Existing behavior to preserve

Source inspection establishes the following current behavior; it is not a new runtime test:

- `client/src/features/learning/pages/DashboardPage.tsx` already separates active/expired subscriptions and displays progress. `server/src/modules/learning/dashboard/service.ts` already calculates course progress and a resume target. M8 improves presentation and navigation; it does not introduce a new completion policy by implication.
- `client/src/features/learning/pages/CourseLearningPage.tsx` already displays the protected outline and merges progress without reloading/unmounting playback. Search and layout changes must retain this property.
- `client/src/features/catalog/pages/PublicCatalogPage.tsx` renders public offers, prices and durations. The inspected component has no search controls. Search/discovery work must use public metadata and never expose protected lesson lists.
- `client/src/features/wallet/pages/AdminRechargePage.tsx` already supports status filters, proof review, receipt verification and approve/reject actions. Queue improvements must preserve those existing financial safeguards.
- The inspected platform schema has durable progress, subscriptions, wallet ledger, purchase and notification records, but no saved-course model. Persistence for saved courses requires a reviewed platform-only migration if that feature is selected.

The current authority remains [approved decisions](../../decisions.md), [requirements](../../requirements.md), [rules](../../rules.md) and [FAYQ design](../../design.md). Old Stitch pages and contradictory historical token examples do not override the current FAYQ brand and the root instructions. Read current source again before implementation; OpenCode's concurrent work may change the baseline.

## 3. Proposed feature boundaries

### Student learning and discovery

1. Public course search using approved title/description fields; clear no-results/reset states. Sorting uses available, accurately defined fields. Topic/level filters wait for an approved source of those labels; do not fabricate categories from course names.
2. Private saved courses with save/remove/list, persisted per signed-in student so the list survives device changes. Saving is distinct from purchasing. Proposed behavior for unpublished/removed courses is to hide unavailable offers; final behavior must be decided before the contract is issued.
3. Improved dashboard: a prominent continue action, clear progress and expiry, coherent active/expired/saved sections and a route to the relevant offer when renewal is needed. Reuse existing backend progress and entitlement rules. Decide ordering and fallback when no incomplete playable lesson exists.
4. Protected lesson search within an already authorized course outline, using translated section/lesson labels. Search must not start playback or request a DRM grant. Selecting a result is an explicit lesson-selection action; expiry still denies access.
5. Better mobile player/outline layout, loading/error/retry states and keyboard navigation. Keep the video, watermark, progress flush, renewal and expiry lifecycle intact. A cosmetic state change must not recreate the player or drop an active session.

### Admin tools and reporting

1. Clear admin home linking to courses, pending recharges and reports. Counts must come from authorized server data; decorative statistics are not product evidence.
2. More usable course management: status and bilingual-completeness cues, bounded search/filter/pagination where needed, clearer upload/processing/error information and accessible editing actions. Existing publication/deletion contracts stay authoritative.
3. Improved recharge queue: clear pending/approved/rejected states, readable EGP amounts and references, proof access, receipt confirmation and rejection reasons. No bulk approval, approval from proof alone, refund or correction-credit feature is implied.
4. Admin-only summaries covering purchases, approved/rejected/pending recharge activity, subscription state and course activity where the existing data supports an accurate definition. Every metric needs a contract: source rows, status filter, date field, timezone, units and treatment of renewals/deleted courses. Query limits and pagination must be explicit.

Purchase totals represent wallet spending on plans; approved recharge totals represent money credited after verified manual funding; wallet balances represent remaining credit. These measures must be labeled separately. Do not label a recharge total as course sales or invent accounting revenue-recognition rules. Charts show real aggregates or clearly labeled test fixtures, never generated live-looking values.

Personal notes/bookmarks inside videos, quizzes, certificates, ratings, chat, email/WhatsApp, AI helpers, automated payments, password recovery, extra roles and offline/downloaded protected video are outside the proposed first version. They may be discussed as separate future features; choosing new features broadly does not approve their policies.

## 4. UI acceptance contract

Retain FAYQ forest/lime/amber/cream/charcoal tokens, Arabic as the default, English parity, RTL/LTR and dark-default/light themes. Keep semantic tokens and shared components easy to revise. Existing cookie authentication and sensitive-data handling remain unchanged.

Each selected screen needs a defined ready/loading/empty/error/unauthorized state and a meaningful primary action. Selected feature controls must work through real APIs; no permanently disabled or placeholder feature claims. Course prices and durations remain server-owned. Recharge approval, wallet credit and explicit course purchase remain clear separate steps.

Verification covers desktop/mobile, both languages and both themes; keyboard focus, labels, screen-reader names, dialogs, mixed-direction references, text/controls contrast, tap targets, long translations, zero horizontal page overflow and error recovery. Test the actual changed journeys, including expiry and unauthorized navigation, rather than treating screenshots as authorization evidence. Use the existing design contrast bars; do not lower them to pass.

## 5. One package at a time

This is a proposed sequence, not an instruction to start all packages. The manager issues only the next bounded prompt after reviewing the preceding result. Each package reports actual changed files, Docker commands, failures, evidence, cleanup and rollback.

| Package | Bounded deliverable | Exit evidence and dependencies |
| --- | --- | --- |
| M8-01 Scope and contracts | Approved feature list; report dictionary; saved/search rules; teen-focused whole-site screen/state inventory, logo comparison and layouts | Owner resolves feature-policy questions; source mapping and prototype review; no application implementation claim |
| M8-02 Shared shell and landing | FAYQ logo/assets, floating mobile dock, responsive navigation, real API-backed landing and isolated demo fixtures | Docker typecheck/build; bilingual/theme/mobile/accessibility and route evidence; no fake live features |
| M8-03 Academic contracts, then discovery | M8-03A grade/term/month/revision and configurable access contract; M8-03B published academic navigation; bundle/access implementation separately; saved/search follow agreed scope | Owner confirms remaining bundle/deadline/renewal terms; additive migration review; correct grouping; authorization and atomic multi-course purchase/expiry before shipping bundles |
| M8-04 Student screens | Clear continue/progress/expiry/saved dashboard plus coherent identity/account/wallet/purchase UI; split into subpackages as needed | Correct ordering/resume/renewal targets; empty/expired/payment states; no changed completion, money or access rules; affected student browser journeys |
| M8-05 Protected lesson navigation and player UI | Search of authorized outline, responsive navigation and player-state improvements | Unsubscribed/expired denial; explicit selection; no search-triggered grants; real affected playback/renewal/progress/expiry evidence through the external API boundary |
| M8-06 Admin workspace | Admin home, course management and recharge queue improvements | STUDENT denied; publication/bilingual/media states; approval/rejection/receipt controls; duplicate decision and exact wallet behavior unchanged |
| M8-07 Admin reports | Agreed bounded aggregate APIs and accurate summary UI; CSV deferred | Independent sums/counts from owned fixtures, date boundaries/timezone, renewal/state cases, privacy/role matrix and query-limit checks |
| M8-08 Final review | Combined regression, scope audit, migration/rollback evidence and owner walkthrough | Separate implementation/review evidence; no blocking scope/security/financial/player finding; owner M8 acceptance recorded explicitly |

Actual files are assigned after M8-01. Use `client/` and modules inside the same Express `server/`; no reporting microservice, analytics provider, new broker or DRM persistence access is implied. New schemas are platform-owned and additive where feasible; immutable applied migrations stay unchanged. Large reports must not cause unbounded table reads or become a route around admin authorization.

Package 03 may require a new migration; package 07 may need indexes. Neither need is approved SQL in this plan. Measure/query-review before choosing indexes. Cosmetic packages require no invented migration. If a genuine product defect is found, record it with affected behavior rather than hiding it as a visual improvement.

## 6. Baseline, verification and release gates

At planning time, platform HEAD is the accepted M6 checkpoint `31ca60d3a2d832b704423060f3d55da7eae65ee3`; uncommitted M7 work is present. M7-01/02/03 have manager review; OpenCode is executing M7-04. Direct [M7-05 client tooling work](../m7/m7-05-client-tooling-report.md) has same-agent verification, with independent review pending. Read the final reviewed M7 state before assigning M8 implementation; do not use these observations as acceptance of concurrent work.

M7 prerequisites relevant to M8 development: reviewed working dependency graph/images and a stable recorded baseline. Outstanding server build/migration dependency debt remains an M7 issue. M7 qualification prerequisites relevant to release: approved deployment shape/secrets/TLS, monitoring, recovery/backup objectives and restore evidence, commercial DRM/provider decision, approved workload and capacity results. Formal M5 acceptance is separately unrecorded; local ClearKey evidence does not establish commercial DRM.

All implementation installs/builds/tests use Docker. Inspect resolved project volumes and labels before isolated startup/cleanup, preserve the existing preview, and never remove another executor's containers. Use run-owned fixtures with exact cleanup, no production financial data, broad deletes or external stress traffic. Real external mutations/playback verification require the existing supported authorization/fixture scope; M8 does not grant DRM maintenance.

A package's test scope follows its actual diff. Money/authorization/migration/player changes need meaningful affected checks and applicable full regressions. Pure layout work uses relevant browser/accessibility checks plus build/typecheck; do not repeat unrelated suites merely to inflate counts. Audit and exact image/revision identities accompany the final candidate. Production/release approval is requested only against a concrete reviewed candidate; a plan is not that candidate.

## 7. Planning completion and next discussion

Before M8-01 can become an implementation contract, agree:

1. Which proposed new features are actually included and their priority; the owner has approved coverage areas, not every feature rule.
2. Saved-course visibility for unavailable courses and whether saving is limited to students.
3. Public-search fields and ordering; lesson search is limited to authorized outlines.
4. Exact admin report measures, date/timezone rules and access/privacy. CSV is already deferred by the owner.
5. Selected screen layouts and states within the current FAYQ identity.

Do not require decisions about excluded quizzes/certificates/payment channels to begin the approved core. Record accepted answers with owner/date and affected documents during integration; until then, keep them in this draft without changing `decisions.md`, the original design or the shared index while OpenCode is writing.

Planning deliverables now include this document and the linked redesign brief, prototype, reference/assets, demo content and reusable Codex prompt. Docker verification applies to the standalone prototype only; it does not constitute application implementation. No worker was dispatched. Estimates/calendar dates follow approved scope and observed package effort; no schedule or capacity promise is made.

## Owner clarification — optional course expiry (2026-10-01)

The owner explicitly clarified that a course may remain accessible after purchase without any expiry, until permanent removal by ADMIN. This supersedes the earlier mandatory-duration wording for M8 standalone offers. ADMIN chooses DURATION, TERM_END, YEAR_END or UNTIL_REMOVAL explicitly. UNTIL_REMOVAL stores a null expiry, not a fabricated distant date. Existing paid terms are immutable; later offer changes apply only to new purchases. Indefinite access dominates finite grants, produces no subscription-expiry notification and must not trigger expiry-based playback termination. Publication/archive/deletion protection and the external DRM API-only boundary still apply. Packages retain the previously approved one shared ADMIN-set deadline.

The owner also confirmed: SECOND_SECONDARY has terms 1 and 2; packages may contain unpublished monthly courses with clear presale labels and no viewing before publication; overlapping ownership warns without blocking package purchase; repeat standalone purchases with a fixed deadline are permitted only when they add access. Existing indefinite access prevents redundant standalone payment. These answers resolve the corresponding pending owner questions; historical proposals remain historical.

Acceptance: nullable-expiry migration preserves finite records; guarded offer creation/edit, one debit and idempotent replay; immutable indefinite purchase snapshot; indefinite entitlement despite expired finite rows; no expiry notice or termination; unpublished package purchase without content leakage; fixed-deadline extension/no-extension cases; bilingual admin/student access labels.
