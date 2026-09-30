# Prompt 01 — baseline and isolated Docker setup

Apply `00-worker-contract.md`. Scope: environment discovery and a safe reproducible Docker setup. No live media mutation or product changes.

1. Confirm platform `b04d84f`, nested DRM `015392b`, parent submodule pointer and both Git statuses. Preserve newer owner work if revisions differ; explain the difference before relying on old evidence. Inspect remotes; do not pull over local changes.
2. Read the reports and build a current evidence map. Distinguish historical tests, fixture proof, real R2 proof and still-open gates.
3. Verify Docker Engine/Compose, available memory/disk, images and running services. On Windows verify WSL2 integration. Use portable commands, no previous developer's absolute paths.
4. Inspect Compose definitions and helper scripts. Prepare a separately named platform verification project with unique PostgreSQL and Redis volumes, port and approved application origin. Render configuration with secrets suppressed; report only service/project/volume names.
5. Prove resolved verification volumes differ from every development volume. Add a reusable fail-closed guard if absent; test rejection of shared development volumes before any bootstrap or cleanup.
6. Start isolated dependencies, run migrations, verify readiness and confirm development data is unchanged. Run credential-free harness selftest in Docker.

Deliver a reproducible runbook, volume guard evidence and a short package report. Acceptance: clean baseline accounted for, isolated volumes proven, migrations/readiness/selftest pass, development data preserved. Stop before credential provisioning and live tests.
