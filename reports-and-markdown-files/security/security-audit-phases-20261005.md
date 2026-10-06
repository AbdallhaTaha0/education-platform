# Ordered security audit phase ledger

**Follow-up 2026-10-06:** the owner authorized DRM repair and separately approved the tooling upgrade. F01/F03 and the DRM development portion of F02 are now fixed and verified; [repair report and 105 passing tests](../drm/drm-security-repair-20261006.md). Frontend/browser-tooling F02 advisories and private historical credential/exposure checks remain. The findings/statuses below preserve the original audit baseline.

Statuses apply to repository evidence, not a production certification. All 70 requested categories were reviewed in order. See the [consolidated report](security-audit-summary-20261005.md) for final findings, verification and remaining manual procedures.

## Phase 1 — UNDERSTAND THE APPLICATION

Architecture map saved before application edits.

## Phase 2 — ATTACK SURFACE ENUMERATION

Platform route inventory saved before application edits; 24 external API registrations subsequently reviewed read-only; see the external report.

## Phase 3 — AUTHENTICATION SECURITY

LOW login maximum-length inconsistency fixed; 72 focused Docker tests passed.

## Phase 4 — JWT SECURITY

HS256 allowlist, signature/issuer/audience verified; only identity/session claims. Cookies HttpOnly/Secure in production/host-only/Lax; refresh rotation and durable reuse revocation. Issuer always emits expiry; verifier could require exp explicitly as defense in depth. Key entropy and rotation NEEDS MANUAL VERIFICATION.

## Phase 5 — SESSION SECURITY

Random session family on each login; refresh digest only; 30-day absolute deadline and immediate durable revocation. Idle timeout/MFA are owner policy decisions, not invented requirements.

## Phase 6 — AUTHORIZATION / ACCESS CONTROL

Route guards and identity-derived ownership reviewed for identity/admin, catalog, wallet, learning, assessment, notifications, and support. Student cannot set role, balance, reviewer, or recipient. Endpoint inventory is a trace map, not independent exhaustive penetration-test evidence.

## Phase 7 — INPUT VALIDATION

Allowlisted primitive inputs, UUIDs, finite numbers, bounded content/contracts, duplicate multipart rejection; global 256KiB JSON, proof8MiB exception. Some admin reorder bodies ignore extra fields but never apply them. Deep JSON and all malformed-Unicode cases require further fuzzing.

## Phase 8 — SQL / DATABASE INJECTION

Raw-query sites enumerated; SQL uses tagged templates/Prisma.sql with value parameters and static identifiers. No unsafe raw query APIs found. Migrations use static DDL. No SQL-injection path established.

## Phase 9 — NOSQL INJECTION

NOT APPLICABLE — no MongoDB/document query operators. Redis commands use server key prefixes and bounded trusted scopes, not client Lua.

## Phase 10 — COMMAND INJECTION

Docker launched with argument arrays, no shell; code arrives on stdin. Intentional Python/JS execution isolated in restricted jobs; production requires runsc. Execution-host escape testing NEEDS MANUAL VERIFICATION.

## Phase 11 — XSS

React escaped content; no dangerouslySetInnerHTML found. IDE innerHTML/Function is intentional in opaque allow-scripts iframe with restrictive sandbox and source-bound messaging; private grades are separate. Browser XSS fuzzing and captions NEEDS MANUAL VERIFICATION.

## Phase 12 — CONTENT SECURITY POLICY

Fixed missing framing policy on static SPA configs; object-src none/base-uri self. Restrictive script/connect CSP remains NEEDS MANUAL VERIFICATION due code preview, workers, DRM media. API Helmet CSP reviewed.

## Phase 13 — CSRF

State-changing platform routes use exact Origin plus session CSRF; login/register use Origin and refresh session binding. Reads that materialize student wallet do not credit money. Socket handshake Origin+CSRF. No write-guard bypass identified in enumerated routes.

## Phase 14 — CORS

Express does not enable cross-origin API CORS (origin:false); deployment is same-origin. Origin allowlist controls writes/socket. No wildcard credential reflection found; production allowedOrigins requires deployment review.

## Phase 15 — SECURITY HEADERS

Helmet protects API; static framing policy fixed; Nginx nosniff/referrer at edge. Browser compatibility/HSTS at HTTPS ingress NEEDS MANUAL VERIFICATION. Do not enable COEP blindly with DRM dependencies.

