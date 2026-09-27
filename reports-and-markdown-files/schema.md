# Conceptual schema

DRAFT model updated with confirmed decisions; not executable Prisma or migration SQL. Prisma owns only platform tables.

| Entity | Responsibility and confirmed fields/concepts | Pending details |
| --- | --- | --- |
| User | Identity; STUDENT or ADMIN | Login identifier, profile, recovery and retention |
| AuthSession | Server-side session validity and cookie-token relationship | Token semantics, lifetime, rotation and device metadata |
| Course | Programming course; required Arabic/English title/description; publication lifecycle | Publication transitions and archival |
| CourseSection / Lesson | Ordered video structure, mandatory translated labels/content; course ownership | Whether explicit section grouping is necessary |
| SubscriptionPlan | Course/package, EGP price, admin-set fixed duration | Duration unit and plan edit policy; starts at purchase |
| Promotion | Discount and eligibility | Stacking, limits and accounting policy |
| Wallet | Student EGP account/balance | Approved numeric bounds |
| RechargeRequest | Student request, amount, transfer reference/proof, review state, reviewer and review time | Evidence fields, deduplication scope, rejection/resubmission |
| WalletEntry | Durable EGP credit/debit and source reference | Reversal/refund policy |
| Purchase | Student/plan and trusted purchase terms | Renewal/cancellation rules |
| Enrollment / Entitlement | User/course access and fixed validity interval | Starts at purchase; early renewal semantics pending |
| MediaMapping | Lesson to external application/asset IDs and observed readiness | Asset replacement/versioning |
| PlaybackReference | External session reference bound to student/entitlement | Retention and termination reconciliation |
| LessonProgress | Student lesson progress | Completion definition |
| AuditEvent | Actor, action, target, time and outcome | Retention/redaction policy |

## Proposed constraints for final schema review

- Precise EGP amounts; integer piastres are the recommended representation, with explicit bounds and safe API serialization. Never floating-point wallet arithmetic.
- Admin approval of a pending recharge, its wallet credit and its audit evidence commit atomically. Unique source reference prevents a request credit from appearing twice; actual transfer duplicate detection requires agreed reference rules.
- Wallet debit, purchase and entitlement commit atomically under concurrency-safe balance checks. Stable idempotency keys reject mismatched retries.
- Snapshot trusted price/duration at purchase as a proposed protection against later plan edits. Do not hard-code 30 days or assume lifetime access.
- Subscription validity uses server time and persisted start/end timestamps; determine timezone and duration arithmetic once duration units are confirmed; start is successful purchase.
- Both translations are mandatory at publication. Schema representation (paired fields or translation table) remains an implementation design choice to document; it does not imply translated video tracks.
- Validate course/lesson/media relationships before issuing external playback authorization.
- Protected lesson-list endpoints enforce entitlement regardless of frontend route visibility.
- No cascading deletion of financial history without explicit retention policy.
- Choose indexes from query paths: active entitlement lookup, course lesson order, pending review queue, wallet history, idempotency references and expiry/session reconciliation.

## External DRM

Do not model DRM keys, internal sessions, migrations or watermark tables in Prisma. Platform references are opaque external IDs, with no cross-database foreign keys. Store video metadata/status/references in platform PostgreSQL; binary media goes through the external service to object storage.
