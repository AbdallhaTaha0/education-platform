# Local DRM security delivery — 2026-10-06

All findings assigned by the owner's **“fix all these bugs”** instruction are corrected locally. The source regression is fixed, updated API/worker images are installed, the parent Git index references the corrected dependency, and both missing parent reports now exist. Nothing was pushed remotely or deployed to production.

## Source and Git reference

- New local DRM commit: `d1bfd692ef4313e5d7f4aeb883c09f36d274215b` — `fix: preserve individual webhook delivery outcomes`.
- Its parent is the reviewed security commit `52853b357168887f89cf5cd98f36060e9efeb38f`.
- The nested tree is clean. The commit contains the per-destination SQL fix, its two real-PostgreSQL regression tests, and the updated nested security report.
- The platform's staged gitlink now references `d1bfd69`, replacing `dd66be3`. Platform HEAD remains `73a77c1`; the parent reference/helper/documentation changes await a platform commit. The local DRM commit and platform reference must be published together when remote delivery is requested.

The owner assignment and architecture boundary are recorded in [decisions](decisions.md). The [repair report](drm-security-repair-20261006.md) explains the changed behavior and regression. The original [independent review](drm-security-independent-review-20261006.md) is preserved as historical evidence.

## Verification

| Check | Evidence |
| --- | --- |
| Reproduce original delivery-status bug | Both new PostgreSQL cases failed before the fix; earlier destination status/attempt/error was overwritten |
| Final default unit/security suite | **103/103** tests |
| Final real PostgreSQL/BullMQ integration | **4/4** tests: two failure-sink regressions and two destination-outcome regressions |
| Workspace TypeScript builds | Passing test, API and worker image builds using the frozen lockfile |
| Installed API protections | `pinnedWebhook=true`, `perDestinationStatus=true`, `nonRoot=true` |
| Installed worker protection | `safeProcessingErrors=true`, `nonRoot=true` |
| Platform-to-DRM authentication | Valid client plus empty media body returns **400** validation refusal; no media created |
| Platform readiness on port 8080 | **200** |
| DRM health on port 3000 | **200**, database/Redis/storage all `ok` |

The database regressions mock external webhook delivery only, not persistence. No live external webhook, new R2 object, course/media fixture, tenant, student or playback session was created during this delivery. No production/capacity qualification or additional vulnerability audit is claimed.

## Installed runtime

| Image tag | Running image ID |
| --- | --- |
| `fayq-drm-api:0.8.0-local` | `sha256:86cb45308ad6873b01ff931f25ad3d82245b84a38dc2ca43c39012f275eb1627` |
| `fayq-drm-worker:0.8.0-local` | `sha256:498af36cc9ae13d20af702ef08183b5d9ff8345904345005244631ea1f9725de` |

Tags were retained for compatibility with the existing guarded local configuration; running-image IDs and compiled-code probes establish the installed version. The migrate image/container was preserved because no schema change was made.

The helper `docker/local-preview.mjs` gained two bounded actions:

```text
node docker/local-preview.mjs drm-build
node docker/local-preview.mjs drm-up
```

They retain all existing persistent-volume, project, mount, image and port guards. `drm-build` builds API and worker only. `drm-up` recreates only API and worker with `--no-deps`; neither action resets data volumes or rebuilds/restarts the platform. On this machine the existing Docker executable was supplied through `DOCKER_EXE`.

## Preservation and cleanup

Nine DRM tables were fingerprinted before and after refresh using row counts and deterministic content hashes: applications, media assets, encrypted DRM keys, processing jobs, deletion operations, personalized variants, watermark policies, webhook endpoints and webhook deliveries. **All nine fingerprints match.** Real videos and encrypted keys remain intact; historical delivery rows were not rewritten.

The identities and mounts of **ten protected containers** match exactly: all seven platform containers and DRM PostgreSQL, Valkey and migrate. Only the DRM API and worker were recreated. Credentials, origins, TTLs and retained volumes were not changed.

The disposable test project's containers, network and two volumes were removed after both the red reproduction and green final run; the temporary review image tag was removed. Sanitized test/preservation evidence remains ignored under `docker/browser/evidence/security-fix-20261006/`. Build cache and retained images were not globally pruned.

A preliminary container-format probe failed because a bind mount has no volume `Name`; it was replaced with a structured names/IDs/mounts-only capture **before** runtime recreation. The successful ten-container before/after comparison is authoritative.

## Rollback

Previous API/worker images remain under `fayq-drm-api:rollback-pre-security-20261006` and `fayq-drm-worker:rollback-pre-security-20261006`. For an emergency local runtime rollback, re-tag these as the corresponding `:0.8.0-local` images and run the guarded `drm-up` action. This restores the old runtime and its known security gaps; it requires no volume deletion or schema rollback. No rollback was needed during this delivery.