## Phase 16 — CLICKJACKING

Static documents previously frameable; fixed with frame-ancestors none and X-Frame-Options DENY. Docker verifies headers for home/index/account and config syntax; Chromium subsequently verifies hostile-frame blocking, React rendering and actual opaque-origin IDE preview execution. Full CSP/real-license browser qualification remains manual.

## Phase 17 — SSRF

Fixed DRM redirect following with credential headers; fixed configured destination, encoded resource identifiers. Object storage already rejects redirects. No arbitrary user URL server fetch found. Configured destination/DNS/egress policy NEEDS MANUAL VERIFICATION.

## Phase 18 — FILE UPLOAD SECURITY

Admin-only resources/captions, private receipts, signature/ext/MIME/size validation, random keys, no archive extraction or executable storage. ZIP/PDF can contain malware: antivirus/quarantine policy NEEDS MANUAL VERIFICATION; attachment disposition limits browser execution, not malware on downloaded files.

## Phase 19 — PATH TRAVERSAL

No client filename filesystem paths in platform. Object keys generated from authorized records+random UUID; execution fixed paths and random server names. No traversal sink established.

## Phase 20 — DOWNLOAD SECURITY

Protected resource/caption reads check identity, entitlement, lesson/course binding, progression before storage. Receipts ADMIN-only. Attachments use safe disposition and nosniff; stored PDF inline receipt uses API CSP but manual hostile-document browser testing remains.

## Phase 21 — OPEN REDIRECTS

No arbitrary backend redirect sink/OAuth/returnUrl flow found. Nginx fixed /api normalization; frontend internal navigation derived fixed routes. No open redirect established.

## Phase 22 — MASS ASSIGNMENT

Registration hardcodes STUDENT; profile explicit field maps; catalog monetary/draft updates validated; wallet status/balance server derived. No request.body directly spread into privileged models found.

## Phase 23 — PROTOTYPE POLLUTION / OBJECT MERGING

No recursive untrusted merge found. Object.assign catalog operates validated academic projection; generic log sanitizer is output-only. Dependency review still required for merge libraries.

## Phase 24 — DESERIALIZATION

JSON only for cookies/queue/contracts; typed bounded parsing and worker result validation. No eval-based serialized object loader. Untrusted code execution is isolated intentional functionality.

## Phase 25 — XML SECURITY

NOT APPLICABLE to platform server — no XML parser. Browser DASH XML processing belongs client dependency review; external packager manifests require separate DRM review.

## Phase 26 — REGEX DENIAL OF SERVICE

Input regexes operate bounded strings for email/phone/UUID/material metadata; no demonstrable catastrophic regex found. Admin rich content/body has ceilings; comprehensive regex fuzzing NEEDS MANUAL VERIFICATION.

## Phase 27 — RATE LIMITING

Redis atomic per-IP auth/register/refresh/admin-create limits across replicas; assessment daily per-account quota and queue capacity. Raw IPv6 addresses permit prefix rotation; distributed credential stuffing still possible. Per-account/adaptive throttling and upload/download limits require measured owner-approved policy; production proxy spoofing must be tested.

## Phase 28 — DENIAL OF SERVICE

Body/file/stream/time/worker memory/pid/cpu bounds exist. Public course list and large hierarchy reads are not uniformly paginated; account/socket count and aggregate Argon concurrency lack global budgets. LOW/medium resource-abuse residuals; capacity/load testing NEEDS MANUAL VERIFICATION. DRM body limit checked after res.text: confirmed issue queued for phase48.

## Phase 29 — API SECURITY

125 explicit platform route entries inventoried; internal modules have no separate listeners. Public JWKS public-only and health minimal. Authz and response projections traced. No full route-by-route hostile runtime matrix yet; endpoint inventory must not be mistaken for completed API pen test.

## Phase 30 — BUSINESS LOGIC SECURITY

Manual recharge requires ADMIN receiptVerified, pending-only credit; backend offers/money; paid progression and private grades trusted backend. No automatic provider settlement exists by design. Owner-scoped workflows preserved.

## Phase 31 — RACE CONDITIONS

Wallet row locks, unique ledger refs, replay keys; refresh FOR UPDATE; course advisory locks; notification inbox locks/leases; grading quota/queue transactions. Existing concurrency regressions will run in final suite. End/renew publication races deserve targeted runtime follow-up.

