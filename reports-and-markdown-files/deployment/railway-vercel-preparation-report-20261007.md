# Deployment preparation verification — 2026-10-07

Outcome: local deployment artifacts prepared and verified. **No cloud deployment
or production readiness acceptance.** Both repositories are on `dev`.
The owner subsequently authorized commit/push of this preparation on 2026-10-07.
`testing` and `deployment` were not advanced.

See [setup and release runbook](railway-vercel-20261007.md) for exact service,
environment, domain, branch, migration and rollback contracts.

## Scope and preservation

- Candidate based on platform `14db6f9`, nested DRM `d1bfd69`.
- Pre-existing gitlink mismatch at preparation: parent recorded `52853b3` while
  nested checkout was `d1bfd69`. Approved delivery now pins DRM `71c49dd`, which
  includes that already-published baseline plus the reviewed Docker stage alias.
- Platform application/business code and schema unchanged. React build configuration,
  provider routing output, Docker deployment targets, IaC, tests and docs added.
- Nested DRM change only: final serving alias in `apps/api/Dockerfile`.
- No real `.env`, provider secrets, tenants, users, course media, R2 object or bucket
  CORS modified. No registry publish, cloud account connection, billing, apply or
  deployment command. Original preview/DRM services left running.

## Verification performed in Docker

| Check | Result / limit |
| --- | --- |
| Pinned Railway SDK install and type-check | PASS, 3.13.0; package audit zero findings at installation |
| Offline IaC/routing/output tests | 5/5 PASS; reject unpinned release images, unsafe gateway URLs, wrong API origin/environment; separate persistence and correct migration commands; static root cannot bypass SSR |
| Five Railway image builds | PASS; platform runtime/migrate/gateway, DRM API/worker |
| Vercel artifact build | PASS using synthetic `https://gateway.example.test`; Build Output v3 generated |
| Actual Vercel output inspection | PASS; referenced static assets exist, root index absent, config v3 |
| Final production-mode rehearsal | PASS; disposable project `fayq-deploy-verify-1791374961975` |
| Both database migrations | platform and DRM one-shot runners confirmed exited 0 against separate fresh PostgreSQL databases |
| Gateway/API probes | health/live and health/ready 200 JSON; anonymous learning dashboard 401 JSON; unknown API/internal renderer paths 404 |
| Production cookie and signing checks | Secure/SameSite=Lax/path-scoped CSRF cookie; public RS256 JWKS without private parameters |
| Public SSR | `/ar` and `/en` 200, FAYQ rendered, references match backend client build |
| Cleanup | owned containers, network and anonymous volumes removed/absence checked; generated synthetic env file removed |
| Source hygiene | both `git diff --check` clean |

This rehearsal used synthetic credentials and an unreachable synthetic HTTPS DRM
origin. It proves production configuration and HTTP/SSR contracts, not real cloud
login/browser cookie handling, R2, commercial DRM, WebSockets, grading or capacity.
No public host ports were bound; owner preview on 8080 was not replaced.

## Local artifact IDs

These are local Docker IDs, not published registry digests.

| Local image | ID | Serving user / command |
| --- | --- | --- |
| `fayq-deployment-platform-runtime:local` | `8da40442a79a` | app / `node dist/index.js` |
| `fayq-deployment-platform-migrate:local` | `83c94d2833de` | app / Prisma migrate deploy |
| `fayq-deployment-platform-gateway:local` | `3fa04e2eed97` | nginx / Nginx foreground |
| `fayq-deployment-drm-api:local` | `88c5945f2adc` | node / API index |
| `fayq-deployment-drm-worker:local` | `ed1be57c0a4a` | node / worker index |
| `fayq-deployment-vercel:local` | `0b7b7aefd045` | inspection/build artifact; not deployed as a serving container |

## Failures encountered and resolved

- Initial SDK type-check found optional context fields; configuration now refuses
  absent project/environment rather than asserting them away.
- Fixture generator's nested newline literal caused an initial pre-start failure;
  corrected without exposing generated material; cleanup succeeded.
- Adding a stand-alone completed DRM migration made Compose `up --wait` treat it
  as an exited service. The rehearsal now explicitly gates completion through the
  gateway dependency (test-only orchestration, not persistence coupling).
- Compose `wait` excluded already-stopped one-shot jobs. Final runner directly
  inspects both jobs' exited/zero state after the completion gate instead.
- All failed rehearsal projects were guarded and removed; the final run was green.
- A multi-image formatted inspection expected a User field on the build artifact
  and reported a template error there. All five serving/job images were separately
  displayed correctly; the Vercel artifact was successfully inspected with Node.

## Reproduction

Run from the repository root. Host Node only orchestrates Docker. Set `DOCKER_EXE`
locally if Docker isn't on PATH; no machine-specific path is committed.

```text
node docker/railway/build-images.mjs platform-runtime platform-migrate platform-gateway drm-api drm-worker
docker build -f client/Dockerfile --target vercel --build-arg RAILWAY_GATEWAY_ORIGIN=https://gateway.example.test -t fayq-deployment-vercel:local .
node docker/railway/verify-local.mjs
```

IaC checks require its lockfile-installed tooling. Install with `npm ci
--ignore-scripts` inside a Docker container with `.railway` mounted as its workspace,
then use `npm run check` and `node --test railway.test.mjs
../client/scripts/vercel-output.test.mjs` with the repo mounted read-only.
The actual checked SDK dependencies remain local ignored `node_modules` only.

## Owner decisions / release gates

Domains/provider project selection, qualified database/cache templates and resource
budgets remain unset. The trusted Docker/gVisor grading execution host remains
unselected (owner question pending). Commercial DRM needs actual provider code
integration as well as credentials: existing non-ClearKey issuance is explicitly
blocked. Two-proxy client IP trust, cloud WebSockets/uploads/cookies, backups,
restore/alerts and 10k capacity need qualified staging evidence. The client install
also reported 8 existing advisories and large bundle warnings; this preparation
does not clear their independent release review.

Approved delivery: DRM `71c49dd` was committed and pushed to `origin/dev`; this
platform delivery pins that exact revision and includes the preparation/report.
No branch promotion or actual provider release occurred. After review, the next
step is promotion and qualification on `testing`, with all remaining gates above.
