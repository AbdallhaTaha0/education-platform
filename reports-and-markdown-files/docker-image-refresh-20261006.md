# Local Docker image refresh — 2026-10-06

Owner request: rebuild the Docker images to include all current changes. Completed for the retained local preview on port 8080 and the independently deployed DRM. No production deployment, commit, push or new milestone acceptance.

## Images

All 11 project application images were built, and every serving project container was checked against its current image tag. Execution images run on demand rather than as permanent containers.

| Image | Image ID prefix |
| --- | --- |
| `fayq-platform-server:0.9.0-m9` | `531a471c92fc` |
| `fayq-platform-client:0.9.0-m9` | `8b7955e66a42` |
| `fayq-platform-migrate:0.9.0-m9` | `fdc35cca97b4` |
| `fayq-platform-nginx:0.8.0-local` | `075bca121a04` |
| `fayq-assessment-controller:0.9.0` | `182c9f8985c7` |
| `fayq-assessment-execution:0.9.0` | `bbd49f148901` |
| `fayq-python-execution:0.10.0` | `82317682adee` |
| `fayq-drm-api:0.8.0-local` | `65ef6228a722` |
| `fayq-drm-worker:0.8.0-local` | `45df28e799f5` |
| `fayq-drm-migrate:0.8.0-local` | `e7b0589d4803` |
| `fayq-materials-minio-fixture:20261004` | `f31bd6adc27f` |

The platform server, migration runner, frontend, Nginx, grading controller, Python runner, DRM API/worker/migration runner and pinned MinIO fixture were built from their current Dockerfiles. PostgreSQL, Redis and Valkey vendor images were preserved; they contain no project source to rebuild.

## Build limitation and resolution

The first forced no-cache build stalled because Debian package-server HTTP and HTTPS requests timed out. Cached platform dependency layers allowed the normal source rebuild to complete. For the JavaScript/web execution image, the retained runtime's package-lock SHA256 exactly matched the current source lock (724f9a81b665c8817c2d825312e94811336e492af2807a26a96eb2b52ae8f6ed). Its latest TypeScript was compiled and copied into a new image based on that verified runtime. Chromium, production dependencies and sandbox configuration were retained. This is current-code synchronization, not a claim that all OS packages received a cold security refresh. No tracked Dockerfile or nested DRM source was altered to bypass the network failure.

## Verification

- All 18 restricted JavaScript/web execution proofs pass, including Chromium namespace/seccomp setup, DOM interaction, private grading, output comparisons, blocked networking and endless-code interruption. Each disposable proof container was removed.
- Restricted Python input/output smoke passes: square of -10 prints 100; the disposable container was removed.
- Private lesson-file PUT/GET/DELETE roundtrip passes after storage refresh. The unique probe object was deleted and HEAD confirms absence. No lesson metadata or owner objects were created or removed.
- HTTP 200: owner preview root, platform readiness through Nginx, and real DRM health. Configured Docker healthchecks are healthy.
- Platform and DRM migration containers exited 0.
- Every baseline volume attachment matches its previous name and destination. All four retained database/cache container IDs are unchanged. No volumes were deleted or reset; files and real video storage were preserved.
- Final inspection found no remaining execution-proof or rebuild-network-probe containers. Serving stacks are left running.

The verification script initially compared JSON strings with different object key order; this false failure was corrected to structural comparison. A subsequent image check correctly found that Compose had retained the prior DRM API/worker containers despite rebuilt tags; both serving containers were explicitly recreated without touching data services, then the full identity/health/preservation receipt passed.

## Recovery and evidence

Each application image retains its original `before-full-refresh-20261006` rollback tag; all 11 tags were verified unchanged. Sanitized build logs, baseline image/volume records and final receipt are in the ignored `docker/browser/evidence/rebuild-20261006/` directory. Existing source changes and the staged nested DRM reference were preserved. Nested DRM is clean at `d1bfd692ef4313e5d7f4aeb883c09f36d274215b`.
