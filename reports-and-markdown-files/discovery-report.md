# Discovery report

Date: 2026-09-27. Scope: source review for planning, not a complete security audit.

## Subsequent owner clarification

This is historical discovery evidence. The owner subsequently confirmed DRM is an external API-only dependency and forbids all edits inside it. Its Caddy/Valkey/SQL/gateway choices are not platform architecture conflicts to repair. Its internal defects remain external readiness findings, not worker tasks. The platform uses one modular Express backend, manual admin-approved EGP funding, recorded courses, cookie authentication and R2 video storage through DRM. See decisions.md for current authority.

## Repository baseline

`client/` and `server/` are currently empty. `education-drm-service/` contains a nested Git repository with an Express API, video worker, React demo player, shared packages, SQL migrations, Docker definitions, and tests. No existing AGENTS.md was found in the workspace during discovery.

The architecture JPEG was visually inspected. All four pages of the supplied DRM PDF were text-extracted and read, alongside its Markdown counterpart. Critical source paths reviewed include upload, processing, packaging, assertions, sessions, media delivery, license issuance, webhook services, player integration, schema definitions, tests, and container definitions. This does not mean every source line was audited.

## Verified from source

| Finding | Evidence relative to education-drm-service/ | Consequence |
| --- | --- | --- |
| Commercial license issuance is not implemented | apps/api/src/services/license.service.ts; packages/drm-core/src/providers/widevine.provider.ts | Non-ClearKey licensing rejects requests; credentials alone do not finish integration |
| Upload registration rejects non-ClearKey providers | apps/api/src/services/upload.service.ts | Commercial packaging needs implementation too |
| Production disables ClearKey | apps/api/src/config/index.ts; docker/docker-compose.production.yml | Current production settings cannot provide the completed paid-video flow |
| Media responses use private/no-store caching and per-request session authorization | apps/api/src/modules/media/gateway.routes.ts | This is not the diagram's completed signed-URL CDN delivery path |
| Existing DRM persistence uses pg and SQL migrations | packages/database/package.json; packages/database/migrations/ | Do not migrate to Prisma without clarification |
| Packaging produces DASH MPD | apps/worker/src/services/video-processing/packaging.service.ts | Diagram's HLS output is not implemented in this path |
| Webhook sender exists but no TypeScript call sites were found | apps/api/src/services/webhook.service.ts; repository search for sendWebhookEvent | Do not rely on automatic MEDIA_READY delivery yet |
| Integration/media/e2e suites check configuration | apps/api/src/tests/{integration,media,e2e}.test.ts | They do not prove live service or browser behavior |
| DRM deployment uses Caddy and Valkey | docker/docker-compose.production.yml | Owner must reconcile with diagram's Nginx and Redis |

## Risks requiring reproduction

1. Segment routing: the packager creates manifest and segment files together, but the gateway exposes segments under `/v1/playback/:sessionId/media/*`. No manifest rewriting or player segment-URI rewrite was found in the reviewed paths. Inspect an actual generated MPD and record every browser request before declaring playback functional.
2. Upload completion changes PostgreSQL state and then enqueues in BullMQ. Catch handling attempts a rollback, but a process crash between those systems can leave processing stranded. Reproduce interruption and recovery.
3. Playback admission commits a database session before the Redis reservation and later watermark/audit writes. Exercise failures at each boundary and verify cleanup and admission behavior.
4. Demo player assigns the original token back to its ref on each render while watermark updates trigger renders. Reproduce playback beyond renewal to check whether the renewed token is overwritten.
5. The production worker has only the internal data network; external provider/JWKS/webhook reachability and browser-reachable presigned upload URLs need explicit topology tests. Do not solve this by exposing private storage indiscriminately.
6. Source deletion after processing is enabled in development. The requested admin download behavior must clarify whether original videos must remain available.

## Verification status this assessment

No application build, unit test, live media test, or load test was run. The supplied report's 26 passing unit tests and build results are historical evidence, not a new result.

Docker CLI is installed. A read-only server-version check failed: Docker configuration was inaccessible in this session and the Docker engine named pipe was not found. Live Docker verification is therefore unverified; this alone does not diagnose the machine's complete Docker setup.

No changes were made to the original design, DRM code, migrations, or existing Docker configuration.
