# M8 school catalog and configurable access contract

Date: 2026-10-01. Owner clarification replaces the earlier generic programming-course discovery examples. Requirements below are confirmed where stated; application schema/API/entitlement changes have not been implemented by this documentation update.

## Confirmed academic structure

- Initial offerings serve first and second secondary grades (أولى ثانوي / ثانية ثانوي). This is catalog targeting, not an age/grade registration restriction.
- Each grade contains monthly explanation courses: each teaching month is its own course, rather than a lesson section within one generic course.
- A three-month package contains **three specifically identified monthly courses**, confirmed by the owner. It is not a rolling grade-wide three-month subscription, nor automatically a 90-day access plan.
- The owner confirmed **one common end date selected by ADMIN for the whole package**. Access granted by that package to all three courses ends at that date; do not copy each course's standalone expiry rule into the package purchase.
- Revision courses are distinct offerings alongside monthly explanation courses. They remain recorded courses under the existing external DRM boundary.
- Both first and second secondary have term 1 and term 2, explicitly confirmed by the owner.

## Confirmed access direction

The owner specified that timing is configurable per course by ADMIN: some content remains available until term end or academic-year end, while other content has a duration. A duration field therefore cannot be mandatory for every course.

The current approved contract supports four explicit access choices:

| Admin choice | Intended student explanation | Remaining precision |
| --- | --- | --- |
| Duration-based access | Available for the configured duration from purchase, under existing immediate-start rules | Existing bounded integer-day representation is the current baseline; UI should retain explicit units |
| Until term end | Available until the applicable term deadline | Actual term/year association, exact deadline/time and source of the admin-entered deadline |
| Until academic-year end | Available until the ADMIN-configured academic-year deadline | Explicit Cairo date/time |
| Until permanent removal | No expiry; access lasts until ADMIN permanently removes the course | Explicit UNTIL_REMOVAL mode; existing archive/publication guards apply |

Explicit UNTIL_REMOVAL access is approved and has no expiry until permanent ADMIN removal. Merely omitting duration does not choose this mode. The implementation uses these four Prisma enum values. Fixed deadlines are truthful ADMIN-configured dates; school-calendar dates are never inferred.

This owner update supersedes the earlier universal integer-day-only assumption for future M8 offer design. It does not retroactively rewrite existing purchases or current application behavior. Expiry continues to be enforced by the server and external session APIs. Recharge approval still credits the wallet only; a student must explicitly buy the course/package.

## Remaining access details

The shared package end date is confirmed. Package cards, purchase review and My learning must show that common deadline clearly. Standalone course purchases retain their selected duration/term/year rule. A later package edit must not silently rewrite purchased terms; overlapping standalone and package access needs a reviewed rule before implementation.

Owner follow-up: existing active access to a member course requires a warning, not a ban on package purchase. Explicit ADMIN date/time entry in Africa/Cairo is approved; purchase snapshots the instant and later edits affect new purchases only. Unpublished members are explicitly allowed with no viewing before publication. Repeat fixed-deadline purchases are allowed only if they add access. No refunds, discounts or recurring billing are inferred.

## Intended discovery UI

Start with a clear grade choice. For first secondary, show term 1 / term 2, then monthly explanation courses and revision offerings for that term. For second secondary, expose its confirmed monthly/revision organization without assuming term rules. Present three-course packages alongside the relevant offers, showing their three member courses distinctly.

Offer cards and purchase review should eventually separate **teaching month/package contents** from **access validity**. Display truthful grade, term where applicable, teaching month where applicable, explanation/revision type, EGP price and selected access terms. Month names, academic years, term dates, subject/category and package memberships are admin-authored metadata, not classifications parsed from titles.

Student My learning should group purchased courses by their real academic metadata and show each applicable expiry. Admin course editing should group academic placement, explanation/revision type, pricing, access choice and package management clearly. Mandatory Arabic/English content and publication safeguards remain unchanged.

## Actual implementation impact and sequencing

