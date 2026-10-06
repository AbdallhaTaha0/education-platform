# M5 closure: manager review and sequential worker prompts

Prepared 2026-09-30 from the owner's teammate handoff and the current checkout.

Current continuation evidence: [manager review](../m5-manager-continuation-review.md). The findings below describe the starting checkout; completed corrections are recorded in the current review. The nested repository is recorded by a gitlink without `.gitmodules`, so it is not a registered Git submodule.

## Review findings

- Platform HEAD is `b04d84f`; the parent records DRM gitlink commit `015392bfab8f35cf79ed2a0749556a0ccdd86714`, and the nested HEAD is `015392b`. Both trees were clean before creating these documents. No fetch or test reproduction was performed for this document-only assignment.
- The reported 153 server unit, 216 integration, 47 client unit, 150 browser and 51 DRM unit passes are historical evidence, not newly reproduced acceptance.
- `platform-lifecycle.mjs` currently logs in as admin, ingests media and deletes a course. It does not exercise student learning playback or platform-mediated renewal. A new platform RS256 stage is needed.
- `negative.mjs` requires an active asset in the same process. Running it separately after deletion cannot prove isolation. Keep these assertions inside the active lifecycle callback.
- The current expiry test accepts a later 401 without proving an initial successful request or independently excluding session expiry/revocation. Strengthen the evidence before accepting Gate B.
- `configure-local-expiry.mjs` writes TTL=10 into the DRM environment without an automatic restoration path. Add guarded development-only execution and restoration.
- `prepare-platform-verification-admin.mjs` targets disposable origin `http://localhost:8082`. Previous approval of `http://localhost:8080` is not approval of 8082. Verify origin approval and resolved volume isolation before bootstrap.
- HTTP fetch with an Origin header is useful CORS protocol evidence but does not prove a browser enforced CORS. Add a real browser upload check.
- A denied CORS configuration read does not prove browser uploads fail. Record configuration visibility and actual browser behavior independently; dashboard evidence can establish configuration without widening storage credentials.
- Reports still describe some committed work as uncommitted and contain historical verdicts. Retain historical evidence, add a dated authoritative status table and correct current revision descriptions.
- M5 functional acceptance and production release readiness are separate verdicts. Widevine provisioning, deployment and capacity must remain visible without silently turning every later operational gate into an M5 coding task.

## Execution order

Issue one numbered prompt at a time. Review its diff and reproduce its critical evidence before issuing the next. Each prompt includes `00-worker-contract.md` by reference; send that file together with the assigned prompt.

| Package | Work | Dependencies |
| --- | --- | --- |
| 01 | Baseline and Docker isolation | None |
| 02 | Local credentials, tenants and public JWKS | 01 |
| 03 | R2 CORS and browser upload | 02; exact origin approval |
| 04 | Live DRM lifecycle and tenant isolation | 02; 03 for browser upload evidence |
| 05 | Real platform RS256 learning and renewal | 02, 04 |
| 06 | Real token and entitlement expiry | 04, 05 |
| 07 | Player and watermark browser verification | 05, 06 |
| 08 | Full regression, cleanup and final evidence | 01–07 |
| 09 | Production decisions and future work plan | Independent discovery; owner decisions required for implementation |

If an owner prerequisite blocks a package, record it and proceed with independent local work. Do not bypass the gate or rerun destructive stages to manufacture evidence.

## Manager acceptance

Review cookie/CSRF authorization, RS256 negative cases, real-time expiry, tenant isolation, exact cleanup, migration safety and secret handling. Worker counts alone do not establish acceptance. Report M5 local functional closure and production release readiness independently. Do not certify 10,000-user capacity. Commit/push only after owner acceptance, following the owner's existing policy.
