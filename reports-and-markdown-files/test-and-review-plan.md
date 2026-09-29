# Test, review, and capacity plan

Updated for external DRM, manual EGP approval, recorded courses and cookie authentication. Tests run through Docker. No runtime success is claimed by this plan.

| Area | Required cases | Evidence |
| --- | --- | --- |
| Cookie identity | HttpOnly/Secure/SameSite policy, CSRF, logout, expiry/revocation, student admin access denial, no local-storage auth tokens | Real API/session and browser tests |
| Manual recharge | Pending has no credit; student cannot approve; duplicate/concurrent approval; mismatch/duplicate reference; rollback | Real platform PostgreSQL and audited EGP reconciliation |
| Purchase | Insufficient funds, trusted price, simultaneous spend, duplicate retry, atomic entitlement | Exact balances and access records |
| Duration/expiry | Agreed date rules, denied listing/playback after expiry, active session termination, renewal-required UI | Server time cases plus external black-box session behavior |
| Bilingual catalog | Arabic default/RTL, English/LTR, both translations required, responsive/keyboard UI | Publication API and browser tests |
| Lesson visibility | Direct API requests by unsubscribed/expired users cannot list protected segments or play | Authorization tests independent of UI |
| Media lifecycle | Admin upload through external contract, completion/status failure/retry, no premature readiness | Contract tests plus real external integration |
| DRM | Wrong course/asset/user, session renewal, watermark observation, revocation, external outage | Real browser/API black-box results; no internal edits |
| Administration | Price/promotion and content changes, permitted download/removal, audit history | Approved policies and external endpoint behavior |
| Platform jobs | Retry/idempotency, expiry reconciliation, failed termination visibility across replicas | Actual Redis/BullMQ and platform containers |
| Recovery | Platform restart/migrations/restore/rollback; external recovery evidence separately | Recorded results and responsibility boundaries |

Mocked external contracts support platform development but do not establish video security or production playback. External failures are reported with request/response evidence and redacted credentials, not patched inside DRM.

For D20 upload recovery, independently verify through disposable DRM Docker services that a lost registration response followed by the same idempotent request returns the same asset ID and a newly issued usable URL only while the asset is `UPLOADED`. Verify tenant isolation, concurrent retries, URL expiry, rejection after processing/deletion, no signed-URL persistence/logging, and preservation of all existing upload/deletion/playback suites. Platform fixture behavior must match the accepted external contract exactly after the prerequisite is accepted.

## 10,000-user qualification

Confirmed: recorded courses only, no live-class load. Still agree simultaneous-viewer/browsing mix, devices, bitrate distribution, duration, region/network conditions, bursts and sustained-run duration. Set latency/error/startup/rebuffer and recovery budgets before running.

Measure platform API p50/p95/p99 latency, errors, DB connections/locks, Redis/queue load, CPU/memory, plus observable external playback/license/CDN outcomes. Separate dependency throughput from platform throughput. Illustrative only: 10,000 viewers at 2 Mbps implies about 20 Gbps aggregate video bandwidth before overhead; this is not an approved bitrate or capacity proof.

Use baseline, ramp, spike, soak and approved failure tests on isolated infrastructure. Validate load-generator capacity and combine representative real browser/device playback with suitable synthetic traffic. Obtain authorization for load on external services; basic integration permission does not authorize stressing a production dependency.

## Manager acceptance

Review actual diffs against requirements and decisions; reproduce critical wallet, access, expiry and Docker tests. Verify no DRM file changes. Record revision/image IDs, exact commands, environment, fixtures, PASS/FAIL/BLOCKED outcomes and skipped checks. No production claim from mocks, historical counts or a successful build alone.
