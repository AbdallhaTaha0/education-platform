# Prompt 08 — final regression, exact cleanup and closure report

Apply `00-worker-contract.md`; prerequisites: reviewed 01–07. Scope: final verification and documentation. Do not make speculative refactors.

Run expensive suites sequentially in Docker on disposable services. Platform: server unit/integration/typecheck/build; client unit/typecheck/production build; Chromium through Nginx; fresh migration; M4→M5 upgrade; migration failure gate; restart persistence. DRM: required-environment full unit, upload recovery, deletion/security, processing, integration/media/e2e, typecheck/build and migration failure. Use counts actually observed, not the teammate's historical totals.

Perform one fresh coordinated live run using the corrected harness: safety selftest → preflight → R2 smoke → CORS/browser upload → DRM lifecycle with active negative controls → platform RS256 → real expiry → existing platform ingestion/deletion proof → exact cleanup. Add/register new stage names explicitly; do not invoke an unimplemented stage. Verify cleanup after failures as well as success. Legacy cleanup is allowed only for an individually identified, owner-authorized object; never infer legacy ownership from a broad prefix.

Scan tracked paths, bundle/runtime/image history and sanitized evidence for secret exposure without printing matches. Render volume mappings before removing disposable stacks; preserve development databases/Redis and compare pre/post safe counts. Retain a sanitized evidence manifest with revisions, image IDs, commands, timing, counts, failure/rerun history and resource cleanup.

Update M5 report, pre-M5 report, documentation index, operations and DRM integration docs. Keep historical sections as history; add a dated current status table and correct stale 'uncommitted' descriptions. Report independently: M5 local functional acceptance recommendation, real external gate status, and production release readiness. Owner-controlled Widevine/hosting/capacity/recovery decisions remain BLOCKED or NOT RUN. Do not silently waive them or represent ClearKey as a production replacement.

Deliver for manager review; leave uncommitted. Following owner acceptance, commit/push DRM changes first if any, then parent pointer/platform documentation; fetch and check divergence first, never amend/force-push. Stop before the next milestone.
