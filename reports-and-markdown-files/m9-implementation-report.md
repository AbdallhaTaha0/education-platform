# M9 reusable IDE and assessments — implementation and review

Subsequent owner-testing corrections are documented in [the follow-up report](m9-testing-corrections-report.md): ADMIN code is now private by default with explicit starter sharing, printed numeric console checks are corrected, active-course duplicate charges are prevented, and submission review is paginated. Earlier image/test evidence below describes the initial implementation; consult that report for the rebuilt preview and final follow-up verification.

2026-10-01. Direct implementation and same-agent source review/verification; no separate reviewer or OpenCode worker was dispatched. Owner approval authorized completion and the exact grading sandbox adjustments. **Implemented locally; ready for owner review.** No milestone acceptance, commit/push, production deployment or 10,000-user certification is inferred.

Baseline platform `9b4e8ad`; independent DRM `bad0c1df9f5d5844fe365c402fcccfee33ab6906`, untouched/clean. Original system design and `design.md` remain unchanged. Earlier planning-only wording is explicitly superseded by [the approved contract](m9-implementation-contract.md); [schema/API](m9-schema-api.md) and [runbook](m9-docker-runbook.md) record delivered behavior.

## Delivered use cases

| Owner requirement | Delivered behavior |
| --- | --- |
| Reusable normal web IDE | One lazy-loaded CodeMirror HTML/CSS/JavaScript component, real DOM/console preview and Stop; shared by practice, coding exercises and ADMIN starter preview. Arabic/English, LTR source inside RTL UI, mobile and both themes. |
| Active subscribers practise | At least one currently active finite/indefinite subscription qualifies; no eligible-course restriction. Expiry denies standalone practice server-side. |
| 50 daily accepted Runs | Durable PostgreSQL counter/idempotent receipts. Cairo calendar/DST boundaries; errors count after acceptance, denied/duplicate controls do not. |
| ADMIN exceptions | Search students, persistent custom allowance, restore default 50, lower below usage → zero remaining. Reset replenishes immediately and starts recurring anchored exact 24h windows, including after restore-default. Audited/idempotent. |
| Exercises outside quota | Assignment/quiz preview and submissions consume no standalone allowance. Unlimited new educational attempts; one outstanding check/student protects fair admission. |
| ADMIN creates assessments near video upload | Independent collapsible lesson-authoring panel; multiple assignment/quiz entries, mandatory bilingual content, explicit required/optional selection, coding and multiple-choice questions, private output/DOM check builder and submission review. |
| Correct/incorrect behavioral checking | Real isolated Chromium executes JS/DOM; trusted host compares outputs, interactions, CSS, functions and console. Choice-only checks avoid browser startup. Mixed assessments require every check/question to pass. No source matching/client score trust. |
| Safe queued submissions | Immutable accepted revision, durable idempotent receipt, bounded backlog, fencing/recovery; Checking leaves editor usable. Recipient-only completion hint and authoritative HTTP fallback. Infrastructure errors never fabricate passes. |
| Progression gates | Published required assessments in prior lessons block later lesson APIs/playback/renewal. Optional/archived entries do not. Migration preserves existing reached lessons; earned passes survive edits. Expiry/publication protection remains. |
| Draft/history lifecycle | Revision-safe server drafts; valid incomplete choices, bounded validated source, own history/results. Terminal history 180 days, bounded cleanup; pass/unlock independent. Permanent course/lesson cascade removes assessment code/drafts/passes/submissions and releases active admission capacity; financial/audit policy unchanged. |

## Implementation map