[M8-03A's concrete data/purchase design](m8-03a-academic-data-and-purchase-design.md) now records the source constraints, candidate models/API, transactional three-item grant, migration/rollout and unresolved owner policies. It is a design package, not an applied schema or implementation acceptance.

The existing SubscriptionPlan references one Course and requires durationDays; Purchase/Subscription snapshot integer-day terms. It does not implement a reviewed three-course package or fixed academic deadline. Consequently this needs platform schema/API/purchase/expiry changes, not only visual filters or renamed plan labels.

Recommended sequence within M8-03:

1. **M8-03A academic/access contract:** incorporate the confirmed common package deadline and settle minimal bilingual admin metadata, dates/renewals, migration treatment of existing courses and immutable purchased terms. Review the additive platform-only schema and API contract before implementation.
2. **M8-03B academic discovery:** build actual grade/term/month/revision navigation using published API metadata, with loading/empty/unavailable states. No hardcoded live memberships or title-derived classification.
3. **Separate bundle/access implementation package:** implement approved three-member purchase and configurable expiry together with atomic debit, snapshotted member terms, idempotence, overlap/renewal and server/DRM session expiry tests. Do not emulate a package with three independent, partially failing payments.
4. Revisit saved-course/search features after this academic structure is settled; those policies remain proposals.

Keep one modular Express application, STUDENT/ADMIN, platform Prisma persistence and external API-only DRM. No parent/teacher role, live lesson, payment gateway or DRM-maintenance permission follows from this clarification.

## Required verification

- Admin authors valid academic placement and access choice, both translations and package membership; ambiguous/missing metadata is not guessed.
- Published discovery filters/grouping match first/second secondary and both first-secondary terms without exposing protected outlines.
- Purchase review distinguishes course content period and expiry. Fixed-deadline offers cannot charge for access that is already unavailable; precise validation is specified in the next contract.
- Duration and academic-deadline expiry are server-enforced; external playback stops through the existing API boundary. Notification expiry markers and renewal handling must account for actual effective expiry.
- Bundles debit once and atomically grant exactly three approved monthly courses with the same snapshotted package deadline; replay cannot duplicate debit/access. Standalone access rules are not substituted for this deadline. Existing subscribers and financial history survive migration.
- Docker evidence includes both grades, term/month/revision/package cases, expiry boundaries, privacy/authorization, financial integrity, bilingual themes and mobile navigation.

Affected documents: decisions.md (D27), requirements.md (R18), schema.md, design.md, the M8 plan, redesign brief and index. Earlier generic prototype/demo courses are historical illustrations; the current read-only preview remains a visual foundation until a reviewed package implements this academic model.

## Owner clarification — optional course expiry (2026-10-01)

The owner explicitly clarified that a course may remain accessible after purchase without any expiry, until permanent removal by ADMIN. This supersedes the earlier mandatory-duration wording for M8 standalone offers. ADMIN chooses DURATION, TERM_END, YEAR_END or UNTIL_REMOVAL explicitly. UNTIL_REMOVAL stores a null expiry, not a fabricated distant date. Existing paid terms are immutable; later offer changes apply only to new purchases. Indefinite access dominates finite grants, produces no subscription-expiry notification and must not trigger expiry-based playback termination. Publication/archive/deletion protection and the external DRM API-only boundary still apply. Packages retain the previously approved one shared ADMIN-set deadline.

The owner also confirmed: SECOND_SECONDARY has terms 1 and 2; packages may contain unpublished monthly courses with clear presale labels and no viewing before publication; overlapping ownership warns without blocking package purchase; repeat standalone purchases with a fixed deadline are permitted only when they add access. Existing indefinite access prevents redundant standalone payment. These answers resolve the corresponding pending owner questions; historical proposals remain historical.

Acceptance: nullable-expiry migration preserves finite records; guarded offer creation/edit, one debit and idempotent replay; immutable indefinite purchase snapshot; indefinite entitlement despite expired finite rows; no expiry notice or termination; unpublished package purchase without content leakage; fixed-deadline extension/no-extension cases; bilingual admin/student access labels.
