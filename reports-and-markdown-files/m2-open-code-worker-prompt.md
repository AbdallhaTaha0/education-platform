# Open Code worker prompt — M2 identity and bilingual shell

You are implementing only Milestone 2 (WP2) of this educational platform. Milestone 1 is accepted at Git revision `fce352f`. The manager will inspect your diff and independently reproduce security-critical behavior. Do not commit, push, or begin M3; submit the completed working tree and evidence for review.

## Read before changing files

Read root `AGENTS.md` and `reports-and-markdown-files/README.md`, `agent.md`, `rules.md`, `decisions.md`, `requirements.md`, `architecture.md`, `confirmed-flows.md`, `implementation-plan.md`, `schema.md`, `design.md`, `docker-and-operations.md`, `test-and-review-plan.md`, and `m1-implementation-report.md`.

Inspect the current repository and Git state before editing. Preserve accepted M1 behavior, existing user work, original JPEG/PDF files, and all development data. The external `education-drm-service/` repository is a read-only API dependency: never edit, install into, format, generate files in, query the database of, or change Git metadata inside it.

## Confirmed M2 decisions

- Exactly two platform roles exist: `STUDENT` and `ADMIN`.
- Students register with both a unique email address and a unique phone number plus password. Login accepts either email or phone in one identifier field.
- Normalize email and phone before uniqueness checks and login lookup. Support Egyptian local mobile input using Egypt as the default parsing region and store canonical E.164; do not silently accept invalid or ambiguous numbers. An explicit valid international E.164 number may remain valid; do not invent an Egypt-only business restriction.
- Public registration always creates `STUDENT`. Never accept a public role selection or mass-assign a role.
- The first admin is created by a one-time Docker bootstrap command. It must refuse once any admin exists. After bootstrap, only an authenticated `ADMIN` may create another admin.
- Access token lifetime is 15 minutes. Refresh-session absolute lifetime is 30 days. Refresh credentials rotate every time they are used, with replay/reuse detection and server-side family revocation.
- Access and refresh credentials are stored only in protected `HttpOnly` cookies, never localStorage, sessionStorage, IndexedDB, JavaScript variables intended for persistence, URLs, or response bodies.
- Password recovery and email/phone verification are excluded because no delivery channel is approved. Do not create fake recovery links, OTP screens, mail/SMS adapters, or “coming soon” flows that imply they work.
- Arabic is the default/primary interface with RTL. English is secondary with LTR. Follow `design.md`; its palette remains provisional and must stay tokenized.
- This remains one modular Express application and one React client. Do not create a separate identity service.

## Objective

Deliver production-oriented cookie authentication, server-backed sessions, CSRF protection, role authorization, first-admin onboarding, and an accessible bilingual identity shell. All development, migrations, tests, and browser verification must run through Docker. Preserve the M1 health, readiness, redaction, migration ordering, non-root runtime, and proxy behavior.

## Allowed scope

You may change `server/`, `client/`, the platform `docker/` definitions, root environment/package support files when necessary, and Markdown in `reports-and-markdown-files/`. Add an additive Prisma migration for M2. Update image/service versions from M1 to M2 consistently.

Do not implement courses, catalog administration, wallet/recharge, purchases, subscriptions, DRM upload/playback, R2 provisioning, notifications, live classes, password recovery, identifier verification, or production deployment. Do not reset the development database or remove its named volumes. Do not weaken an M1 control to make an M2 test pass.

## Backend structure and persistence

Add an internal identity module under `server/src/modules/identity/` (or an equivalently clear internal module) with explicit boundaries for routes, service/domain logic, persistence, password hashing, token/session handling, CSRF, normalization, validation, and authorization middleware. It is mounted inside the existing Express app; it is not a new network service.

Create the minimum platform-owned Prisma models needed for M2:

- `User`: stable ID, normalized unique email, normalized unique phone, password hash, display name, exactly `STUDENT` or `ADMIN`, and timestamps.
- Server-side session/token persistence sufficient to bind access tokens to an active session, rotate refresh credentials atomically, detect reuse, revoke the whole affected session family, support logout/logout-all, and record expiry/revocation timestamps.

You may choose one or multiple session tables, but document the invariants and indexes. Store only a cryptographic digest of high-entropy refresh secrets, never the raw refresh token. Never store plaintext passwords. Use an established Argon2id implementation with documented production parameters. Use a documented modern password policy (minimum 12, maximum at least 128 characters, no arbitrary composition rule, and allow password managers/paste); test hashing cost may be reduced only through an explicit test-only dependency/configuration path and must not weaken production defaults.

Use an additive Prisma migration and `prisma migrate deploy`. Never use `migrate reset`, edit an applied M1 migration, access DRM persistence, or introduce cross-database relationships. Migration failure must still block server startup.

## Token and session requirements

Use a short-lived signed access token with at least `sub`, `role`, server session ID, unique token ID, issuer, audience, issued-at, and expiry claims. Configuration must validate issuer/audience and require a strong signing secret outside source control. An access token is accepted only while its corresponding server-side session is active, so logout/revocation takes effect immediately rather than waiting 15 minutes. Redis may cache session status for replicas, but PostgreSQL remains durable authority and revocation must invalidate any cache entry without a stale authorization window.

Use at least 256 bits of randomness for the opaque refresh credential. Rotation must be atomic under concurrent requests. A successfully used refresh credential cannot be used again. Replay/reuse revokes the affected session family and denies credentials derived from it. Define and test the outcome of two concurrent refreshes; at most one may succeed. Do not extend the 30-day absolute session lifetime on rotation.

Use these default cookie names unless an existing constraint justifies a documented alternative:

- `edu_access`: `HttpOnly`, `SameSite=Lax`, `Secure` in production, path `/api`, 15-minute max age.
- `edu_refresh`: `HttpOnly`, `SameSite=Lax`, `Secure` in production, path `/api/auth`, bounded by the 30-day absolute session expiry.
- `edu_csrf`: JavaScript-readable only because the client must echo it in a request header; `SameSite=Lax`, `Secure` in production, path `/`. It must contain no authentication credential and must be cryptographically bound to the active session or otherwise use a robust synchronizer/double-submit design.

Do not set a cookie `Domain` by default. Clear cookies with exactly matching path/security attributes. Production configuration must fail closed if cookie security is disabled, token secrets are missing/weak, origins are wildcarded, or issuer/audience configuration is invalid. Local HTTP Docker development may explicitly use `Secure=false`; tests must prove production resolves to `Secure=true` and rejects unsafe overrides.

## CSRF, origins, abuse controls, and responses

Require an approved exact `Origin` (with a safe `Referer` fallback only where justified) and a valid CSRF token for all state-changing identity requests, including pre-authentication registration/login and authenticated refresh, logout, logout-all, and admin creation. Provide a safe CSRF bootstrap endpoint for the SPA. Reject cross-site requests even when cookies are present. Do not use wildcard credentialed CORS. Preserve same-origin operation through Nginx `/api` routing.

Add shared Redis-backed rate limiting for login and other abuse-sensitive identity endpoints so limits apply across backend replicas. Use bounded keys/TTLs and avoid logging passwords, cookies, raw tokens, CSRF values, or full request bodies. Return stable machine-readable error codes that the frontend localizes. Login errors must not disclose whether an email or phone exists. Apply safe request-size limits and schema validation; reject unknown role/security fields where appropriate.

## Required API behavior

Use the existing public `/api` proxy prefix; backend routes remain mounted without duplicating that prefix. Implement and document at least:

- `GET /auth/csrf`: establish/return the CSRF mechanism without exposing auth credentials.
- `POST /auth/register`: display name, email, phone, password; always creates `STUDENT`; returns a safe user representation and establishes the cookie session.
- `POST /auth/login`: one `identifier` field accepting normalized email or phone plus password; establishes a new server-backed cookie session.
- `POST /auth/refresh`: CSRF/origin protected atomic refresh rotation; returns no bearer/refresh token in JSON.
- `POST /auth/logout`: revoke the current session and clear cookies, idempotently.
- `POST /auth/logout-all`: revoke all sessions for the current user and clear the current cookies.
- `GET /auth/me`: return only the authenticated user's safe profile and role.
- `POST /admin/users`: authenticated `ADMIN` plus CSRF creates another `ADMIN` from display name, email, phone, and initial password. A `STUDENT` receives 403. This endpoint must not accept arbitrary roles.

Use consistent status codes and response envelopes. `401` means unauthenticated/expired/revoked; `403` means authenticated but forbidden or CSRF/origin denied, with a stable code. Do not return password hashes, token digests, session internals, or stack traces.

## First-admin Docker bootstrap and test credentials

Add a non-interactive one-time bootstrap command that runs inside a platform Docker image and receives display name, email, phone, and password through environment variables or another non-committed input mechanism. It must:

1. use the same normalization, validation, and password hashing code as the application;
2. create the first `ADMIN` only when no admin exists;
3. be concurrency safe so two simultaneous bootstrap attempts cannot create two first admins;
4. exit non-zero with a clear message when an admin already exists or required input is invalid;
5. never print the password or place credentials in an image layer, tracked `.env`, shell script, report, logs, or migration.

Run the command in the development Docker environment with local-only credentials so the owner can test both email and phone login. In your final chat response, provide the exact local development admin email, phone, and password. Do **not** put those credentials in `m2-implementation-report.md` or any committed/tracked file. Confirm `.env` remains ignored. Test fixtures may contain clearly marked isolated dummy credentials but must never target development or production data.

## Frontend identity shell

Extend the existing React/TypeScript client using the shared visual tokens in `design.md`. Preserve the Arabic-default language switch and legitimate language-only localStorage key. Add responsive, keyboard-accessible identity routes/screens for:

- registration with display name, email, phone, password, confirmation, validation, and a statement that both identifiers are required;
- login with one email-or-phone identifier field and password;
- authenticated account/session view with role and logout/logout-all actions;
- a minimal protected admin identity view for creating another admin;
- clear unauthenticated, loading, validation, rate-limited, expired-session, forbidden, success, and service-error states in Arabic and English.

Public registration must not show a role selector. Do not add course, wallet, or media UI. Use correct `lang`, `dir`, focus behavior, labels, autocomplete attributes, mixed-direction handling for email/phone, minimum 44px targets, and visible keyboard focus. Do not claim email/phone verification or password recovery exists.

The SPA must authenticate through cookies using `credentials: 'include'` where needed. It may read the CSRF cookie/token solely to send the CSRF header. It must never read access/refresh cookies or copy any auth token into browser storage. On an eligible 401, coordinate at most one refresh attempt and retry safely; prevent refresh storms and infinite retry loops. Do not persist the returned user profile or sensitive form values in browser storage.

## Docker and configuration

All application execution and verification stays in Docker. Update the dev/test Compose definitions and environment contract for M2 without exposing PostgreSQL/Redis ports or publishing a new backend port. Preserve the one-shot migration gate, healthchecks, Nginx as the only public entry point, non-root runtimes, graceful shutdown, and separate client/server images.

Document server-only settings for access signing, issuer/audience, cookie mode/names, allowed public origin, session lifetime, password hashing, and rate limiting. `.env.example` contains placeholders only. Generate any real local signing secret into an ignored local `.env`; never commit it or pass it into the frontend build. Test Compose may use explicit isolated test-only values. Inspect final browser assets and image histories/runtime contents for credential leakage.

Do not make external DRM availability an auth dependency. Confirm `education-drm-service/` remains unchanged before and after work.

## Required automated tests

