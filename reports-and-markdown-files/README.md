# Education platform documentation

Current review (2026-10-01): [M5 manager continuation](m5-manager-continuation-review.md) records the recovered OpenCode work, new fixes, fresh Docker evidence and remaining gates. Platform M5 implementation is committed at `b04d84f`; closure work is uncommitted. The baseline paragraphs below describe earlier evidence, not current acceptance.

Baseline updated: 2026-09-30 after the owner-authorized M5 DRM security
correction and fresh live lifecycle verification (all uncommitted). The Docker foundation
remains accepted at revision `fce352f`, M2 at `b8080a8`, M3 at `d520dd7`, the
platform M4 code checkpoint at `03e51eb`, the DRM permanent-deletion baseline at
nested revision `6e1e01c`, and the accepted DRM recovery/job-status checkpoint at
`5293917`. Wallet funding, transactional purchase, subscription renewal, proof
retention, bilingual dark/light UI, catalog administration, external DRM
integration, and retry-safe upload recovery are independently verified.

Cloudflare R2 writes, reads, and prefix-scoped deletion, and the
platform-to-DRM ingestion and deletion path, were exercised before an R2
access-key pair was exposed in tool output. Those runs remain historical and
non-reproducible. The owner subsequently confirmed rotation, and the corrected
test-only harness produced fresh run-scoped evidence for real R2 processing,
authenticated packaged-segment delivery, successful ClearKey licensing,
unknown-asset refusal, wrong-device refusal, and exact cleanup. R2 CORS, a
second DRM tenant, the full token-expiry wait, a complete real
platform-to-DRM RS256 run, commercial DRM/Widevine, browser watermark
observation, capacity qualification, and production deployment remain open.
The historical Pre-M5 report still ends `NOT READY FOR MILESTONE 5`.
Remaining detailed business policies stay marked pending.

The owner has additionally approved the `FAYQ` identity and its forest/lime/amber/cream/charcoal visual direction. The current uncommitted client centralizes the FAYQ wordmark, self-hosted bilingual typography, semantic themes, responsive brand shell, home experience and shared controls. This visual work does not close an external production gate or alter platform/DRM business behavior.

## Authority and evidence

1. Explicit owner requirements and subsequent recorded clarifications.
2. Original [system design](education-platform-system-design.jpeg), preserved unchanged.
3. Original [DRM report](education-drm-service-report.pdf), preserved unchanged; statements about implemented behavior must be checked against code.
4. Approved decisions in [the decision register](decisions.md).
5. These working documents. Proposals do not override the original architecture.

Where sources conflict, record the conflict and ask the owner. Neither existing code nor a new plan silently overrides the design.

## Documents

