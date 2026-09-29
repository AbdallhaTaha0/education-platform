# Education platform documentation

Baseline updated: 2026-09-29 after independent local acceptance of M3 and the bounded DRM upload-recovery/job-status prerequisites. The Docker foundation remains accepted at revision `fce352f`, M2 at `b8080a8`, the DRM permanent-deletion baseline at nested revision `6e1e01c`, and the accepted DRM recovery/job-status checkpoint is local commit `5293917`. Catalog administration, Tailwind feature structure, external DRM integration, and retry-safe upload recovery are independently verified. Live Cloudflare R2 and real external DRM upload/deletion verification remain blocked, so no production-readiness or capacity claim is made. Remaining detailed business policies stay marked pending.

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
| [m4-open-code-worker-prompt.md](m4-open-code-worker-prompt.md) | Bounded M4 wallet/recharge/purchase prompt with a Tailwind UI/UX improvement workstream and mandatory policy gate |

M1, M2, the bounded DRM permanent-deletion prerequisite, M3, and the bounded upload-recovery/job-status prerequisites are accepted for their independently verified local scope. The latest DRM prerequisite is committed locally as `5293917`, and the platform M3 checkpoint is local only; neither repository was pushed. The original design sources remain unchanged. Live Cloudflare R2 and real external DRM upload/deletion verification are blocked pending credentials and configuration; no production readiness or 10,000-user capability is certified.
