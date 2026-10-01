# OpenCode — M7 package 06: Prisma remediation assessment

Work on **this package only**, then stop for manager review. Read AGENTS.md, the documentation index, agent.md, rules.md, decisions.md and the M7-03/04 manager reviews first. Preserve every existing uncommitted package and M8 design file. No commit, push, deployment or subsequent package execution.

## Objective and verified baseline

Determine a defensible remedy for the remaining Prisma build/migration dependency findings without destabilizing the serving image or silently accepting a major dependency override. Produce a concrete recommendation and reproducible Docker evidence. This is an assessment package; application dependency edits are deferred until manager review of the candidate.

M7-04 server tooling has passed independent review: Vitest 4.1.11, Vite 6.4.3, 159 unit and 251 integration tests. M7-05 client tooling is implemented with same-agent evidence, but independent review remains pending. Server Prisma and @prisma/client remain 6.19.3. Full server audit retains three high rollup entries: prisma, @prisma/config and deepmerge-ts. The serving image installs with `--omit=dev --omit=optional`, excludes this CLI chain, and has zero findings in that installation scope. Do not describe build/migration debt as serving exposure.

Registry inspection found @prisma/config 6.19.3 depending on **exact deepmerge-ts 7.1.5**. The reviewed advisory [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) identifies deepmerge-ts 8.0.0 as patched; this is a major change outside the upstream exact constraint. Its cyclic-object failure must be assessed against actual Prisma config inputs. No override or Prisma candidate has yet been applied or proven compatible.

## Work in order

1. Record checkout, clean nested DRM pin, manifests/lock hashes and Docker resources. Keep the existing platform preview and `m8-design-preview` untouched. Audit current registry/advisory metadata with time and exact versions; distinguish confirmed advisory facts from inferred reachability.

2. Inspect the installed @prisma/config source in Docker. Identify its deepmerge calls, accepted input shapes, actual project config usage and whether attacker-controlled cyclic objects can reach them. Explain consequences and prerequisites precisely. JSON cannot encode a cyclic object graph by itself; do not invent an application remote exploit. Limited practical reachability also does not erase an audit finding.

3. Check current upstream supported fixes and release notes. Prefer a compatible supported update if one exists. Do not assume a Prisma major upgrade is approved: assess any required client, driver, engine, generator or configuration changes and report their scope. Inspect deepmerge-ts 8.0.0 exports/types/behavior and compare them with what @prisma/config actually uses.

4. If useful, create a **disposable copy** of manifests and required build inputs, outside tracked application paths. Probe a narrowly scoped override for the exact @prisma/config dependency, or another concrete candidate. Clearly label this as an experiment rather than upstream support. Keep the original application manifests, lockfiles and Dockerfile unchanged. Use Docker for resolution, installs, builds and tests. A supported disposable npm resolver may be used if npm 10 repeats its `edgesOut` bug; record versions, failures and engines. Then prove a frozen install with the normal Docker npm and lifecycle scripts enabled. No `--force`, peer-dependency bypass, audit suppression or weakened tests.

5. Compare the candidate lock closure and explain every movement. Verify Prisma/client alignment and native engines. Test actual config loading, schema validation, client generation and CLI execution using the project's real inputs. Include a focused advisory regression and representative differential configuration cases where meaningful; do not treat one smoke command as comprehensive compatibility proof.

6. If the candidate remains viable, build uniquely tagged test/migration/runtime images from the disposable candidate context. Run the unchanged full server typecheck/unit/integration suite against fresh PostgreSQL/Redis. Apply all migrations from empty state and demonstrate current Compose migration failure blocks server startup. Reuse the strengthened M7-03 runtime helper to verify native cookie login, approval/duplicate behavior, private notification delivery, exact financial balances and subscription duration through the actual candidate serving image. Preserve serving CLI exclusion and non-root/native-engine properties. Report any failure honestly; do not patch product source or tests to make an assessment pass.

7. Reaudit each applicable scope with valid machine-readable results and recorded exit statuses. Separate full build/test/migrate findings from serving installation findings. If no supportable narrow remedy exists, deliver the evidence-backed options and remaining debt; do not manufacture zero findings by deleting necessary tooling or rewriting the audit.

## Safety, boundaries and deliverable

Exactly STUDENT and ADMIN; one modular Express application; unchanged cookies, wallet/recharge/purchase, notification, recorded-course and external DRM contracts. No schema/migration/business-policy/client edits. No DRM edits, database access or real media calls. No production credentials in logs. No change to the M8 prototype or owner design direction. All fixture and failure tests use unique disposable projects, private ports and owned volumes. Inspect final resolved configuration and ownership; check all volume attachments before cleanup. Never prune global Docker resources or remove another project's volumes.

Save `reports-and-markdown-files/m7-06-prisma-remediation-assessment.md` and add one index row. Track only narrowly useful assessment helpers/documentation; exclude copied application trees, dependency directories and raw sensitive logs. Include actual commands, candidate versions, hashes, dependency diff, config reachability, install/build/test/audit results, failures, cleanup and rollback. Distinguish a tested override from a supported upstream solution, and identify the exact proposed follow-on edits for review. If blocked on upstream compatibility, finish the source/metadata assessment and describe the smallest next decision rather than changing architecture.

Stop after submitting the changed-file list and recommendation. Do not implement the recommended application dependency update, declare M7 complete, start M8 implementation or infer owner risk acceptance. The manager reviews this package before issuing the next implementation assignment.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
