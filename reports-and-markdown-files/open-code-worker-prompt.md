# Open Code worker prompt â€” M1 Docker foundation

You are implementing only M1 of this educational platform. The manager will inspect your diff and independently verify important behavior. This prompt is ready for the owner to hand to Open Code; preparing it does not mean implementation has already started.

## Read before changing files

Read root AGENTS.md and reports-and-markdown-files/README.md, agent.md, rules.md, decisions.md, requirements.md, architecture.md, confirmed-flows.md, implementation-plan.md, docker-and-operations.md, drm-integration.md and test-and-review-plan.md. Explicit owner clarifications override earlier draft assumptions and the historical discovery report.

## Confirmed architecture and product context

- client/: React with TypeScript. server/: ONE Node.js/Express/TypeScript application with separate internal modules. Replicas use the same image behind Nginx.
- Platform PostgreSQL with Prisma; platform Redis; BullMQ when a later assigned feature needs a worker. No separate auth/course/wallet microservices.
- Exactly STUDENT and ADMIN. Recorded programming courses only; no live classes.
- Arabic default/primary and English secondary, both content translations mandatory; RTL/LTR.
- Manual EGP funding: student submits request/reference/proof, admin verifies receipt and approves before wallet credit.
- Admin defines fixed plan duration; access begins immediately at successful purchase and stops at expiry.
- Authentication and session tokens use cookies, never local storage.
- Cloudflare R2 stores production videos through external DRM.
- DRM is an external API package. Never edit ANY file inside education-drm-service/, query its database, copy its source into platform images, rebuild its security in platform code, or change its Docker configuration. Integrate by API URL and server-side credentials only.

## Objective

Deliver a reproducible local Docker foundation with independently built frontend/backend images, Nginx, platform PostgreSQL, platform Redis, Prisma migration infrastructure and isolated tests. Do not implement business features in this milestone. The platform must start locally without live R2 or commercial DRM credentials.

## Allowed paths and change boundaries

Allowed: client/, server/, a new platform docker/ directory, necessary root workspace/package/lock/TypeScript configuration, root .gitignore/.dockerignore if needed, an example environment file with placeholders, and Markdown under reports-and-markdown-files/.

Preserve all existing work and original JPEG/PDF. Root AGENTS.md is instruction, not something to weaken. education-drm-service/ is entirely forbidden for writes, including package install, formatting, generated output and Git changes. Do not initialize/overwrite its nested Git repository. Inspect repository state before choosing version-control commands; the root may not yet be a Git repository.

Choose and document compatible supported package/runtime versions with a lockfile. This is a routine implementation choice; do not change the required stack. Platform workspace discovery/build globs must exclude external DRM. No production deployment, paid provisioning, real secrets, destructive volume cleanup or load test of an external service.

## Required deliverables

1. React/TypeScript client with an Arabic-default minimal startup page and working English switch. This is a foundation/status view, not an invented course catalog, wallet or auth implementation.
2. Express/TypeScript server with clear proposed module directories and health endpoints. Implement GET /health/live and GET /health/ready; readiness checks platform PostgreSQL/Redis with bounded timeouts. An unavailable optional external DRM connection must be reported separately, not falsely mark local foundation startup as broken.
3. Separate multi-stage client/server Dockerfiles, minimal runtime contents and non-root application users where supported. No frontend secrets or external DRM source in build context outputs.
4. Platform Compose definition, for example docker/compose.dev.yml, with client, server, nginx, postgres, redis and one-shot migration service. Use private service networking; publish only necessary local entry points. Add persistence and dependency healthchecks.
5. Prisma schema/migration tooling for platform ownership. Do not invent course/wallet/User schemas to satisfy startup. An empty business schema is acceptable; prove DB readiness independently and migration-tool execution. If a migration smoke fixture is needed, keep it in an isolated test database and out of future production domain tables.
6. Disposable Docker test project/volume configuration, e.g. docker/compose.test.yml. Do not target existing DRM or user data. Require migration failure to prevent dependent application startup.
7. Environment contract using placeholder names for platform database/Redis, public origins, server-side DRM base URL and credentials. Never expose secrets through frontend-prefixed variables. Basic startup works with real DRM unavailable; document which later integration checks require it.
8. Read-only external connection instructions. For now document DRM API configuration and error handling; do not create an unrequested media gateway, R2 bucket or processing worker. Local media storage setup is a later integration dependency.
9. Documentation of build/start/test/stop, configured ports, architecture mapping, image identities, graceful shutdown, persistent data and non-destructive rollback.

## Verification to perform, not merely list

Use Docker for application execution and tests. Adjust commands to actual delivered file/service names and record exact invocations and exit results.

Suggested command structure:
- docker compose -f docker/compose.dev.yml config --quiet
- docker compose -f docker/compose.dev.yml build
- docker compose -f docker/compose.dev.yml up -d --wait
- docker compose -p education-platform-test -f docker/compose.test.yml run --rm test

Verify frontend through Nginx, both language directions, server health and readiness, database/cache reachability and startup ordering. Test dependency-not-ready behavior using isolated test infrastructure; liveness should distinguish a running process from dependency readiness. Verify restart persistence and migration failure behavior. Run TypeScript/build checks inside containers.

Inspect built frontend output for privileged configuration leaks. Verify no platform container can accidentally use DRM database configuration. Confirm external DRM files are unchanged using a read-only before/after inventory or diff; distinguish pre-existing changes.

Do not start a dev server on the host to evade Docker requirements. If Docker Engine is unavailable, complete authorized files and static checks, report runtime tests BLOCKED with the exact error, and do not claim M1 fully accepted. Do not delete unrelated containers/volumes to solve startup.

## Out of scope

Business identity/token implementation; wallet credits; payment providers; purchases; duration units/refunds; actual media upload/playback; DRM repairs; R2 provisioning; notification/live-class features; production scheduler selection; 10,000-user qualification. Later milestones implement these approved requirements with their own acceptance tests.

## Completion report and stop

Report changed files, requirement IDs, directory/service mapping, chosen version rationale, exact Docker checks with PASS/FAIL/BLOCKED, screenshots or browser evidence, image IDs, unresolved issues and non-destructive rollback. Submit for manager review and stop after M1. Do not automatically implement M2 or deployment.

The manager will inspect the diff, check API-only DRM isolation and Docker reproducibility, and reproduce critical tests. A generated Compose file alone does not establish production readiness.