- `server/src/modules/assessments/`: validated private/public contracts, quota administration, immutable author/student services, progression, HTTP routes, trusted launcher and durable grading worker. `server/src/grading-worker.ts` is the dedicated controller entry.
- `server/prisma/schema.prisma` and additive `20261001210000_m9_assessments`: authority tables, rollout snapshot and atomic durable queue-admission trigger.
- Existing Express app mounts the module; learning access/playback renewal enforce locks. Notification realtime carries only recipient submission-ID hints after durable completion.
- `server/execution/`: independent TypeScript/lock/Docker image with sandboxed Chromium. No platform persistence or credentials inside an execution job.
- `client/src/features/ide/` and `client/src/features/assessments/`: shared editor/preview, practice, authoring, student assessment/history and quota controls; existing shell/course/lesson components provide navigation/integration. User/assessment keyed remounting prevents cross-context stale drafts.
- `docker/ide/`: scoped seccomp, controller/browser images, isolated backend/browser projects, execution/recovery proofs, guarded preview upgrade and evidence wrappers. Persistent local Compose/wrapper updated to M9 platform images with a trusted grading-only socket mount.

Backend remains one Express business application; no new role, payment rule, DRM persistence access or DRM edit. Grading's socket is isolated to the trusted controller, never web replicas or untrusted jobs.

## Docker evidence actually run

| Verification | Result and scope |
| --- | --- |
| Full backend regression snapshot | 181 unit + 284 real-PG/Redis integration = **465 PASS**, with production/test typechecks. This was before later recovery/draft hardening; it is not labeled a final 470-test single run. |
| Final affected backend checks | **24 PASS**: 8 M9 contract/timezone/private-input tests + 16 integration tests; final production/test typechecks PASS. Includes exactly 50/52 concurrent distinct Run accepts, duplicate charging, durable overrides/reset, lost delivery, retained real BullMQ failed job, stale lease, pass-preserving retention, expiry despite reach snapshot and permanent lesson cascade. |
| Frontend | **83 PASS**, plus 2 existing DASH compatibility checks; final client runtime TypeScript/build PASS. Rechecked affected preview tests after sandbox changes. |
| Restricted execution | **8/8 PASS**: real Chromium namespace/seccomp active, DOM click/input/CSS/function/console, wrong output, syntax error, forged pass flags/prototype tampering, blocked network, mixed questions and endless-code interruption. |
| Controller crash orphan | **2/2 PASS**: recent running job preserved; expired isolated owned job removed. No other active grading jobs allowed during fixture clock advancement. |
| Real browser flow | **34 PASS** in the final synthetic isolated run: shared practice/editor, cookie auth, opaque origin/storage denial, copied-nonce injection denial, async-generator escape denial, draft, RTL/mobile, dark/light source readability, quota, wrong/correct real isolated grading, private tests, recipient hint, unlock/history, ADMIN limit/reset/restore, UI-authored bilingual optional quiz, queue grading, inactive/role denial, assessment-ID switching and empty auth browser storage. Saved CLI/browser logs/screenshots; no real R2/video fixture. |
| Runtime/migration images | Server Prisma construct smoke passes; migrate image contains additive SQL; controller has Docker29 CLI/profile/own reconciliation health check; execution stays non-root/read-only/no-network/no-host-mount with sandbox active. |
| Retained preview upgrade | Protected ignored custom-format backup before migration; original user/wallet/purchase/subscription/course/section/lesson/media row fingerprints identical afterward. All existing reached lessons preserved. Preview remains 8080; grader healthy. |
| Cleanup | Each backend/UI wrapper reports **containers=0 networks=0 volumes=0** for its owned project on success/failure. Execution/recovery jobs removed. Retained owner preview/DRM intentionally running. No global prune or retained-volume deletion. |

Commands and individual controls are in [the runbook](m9-docker-runbook.md). Full regression, final focused run and browser/recovery checks are distinct evidence, not added as though independent test totals. Financial/auth/video/notification regressions were preserved; capacity/commercial DRM/provider deployment were not attempted.

## Findings repaired during review