## Phase 32 — DATABASE SECURITY

PG schema enum two roles, FK/uniques/indexes and migrations examined; ledger integrity constraints and lease ownership. Development/test use postgres superuser, not production proof. Production separate DML/migrator roles, TLS, backup encryption/restore NEEDS MANUAL VERIFICATION.

## Phase 33 — SENSITIVE DATA

National ID AES-GCM with separate HMAC index; minimized student views; proof private; tokens not durable raw. Generic logs retain arbitrary error.message and request query: confirmed sensitive-data sink to address phase38.

## Phase 34 — CRYPTOGRAPHY

Argon2id, crypto.randomBytes/UUID, SHA256 refresh hashes, timingSafeEqual, AES256GCM nonce12/AAD and RSA2048 assertion. Math.random only jitter/nonsecret browser idempotency fallback. Key entropy/rotation/backups NEEDS MANUAL VERIFICATION.

## Phase 35 — SECRETS MANAGEMENT

Tracked .env/key/pem paths search returned none; no secret values printed. Example/test placeholder credentials exist. Pinned Gitleaks8.30.1 subsequently scanned all locally available refs, fully redacted:33 platform and6 external candidates. Many are examples/fixtures; owner credential-inventory triage and rotation of any used real value still NEEDS MANUAL VERIFICATION. No clean-history certification.

## Phase 36 — ENVIRONMENT / CONFIGURATION

Production env validation rejects weak-length secrets, insecure cookies, HTTP DRM/storage and HS assertion. Partial integrations fail closed. Development/test credentials are deliberate fixtures. Production allowedOrigins can still include HTTP: configuration hardening recommended, deployment exact origins NEEDS MANUAL VERIFICATION.

## Phase 37 — ERROR HANDLING

Frontend-safe ApiError/LearningError; malformed JSON and oversize classified400/413; unexpected errors generic500. Async handlers propagate errors; no raw upstream response forwarded. Raw error logging was identified and subsequently fixed in phase38. Exceptional dependency fail-closed tests included in existing suites.

## Phase 38 — LOGGING

MEDIUM privacy sink fixed: safe error serializer omits raw messages/causes; HTTP request allowlist drops query/params/body. Header redaction retained. 19 focused tests passed; regression initially exposed pino-http serializer override and was corrected at that boundary. Logs still contain IPs/route IDs; access/retention NEEDS MANUAL VERIFICATION.

## Phase 39 — SECURITY MONITORING

Request IDs/status logs and durable audit events support investigation; no repository alert delivery proof. NEEDS MANUAL VERIFICATION: demonstrate alerts for repeated401/403/429, abnormal admin edits, grading failures and dependency503; configure retention/ACLs and simulate synthetic events.

## Phase 40 — DEPENDENCY SECURITY

Docker npm audits: server0, execution0, client5 high chain alerts (braces3.0.3/Tailwind build), browser tooling7 high chain alerts (FTP parser/archive extraction), DRM pnpm1 high dev braces alert. No patched braces release available (npm latest3.0.3; advisory no patch; pnpm metadata misleading >=3.0.4). Major-tool migrations deferred pending compatibility qualification, alerts remain open.

## Phase 41 — SOFTWARE SUPPLY CHAIN

npm ci/pnpm frozen lockfiles and private package names; postinstall dash patch version+single signature fail closed, no arbitrary downloads in script. Image base tags mutable and controller inherits local platform tag. Provenance, registry permissions/SBOM/container CVE scan NEEDS MANUAL VERIFICATION.

## Phase 42 — CI/CD SECURITY

No GitHub/GitLab pipeline present; Railway manifests/build/start/predeploy scripts inspected. Provider deploy credentials, protected environments, approver access, PR secret exposure NEEDS MANUAL VERIFICATION in account; source absence cannot establish permission posture.

## Phase 43 — DOCKER SECURITY

Web runtime nonroot, whitelist image copy excludes env/git, execution jobs no network/socket/read-only/dropall/pids/memory/CPU/no-new-privileges. Trusted controller alone root+socket by approved design. Existing previews untouched; audit fixtures scoped. Image CVE inventory and runsc deployment NEEDS MANUAL VERIFICATION.

