# Security architecture baseline — 2026-10-05

Phase 1 source map, prepared before application changes. This is not the final security verdict or a claim of production readiness. Scope: current platform source, build/deployment files, and independently deployed DRM dependency (read-only). Initial git status was clean. Required README, agent, rules and decisions were read. Existing owner decisions govern manual funding, exactly STUDENT/ADMIN, cookies, bilingual content, published working copies and external API-only DRM. No new business policies, nested DRM modifications, deployment or commit/push are authorized by this audit.

## Application inventory

| Area | Observed implementation | Primary evidence |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind, self-hosted fonts; Arabic default/RTL and English/LTR; hash-based SPA routes | client/package.json; client/src/routes.ts; client/src/App.tsx |
| Backend | One Express 4 TypeScript application; identity, catalog, wallet, learning, notifications, assessments and support are internal modules | server/src/app.ts |
| Database | Platform PostgreSQL, Prisma client/migrations, pg for connectivity; parameterized raw-query sites require further inspection | server/prisma/schema.prisma; server/src/infra/prisma.ts |
| Shared state | Redis for atomic IP limits, revocation hints, leases, realtime pub/sub; BullMQ for isolated grading/preparation/Python jobs; PostgreSQL remains durable authority | identity/store.ts; identity/rateLimit.ts; assessments/worker.ts |
| Authentication | Email or phone + Argon2id password. Policy: 12–256 JS string characters, defaults 64 MiB/time 3/parallelism 4. HS256 access JWT with explicit issuer/audience and algorithm allowlist; current database user/session checked per protected request | identity/service.ts; identity/password.ts; identity/tokens.ts; identity/middleware.ts |
| Sessions | Fresh random session identity; 15-minute access tokens, 30-day absolute refresh lifetime; random 256-bit refresh secret persisted as SHA-256; rotation/reuse revocation; logout and logout-all; no independent idle timeout seen | identity/tokens.ts; identity/store.ts |
| Cookies | edu_access: HttpOnly, /api, 15 min; edu_refresh: HttpOnly, /api/auth, remaining session lifetime; edu_csrf: readable synchronizer, /; host-only, SameSite=Lax; Secure required in production | identity/cookies.ts |
| CSRF/CORS | Exact configured Origin for mutations; double-submit before session and digest-bound session CSRF; refresh uses its durable credential/CSRF flow; CORS disabled for cross-origin platform API | identity/csrf.ts; identity/routes.ts; app.ts |
| Admin | First ADMIN via Docker CLI bootstrap with PostgreSQL advisory lock; subsequent creation authenticated ADMIN; catalog, prices, payments, students, quotas, assessments, support and device recovery protected server-side | identity/bootstrap.ts; route inventory |
| Payments | Manual EGP funding, ADMIN verifies real receipt before approval; integer piastres ledger, transactional purchases and immutable access snapshots; no gateway/webhook settlement | wallet/recharge/service.ts; wallet/purchase/service.ts; schema.prisma |
| Uploads | Receipt JPG/PNG/PDF up to 5 MiB as base64 JSON into PostgreSQL; payment QR image upload; video intent obtains external upload URL for browser direct upload; bilingual WebVTT captions and up-to-10-MiB PDF/ZIP/TXT/JS/JSON resources via bounded multipart | wallet/proof.ts; wallet/payment-qr.ts; catalog/media/intentService.ts; learning/materials/routes.ts |
| Downloads | ADMIN-only recharge proof; authenticated payment QR; subscriber/progression checked caption/resource retrieval via platform backend, attachment disposition for resources | wallet/routes/admin.ts; learning/materials/service.ts |
| DRM | Independently deployed Express/TypeScript pnpm workspace, PostgreSQL/Valkey, Caddy configuration, media worker using FFmpeg/Shaka Packager. Platform calls authenticated HTTP APIs only. R2 production video storage belongs to DRM; its persistence is separate | education-drm-service/package.json; apps/api/package.json; docker/; platform catalog/drmClient.ts |
| Playback | Platform signs bounded RS256 assertions; public JWKS; validates browser-facing media origins; browser holds transient playback bearer for external manifests/license/heartbeat; platform stores playback references and retries expiry termination through external APIs | learning/playback/; learning/expiry/; client learning/player/ |
| Private materials storage | Platform-owned S3-compatible SigV4 client; configured endpoint/bucket and credentials; separate from DRM objects; authenticated backend reads, no public resource URL | server/src/infra/storage.ts |
| Realtime | Socket.IO WebSocket-only /notifications namespace, exact Origin, access-cookie/durable-session check and CSRF handshake; Redis adapter; notifications and grading completion hints; 2 KiB input ceiling; periodic expiry/revocation checks | notifications/realtime.ts |
| Student execution | Browser JS/web preview in opaque allow-scripts iframe; CSP denies network; parent checks source, null origin and run ID. Python and private grading run isolated Docker jobs; grades decided by controller, not preview | client/features/ide/preview.ts; WebIDE.tsx; assessments/launcher.ts; python.ts |
| Grading trust | Trusted controller has Docker socket; web replicas/jobs must not. Jobs: no network, read-only filesystem, bounded tmpfs/CPU/memory/PIDs, capability drop, no-new-privileges. Production controller requires runsc. JS grading additionally uses Chromium sandbox/seccomp | assessments/launcher.ts; worker.ts; docker/ide/controller.Dockerfile |
| Deployment | Local development/test Compose and Railway preparation manifests. Nginx serves/proxies SPA, strips /api to one backend; conventional public JWKS path. Railway edge assumes provider TLS and sanitized ingress headers. This is preparation evidence, not proof of a deployed production configuration | docker/compose.dev.yml; docker/compose.test.yml; docker/nginx/nginx.conf; docker/railway/ |
| Images/package managers | Separate npm lockfiles for client/server/execution; external DRM uses pnpm. npm ci in multistage images. Backend runtime and client Nginx non-root; migration separated; controller privileged trust distinct | package manifests; Dockerfiles |
| Cloud/CDN | R2 named in owner decisions; Railway selected/prepared; actual provider ACLs/DNS/CDN/cache/TLS not established by repository alone | decisions.md; docker/railway/ |
| CI/CD | No .github workflow directory found in inventory. Railway deployment descriptors and local scripts exist; repository/provider environment protections require inspection outside source | inventory; docker/railway/*.railway.json |
| Email/OAuth/reset | No mail-delivery, OAuth/OIDC, identifier-verification or reset HTTP route found in platform map. Owner explicitly deferred recovery until delivery channel approval; support email contact is not email sending | decisions D09; identity/routes.ts; support/routes.ts |
| Other protocols | No platform GraphQL, SSE, live-class or payment webhook route found in mounted route map; this does not enumerate every independent DRM route | app.ts; route inventory |

## Trust boundaries and assets

1. **Untrusted browser → public Nginx**: paths, hash/query identifiers, bodies, multipart metadata, cookies, Origin/Host/forwarded headers and websocket messages are client controlled. SPA visibility does not authorize APIs. Sensitive responses must avoid shared caching.
2. **Nginx/provider → Express**: prefix rewrite, body limits, IP/HTTPS trust, WebSocket upgrade and timeout policy. Express trusts one proxy hop; deployment must prevent direct public backend bypass and sanitize client-supplied forwarding headers.
3. **Identity guards → module services**: verified session user/role is authoritative. Resource IDs still require ownership, publication, entitlement and required-assessment checks. ADMIN is not automatically an entitled STUDENT.
4. **Express → platform PostgreSQL/Redis**: credentials, user PII, encrypted national IDs, refresh digests, money ledger, access snapshots, code drafts, hidden assessment checks, progress, audits and inbox state. Runtime/migration roles and Redis network/ACL isolation need deployment evidence.
5. **Platform → external DRM API**: application credentials and RSA assertions cross the boundary. External responses and returned media URLs are untrusted. No DRM DB access from platform code. Device/session recovery must remain tenant-bound and preserve active/revoked devices.
6. **Browser → external DRM/object media origin**: transient bearer/device binding and signed video upload URLs. R2 CORS, CDN/cache, commercial license provider and token expiry must be exercised separately from HTTP fixture tests.
7. **Platform → private materials storage**: server-only S3 credentials and platform-owned generated object keys. Authorization precedes browser retrieval. Provider bucket ACLs, encryption, retention and deletion ownership require verification.
8. **Web application → trusted grading controller → hostile execution job**: student source is hostile. Controller/host socket and DB/Redis credentials must never enter jobs. Queue payload/result trust, hidden tests, quota, replay and cleanup need independent tracing.
9. **Parent SPA → opaque iframe / formatter worker**: intentional student-code execution is not ordinary application HTML rendering. No same-origin allowance or credentials should cross into preview; messages are hints, never trusted grading results.
10. **HTTP process → notification sockets/pub-sub/background work**: user-bound events, durable state and session revocation remain authoritative across replicas/restarts. Background deletion, expiry and retention may perform sensitive work even when no HTTP request is active.
11. **Repository/build/local evidence → runtime/deployment/backups**: dependency install scripts, lockfiles, images, ignored env, provider secrets, dumps, private fixtures and restored data. Ignore rules are not proof that history contains no secrets.
12. **Admin → financial/content/destructive actions**: authenticated ADMIN can change receiving details, approve money and remove media. Audit integrity and replay/concurrency controls matter even when role checks pass.

| Sensitive asset | Location/boundary | Security requirement to verify |
| --- | --- | --- |
| Passwords/Argon2 hashes | Browser input → identity → User | No logs, bounded input/cost, generic login failures |
| Access JWT / refresh secret / CSRF | Host-only cookies; session rows/digests | Signature/claims, rotation, revocation, CSRF, cache isolation |
| National ID | StudentProfile cipher/fingerprint/last4; two server-only keys | AES-GCM AAD binding, unique HMAC index, limited profile responses, key recovery |
| Student/guardian contact and school data | User/StudentProfile; admin directory | Actor-based access, field minimization, no indiscriminate logs/exports |
| Financial data and receipt bytes | Wallet/ledger/recharge/purchases/PostgreSQL | ADMIN proof access, atomic once-only credit/debit, immutable snapshot, retention |
| Code drafts/submissions/private grading tests | Assessment JSON / jobs | Student ownership, secret-test redaction, sandbox isolation, quotas |
| Captions/resources | Private object storage + platform metadata | Entitlement/progression, random owned keys, safe downloads and deletion |
| Original/packaged videos, content keys | External DRM/object storage/license boundary | Tenant/session/device/access enforcement; platform cannot certify internals from adapters |
| DRM client credential/RSA private key | Server-only config; public JWKS derivative | No browser leakage, redirect leakage, logs or build layers; rotation |
| Database/Redis/storage credentials | Deployment configuration/controller | Least privilege, network isolation, transport and provider restrictions |
| Receiving account settings/QR | Admin APIs and settings rows | ADMIN mutation, CSRF, consistency, audit |
| Docker socket/host | Trusted grading controller only | Never web/job mounted, qualified runtime, exact cleanup ownership |
| Backups/private evidence/local env | Ignored local files/provider stores | Access restriction, rotation/history scan, encrypted verified recovery |

## Initial data-flow traces

- Login: IdentityForm → cookie API client → /auth/login → IP limiter, Origin, anonymous CSRF → normalize identifier/password → user lookup + Argon2 verification → fresh durable session/refresh digest → Set-Cookie + safe user.
- Recharge: student JSON proof → /wallet/recharge-requests → authenticated actor + Origin/CSRF/limiter → proof/reference/amount validation → durable pending request → ADMIN review transaction → ledger credit/notification. A submitted screenshot does not settle funds.
- Purchase: authenticated student request supplies offer/reference/idempotency details → server resolves current offer and access terms → locked transactional wallet debit/access snapshot → own purchase response.
- Playback: course/lesson IDs + device ID → STUDENT/entitlement/progression → bounded platform assertion → authenticated DRM session API → validated browser-safe grant → direct external media/license calls; renew rechecks current access and expiry worker calls external revoke.
- Materials: ADMIN multipart → guards/limits/type and byte validation → platform private object + lifecycle metadata; STUDENT ID lookup → course/lesson access → backend storage fetch → no-store captions or safe attachment resource.
- Grading: authenticated source/draft/submission → service ownership/eligibility/version/quota/idempotency → durable record/outbox → trusted controller → resource-limited no-network job → validated per-question result → pass/result transaction → recipient completion hint + HTTP recovery.

## Externally reachable surface

The companion [API inventory](security-audit-attack-surface-20261005.md) lists 125 explicit method/path registrations including the dynamic QR mutations and public JWKS. HEAD aliases, trailing slashes, OPTIONS and socket protocol are additional runtime cases; a route count is not security coverage.

Public SPA: /, /index.html, /assets/* and hash pages home, login, register, courses, course offer, package, support, terms/privacy/refunds. Authenticated screens include account/profile, dashboard, wallet/recharge, purchases/purchase, learn, notifications, practice/assessment and admin workspaces. Exact hash dispatch: client/src/routes.ts. Hash IDs are still untrusted when sent to APIs. No separate server page endpoints enforce these UI routes.

API families: /auth, /admin, /catalog, /support, /wallet, /learning, /assessments, /admin/assessments, /notifications, /health, /.well-known/jwks.json. Socket: /api/notifications/socket.io/. Railway preparation adds /edge-health. Development publishing is 8080:8080 without an explicit loopback address; actual host firewall/interface reachability needs verification. Direct independent DRM endpoints and storage policies are not covered by this platform route count.

Environment inventory (names only): DATABASE_URL, REDIS_URL, POSTGRES_*, AUTH_JWT_SECRET, AUTH_ISSUER, AUTH_AUDIENCE, ALLOWED_ORIGINS, COOKIE_SECURE, ARGON2_*, STUDENT_DATA_ENCRYPTION_KEY_B64, STUDENT_DATA_INDEX_KEY_B64, DRM_BASE_URL, DRM_CLIENT_ID, DRM_CLIENT_SECRET, DRM_ASSERTION_*, DRM_PUBLIC_BASE_URL, STORAGE_*, PAYMENT_CHANNELS; controller GRADING_IMAGE/GRADING_RUNTIME/GRADING_SECCOMP_FILE and Python execution image settings. VITE_* values are public build inputs. No real secret values were included in this report or generated.

## Initial mapping status and subsequent audit completion

Historical status at the end of Phase 1, before source edits: Phase 1 mapping was complete for platform architecture; Phase 2 inventory was an initial source baseline. Per-route data-flow/security assessment, external DRM route review and phases 3–70 remain pending and must not be represented as passed. No application code changed in this phase. Initial process launches were slow; direct Node process launch returned EPERM; sandbox Docker check returned named-pipe permission denied. An approved elevated read-only Docker check subsequently succeeded (engine 29.8.0), so isolated verification can proceed. Existing preview/storage/controller resources were inspected, not changed.

Subsequent completion: all 70 categories are recorded in the [phase ledger](security-audit-phases-20261005.md), with six platform fixes and final Docker evidence in the [summary](security-audit-summary-20261005.md). The pending statements above record mapping-time status, not current unfinished source review.

Production provider TLS/DNS/ACLs/secrets/backups/CDN/trusted ingress and real-license enforcement: **NEEDS MANUAL VERIFICATION**. Procedures: inspect provider public/private ingress and forwarded-header rewriting; test actual HTTPS certificate/redirect/HSTS/cookies at approved origin; inspect bucket public-access/CORS and IAM scope; restore a protected backup into an isolated target and reconcile counts/financial integrity; exercise real entitlement/token expiry and cross-tenant/device denial through supported APIs. No production mutation, secret rotation, destructive exploit or capacity certification is implied.

Guidance: [OWASP Top 10 2025](https://top10.owasp.org/2025/0x00_2025-Introduction/), [ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0), [OWASP API Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x00-header/). These are audit guidance, not a claim of full ASVS conformity.