1. Docker's restricted profile initially denied Chromium namespace/chroot setup. Exact additional syscalls were owner-approved; renderer namespace and seccomp were then verified. No no-sandbox grading fallback.
2. Queue loss/retained terminal jobs/stale DB leases need durable delivery. PostgreSQL remains acceptance authority; real BullMQ recovery tests and fenced processing prove repair without invented passes.
3. Anonymous Redis test volume required explicit attachment/project ownership proof before cleanup; the guard now allows only that exact disposable mount and reports zero remaining resources.
4. BullMQ's original UUID dependency had a moderate advisory. Targeted `uuid`11.1.1 override removed it; real queue grading/recovery still pass. Backend/client/execution dependency audits produced zero findings; no unrelated ORM upgrade.
5. Async ADMIN save/list timing caused a browser-harness failure; waiting for the authored row repaired the probe. The test's language injection also ran inside opaque child frames, correctly receiving SecurityError; injection is now restricted to the trusted top page.
6. Source review hardened sandbox policy against copied nonces and async-generator dynamic constructors; browser negatives pass. Private checker decisions remain outside the student page.
7. Draft validation and keyed assessment/user remounting prevent malformed/stale editor data; correct question bindings and incomplete-choice drafts are tested.
8. Test-only Worker generic inference caused a TypeScript failure, corrected before final affected checks. It was not reported as a product defect.
9. Replacing app containers left Nginx's statically resolved upstream pointing to an old address. Preview upgrade now waits for the application/controller and then recreates only the edge; repeated upgrade is idempotent and does not grandfather post-launch progress. Data/backup remained intact during the temporary 502; final health is checked after repair.
10. Visual review improved mobile navigation layout and editor token/gutter/cursor contrast using semantic theme colors. Browser screenshots cover mobile Arabic and desktop exercise; ordinary editor source remains LTR.

## Preserved state and release limits

Verified local image identities (Docker inspect, shortened): server `b70258c32d72`, client `51690b880e33`, migrate `da2f1ebc4167`, grading controller `64bd65e26a91`, execution `e8961203567f`. Nginx remains the existing local image, recreated to resolve current upstream addresses. These local tags are not production release attestations. The final production-runtime guard was also exercised in a no-network transient controller: an unqualified production setting refuses startup before persistence or execution access.

All changes are uncommitted for owner milestone review. Independent DRM source/tree and runtime are unchanged; no real video/R2 deletion, tenant/CORS mutation, owner-user fixture or fabricated financial row was created. Protected local migration backups and test evidence remain ignored; no password/token/private test/URL was published in reports.

One local grading slot/controller and a 10,000-receipt admission bound are implemented. They do **not** prove 10,000-user throughput or a maximum wait. Production checking requires dedicated execution hosts and qualified `runsc` isolation; production startup refuses an unqualified runtime setting. Browser-local responsiveness guards do not establish universal memory/time isolation for all pathological built-ins. Production/capacity/SLA/budget qualification remain explicitly deferred, alongside previously deferred provider/commercial-DRM gates. Local feature review can proceed without claiming those gates closed.

## Owner review

Open `http://localhost:8080/#/practice` as a subscribed student. In ADMIN, open a lesson's Assignments and quizzes panel to author/publish required or optional exercises; `#/admin/practice` manages student allowances. Existing accounts are reused; no new owner credentials are invented. After explicit M9 acceptance, commit/push the platform changes under the standing milestone-delivery instruction. Until then, retain working-tree changes and evidence. Rollback preserves data through the runbook's old-image override and retained additive schema.


## Input/output follow-up (2026-10-02)

New PROGRAM questions now use private reference solutions and generated/frozen hidden input/output cases. The retained localhost:8080 preview is upgraded with the additive preparation migration and preserved-data backup/fingerprints. Final Docker evidence: 189 server unit + 300 integration, 88 frontend unit + 2 DASH checks, 18 restricted execution proofs, 74 browser/queue checks, final preview browser/health proof and zero owned test resources remaining. Existing assessment types/passes and the external DRM remain unchanged. See [the detailed report](m9-input-output-implementation-report.md) and [authoring guide](m9-input-output-guide.md). Work remains uncommitted; no production/capacity or owner milestone acceptance is inferred.