## Phase 44 — SERVER / REVERSE PROXY

Nginx body11MiB, connect/read timeouts, fixed upstream; Railway privatebackend validation and HTTPS provider assumption. Source cannot prove provider overwrites X-Real-IP or blocks direct web-replica access. NEEDS MANUAL VERIFICATION: spoof forwarding headers via public edge and direct backend; compare rate-limit identity, confirm network ACLs.

## Phase 45 — HTTPS / TLS

Securecookies + HTTPS DRM/storage enforced by production platform config, external DRM enforcesHTTPS/premiumDRM. Railway terminatesTLS by assumption. NEEDS MANUAL VERIFICATION: HTTP redirect/cert/TLS versions/HSTS/mixed content/wss on deployed domain.

## Phase 46 — HOST HEADER ATTACKS

No app URL/identity generated from Host; Origin and DRM/storage locations come from configured values. Nginx forwards Host but no password-reset links exist. Host poisoning path not established; tenant/domain routing validation at edge NEEDS MANUAL VERIFICATION.

## Phase 47 — WEBHOOK SECURITY

NOT APPLICABLE to platform — no incoming settlement/webhook callbacks. External DRM outgoing webhook service reviewed: HMAC SHA256 signatures, HTTPS/443, encrypted stored secret, manual redirects. Found address-validation gap and DNS check/use race; see external report. Receiver replay/timestamp procedures require consuming app tests.

## Phase 48 — THIRD-PARTY API SECURITY

MEDIUM external-response buffering fixed with streaming256KiB byte budget and cancellation; strict response schema checks, bounded timeouts/retry only idempotent. Redirecterror already fixed phase17. 49 focused tests passed. Malicious compressed/body transport testing and deployed service response contracts NEEDS MANUAL VERIFICATION.

## Phase 49 — OAUTH / SOCIAL LOGIN

NOT APPLICABLE — no OAuth/OIDC/social login in platform or inspected DRM API.

## Phase 50 — PASSWORD RESET

NOT APPLICABLE — no password reset endpoint/token/email flow; existing profile password change reauthenticates. Manual support recovery is not an audited self-service reset implementation.

## Phase 51 — EMAIL SECURITY

NOT APPLICABLE — platform sends no email; public configured support mailto is normalized/encoded. No SMTP API or templated email sink found.

## Phase 52 — FRONTEND SECURITY

Cookiecredentialsinclude, CSRF only readable token; no auth in local/sessionStorage; React escaped views, fixed hash navigation, source/run-bound opaque-iframe messages. Code formatter worker private owner-bound, worker terminated on timeout. targetblank proof link has rel. Production console/source bundle secret review supplemented by scanner.

## Phase 53 — SERVICE WORKERS / PWA

NOT APPLICABLE — no service worker registration/PWA cache found.

## Phase 54 — CACHE SECURITY

LOW private-response caching omission fixed: API-wide no-store before parsers/guards; explicit public-only JWKS override remains maxage300.16 focused tests passed; representative successful private responses in integration suite. CDN honoring policy NEEDS MANUAL VERIFICATION.

## Phase 55 — HTTP METHOD SECURITY

Explicit methods enumerated; Express HEAD aliases to GET and automatic OPTIONS are expected; no TRACE/CONNECT handlers or client method override middleware. NEEDS MANUAL VERIFICATION raw deployed TRACE/CONNECT/duplicate headers; HEAD still uses auth middleware.

## Phase 56 — REQUEST SMUGGLING / PROXY ASSUMPTIONS

NEEDS MANUAL VERIFICATION — raw multi-hop HTTP parsing cannot be certified from source. In isolated staging, compare rejection/connection-close for conflicting CL/TE, duplicateCL and malformed chunks across provider/nginx/node; no destructive smuggling payload sent here.

## Phase 57 — GRAPHQL SECURITY

NOT APPLICABLE — no GraphQL schema/listener/resolver.

## Phase 58 — WEBSOCKET SECURITY

Socket.IO websocket-only, exactOrigin+cookie+sessionCSRF,2KiB maxbuffer, ownerbound server-only events, no client rooms/messages, claims expiry timer +5sec durable session checks, Redisfailclosed. No handshake concurrency/accountconnection caps; abuse/load and cross-replica runtime tests NEEDS MANUAL VERIFICATION.

