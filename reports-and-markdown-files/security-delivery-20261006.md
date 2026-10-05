# Security delivery — 2026-10-06

The owner instructed “do them” after the proposed independent review, dual-repository commit/push, dependency follow-up, private exposure triage and deployment checks. The owner approved a separate read-only reviewer and confirmed there is no production deployment yet. This delivery does not create one or grant milestone/capacity acceptance.

## Delivered changes

The platform preserves one Express backend, STUDENT/ADMIN roles, cookie sessions and the external DRM API/persistence boundary. Six platform audit fixes cover safe logging, authenticated-response cache policy, bounded login input, bounded DRM responses with redirect rejection, and anti-framing/security headers for both local and Railway Nginx configurations. See the [audit baseline](security-audit-summary-20261005.md) and [phase ledger](security-audit-phases-20261005.md).

DRM commit **52853b3** was pushed to its existing origin/main. It removes key-bearing native errors from worker logs, SQL and BullMQ failures; pins public-only webhook DNS answers to verified HTTPS connections on every retry; and upgrades the approved TypeScript ESLint parser/plugin to qualified 8.71.0 while preserving dependency-age policy. No database migration. [Detailed repair evidence](drm-security-repair-20261006.md). The parent repository records this independently deployed package's new Git revision.

Browser tooling now pins puppeteer-core 25.12.0 with a regenerated integrity-bearing lockfile and Node >=22.15.0. The rebuilt Node 22/system Chromium harness passed real browser verification and reports zero npm dependency advisories. This is a test harness, not production runtime traffic.

## Frontend advisory mitigation and limits

The existing Tailwind 3 chain still resolves braces 3.0.3. Its upstream advisory has no fixed published version: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). A local, version/hash-pinned source guard caps parser nesting and recursive compile/expand/stringify traversal at 100 levels. It verifies exact upstream source, applies idempotently during installation, and fails builds closed if missing or changed. No audit exception suppresses this finding.

Eight focused cases cover normal brace semantics, deeply nested input, deep ASTs, a child-cycle, and tampered-source rejection. This specifically mitigates nesting-driven stack overflow; it does not provide a general hostile-AST validator or a combinatorial expansion budget. npm's version-based client audit continues to report five HIGH entries for the existing affected dependency chain, including meta-vulnerabilities. Record F02's frontend portion as **locally mitigated with upstream tracking**, not an upstream-fixed or zero-advisory dependency tree.

[Tailwind 4 raises its supported browser floor](https://tailwindcss.com/docs/upgrade-guide). The guard preserves the owner's existing Tailwind/CSS/browser behavior without inventing a browser-support policy. All 37 built public files have identical paths and SHA-256 bytes to the prior audited build.

## Verification and independent review

- Platform Docker suite: 993 server checks (576 unit, 417 integration; no skips); server/client builds and typechecks passed.
- Final frontend Docker suite: 173 frontend tests, two existing DASH checks, and eight new brace-guard checks passed (183 total).
- DRM Docker suite: 103 default unit/security checks plus two real PostgreSQL/BullMQ failure-sink tests passed (105 total); build/typecheck and tooling compatibility passed; full dependency audit zero advisories.
- Independent read-only reviewer found no blocking issue and reran 307 focused platform checks and 52 DRM security checks in network-disabled Docker. A second review qualified the dependency changes and reran the initial seven brace cases; the final suite additionally tests a real self-child cycle.
- New Puppeteer/system Chromium checks: React renders, hostile framing is blocked, actual isolated IDE preview executes, and eight mobile/desktop × Arabic/English × dark/light homepage cases pass with no horizontal overflow. Screenshots were spot-inspected. The isolated static fixture has no API, so its expected service-unavailable UI is not live catalog/playback evidence. The shipped assets are unchanged.
- Git whitespace checks passed. Fully redacted staged credential scanning identified a public Valkey image version false positive in the DRM fixture and a synthetic identity unit-test secret in the platform patch; no used credential was confirmed in either patch.

Reviewer follow-up outside the bounded DRM repair: apps/api/src/services/webhook.service.ts updates webhook_deliveries by event_id alone. Multiple endpoints for the same event may overwrite each other's status. Add webhook_endpoint_id to that predicate and test two endpoints with opposite outcomes in a separately assigned repair. No reviewer blocker was waived.

## Private exposure triage

A disposable, network-disabled scanner privately compared all-local-ref history candidates against values in the three current local environment files. Raw candidates and values stayed inside the temporary container and were deleted. Only counts and safe file/rule metadata were retained in ignored local evidence. Result: **33 platform + six DRM candidates; zero matches to current local environment values**. Fixture-looking candidates are not evidence of used credentials. This does not prove remote/deleted refs, credential formats, archives or an unprovided deployment inventory are clear. No confirmed used credential exposure requiring rotation was established.

Historical DRM SQL inspection used a fresh owned copy of the retained PostgreSQL 16 volume mounted read-only for copying. The original was neither started nor modified. Aggregate result: **four processing jobs; zero stored error messages; zero key/credential-marker errors**. No raw errors, encryption keys, user records or secret values were output. Historical queue/log/backup inventories were unavailable and are not certified. The copy and its isolated network-disabled database container were deleted.

## Deployment prerequisites

There is no production deployment or confirmed HTTPS origin to test. Before a future launch, provision a staging origin and verify TLS/renewal, ingress/proxy and cookie behavior, private database/Redis/grading-controller reachability, private storage and signed URL expiry, backup restore, and end-to-end subscription expiry/video license/playback behavior. These remain unverified launch checks; no deployment was attempted. See the original phase ledger for the full manual-verification boundary.

## Evidence and cleanup

Ignored local evidence: docker/browser/evidence/security-audit-20261005/, drm-security-repair-20261006/, and security-delivery-20261006/ (build/test logs, safe triage/counts, 37-file comparison, browser matrix/screenshots). These private artifacts and environment files are excluded from Git. Source verification harnesses are included.

Every owned delivery container's labels and mounts were inspected before removal. Four temporary containers, the copied database volume and the empty owned browser network were removed. Reusable images/evidence remain; no global prune. The original fayq-local-preview-grading-1 and fayq-local-materials-materials-minio-1 services and retained volumes remain intact. Earlier audit/reviewer/repair fixtures were already cleaned.

## Delivery status

DRM origin/main contains 52853b3. The platform commit includes this report, audit fixes, bounded dependency mitigation, verification harnesses and that DRM revision. Remote synchronization and clean working trees are checked after pushing; the platform commit is identified in the final delivery message. No production release, schema migration, retained-data deletion or machine shutdown is part of this security delivery.
