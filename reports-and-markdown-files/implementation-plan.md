# Implementation work packages

Updated after owner answers. Platform work packages consume DRM through its API. The owner separately authorized the bounded DRM permanent-deletion prerequisite linked from the documentation index; it is independent package maintenance and does not permit cross-database coupling or unrelated DRM changes. The manager reviews actual worker changes and reproduces critical checks.

## WP0: Contracts

Use decisions.md and confirmed-flows.md. Map one modular backend to platform responsibilities. Define environment names, request/error contracts, external identifiers and data ownership. Keep unresolved policies local to their dependent tasks.

## WP1: Docker foundation

Create separate client/server build/runtime images, Nginx, platform PostgreSQL/Redis, Prisma migration job and disposable test services. Establish health/readiness, startup ordering, internal/public addressing, persistent development data and isolated test volumes. Backend replicas run the same application image.

Use an external DRM API URL and server-side credentials. Do not copy DRM source into platform images, alter its Dockerfiles, share its tables or implement its workers. Document connection to an independently running unchanged distribution. Basic local startup must not require live Cloudflare credentials. Resolve local storage substitute before storage-dependent features; explicitly label test doubles.

Acceptance: clean Docker build/start, separate image identities, migration failure handling, health/readiness, persistence, browser-to-platform routing and external connectivity/error reporting. Do not invent business models just to test startup.

## WP2: Authentication and localization

Implement the confirmed identity contract: students register with unique email and phone plus password, then sign in with either normalized identifier. Public registration always creates STUDENT. Create the first ADMIN once through a Docker bootstrap command; after that, only an authenticated ADMIN creates additional admins. The worker provides local test credentials to the owner without committing them. Password recovery and identifier verification remain excluded until a delivery channel is approved.

Use a 15-minute access token and rotating 30-day refresh session in HttpOnly cookies, Secure in production, with explicit SameSite/domain/path policy, server-side revocation, refresh reuse detection and CSRF/origin protection. No platform credential may enter localStorage, sessionStorage or JavaScript-readable persistence. Authorization recognizes exactly STUDENT and ADMIN inside the same Express application.

Build Arabic-default RTL and English LTR registration/login/account shell and localized validation/errors using design.md. Acceptance: either-identifier login, uniqueness and normalization, safe password hashing, rate limiting, cookie flags, cross-origin/CSRF denial, refresh rotation/reuse, concurrent refresh behavior, revoked/expired sessions, logout, bootstrap one-time behavior, admin creation isolation and RTL/LTR browser checks.

## WP3: Catalog and administration

Implement bilingual programming courses using Course → ordered Sections → ordered Lessons, with one external DRM video per lesson. Plans use EGP prices and an admin-set positive integer duration in days. A plan may optionally show a higher previous price beside the current selling price as a visual marketing offer; this is not a coupon or promotion engine. Publishing requires both translations. Public course offers remain visible; lesson/segment lists and content require entitlement.

Use DRAFT, PROCESSING, READY, PUBLISHED and reversible ARCHIVED states, with validated transitions and only PUBLISHED courses visible publicly. Original upload uses the external DRM registration/upload/completion/status contract. Persist media IDs/readiness in platform PostgreSQL. Do not process video, manage keys or mutate DRM tables. Use supported status polling/reconciliation until external webhooks are confirmed. Implement the adapter and contract verification so real upload waits only for credentials/storage configuration. Mark real external verification BLOCKED until supplied. The independently accepted DRM media-delete endpoint is the required permanent-deletion path; platform-only row deletion remains forbidden because it does not free space.

Acceptance: admin-only mutation, deterministic ordering, bilingual completeness, lifecycle transition checks, reversible archive, compare-at price validation, unready asset exclusion, API-only media lifecycle and no protected listing leaks. Report real DRM upload as BLOCKED rather than passing it with a fixture when credentials are unavailable.

## WP4: Manual recharge and purchase

Implement student funding requests with agreed reference/proof fields. Admin independently verifies receipt before approval. An approval transaction must atomically move a pending request to approved, record the wallet credit and audit the actor, so concurrent approvals cannot duplicate money. Submitted screenshots are not automatic proof of receipt. No automated gateway in release one.

Purchase uses trusted server price/duration, concurrency-safe wallet balance validation, atomic debit/purchase/entitlement and idempotency. Proposed integrity policy: snapshot purchased price/duration so later plan edits do not silently rewrite purchases. Start duration at successful purchase; finalize units and renewal rules before date arithmetic. Rejection/resubmission and reversals need their own approved policies.

Acceptance: duplicate/concurrent approval, unauthorized approval, simultaneous spending, retries and rollback; exact EGP reconciliation and no unpaid access.

## WP5: Learning and expiry

Implement dashboard and protected lesson listing, backend course/lesson/asset binding, required DRM assertions, frontend-safe API responses and player lifecycle. Platform cookie authentication and transient DRM bearer tokens are separate contracts. Keep privileged DRM credentials server-only.

Compute subscription validity from backend time and stored dates. On expiry deny listings, new playback and platform-mediated renewal, show needs-renewal, stop the player and request supported external session termination. Maintain necessary session references; retry failed revocation and measure enforcement delay. If an external direct-renewal path bypasses expiry, report a release blocker rather than editing DRM or claiming the UI solves it.

Acceptance: real external upload-to-playback, token lifecycle, watermark observation, wrong asset/user denial and expiry during playback. External failures do not expand worker scope.

## WP6: Background and realtime

No live classes. Implement only confirmed notification/realtime scope. Platform expiry/reconciliation jobs can use BullMQ/Redis after contracts are approved. Define idempotency, retries, failure visibility and replica coordination. Chat/email/WhatsApp release scope is pending.

## WP7: Qualification

Use Docker for functional/integration/browser/security/load/recovery verification. Separate platform and external DRM/CDN bottlenecks in the recorded-course workload. Report image IDs, commands, results, blockers and migration/rollback/restore evidence. Do not certify external behavior using mocks.
