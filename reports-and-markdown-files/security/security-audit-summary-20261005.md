# Security Audit Summary

**Follow-up 2026-10-06:** the owner authorized DRM repair and separately approved the tooling upgrade. F01/F03 and the DRM development portion of F02 are now fixed and verified; [repair report and 105 passing tests](../drm/drm-security-repair-20261006.md). The [security delivery follow-up](security-delivery-20261006.md) records browser-tooling remediation, a bounded frontend nesting mitigation with upstream advisories still visible, private local exposure checks, independent review and authorized dual-repository delivery. The findings/statuses below preserve the original audit baseline.

Audit started 2026-10-05; completed 2026-10-06. Scope: repository source, configuration, dependency metadata, redacted local Git-history scanning and isolated Docker verification. No production deployment, commit or push. Retained application data was not changed.

## Overall risk

**HIGH.** Nine findings: two HIGH, five MEDIUM and two LOW. Six platform findings were fixed; three remain open in external DRM or development/browser tooling. No CRITICAL vulnerability was established in the reviewed evidence. This is not a certification of production safety or complete exploit coverage.

All 70 requested categories are recorded in [the phase ledger](security-audit-phases-20261005.md), including NOT APPLICABLE and NEEDS MANUAL VERIFICATION dispositions. Architecture and trust boundaries were mapped before changes in [the architecture report](security-audit-architecture-20261005.md). The [attack-surface inventory](security-audit-attack-surface-20261005.md) covers 125 platform endpoints; the [read-only DRM review](security-audit-drm-readonly-20261005.md) covers 24 external API registrations and relevant worker paths. Endpoint guard tests do not replace every resource-ownership permutation or a deployed penetration test.

