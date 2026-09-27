# Decision register

Updated 2026-09-27 from owner answers and follow-up responses. CONFIRMED is explicit owner direction; PARTIAL means remaining details are listed. Recommendations are not decisions.

| ID | Status | Owner decision | Remaining detail / consequence |
| --- | --- | --- | --- |
| D01 | CONFIRMED | DRM is external, API-only, with its own technologies. Send required requests and return frontend-safe responses. Do not edit anything inside DRM. | No platform work to replace its Caddy, Valkey, SQL, gateway or packaging. |
| D02 | PARTIAL | Recorded videos only; no live classes or live courses. | 10,000 concurrent users remains the target. Viewing/browsing mix and performance thresholds remain open; chat/email/WhatsApp release scope is unanswered. |
| D03 | CONFIRMED | DRM remains external, including persistence. Platform uses PostgreSQL/Prisma. | No DRM ORM migration, shared-table access or cross-service foreign keys. External physical hosting is not a platform persistence decision. |
| D04 | PARTIAL | Admin sets a fixed course/package subscription duration while creating the course. Follow-up confirms duration starts immediately at purchase. | Confirm duration unit, early renewal, refund rules and treatment of existing purchases after plan edits. |
| D05 | PARTIAL | Manual EGP recharge initially. Follow-up confirms student submits a request/reference/proof; admin verifies receipt and approves credit. No automated payment gateway. | Exact transfer methods, required evidence, reference deduplication, rejection/resubmission and reversal rules remain. Do not reinterpret the owner's 'STP' or choose a provider. |
| D06 | PARTIAL | Follow-up confirms Cloudflare R2 configured through external DRM for videos; local development runs through Docker. | Confirm permitted Docker local substitute and how the unchanged external DRM deployment is configured. Hosting/recovery targets remain open. |
| D07 | CONFIRMED | DRM handles video security, watermarking and video-related processing. | Test API integration and report external failures; no internal repair or provider implementation by platform worker. |
| D08 | PARTIAL | Admin uploads original video; lifecycle leads to object storage and a platform PostgreSQL record. | Store metadata/references/status in PostgreSQL, not assumed video blobs. Original retention, subsequent download and removal policies are unanswered. |
| D09 | PARTIAL | Authentication and session tokens are stored in cookies, not local storage. | Login identifier, recovery/admin onboarding, exact session-token renewal semantics and lifetimes remain open. Cookie security/CSRF controls are still required. |
| D10 | PARTIAL | Expiry stops viewing and changes access to unsubscribed / needs renewal. | Enforce on server plus external session termination. Measure external enforcement latency. Device/stream policies remain external. |
| D11 | CONFIRMED | Arabic primary, English secondary; both translations mandatory. Programming courses have video lessons/segments; listing is shown after subscription. | Required translated platform content does not imply two dubbed recordings. Promotion rules remain open. |
| D12 | CONFIRMED | Follow-up: one Express backend with separate internal modules; external DRM separate. | Replicas run the same backend image. No separate auth/course/wallet microservices. |

## Pending immediate follow-up

Answered: Cloudflare R2 through external DRM; subscription duration starts immediately at successful purchase. No further approval is needed for these choices.

Other questions block only their dependent work: identity fields before auth implementation; retention before destructive media actions; renewal/refunds before those features; notification scope before notifications. They do not block the basic Docker foundation.

## Approval and verification record

These answers update agent rules, architecture, requirements, plans, schema, integration, operations, tests and worker instructions. Original JPEG/PDF and external DRM files remain untouched. Verify the boundary through diffs and API-only adapters; verify manual credit, fixed duration, cookie auth, bilingual publication and expiry through test-and-review-plan.md.

Future answers must record owner/date, approved policy, affected documents and acceptance checks. Do not quietly promote recommendations to approved requirements.
