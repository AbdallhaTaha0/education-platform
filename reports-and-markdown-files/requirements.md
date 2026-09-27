# Requirements baseline

Updated from owner decisions; unresolved details remain in decisions.md.

| ID | Confirmed requirement | Acceptance evidence |
| --- | --- | --- |
| R01 | Arabic primary, English secondary; both content translations mandatory | RTL/LTR UI, localized errors/forms, mandatory bilingual publication validation |
| R02 | STUDENT and ADMIN only | Server role matrix; student admin requests denied |
| R03 | Programming courses with admin-defined fixed-duration plans | Catalog price/duration and purchase term validation |
| R04 | Manual EGP funding: student submits, admin verifies receipt and approves | No credit before approval; duplicate/concurrent approvals credit once |
| R05 | Wallet purchase creates course subscription | Atomic debit/purchase/access; no overspending/double charge |
| R06 | Dashboard and lesson/segment listing after subscription | Entitlement enforced on listing, content and playback APIs |
| R07 | Admin content, prices, promotions, uploads/downloads/removal | Audited actions; retention and external capabilities clarified before destructive work |
| R08 | API-only external DRM; no internal edits | Upload/status/playback/termination integration; credentials remain server-side |
| R09 | React/TypeScript; one modular Express/TypeScript backend; PostgreSQL/Prisma | Required stack and single replicable backend image |
| R10 | Docker throughout platform development/testing/deployment | Independent frontend/backend images, dependency containers and isolated tests |
| R11 | Preserve original architecture with explicit owner clarifications | No silent service/infrastructure substitution |
| R12 | 10,000 simultaneous users; recorded courses only | Agreed realistic load qualification, no live-class features |
| R13 | Authentication/session tokens in cookies, not local storage | HttpOnly/Secure policy, CSRF checks and server session revocation |
| R14 | Expiry stops access and shows unsubscribed / needs renewal | Backend time checks, active playback termination and renewal-required UI |
| R15 | Cloudflare production object storage; Docker local environment | R2 through external DRM; local/staging contract verification |

## Student journey

Browse public course plans; authenticate; select plan. If funds are insufficient, submit a manual recharge request with agreed evidence, wait for verified admin approval, then purchase using wallet balance. Approval credits the wallet; it does not silently purchase a course. After successful purchase show dashboard, course sections/lessons and authorized recorded videos. Expired access becomes renewal-required and playback stops.

## Admin journey

Create bilingual course content, order video lessons, set EGP price and fixed duration, upload originals through external DRM, observe readiness and publish valid content. Verify real receipt of transferred funds before approving student recharge requests. Manage promotions and content within approved policies; no extra instructor role.

## Unapproved additions

No live teaching, automated payment gateway, automatic recurring billing, exams, certificates, parent role, native mobile application or dubbed-video requirement is implied. Notification/chat release scope, retention, refund, duration-unit and detailed identity policies remain open.