| File | Purpose |
| --- | --- |
| [drm-recorded-manifest-repair-proposal.md](drm-recorded-manifest-repair-proposal.md) | Exact static-manifest prerequisite, reproduction and bounded owner assignment |
| [m5-manager-continuation-review.md](m5-manager-continuation-review.md) | Recovered work, independent verification, current blockers and bounded next steps |
| [m5-closure-work-packages/README.md](m5-closure-work-packages/README.md) | Sequential closure packages 01–09 and worker contract |
| [agent.md](agent.md) | Manager, worker, and reviewer responsibilities |
| [rules.md](rules.md) | Non-negotiable constraints and engineering review rules |
| [discovery-report.md](discovery-report.md) | Repository findings and concrete gaps |
| [requirements.md](requirements.md) | Confirmed scope and acceptance criteria |
| [confirmed-flows.md](confirmed-flows.md) | Manual recharge, purchase, expiry and external video lifecycle |
| [design.md](design.md) | Stitch UI v1, provisional visual tokens, bilingual layouts and review checklist |
| [architecture.md](architecture.md) | Faithful architecture transcription and unresolved boundaries |
| [plan.md](plan.md) | Delivery milestones and exit gates |
| [implementation-plan.md](implementation-plan.md) | Sequenced work packages and dependencies |
| [schema.md](schema.md) | Conceptual data model; not an executable Prisma schema |
| [drm-integration.md](drm-integration.md) | Existing contracts, identity mapping, and integration risks |
| [docker-and-operations.md](docker-and-operations.md) | Container requirements and production evidence |
| [test-and-review-plan.md](test-and-review-plan.md) | Independent verification and capacity qualification |
| [decisions.md](decisions.md) | Questions, blocked work, and decision recording |
| [open-code-worker-prompt.md](open-code-worker-prompt.md) | Bounded M1 Docker foundation implementation prompt |
| [m2-open-code-worker-prompt.md](m2-open-code-worker-prompt.md) | Bounded M2 identity and bilingual shell implementation prompt |
| [m2-implementation-report.md](m2-implementation-report.md) | M2 implementation, correction, Docker verification and independent acceptance evidence |
| [drm-media-deletion-open-code-worker-prompt.md](drm-media-deletion-open-code-worker-prompt.md) | Owner-authorized DRM prerequisite prompt for durable permanent media deletion before M3 |
| [drm-media-deletion-implementation-report.md](drm-media-deletion-implementation-report.md) | Accepted DRM deletion implementation and independent Docker evidence |
| [drm-upload-url-recovery-open-code-worker-prompt.md](drm-upload-url-recovery-open-code-worker-prompt.md) | Owner-authorized bounded DRM prerequisite for retry-safe upload URL recovery before M3 acceptance |
| [drm-upload-url-recovery-implementation-report.md](drm-upload-url-recovery-implementation-report.md) | Implemented and independently verified upload-URL recovery evidence |
| [drm-job-status-correction-implementation-report.md](drm-job-status-correction-implementation-report.md) | Bounded PostgreSQL job-status correction and worker-to-READY verification |
| [m3-final-review-open-code-worker-prompt.md](m3-final-review-open-code-worker-prompt.md) | Bounded independent final review prompt for M3 |
| [m3-implementation-report.md](m3-implementation-report.md) | M3 implementation, corrections, Docker evidence, blockers, and manager ruling |
| [m4-open-code-worker-prompt.md](m4-open-code-worker-prompt.md) | Executable M4 wallet/recharge/purchase prompt with approved policies and a Tailwind dark-mode UI/UX improvement workstream |
| [m4-implementation-report.md](m4-implementation-report.md) | M4 implementation, correction history, fresh Docker evidence, audit findings, blockers, and manager acceptance |
| [pre-m5-production-readiness-report.md](pre-m5-production-readiness-report.md) | Pre-M5 closure through correction round 5: R2 credential-rotation gate, corrected and offline-tested live-verification harness, historical non-reproducible pre-rotation R2 observations, migrations, backup/restore, audits, volume isolation, and open blockers |
| [m5-implementation-report.md](m5-implementation-report.md) | M5 implementation plus the owner-authorized DRM security correction: RS256/JWKS assertions, strict device binding, tenant-scoped renewal, fresh live DRM/R2 evidence, Docker results, and remaining external gates |

M1 through M4 and the bounded DRM deletion and upload-recovery/job-status
prerequisites are accepted for their independently verified scope. Platform
checkpoint `03e51eb` and nested DRM `5293917` are available on their remotes.
The original design sources remain unchanged. Pre-M5 status, including the
historical rotation gate and the then-unproven protected playback paths, is
recorded in the Pre-M5 report; current correction evidence is in the M5 report. No production deployment
or 10,000-user capability is certified.

## 2026-09-30 update — M5 gate-closure pass

A second owner-authorized M5 pass closed the test-isolation debt, ran the complete
DRM and platform regressions, and implemented the browser watermark. It did not
close the external gates.

- Platform server integration **216/216** on a verifiably fresh disposable
  database and twice on the re-used one; server unit **153/153**; client unit
  **47/47**; Chromium through Nginx **150/150**; server and client typechecks and
  the production client build pass; an explicit M4-to-M5 upgrade migration drill
  preserves rows; migration failure exits non-zero.
- Complete DRM regression through the DRM's own Docker test Compose: unit
  48/48, upload recovery 38/38, deletion and security 44/44, processing 7/7,
  integration 3/3, media 3/3, end-to-end 2/2, typecheck and build pass,
  migration failure exits non-zero.
- Two product defects fixed: concurrent identical purchase retries answered
  `402 INSUFFICIENT_FUNDS` instead of replaying the committed purchase, and a
  fatal dash.js error left a blank player with no explanation.
- Test-isolation debt fixed at the source: an integration world deleted every
  admin in the shared database, six tests assumed they ran first, and the three
  M5 learning files leaked their handles.
- The browser watermark is proven as a **visible, privacy-conscious label** with
  a stated boundary. It is not a forensic control and cannot prevent screen
  capture; attributable watermarking remains the external DRM's responsibility.
- Still open: second DRM tenant isolation, real token and entitlement expiry,
  end-to-end RS256, R2 CORS, Widevine, capacity, and production deployment.
  Widevine is now confirmed `OWNER BLOCKED` with evidence: all five `WIDEVINE_*`
  keys in the ignored `.env` are empty.
- New operational note: **there is no platform production Compose file.** The
  platform has development and test configurations only. Creating one needs
  owner decisions on host, secrets injection, replicas and TLS termination.

Both reports still end `NOT READY FOR MILESTONE 5`, and nothing here softens that.
