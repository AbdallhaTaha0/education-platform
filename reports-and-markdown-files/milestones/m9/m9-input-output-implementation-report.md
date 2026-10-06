# M9 input/output problem implementation

2026-10-02. Direct implementation authorized by the owner's “do this way” response to the proposed Codeforces-style workflow. Complete for local owner review; no milestone acceptance, commit/push, deployment or capacity certification is implied.

## Delivered behavior

New coding questions default to PROGRAM. ADMIN authors bilingual input/output descriptions and public samples, a separate private reference solution and an integer-range or custom JavaScript input generator. Save → Prepare and review tests → Publish. Publishing is blocked until the current normalized draft has a matching READY preparation. Changing a draft does not mutate the published checker or prior passes.

Preparation is a durable PostgreSQL outbox with global bounded admission, unique content fingerprints, fenced leases and separate BullMQ delivery/reconciliation. Only the trusted existing grading controller runs generators/reference code, inside restricted disposable execution containers. Each reference/input runs twice; sample mismatch, unstable output, invalid generator, runtime failures or bounds prevent preparation. Publishing removes reference/generator from the immutable version and freezes validated inputs/outputs. No private source/test enters student responses.

Students read public samples and use `readline()` plus `console.log()` in the reusable JavaScript IDE. Local input affects Run only. Submit checks the frozen hidden cases in fresh isolated pages; a hardcoded sample answer is rejected. Tokens, exact-text and strict JSON comparison are supported. Existing CODING console/function questions, multiple-choice, private/shared starter rules, reset/highlighting/Prettier, drafts, retries, allowances and progression remain compatible.

See [authoring guide](m9-input-output-guide.md), [schema/API](m9-schema-api.md), [contract](m9-implementation-contract.md) and [Docker runbook](m9-docker-runbook.md).

## Verification reproduced in Docker

| Verification | Final result |
| --- | --- |
| Server build, generated Prisma runtime and server/test typechecks | PASS |
| Full server unit suite | 189/189 |
| Full server integration suite on fresh PG/Redis | 300/300 |
| Final client image build and final-source typecheck | PASS |
| Final client unit suite | 88/88 plus 2 DASH compatibility checks |
| Real restricted execution proof | 18/18; namespace/seccomp remain enabled |
| Real admin/student browser and grading-controller flow | 74/74; no page errors |
| Guarded retained-preview upgrade | PASS; protected PostgreSQL backup saved |
| Existing user/wallet/purchase/subscription/catalog/media fingerprints and reached-lesson preservation | Unchanged |
| Additive preparation migration on retained preview | Applied, finished count 1 |
| Retained `/api/health/ready` and platform/controller container health | 200 / healthy |
| Retained preview browser CLI | Render, navigation, page-error check and screenshot PASS |
| Owned execution/test/browser containers, test networks and test volumes | 0 remaining |

The new server tests specifically cover student preparation denial, unprepared publication, concurrent preparation deduplication/claiming, frozen content/privacy, forged grading counts, changed-draft invalidation, safe failure/retry/stale lease recovery, real BullMQ lost delivery/retained failure repair, admission bounds and cascading deletion. Runtime proofs additionally cover multiline inputs, custom generation, whitespace/JSON rules, unstable references, bad samples, syntax/runtime errors, oversized output, extra output and forged success flags. Browser proof creates/prepares/reviews/publishes the square problem through ADMIN UI and proves local sample Run, hardcoded-answer denial and dynamic-answer acceptance through the actual controller.

Evidence is saved under ignored `docker/browser/evidence/m9/`: server/client test logs, execution proof, UI flow/screenshots, preview upgrade/backup and final preview browser proof. Screenshots were visually inspected. No test used owner credentials or edited an owner quiz; UI fixtures were synthetic and removed by disposable database teardown.

## Defects found and corrected before delivery

- Prisma could not deserialize the advisory-lock function's void return through `$queryRaw`. Changed that lock to `$executeRaw`; concurrent real-database preparation now passes.
- The initial student renderer still branched only for CODING. Added PROGRAM editor rendering and public problem descriptions/samples; repeated full browser proof passes.
- A privacy assertion searched complete response UUIDs for the hidden numeric input `-4`, producing a false positive. Scoped the assertion to assessment content, retaining private-field/input checks. A BullMQ recovery-test generic type error was also corrected before final typechecks.

Earlier failed evidence is retained separately. Final verdicts above come from passing runs, not truncated projections.

## Preserved boundaries and limits

The independently deployed DRM tree is unchanged and clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`; DRM containers were not restarted. The one-Express backend architecture is unchanged; serving replicas never receive a Docker socket. No private code executes in Express. No global prune, existing-volume removal, financial mutation or historical-content conversion occurred.

Local preview is ready at `http://localhost:8080`. All source remains uncommitted for owner review. This is a finite, synchronous input/output judge: at most 20 cases per assessment, bounded source/input/output, no external libraries/network, and existing execution resource limits. Admin reference consistency/sample validation is not mathematical proof of correctness or exhaustive coverage. Custom valid-output checkers/floating-point tolerances and production/10,000-user qualification are outside this delivery.