Tests must exercise the real Express middleware and real isolated PostgreSQL/Redis services where behavior depends on them. Do not replace security-critical integration coverage with mocks.

At minimum cover:

1. Email and phone normalization, invalid input, unique conflicts, password policy, and safe hashing.
2. Registration always creates `STUDENT`; submitted `role`, admin flags, unknown security fields, and mass-assignment attempts cannot elevate privileges.
3. Login succeeds independently with normalized email and normalized phone; wrong/unknown identifiers produce the same public failure shape.
4. Access/refresh cookie names, paths, `HttpOnly`, `SameSite`, max ages, local development behavior, production `Secure`, and exact clearing behavior.
5. No access or refresh credential in JSON bodies, URLs, logs, localStorage, sessionStorage, or IndexedDB.
6. Missing/invalid CSRF, hostile/missing disallowed origin, and cross-site attempts fail; valid same-origin requests pass.
7. Access expiry without sleeps (inject/fake time), refresh success, rotation, old-token replay, two concurrent refresh attempts, absolute expiry, malformed tokens, issuer/audience mismatch, and session-family revocation.
8. Logout is idempotent and immediately invalidates the bound access token; logout-all invalidates other sessions for that user without affecting other users.
9. Shared rate limits work through Redis and return the documented safe response.
10. First-admin bootstrap succeeds exactly once, fails on repeat/concurrent attempts, and never reveals the password. Authenticated admin creation succeeds; unauthenticated and STUDENT calls fail; no third role can be persisted.
11. Existing health/readiness, logging redaction, migration failure, restart persistence, and Nginx routing remain valid.
12. Arabic default/RTL and English/LTR browser flows: register a student, log out, log in once by email and once by phone, inspect protected-cookie attributes, verify auth credentials are absent from browser storage, verify student denial of the admin screen/API, and verify the bootstrap admin can access the admin identity view.

Add a committed containerized browser test service/harness if practical for the delivered stack. Browser screenshots alone are insufficient for cookie/storage/authorization assertions. If a browser scenario is genuinely blocked, report it as BLOCKED with the exact reason; do not label a manual page load as equivalent automated proof.

## Verification and evidence

Use a newly named disposable Docker project and volumes for automated tests. Never run destructive tests against development data. Record exact commands and exit codes for:

- Compose configuration validation and clean M2 image builds.
- Additive migration deployment from the accepted M1 schema.
- Server/client type checks and production builds.
- Unit tests and PostgreSQL/Redis integration tests.
- Containerized browser tests through Nginx.
- One-time admin bootstrap and repeat/concurrency refusal.
- Dev stack startup with all services healthy, registration/login by both identifiers, refresh/logout, role denial, and restart persistence.
- Production configuration fail-closed checks.
- Final bundle/log/image scan for secrets and unchanged external DRM evidence.

Record test counts, image IDs, relevant request/status evidence, and browser evidence. Use synthetic secrets in test logs and redact cookie/token values. A successful build alone is not acceptance.

## Completion report and stop

Create `reports-and-markdown-files/m2-implementation-report.md` containing:

- changed files and requirement mapping (`R01`, `R02`, `R09`, `R10`, `R13`, `R16`);
- final data/session invariants, endpoint matrix, cookie/CSRF/origin policy, and configuration contract;
- migration name and forward/rollback compatibility notes (no destructive rollback);
- exact Docker commands and PASS/FAIL/BLOCKED results with test counts and image IDs;
- browser accessibility/RTL/LTR evidence;
- security evidence for hashing, rotation/reuse, revocation, rate limiting, role isolation, storage absence, and secret redaction;
- external DRM before/after proof;
- known limitations and unresolved questions.

Do not include the local development admin password in the report. Put the requested email, phone, and password only in your final response to the owner after verification. Then stop and wait for manager review. Do not implement M3, commit, push, deploy, delete development volumes, or claim production/10,000-user readiness.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