## Phase 59 — ADMIN PANEL SECURITY

Every68 ADMIN endpoint passes staleADMIN-token/currentSTUDENT-role denial matrix; backend role authoritative. Existing admin CSRF/session/private data audit tests pass. Exactly two roles preserved; owner policy needed for MFA/recentauth threshold, not extra roles.

## Phase 60 — MULTI-TENANCY

NOT APPLICABLE to platform organizations — single platform with student ownership. DRM application tenant binding reviewed for media/device/playback/audit/webhooks; source supports scoping; full tenantA/B runtime matrix NEEDS MANUAL VERIFICATION in separate disposable DRM deployment.

## Phase 61 — PRIVACY / DATA MINIMIZATION

Masked nationalID by default; fullADMIN views audited; receipt bytes180days afterreview cleanup; notifications180days expiry and contentminimized; grading histories retention. Deletedaccount flow absent; owner approved legal retention/account deletion policy remains NEEDS MANUAL VERIFICATION. Testfixtures are synthetic, no production data touched.

## Phase 62 — SOURCE MAPS

Vite build sourcemapfalse; successful production build; no private source map hosting configured. Dependencies debug source included bundled/minified is code visibility, not proof of key leakage. Built artifact scan and deployedmap404 verification NEEDS MANUAL VERIFICATION.

## Phase 63 — STATIC / SENSITIVE FILE EXPOSURE

Static image only dist; .dockerignore whitelist/envgit exclusions, no directorylisting configured. SPA fallback may returnindexhtml200 for /.env/.gitconfig rather than404 but no filecontent served. Probe deployed paths and comparebody to entrydocument; no backup/privatekeys exposed from inspected root.

## Phase 64 — INFORMATION DISCLOSURE

Poweredbydisabled; generic500, no upstreamrawbody; health includes serviceversion/dependency status; Nginx may disclose version. LOW/informational fingerprinting; server_tokens off recommended at edge after compatibility test. Logframes intentionally serverinternal and accessrestricted; no client stack leaks found.

## Phase 65 — SUBDOMAIN / DOMAIN SECURITY

Hostonly cookies, exactOrigin/socket allowlists; no wildcardDomain/subdomain trust. NEEDS MANUAL VERIFICATION: DNS records/CNAMEproviderownership, danglingdomains, certificate coverage, cookie policies on siblings.

## Phase 66 — SECURITY OF DELETE / ACCOUNT ACTIONS

Permanentcatalog deletion ADMIN+Origin+CSRF+exactconfirmation and durable ownedasset intents; walletrejection immutable; inactiveACTIVE DRMdevice release preservesactive/REVOKED. No accountdeletion API. Recent-auth/MFA for destructive actions is a policy decision; DB/accountretention treatment not invented.

## Phase 67 — PAYMENTS

Manual EGP funding by explicitly verifiedADMINreceipt; pendingrequest no credit, exactlyonceledgerreference and wallet locks, backendoffer snapshot/idempotency and bounds; providerwebhook/chargeback NOT APPLICABLE because no automatedprocessor.25materials tests preservewallet/subscriptions/progress on archive/deletion.

## Phase 68 — SECURITY TESTING

Docker tests: authentication72 focused; DRM redirects10, stream/schema/playback49; log19; cache16; protectedroute292 (112missing+112malformed+68currentrole denials); client173+2script; final full server576unit+417integration=993passing, no skips, with fresh named test database and MinIO. Both builds/typechecks pass. Initial materials guard failure resolved through correct fixtures, not suppressed. Nginx+Chromium framing and actual IDE preview pass; real DRM/infra pen tests remain manual.

## Phase 69 — SECURITY LINTING / STATIC ANALYSIS

Executed dependency audits, route matrix, TypeScript compile/tests, safe static sink searches; pinned Gitleaks8.30.1 all-local-ref redacted scans complete (33+6 candidates requiring private owner triage). No unnecessary persistent toolchain installed. Recommend official Semgrep/CodeQL, Gitleaks redacted allhistory, SBOM/Trivy image OS scan in trustedCI after qualification.

## Phase 70 — PRODUCTION READINESS

Overall HIGH due external content-key leak + known high tooling advisories; no production approval granted. Checklist and exact manual verification runbook in final report; unresolved infrastructure/DRM/full-CSP checks prevent an unconditional release recommendation.
