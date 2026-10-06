# Requirements baseline

Owner update, 2026-10-01 — **R18 academic catalog/access**: both first and second secondary have terms 1 and 2, monthly explanation courses and revisions. Packages contain three specified monthly courses, including unpublished members if clearly labeled unavailable for viewing, and one common ADMIN-set Cairo deadline. Overlap warns without blocking package purchase. Standalone offers explicitly use duration, term end, academic-year end or UNTIL_REMOVAL (no expiry until permanent ADMIN removal). Purchased terms remain immutable. Fixed-deadline repurchase must add access. See [confirmed D27](milestones/m8/m8-school-catalog-contract.md). R03 is the historical finite-duration baseline and remains applicable to DURATION offers.
Updated from owner decisions; unresolved details remain in decisions.md.

| ID | Confirmed requirement | Acceptance evidence |
| --- | --- | --- |
| R01 | Arabic primary, English secondary; both content translations mandatory | RTL/LTR UI, localized errors/forms, mandatory bilingual publication validation |
| R02 | STUDENT and ADMIN only | Server role matrix; student admin requests denied |
| R03 | Programming courses with admin-defined integer-day plans; purchase snapshots price/duration, active renewal extends from current expiry, and expired purchase starts immediately | Catalog price/duration, immutable purchased terms and renewal-date validation |
| R04 | Manual EGP funding through configured InstaPay, bank-transfer or mobile-wallet instructions: student submits approved fields and bounded proof; admin verifies receipt and approves | No credit before approval; channel-scoped global reference uniqueness; duplicate/concurrent approvals credit once; admin-only proof access and 180-day proof deletion |
| R05 | Explicit wallet purchase creates or renews a course subscription; recharge approval never auto-purchases | Atomic debit/purchase/access; idempotent retry; no overspending/double charge; later plan edits do not rewrite purchases |
| R06 | Dashboard and lesson/segment listing after subscription | Entitlement enforced on listing, content and playback APIs |
| R07 | Admin content, prices, promotions, uploads/downloads/removal | Audited actions; retention and external capabilities clarified before destructive work |
| R08 | Platform uses the independently deployed DRM through APIs only; DRM internals never become platform persistence. The owner may separately authorize bounded maintenance within their DRM package. | Upload/status/playback/termination/deletion integration; credentials remain server-side; no cross-database access |
| R09 | React/TypeScript; one modular Express/TypeScript backend; PostgreSQL/Prisma | Required stack and single replicable backend image |
| R10 | Docker throughout platform development/testing/deployment | Independent frontend/backend images, dependency containers and isolated tests |
| R11 | Preserve original architecture with explicit owner clarifications | No silent service/infrastructure substitution |
| R12 | 10,000 simultaneous users; recorded courses only | Agreed realistic load qualification, no live-class features |
| R13 | Students have unique email and phone identifiers and may log in with either plus password. Access tokens last 15 minutes; rotating refresh sessions last 30 days. Both use HttpOnly cookies, never browser storage. | Either-identifier login, duplicate rejection, HttpOnly/production-Secure/SameSite policy, CSRF denial, rotation/reuse detection, logout and server-side revocation |
| R16 | First admin is created once through Docker; only an authenticated ADMIN can create later admins. Password recovery is excluded until a delivery channel is approved. | Bootstrap succeeds once and then refuses; student/admin authorization tests; local credentials handed to owner without committing them; no recovery endpoints or misleading UI |
| R14 | Expiry stops access and shows unsubscribed / needs renewal | Backend time checks, active playback termination and renewal-required UI |
| R15 | Cloudflare production object storage; Docker local environment | R2 through external DRM; local/staging contract verification |
| R17 | D25: realtime in-platform notices for recharge decisions to the request owner, first course publication to all students, and effective subscription expiry to the affected student once per expiry after renewals; read/unread, mark-all-read, no dismissal, 180-day retention | Recipient-only HTTP/realtime authorization, committed-event uniqueness/recovery, renewal races, cross-replica/reconnect behavior, retention and bilingual accessible UI; specified in `milestones/m6/m6-notification-contract.md`, not yet implemented |

## Identity journey

Student registration collects both email and phone with a password. Either normalized identifier can be used at login. Public registration always creates STUDENT and cannot accept a caller-selected role. The first ADMIN is created by a one-time Docker bootstrap; later admins require an authenticated ADMIN. Email/phone verification and password recovery are not part of M2 because no delivery channel is approved.

## Student journey

Browse public course plans; authenticate; select plan. If funds are insufficient, submit a manual recharge request with agreed evidence, wait for verified admin approval, then purchase using wallet balance. Approval credits the wallet; it does not silently purchase a course. After successful purchase show dashboard, course sections/lessons and authorized recorded videos. Expired access becomes renewal-required and playback stops.

## Admin journey

Create bilingual course content, order video lessons, set EGP price and fixed duration, upload originals through external DRM, observe readiness and publish valid content. Verify real receipt of transferred funds before approving student recharge requests. Manage promotions and content within approved policies; no extra instructor role.

## Unapproved additions

No live teaching, automated payment gateway, automatic recurring billing, exams, certificates, parent role, native mobile application or dubbed-video requirement is implied. D25 confirms only the R17 in-platform notification scope; chat, email and WhatsApp are deferred. Unrelated media retention and any future refund/reversal implementation policy remain open. M4 explicitly excludes refunds and reversals; its integer-day duration and renewal rules are confirmed.

## Owner clarification — optional course expiry (2026-10-01)

The owner explicitly clarified that a course may remain accessible after purchase without any expiry, until permanent removal by ADMIN. This supersedes the earlier mandatory-duration wording for M8 standalone offers. ADMIN chooses DURATION, TERM_END, YEAR_END or UNTIL_REMOVAL explicitly. UNTIL_REMOVAL stores a null expiry, not a fabricated distant date. Existing paid terms are immutable; later offer changes apply only to new purchases. Indefinite access dominates finite grants, produces no subscription-expiry notification and must not trigger expiry-based playback termination. Publication/archive/deletion protection and the external DRM API-only boundary still apply. Packages retain the previously approved one shared ADMIN-set deadline.

The owner also confirmed: SECOND_SECONDARY has terms 1 and 2; packages may contain unpublished monthly courses with clear presale labels and no viewing before publication; overlapping ownership warns without blocking package purchase; repeat standalone purchases with a fixed deadline are permitted only when they add access. Existing indefinite access prevents redundant standalone payment. These answers resolve the corresponding pending owner questions; historical proposals remain historical.

Acceptance: nullable-expiry migration preserves finite records; guarded offer creation/edit, one debit and idempotent replay; immutable indefinite purchase snapshot; indefinite entitlement despite expired finite rows; no expiry notice or termination; unpublished package purchase without content leakage; fixed-deadline extension/no-extension cases; bilingual admin/student access labels.
