# Security audit phase follow-up — 2026-10-11

This is a current-source delta ledger for the [complete 2026-10-05 70-phase review](security-audit-phases-20261005.md) and the [2026-10-06 delivery](security-delivery-20261006.md). Each requested phase is accounted for below. “Carry forward” retains the prior source finding and its stated limit; the current change set was checked for impact. This is not a new external penetration test. New route findings are in the [current route inventory](security-attack-surface-followup-20261011.md); current risk and launch gates are in the [follow-up summary](security-audit-followup-20261011.md).

| Phase | Subject | Current disposition |
|---:|---|---|
| 1 | Understand the application | Carry forward: one Express backend, React/Vite, PostgreSQL/Prisma, Redis, cookie sessions, two roles and API-only DRM boundary. M10 and course-cover modules remain inside this architecture. |
| 2 | Attack surface enumeration | Updated: 132 current route-method registrations; seven M10 additions, two cover reads and two retired captions accounted for. See route delta table. |
| 3 | Authentication security | Carry forward: Argon2, bounded login input, session rotation/revocation and rate limits remain as reviewed; no auth implementation changed here. Deployment abuse telemetry remains manual. |
| 4 | JWT security | Carry forward: algorithm/issuer/audience/session checks and cookies remain unchanged. Production key entropy/rotation needs manual verification. |
| 5 | Session security | Carry forward: durable session binding/revocation and logout behavior remain unchanged. Production cookie flags and expiry need edge verification. |
| 6 | Authorization / access control | Updated: M10 routes use current database ADMIN checks or student identity/entitlement binding. Private course-cover GET is included in missing-auth and stale-role guard matrices. |
| 7 | Input validation | Updated: M10 UUIDs/cursors/limits and bounded report selections; course cover UUID, type/signature/size/dimension and URL validation were reviewed. Broader adversarial fuzzing remains incomplete. |
| 8 | SQL / database injection | Carry forward: parameterized Prisma/tagged SQL; new M10 database queries reviewed in their services. No new unsafe query path found. |
| 9 | NoSQL injection | Not applicable: PostgreSQL/Prisma and bounded Redis usage; no document database. |
| 10 | Command injection | Carry forward: no new client-controlled command execution. Restricted grading-controller boundary and deployed runsc qualification remain manual. |
| 11 | XSS | Carry forward: React escaping and existing isolated IDE preview controls unchanged. New report fields are rendered as text. Browser XSS fuzzing remains manual. |
| 12 | Content security policy | Carry forward: current API/edge policies unchanged. Full deployed CSP compatibility with workers/DRM requires staging verification. |
| 13 | CSRF | Updated: M10 POST routes retain Origin/session-CSRF guards; GET routes are read-only. No new state-changing route bypass identified. |
| 14 | CORS | Carry forward: same-origin API and exact Origin checks unchanged. Verify edge behavior on the real origin. |
| 15 | Security headers | Updated: cover responses set `X-Content-Type-Options: nosniff`; existing Helmet/Nginx policies remain. TLS-only headers require deployment verification. |
| 16 | Clickjacking | Carry forward: edge/API frame restrictions unchanged and covered by prior local Chromium verification. Recheck actual deployed edge. |
| 17 | SSRF | Carry forward: no new client-controlled outbound URL. Cover URL validation rejects external origins; dependency DNS/egress restrictions need deployment review. |
| 18 | File upload security | Updated: course-cover upload/reads reviewed with existing strict JPEG/PNG, signature, dimensions and body limits; integration tests cover malformed inputs and public/private lifecycle. Lesson resources retain private MinIO controls. |
| 19 | Path traversal | Updated: cover retrieval uses UUID-scoped database-owned keys and an exact public route; no caller-supplied storage path. Resource keys remain opaque. |
| 20 | Download security | Updated: public cover is limited to published courses; drafts are ADMIN-only/private/no-store; lesson resources remain authenticated and entitlement/progression-bound. |
| 21 | Open redirects | Carry forward: no redirect destination added by this work; known redirect protections unchanged. |
| 22 | Mass assignment | Carry forward: no role, wallet, or authorization fields added through these paths. M10 report inputs are allowlisted. |
| 23 | Prototype pollution / object merging | Carry forward: no new generic object merge or client-shaped query construction identified. |
| 24 | Deserialization | Not applicable to new paths: JSON validation and multipart form parsing remain bounded; no unsafe object deserializer added. |
| 25 | XML security | Not applicable to new paths: no XML parser or upload mode added. |
| 26 | Regex denial of service | Carry forward: braces source guard remains pinned and regression-tested; advisories are still reported. Input regex review remains as baseline. |
| 27 | Rate limiting | Updated: view start/heartbeat have 30/minute and 120/minute limits; parent-report generation has 30/minute. Effective multi-replica ingress identity needs real deployment verification. |
| 28 | Denial of service | Updated: report courses are limited to 50 and paginated; heartbeats are rate-limited and row-locked. Existing whole-catalog scaling and load limits remain separate capacity work. |
| 29 | API security | Updated: seven new M10 routes and two cover routes traced; new guards, fields, cache policy and side effects are documented. No new API bypass established. |
| 30 | Business logic security | Updated: reports are transient; contact data is ADMIN-only; course covers follow publish/delete state; lesson materials still enforce expiry and progression. Relevant integration suites pass. |
| 31 | Race conditions | Updated: M10 heartbeat lock/threshold tests pass; cover lifecycle tests cover publication/deletion visibility. Other DB/provider concurrency limits remain as in baseline. |
| 32 | Database security | Carry forward: no schema migration in this follow-up and no platform access to external DRM persistence. Production grants/backups are manual. |
| 33 | Sensitive data | Updated: parent-contact and learning reports are privileged, bounded and non-persistent; no report body/phone-bearing URL logging path was found. Production audit-log access/retention remains manual. |
| 34 | Cryptography | Carry forward: no crypto/session/token changes; current algorithm and key boundary findings remain in the baseline. |
| 35 | Secrets management | Carry forward: no credentials were added. Historical private-scan scope/limits remain as the 2026-10-06 report states; remote refs and any production vault require owner-side review. |
| 36 | Environment / configuration | Updated: only development/build package versions and lockfiles changed; runtime server settings and external API-only boundary remain. |
| 37 | Error handling | Carry forward: cover/report APIs use existing safe error envelopes; no raw upstream payload was added to responses. |
| 38 | Logging | Updated: M10 report path source reviewed for recipient/body logging; none found. Existing bounded serializers and redaction remain. Production log ACLs/retention need manual verification. |
| 39 | Security monitoring | Needs manual verification: no production monitoring/alert system is configured or available to inspect here. |
| 40 | Dependency security | Updated 2026-10-12: server runtime and client production-only dependencies each audit 0; browser test image 0. The selector-parser moderate was fixed with a 7.1.6 override. Full client tree retains five high advisory records from Tailwind 3's build-only `braces` chain; the existing local depth guard is exact-source-pinned and tested, but npm still reports the upstream package advisory. Tailwind 4 cleared the full audit in a Docker trial but was not retained because its official browser floor is higher; the owner reaffirmed preserving current browser support. |
| 41 | Software supply chain | Updated: Vite 6.4.4 and source-map-js 1.2.2 locked; no audit exception added. Reproducible CI/SBOM/signature controls remain deployment/CI verification. |
| 42 | CI/CD security | Carry forward: no CI credentials/workflow edit. Protect branch, signing, and deployment secrets on the actual GitHub environment. |
| 43 | Docker security | Carry forward: source tests use isolated Docker. Production image privilege, runtime seccomp and grading socket exposure require deployment inspection. |
| 44 | Server / reverse proxy | Needs manual verification: forwarded-IP trust, private backend ingress, request framing and edge body/time limits cannot be proven from local source alone. |
| 45 | HTTPS / TLS | Needs manual verification: no production host/certificate exists to probe. |
| 46 | Host header attacks | Carry forward: SEO origins use configured canonical origin; no Host-derived report URL introduced. Live tenant/domain behavior is unverified. |
| 47 | Webhook security | Platform: not applicable (no inbound payment webhook). DRM remains read-only in this task; previously authorized fixes and remaining receiver checks stay in its report. |
| 48 | Third-party API security | Carry forward: no new external API consumer. DRM response limits/redirect rejection remain; provider contract and egress need live verification. |
| 49 | OAuth / social login | Not applicable: none in the platform. |
| 50 | Password reset | Not applicable: no self-service password-reset route. |
| 51 | Email security | Not applicable: platform has no email sender. |
| 52 | Frontend security | Updated: public preload/social metadata use escaped URLs and same-origin validated course covers; no token storage, auth boundary or iframe policy changed. |
| 53 | Service workers / PWA | Not applicable: no service-worker execution was introduced. |
| 54 | Cache security | Updated: API defaults remain no-store; private course covers are no-store; public covers revalidate and disclose only published image bytes. CDN adherence remains manual. |
| 55 | HTTP method security | Carry forward: methods remain explicitly registered; GET/HEAD/OPTIONS and proxy method handling need deployed transport verification. |
| 56 | Request smuggling / proxy assumptions | Needs manual verification: raw CL/TE and duplicate-header behavior across provider, Nginx and Node was not tested here. |
| 57 | GraphQL security | Not applicable: no GraphQL endpoint. |
| 58 | WebSocket security | Carry forward: Socket.IO session/Origin/CSRF protections unchanged; replica coordination and abuse limits need deployment tests. |
| 59 | Admin panel security | Updated: M10 roster/report routes and admin cover read use ADMIN guards; stale-role denial matrix includes the new cover endpoint. |
| 60 | Multi-tenancy | Carry forward: platform is single-tenant with student/course ownership; external DRM tenant matrix remains outside this read-only review. |
| 61 | Privacy / data minimization | Updated: generated report is transient, course-limited and not persisted; exact external guardian-contact consent/retention policy remains an owner/legal decision. |
| 62 | Source maps | Carry forward: production Vite source maps remain disabled. Verify deployed static paths against the actual release. |
| 63 | Static / sensitive file exposure | Updated: cover path returns validated image bytes only; no directory or arbitrary object key route added. Deployment path probes remain manual. |
| 64 | Information disclosure | Carry forward: no new server version, stack trace or secret-bearing response. Health and edge fingerprints retain baseline notes. |
| 65 | Subdomain / domain security | Needs manual verification: DNS, domain ownership, CNAME records and certificate scope cannot be checked without production-domain ownership details. |
| 66 | Delete / account actions | Updated: course cover is hidden when deletion is requested; no new account/destructive action added. Existing durable course deletion behavior remains. |
| 67 | Payments | Carry forward: manual EGP review, wallet and purchase paths unchanged; no processor/webhook route introduced. |
| 68 | Security testing | Updated: full server, client and dedicated materials Docker counts are recorded in the follow-up summary. Targeted protected-route coverage adds ADMIN cover denial cases. |
| 69 | Security linting / static analysis | Updated: lockfile npm audits repeated; server/browser/runtime clean, client full dev chain remains nonzero. No formal CodeQL/Semgrep or production image scan is claimed. |
| 70 | Production readiness | HIGH due client build-chain advisories; no critical platform vulnerability established. Production, remote history, edge and execution-host checks remain **NEEDS MANUAL VERIFICATION**. No production release performed. |
