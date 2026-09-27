# Education platform documentation

Baseline updated: 2026-09-27 after owner D01-D12 answers and follow-ups. Confirmed decisions are recorded; remaining detailed policies are marked pending. The Docker foundation handoff is prepared; no application implementation was performed in this update.

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

Only Markdown documentation was created during this assessment. No application code, existing deployment definitions, original documents, or DRM migrations were changed. No production readiness or 10,000-user capability is certified.
