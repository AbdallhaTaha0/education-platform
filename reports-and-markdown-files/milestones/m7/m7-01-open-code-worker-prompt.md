# OpenCode — M7 package 01: readiness and dependency audit

Work on this package only, then stop for manager review.

Read `AGENTS.md`, and `README.md`, `agent.md`, `rules.md`, `decisions.md`, `../m6/m6-owner-acceptance.md`, `docker-and-operations.md`, and `test-and-review-plan.md` under `reports-and-markdown-files/`.

M6 is accepted. Preserve the current checkout and all existing work. Do not require a clean tree: the accepted M6 commit/push may still be pending. External DRM remains read-only at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.

Your task:

1. Record actual platform/DRM revisions, working-tree state and Docker availability. Inspect existing containers and volumes before running anything.
2. Using isolated Docker containers, audit the current client/server lockfiles. Record package/version, severity, runtime versus tooling exposure, available fixes and compatibility risks. Keep audit failures or unavailable registry access explicit. Do not install upgrades or change lockfiles yet.
3. Inspect current production-readiness gaps: deployment/TLS/secrets, monitoring, backup/restore/rollback, commercial DRM and capacity. Verify current code before repeating historical blockers. Identify which need owner decisions.
4. Write `reports-and-markdown-files/milestones/m7/m7-01-readiness-report.md` with findings, exact commands/results, failures/blocks, verified cleanup and ONE recommended next work package. Link it from the index. Do not claim independent acceptance.

Preserve the one Express application, PostgreSQL/Prisma, Redis/Nginx, two roles, cookie authentication and bilingual FAYQ UI. Protect the pinned dash.js compatibility patch. No application changes, secret output, existing-volume deletion, production deployment, external load, DRM edits, commits or pushes in this package.

Return the report and changed-file list. Stop: the manager will inspect the diff and verify important findings before issuing package 02.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
