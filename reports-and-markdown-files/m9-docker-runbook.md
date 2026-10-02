# M9 Docker, isolation and operational runbook

2026-10-01. Local implementation, not a production/capacity certificate. See [contract](m9-implementation-contract.md), [schema/API](m9-schema-api.md) and [implementation evidence](m9-implementation-report.md).

## Services and trust

The serving Express image remains horizontally replicable and never receives a Docker socket. A separate trusted grading-controller image runs the existing platform's grading worker and receives only platform PostgreSQL/Redis connection settings. It orchestrates disposable execution containers; it is a privileged execution-host component, not a new identity/catalog/wallet API. Student code never executes in Express or the controller process. External DRM is independent and unchanged.

Local execution container: non-root `node`, no network, no host mounts/platform credentials/socket, read-only root, 256MB `/tmp` tmpfs, all capabilities dropped, no-new-privileges, grading-only seccomp, 768MB memory, 1 CPU, 256 PIDs, 35s job deadline, 64KB output bound. Chromium namespace/seccomp sandbox stays enabled. The 35s resource deadline is not a quiz deadline. A renderer timeout is incorrect behavior; infrastructure launch failure is ERROR.

The grading-only profile starts from [Docker's official default profile](https://github.com/moby/profiles/blob/main/seccomp/default.json). The owner expressly approved `clone`, `clone3`, `unshare`, `setns`, and subsequently `chroot` for Chromium sandbox setup. No capability was added. SHA256 of the committed profile: `00cdc5469d7d6b38848b86b9c236fad28b8b19e4ceb75bf380259f3b39106e5a`. These permissions do not apply to platform/DRM containers. The UI test vehicle's no-sandbox flag is for trusted browser inspection only; untrusted grading never uses it.

Browser-local previews have opaque iframe origin, no platform cookies/storage, CSP/resource restrictions and AST loop/function guards. A second policy disallows subsequent script injection, including copied bootstrap nonces; dynamic function constructors including async generators are blocked. [Multiple CSP policies intersect rather than relax one another](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy). Instrumentation is responsiveness protection, not an OS memory quota or universal interruption guarantee for every pathological browser built-in. Official correctness always comes from isolated server grading.

## Build

Run from repository root; Docker is required. `DOCKER_EXE` may point to the local Docker executable without embedding personal paths in scripts.

```text
docker build -f server/Dockerfile --target runtime -t fayq-platform-server:0.9.0-m9 .
docker build -f server/Dockerfile --target migrate -t fayq-platform-migrate:0.9.0-m9 .
docker build -f client/Dockerfile --target runtime -t fayq-platform-client:0.9.0-m9 .
docker build -f server/execution/Dockerfile -t fayq-assessment-execution:0.9.0 .
docker build -f docker/ide/controller.Dockerfile -t fayq-assessment-controller:0.9.0 .
```

Build server before controller; its base is the built local server image. The existing nginx image/config remains unchanged. Execution has its own dependency lock/image and no ORM or credentials. The controller uses Docker CLI 29.8.1 so it can communicate with the current daemon.

On a machine without the earlier browser-tool image, build its repository prerequisite before the M9 inspection image:

```text
docker build -f docker/browser/Dockerfile -t fayq-review-browser:0.8.0-local .
docker build -f docker/ide/browser.Dockerfile -t fayq-m9-browser:0.9.0 .
```

Before attaching retained PostgreSQL volumes, inspect the original container's `PGDATA` and mount destination. The local override accepts `LOCAL_PLATFORM_PGDATA_PATH` in the ignored root `.env`; its default remains `/var/lib/postgresql/data/pgdata`. A transferred volume originally using `/var/lib/postgresql/data` must explicitly retain that path. A healthy empty database at another directory is not evidence that owner data is absent. Stop the old database container before attaching the same volume to its replacement; never run two PostgreSQL instances against the same data directory. Preserve any alternate directory and investigate without deletion.

## Retained local preview

```text
node docker/ide/preview.mjs check
node docker/ide/preview.mjs upgrade
```

The wrapper checks ignored configuration, retained volume ownership, exact local image/service/port contracts and runtime mounts. Upgrade stops only platform serving briefly, saves a protected ignored custom-format PostgreSQL dump, applies additive migrations, compares existing user/wallet/purchase/subscription/catalog/media fingerprints, and checks reached-lesson preservation before restarting platform+grading. No DRM command, DB reset or volume removal. Port remains `http://localhost:8080`. Database backup and sanitized upgrade receipt are retained under ignored `docker/browser/evidence/m9/`.

ADMIN: open an existing lesson in course administration → Assignments and quizzes → Add assessment → bilingual content → required/optional → coding or multiple-choice questions → save draft → publish revision. Coding author preview uses the same editor; private checks are configured separately. Student: Practice IDE in navigation or published lesson's assessment link → Run for preview, Submit for official checking. ADMIN Practice allowances offers search, override, restore 50 and reset.

ADMIN coding editor is private by default. Only check **Share this code as student starter code** for deliberate scaffolding, never a solution. For `console.log(2)`, choose **Console output**, enter **2** under Expected output, then save and publish. Enter the printed output, not `console.log(2)` as the expectation. Function-result checks separately accept JSON numbers/objects. Review submissions in ten-row pages and open one selected answer. Students cannot buy a course again while its access is active; renewal is available after expiry. See [owner-testing corrections](m9-testing-corrections-report.md).

Interactions are optional actions performed before a behavior check, such as clicking `#button` then checking the text of `#result`, or filling `#name` before checking a computed value. Each has **Remove interaction**. A console-only exercise needs none. Console expectations are literal text: enter `2`, not `"2"`; a warning explains quoted expectations. Save and publish after removing interactions, then reload the student page to submit the new revision. Prior incorrect submissions are historical and are not changed into passes.

## Verification and cleanup

```text
node docker/ide/verify.mjs --build
node docker/ide/verify.mjs --focused
node docker/ide/execution-proof.mjs
node docker/ide/recovery-proof.mjs
node docker/ide/ui-review.mjs
```

`verify` builds test images when requested, typechecks/tests against isolated real PG/Redis, saves evidence and always guards its own `down -v`. `--focused` checks M9 backend only using already rebuilt test images. `ui-review` uses synthetic accounts/catalog, dedicated localhost:8084 and separate project volumes; browser → API → real queue → actual isolated grading → result/progression are tested. No real video/R2 operation. Recovery proof requires no other active grading containers before advancing a fixture-only clock. Do not run it during owner grading.

If the optional `agent-browser` inspection CLI is unavailable, `node docker/ide/ui-review.mjs --flow-only` explicitly skips that probe and still runs the direct Puppeteer ADMIN/student/controller checks with identical isolation and cleanup. Report the CLI as skipped/unavailable, never as passing. CLI failure diagnostics are bounded and saved in the ignored evidence log.

All wrappers verify project labels and mounts before removing owned test containers/networks/volumes, including failure paths. Preserved preview data and independent DRM must never be included in test cleanup. No global prune. Evidence includes failed runs and diagnostic repairs, not only green summaries.

## Queue recovery, retention and release gates

Accepted submissions persist in PostgreSQL before queue delivery. Reconciler every 2s selects up to 500 PENDING/stale RUNNING records FIFO, replaces retained terminal jobs, leaves live queue jobs alone, and submits deterministic IDs. Claims have 60s leases and fencing. One active check/student and atomic 10,000-receipt global admission bound prevent unbounded backlog. One execution slot/controller locally; production can scale controllers on dedicated execution hosts, with a measured resource budget. Multiple-choice-only work avoids Chromium entirely. Realtime recipient hints avoid continuous fast polling; HTTP fallback slows to ~30s with jitter.

Expired orphan containers are recovered at startup and every ~30s after a 90s grace, with exact name/label/user/network/filesystem/capability/mount checks. Controller health requires a recent successful database/queue reconciliation heartbeat; a process existing is insufficient. Shutdown waits outstanding reconciliation and closes worker/queue/Redis/Prisma. Terminal history/Run receipts older than 180 days are deleted in bounded 1,000-row batches; passes/unlocks remain until course/lesson deletion.

Production controller refuses to start unless `NODE_ENV=production` has `GRADING_RUNTIME=runsc`; runtime availability, Chromium isolation, dedicated-host networking and browser-host protection must be qualified on the actual target host. Docker Desktop is local evidence. No production deployment topology or service-level wait bound is certified here.

10,000 simultaneous editors use each student's browser for practice previews. Submissions are queued, not 10,000 concurrent Chromium launches. Backlog capacity is admission, not a latency guarantee: approximate drain time is accepted work × measured service time / available execution slots. Required future evidence is a realistic 10k activity mix, sustained throughput, tail waits, PG/Redis saturation, abuse/resource tests, autoscaling and budget approval. These remain deferred by the owner; do not label current tests a 10k benchmark.

## Rollback

Stop the grading controller first. Recreate platform server/client using retained M8 image tags and the same external volumes/8080 port through an explicit rollback override. Leave additive M9 schema/history intact; old code ignores it. Preserve immutable migration files and checksums. The before-M9 dump is for deliberate transactional recovery into a separate verified volume, not an automatic destructive restore over retained data. Never drop tables, restore over current data, or delete volumes without an explicit recovery assignment.


## Input/output problems (2026-10-02)

Build server/migrate/client, then the controller derived from the new server image, and the updated execution image. Use the guarded preview upgrade to back up retained data and apply the additive preparation migration; do not reset volumes. The controller now handles a separate bounded preparation queue as well as student submissions. Reference/generator execution uses the same restricted disposable containers and fencing/cleanup rules. Only ADMIN can request/review preparation.

Verification remains node docker/ide/verify.mjs --build (fresh PG/Redis/typechecks/full regression), node docker/ide/execution-proof.mjs (real restricted execution), and node docker/ide/ui-review.mjs (synthetic admin/student UI and actual controller). All runners clean only their owned containers/networks/volumes after success/failure. [Input/output authoring guide](m9-input-output-guide.md) documents Save/Prepare/Review/Publish and student Run/Submit. No DRM resources are used by these tests.