References: [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/), [ASVS 5.0](https://github.com/OWASP/ASVS/tree/v5.0.0), [OWASP API Security 2023](https://api-security.owasp.org/editions/2023/en/0x00-header/). These are review guides, not a claim of formal ASVS certification.

## Critical vulnerabilities

None established. Native execution isolation, deployed infrastructure, production credential use and DRM license behavior still require the verification below.

## High vulnerabilities

### F01 — Key-bearing packaging errors can reach external DRM logs and job persistence

**HIGH; OPEN.** CWE-532 / CWE-312; OWASP A09 logging and A04 cryptographic failures.

**Location/path:** education-drm-service/apps/worker/src/services/video-processing/packaging.service.ts:39 passes the content key in Shaka Packager command arguments. processors/video.processor.ts:133 handles a processing exception using its raw message, logs it, persists it through updateJobStatus and rethrows it for queue failure recording.

**Why/scenario/impact:** Node execFile failures include command arguments in the error message. A failed packaging attempt can therefore put its content key into logs, PostgreSQL job error text and queue failure data. An operator or attacker able to read these sinks could recover that failed attempt's key and decrypt any retained matching partial output. This is not evidence that successfully published videos' keys leaked, or that a student API exposes those logs.

**Recommended fix:** sanitize at the subprocess boundary and again before logging, persistence or rethrow; retain only approved operation/category/exit-status fields. Never retain raw command arguments, stderr or nested causes containing key material. Privately assess historical sinks and rotate/repackage affected outputs if exposure is confirmed.

**Code change:** none; nested DRM remained read-only. AGENTS.md says “Default work must not edit it” and requires an explicit assignment of a bounded DRM task. This general audit does not grant new nested maintenance authorization.

**Evidence/test:** a network-disabled Docker reproduction using a fixed synthetic placeholder confirmed execFile error messages contain arguments. Source tracing establishes the three sinks. A repair must add failure and timeout regressions asserting the placeholder is absent from logger, SQL update and queue-failure data.

**Remaining risk:** this external finding is open; historical production exposure is unknown.

### F02 — Known high-severity advisories in build and browser tooling

**HIGH advisory classification; OPEN.** CWE-674 / CWE-1333 / CWE-22, depending on advisory; OWASP A03 supply-chain failures.

**Location/path:** client/package-lock.json: Tailwind/watch/glob chain to braces 3.0.3; docker/browser/package-lock.json: Puppeteer browser-management FTP/PAC/archive dependencies; education-drm-service/pnpm-lock.yaml: development ESLint/globby chain to braces.

**Evidence:** Docker audits reported server 0, execution 0, client 5 high chain entries, browser tooling 7 high chain entries and external DRM 1 high development entry. These are dependency-chain entries, not 13 distinct vulnerabilities. Public web-runtime exploitability was not established. [Braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists affected versions through 3.0.3 and no patched release; npm latest was 3.0.3 during review. A pnpm suggestion of at least 3.0.4 was not an available release. Browser findings include [basic-ftp](https://github.com/advisories/GHSA-c475-qrg2-pj4r) and [archive extraction](https://github.com/advisories/GHSA-jmr9-qjv8-65gv).

**Why/scenario/impact:** a builder processing attacker-controlled brace patterns may exhaust resources; vulnerable browser management handling hostile proxy/FTP/archive input can expose its environment or write outside intended extraction locations. Actual exposure depends on tool inputs and privileges.

**Recommended fix/code change:** no blind major upgrade applied. Qualify Tailwind 4 and browser Puppeteer 25 migrations, or a reviewed bounded patch/removal of the vulnerable chain. Keep untrusted patterns, proxy configuration and archives away from privileged builders. External lockfile changes require their own authorization.

**Test proving repair:** currently only audit evidence, not a fix. After migration, rerun dependency audits, frontend build/style/browser checks and browser installation/extraction tests in disposable Docker environments.

**Remaining risk:** advisories remain open; runtime and tooling severity must be distinguished in release decisions.

## Medium vulnerabilities

### F03 — External webhook address normalization and DNS check/use gap

**MEDIUM; OPEN.** CWE-918; OWASP API7 SSRF.

**Location/path:** education-drm-service/apps/api/src/services/webhook.service.ts:29 private-address predicate and :122 delivery fetch. Validation resolves DNS separately from the eventual connection.

**Why/scenario/impact:** the mapped-loopback URL https://[::ffff:127.0.0.1]/ canonicalizes to a hexadecimal mapped address that the selected dotted-address checks miss. An application credential holder can register a webhook destination whose address is wrongly accepted; DNS rebinding can also change the address between validation and delivery. HTTPS, port 443, normal TLS verification and manual redirect handling constrain the attack. No internal request, exfiltration or full SSRF exploit was performed.

**Recommended fix/code change:** no nested edit. Use vetted normalization and a complete public-address policy covering mapped IPv6; bind the validated DNS result to the actual TLS connection while preserving hostname verification/SNI, plus outbound network restrictions.

**Test/evidence:** the actual copied predicate accepted canonical mapped loopback in a network-disabled Docker test. Add mapped/private/reserved address cases and a controlled changing-DNS delivery fixture when repairing.

**Remaining risk:** open; tenant credentials are a prerequisite and network/TLS constraints affect exploitability.

### F04 — Platform DRM requests could follow redirects carrying application credentials

**MEDIUM; FIXED.** CWE-200 / CWE-918; OWASP API10 unsafe API consumption.

**Location/path:** server/src/modules/catalog/drmClient.ts, request and bearerRequest fetch calls. Default redirect following could forward custom application-secret headers to a destination selected by a compromised upstream.

**Scenario/impact:** a compromised configured DRM endpoint redirects a platform request to an attacker endpoint, exposing custom secret headers. This is dependency-driven, not a student-controlled arbitrary URL.

**Fix/change:** both fetch paths now use redirect: error; existing bounded safe dependency errors are retained.

**Test:** Docker transport tests assert both fetch paths reject redirect following and preserve safe failure behavior. They test fetch options, not a full deployed redirect chain.

**Remaining risk:** the configured destination, DNS, certificate trust and service credentials still need deployment protection.

### F05 — Upstream response limit applied after unbounded buffering

**MEDIUM; FIXED.** CWE-400; OWASP API4 resource consumption / API10.

**Location/path:** server/src/modules/catalog/drmClient.ts, readBoundedBody. The old response.text() buffered the whole body before applying a character limit.

**Scenario/impact:** a malfunctioning or compromised DRM dependency sends an excessive response and consumes replica memory; multibyte text also defeats a character-based byte budget.

**Fix/change:** stream with a 256 KiB byte limit, cancel on overflow, release the reader lock and decode only accepted chunks.

**Test:** Docker tests prove cancellation without awaiting stream completion and byte-based rejection of multibyte Arabic text; related schema/playback regressions pass.

**Remaining risk:** compressed transport behavior and concurrent dependency failures need runtime resource qualification; timeouts and schema validation remain necessary.

### F06 — Raw exceptions and request query data could enter platform logs

**MEDIUM; FIXED.** CWE-532; OWASP A09.

**Location/path:** server/src/logger.ts and server/src/app.ts pino-http configuration. Arbitrary exception messages/causes and default request serializers could retain sensitive upstream content or query data.

**Scenario/impact:** a dependency exception or request containing a sensitive query value becomes visible to log readers and survives retention.

**Fix/change:** safe error serialization permits bounded type/code and stack frames only; request serialization explicitly allows request ID, method, URL without query, headers subject to existing redaction and connection metadata. The HTTP boundary explicitly uses these serializers; existing header redaction stays in place.

**Test:** logging tests check raw message/cause/query/params/body omission and safe diagnostics. An initial HTTP serializer override regression was detected and corrected; final suite passes.

**Remaining risk:** IP addresses and resource paths remain; log ACLs, retention and future arbitrary named log fields require review.

### F07 — SPA response lacked anti-framing protection

**MEDIUM; FIXED.** CWE-1021; OWASP A02 misconfiguration.

**Location/path:** client/nginx.conf and docker/railway/default.conf.template, server and asset/index response locations.

**Scenario/impact:** an attacker able to satisfy the necessary browser/session conditions, including possible same-site sibling hosting, frames account/admin actions for UI redress. SameSite cookies reduce some cross-site cases but do not replace framing policy.

**Fix/change:** CSP frame-ancestors 'none'; object-src 'none'; base-uri 'self', plus X-Frame-Options DENY. Location-level copies account for Nginx header inheritance.

**Test:** both Nginx configurations validate and return the headers. Chromium renders the app, blocks a hostile parent frame and successfully executes the actual opaque-origin sandboxed IDE preview under the new CSP.

**Remaining risk:** this is a limited CSP. Full script/connect/media/worker policy requires real DRM/IDE browser qualification before enforcement.

## Low vulnerabilities

### F08 — Private API responses had no consistent cache default

**LOW; FIXED.** CWE-525; OWASP A02.

**Location/path:** server/src/app.ts middleware before body parsers and route guards. Successful private responses previously lacked a consistent no-store default.

**Scenario/impact:** a browser or misconfigured intermediary could retain private data longer than intended. No actual cross-user CDN leak was established.

**Fix/change:** API responses default to Cache-Control: no-store; public JWKS explicitly retains public max-age=300.

**Test:** representative route/cache tests and successful authenticated profile/refresh integration responses assert no-store; JWKS behavior remains covered.

**Remaining risk:** production CDN cache rules must honor origin policy and identity separation.

### F09 — Login did not enforce the password-length contract before lookup

**LOW; FIXED.** CWE-400; OWASP API4.

**Location/path:** server/src/modules/identity/service.ts, login. Registration/change-password enforce the 256-character limit but login previously did not.

**Scenario/impact:** oversized inputs cause avoidable processing and violate the shared contract. Existing JSON size/IP limits bound exposure; Argon2 memory cost is not proportional to password length, so this is not a demonstrated catastrophic hashing DoS.

**Fix/change:** reject over-limit values with generic INVALID_CREDENTIALS before account lookup or hashing.

**Test:** email and phone unit cases assert no lookup; integration tests accept the 256-character boundary and reject 257 characters for known/unknown accounts with the same generic response.

**Remaining risk:** distributed credential stuffing and aggregate authentication capacity require operational controls.

## Fixed vulnerabilities

F04–F09 are implemented and verified. Source changes are limited to identity login, DRM transport, platform logging/cache defaults and the two Nginx response configurations. No schema migration, new role, new policy, external persistence access or nested DRM edit was introduced.

## Remaining vulnerabilities

F01, F02 and F03 remain open. Do not describe the audit as all vulnerabilities fixed. The external read-only report includes concrete repair targets; a bounded owner assignment is required before nested implementation.

History scanning produced **39 candidates requiring private owner triage**, not 39 confirmed leaked production credentials. Pinned official Gitleaks 8.30.1 scanned all locally available refs with full redaction and allow-comments disabled: platform 29 commits / 33 candidates, DRM 14 commits / 6 candidates. Many have fixture/example context; a nearby placeholder marker is not conclusive. No raw values were printed. Any committed/default value used as a real credential MUST ROTATE/revoke even if subsequently removed. Unknown secret formats, unavailable remote refs and backups were not certified clean. [Scanner release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).

## Manual verification required

All procedures below are **NEEDS MANUAL VERIFICATION**; use authorized staging and synthetic identities.

1. **DRM runtime and historical key exposure:** privately inspect job/log/queue failure sinks; reproduce failed and timed-out packaging with a dummy key and assert absence from every sink after repair. Exercise tenant A/B media/device/session/license binding, expired subscriptions and playback revocation through external APIs in a disposable DRM deployment. Platform code must never access the DRM database.
2. **Credential inventory:** compare all 39 redacted candidate locations/commits against the owner's deployed credential inventory without posting values. Revoke/rotate confirmed used values, update dependent services and verify old credentials fail. Scan authorized remote refs, release archives and backups separately.
3. **TLS/domain/cookies:** on actual domains verify HTTP redirect, certificate chain/expiry, accepted TLS versions, HSTS, mixed content and wss; inspect Secure/HttpOnly/SameSite/host-only cookies and exact origins. Check provider ownership and dangling DNS/CNAME records.
4. **Proxy/network/parser:** prove backend, database, Redis and grading controller are private. Send controlled forged X-Real-IP/X-Forwarded-For/Proto through the public edge and compare rate-limit identity; direct access must fail. In isolated staging test CL/TE conflicts, duplicate Content-Length and malformed chunks for rejection/connection close at each hop; review TRACE/CONNECT/HEAD/OPTIONS.
5. **Database/backups:** verify separate runtime and migration principals, only necessary DML grants, no superuser/DDL for web replicas, TLS where applicable, encrypted backup access and isolated restore integrity including wallet ledgers.
6. **Storage/privacy:** confirm bucket privacy, IAM/CORS, denial of unsigned and foreign-owner objects, quarantine/scanning policy for allowed documents and bounded PDF/ZIP handling. Verify proof/notification 180-day cleanup and grading retention. Obtain owner-approved account deletion/legal retention policy rather than inventing it.
7. **Browser/cache/static:** qualify a full CSP in report-only staging across DRM playback and IDE languages/browsers. Use two identities against actual CDN routes to verify no private caching. Probe .map/.env/.git/backup paths and compare response bodies to SPA fallback before claiming disclosure.
8. **Execution and abuse:** verify deployed runsc and namespace/seccomp limits using bounded isolated probes; confirm no socket/network from jobs and reliable cleanup. Measure aggregate authentication, upload, database, socket and grading limits, including IPv6 prefix rotation, without production load tests.
9. **Supply chain/operations:** generate an SBOM and scan OS/Chromium/FFmpeg/Shaka images; qualify dependency migrations. Inspect provider CI/deploy credentials, PR secret access, approvals and protected environments. Verify log ACL/retention and alerts using synthetic 401/403/429, admin-action and dependency-failure events.

## Production deployment requirements

Resolve or explicitly disposition the three open findings with the owner; complete the applicable runtime checks above; rotate any confirmed used committed secrets; qualify dependency replacements and enforce private network, TLS, least-privilege and backup requirements. This report grants no production, capacity or milestone acceptance. Source-only validation cannot establish these deployed properties.

## Recommended security improvements

Prioritize qualified dependency migration, safer external worker error handling and webhook egress. Then consider owner-approved admin MFA/recent-authentication requirements, adaptive account-level authentication limits, socket connection caps, aggregate resource budgets, bounded remaining catalog reads, full CSP, immutable image digests and trusted CI secret/SAST/container scanning. No new role or business policy was invented.

## Security controls already implemented correctly

- Cookie-based authentication; no authentication tokens in browser local storage. Durable session validation, rotation/revocation and current database role checks.
- Exactly STUDENT and ADMIN; protected routes enforce server guards, resource ownership and subscription expiry. ADMIN grants are not taken from client fields.
- Origin/CSRF checks, restricted CORS/socket origins and strict bounded input schemas. Prisma parameterization; no unsafe dynamic SQL path found.
- React escaped rendering and isolated opaque-origin IDE preview messaging; untrusted grading isolated from the web service and private expected results.
- Manual EGP recharge approval, authoritative prices/subscription duration, wallet locking and idempotent ledger references; no automatic payment callback assumed.
- API-only external DRM integration, tenant/session binding in reviewed source, private materials/proof storage, auditable sensitive admin actions and explicit destructive confirmation.

These statements describe reviewed source and exercised cases, not every production failure mode.

## Verification and cleanup evidence

Final isolated Docker run: **576 server unit tests + 417 integration tests = 993 passing, no skipped tests**. Frontend: **173 tests plus two DASH script checks passing**. Server and test TypeScript checks, server build and frontend typecheck/build pass. Existing frontend chunk-size advisory remains.

The 292-case route matrix covers all 112 protected endpoints with missing and malformed credentials, plus all 68 ADMIN endpoints using a stale ADMIN token against a current STUDENT database role. Existing ownership, CSRF, wallet, playback, material and concurrency suites supplement it.

Both Nginx configurations and Chromium framing/real IDE preview checks pass. External predicate/key-error reproductions were network-disabled and used synthetic inputs. An initial materials guard failure was resolved using correctly named fresh databases and isolated MinIO, not by bypassing guards; final full run includes materials.

Evidence: docker/browser/evidence/security-audit-20261005/ (ignored local logs and redacted scanner output). Harness: docker/security-audit/. Only audit-labelled containers, networks and fresh named/anonymous volumes were removed after ownership inspection. Existing fayq-local-preview-grading-1 and fayq-local-materials-materials-minio-1 remain running. Audit images/evidence remain available. Nested Git working tree stayed clean.

## Final production checklist

Checked boxes mean reviewed source/test evidence for that control; unchecked boxes need the stated remaining work. They do not certify deployment.

- [x] Authentication secure — reviewed flows/tests; aggregate abuse remains operational.
- [x] Authorization secure — current roles and ownership guards reviewed.
- [x] IDOR/BOLA tested — existing ownership cases, not exhaustive permutations.
- [x] Input validation complete — inventoried implemented routes reviewed.
- [x] SQL/NoSQL injection protected — parameterized SQL; no platform NoSQL sink.
- [x] XSS protected — reviewed escaping/isolated previews; browser qualification remains.
- [x] CSRF addressed.
- [x] CORS restricted — source; deployed origins still require inspection.
- [x] Security headers configured — Docker HTTP/browser checks.
- [ ] CSP configured — limited policy fixed; full policy qualification pending.
- [x] Rate limiting configured — aggregate/IPv6 limits still require measurement.
- [x] Password handling secure.
- [x] JWT/session security verified — source and regression coverage.
- [ ] File uploads secured — source checks present; storage/scanning/runtime policy pending.
- [ ] SSRF protected — external F03 open.
- [x] Path traversal protected — reviewed owned prefixes/paths and regressions.
- [ ] Secrets removed/rotated — candidate inventory triage pending.
- [x] Environment validation configured.
- [x] Production errors sanitized — platform client responses; external worker F01 open.
- [ ] Security logging configured — platform serializers fixed; external/operational gaps remain.
- [x] Dependencies audited — open findings do not mean resolved.
- [x] Supply-chain risks reviewed — runtime image/provenance checks pending.
- [ ] Database least privilege configured — deployed grants unknown.
- [ ] HTTPS enforced — source restrictions; deployed edge verification pending.
- [x] Cookies secured — source; inspect deployed attributes.
- [x] Sensitive data exposure reviewed — production sinks/inventory still pending.
- [x] Admin permissions verified — 68-route current-role denial matrix.
- [x] Business-logic attacks reviewed — manual funding and progression preserved.
- [x] Race conditions reviewed — locking/idempotency suites pass.
- [x] API abuse protections configured — aggregate capacity remains unverified.
- [ ] DoS/resource limits configured — source bounds exist; deployed aggregate qualification pending.
- [ ] CI/CD security reviewed — provider permissions unknown.
- [x] Deployment configuration reviewed — source only.
- [x] Security tests passing.
- [x] Build passing.
- [x] Type checking passing.
- [x] No known CRITICAL vulnerabilities — none established within this scope.
- [ ] No known HIGH vulnerabilities — F01/F02 remain open.
