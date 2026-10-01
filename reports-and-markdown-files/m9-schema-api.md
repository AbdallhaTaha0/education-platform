# M9 schema and API contract

2026-10-01. Implemented under [the owner-approved contract](m9-implementation-contract.md). All business routes belong to the existing Express application. External DRM remains API-only and unchanged.

## Persistence

| Model | Authority and lifecycle |
| --- | --- |
| Assessment | Lesson-owned author draft, assignment/quiz kind, live status/version and explicit required/optional selection. Draft selection cannot change live gating before publication. |
| AssessmentVersion | Immutable published bilingual content, starter files, questions and private behavior checks/choice key. Each accepted submission binds this version. |
| AssessmentDraft | One server draft per student/context; optimistic revision conflict returns 409. Source is inert bounded data. Practice and assessment drafts are distinct. |
| AssessmentSubmission | Idempotent durable receipt, accepted version/answers, PENDING/RUNNING/CORRECT/INCORRECT/ERROR, fenced lease and safe result. Terminal history retained 180 days. |
| AssessmentPass | Student/assessment unique earned pass, independent of history retention and subsequent author edits. |
| PreservedLessonUnlock | Migration-time union of existing progress/playback evidence. Does not fabricate a grade or bypass subscription/publication protection. |
| PracticeQuota | Durable per-student override, used count, current window/epoch and optional reset anchor. Null override means 50. |
| PracticeRun | Idempotent accepted Run receipt; duplicate controls do not increment usage. Retained 180 days. |
| AssessmentQueueBudget | Atomic global durable admission counter; initial capacity 10,000 outstanding receipts, not a throughput claim. Active inserts reserve; terminal transition or cascade deletion releases. |

Migrations: `20261001210000_m9_assessments` and additive `20261001230000_m9_submission_browse` (assessment/time/id index for bounded browsing). Existing applied SQL is unchanged. Lesson → assessment → versions/drafts/submissions/passes cascade on permanent deletion; course deletion reaches these through the existing section/lesson cascade. Financial and audit records follow their existing retention policy. Practice drafts are not course-owned.

Submission transitions are PENDING → RUNNING → terminal. Recovery may reclaim expired RUNNING leases with a fresh fencing token; only that token can commit its result/pass. Terminal records are never moved back into an active state. Intentional retries create new receipts.

## Public HTTP surface

All paths below have the existing `/api` ingress prefix. STUDENT/ADMIN permissions are enforced by the server; writes require approved Origin and session-bound CSRF with HttpOnly authentication cookies. No execution source or private test contents are logged.

| Method/path | Contract |
| --- | --- |
| GET `/assessments/practice` | Active-subscription eligibility, current allowance and own saved practice draft. |
| POST `/assessments/practice/run` | `{idempotencyKey}` reserves exactly one accepted official Run. Exhausted → 429. Code errors count after acceptance. |
| PUT `/assessments/practice/draft` | `{revision,content:{html,css,javascript}}`; revision-safe save. |
| GET `/assessments/lessons/:lessonId` | Entitled/unlocked lesson's published assessment list, required/optional and own earned-pass state. |
| GET `/assessments/:id` | Current public immutable revision, instructions/starter/choices and own draft/pass. No private checks or answer key. |
| PUT `/assessments/:id/draft` | `{revision,version,content:[answers]}`; partial choice selection allowed, source/bindings validated. |
| POST `/assessments/:id/submit` | `{version,idempotencyKey,answers:[{questionId,source? ,choiceId?}]}` → 202 durable receipt. Same key/different answers → 409. One outstanding check/student → 429. Full global backlog → 503 with no accepted receipt. |
| GET `/assessments/submissions/:id` | Own durable state, own answers and safe feedback; other student → 404. |
| GET `/assessments/:id/history` | Latest 30 own retained attempts. Historic own work remains readable after entitlement expiry; executing/starting new work does not. |
| GET `/admin/assessments/students?q=` | Bounded student search; no new role. |
| GET/POST `/admin/assessments/students/:studentId/quota` | Read or `{action:LIMIT\|RESET,limit:number\|null,idempotencyKey}`; persistent override/default restoration or recurring 24h reset. Audited/idempotent. |
| GET/POST `/admin/assessments/lessons/:lessonId` | Author list/create with `{kind,required,content}`. Required/optional must be explicit. |
| PUT `/admin/assessments/:id` | Save author draft without changing the immutable published revision. |
| POST `/admin/assessments/:id/publish` | New immutable version, publish required/optional setting. Existing passes remain valid. |
| POST `/admin/assessments/:id/archive` | Withdraw from student surfaces and progression requirements; later publish restores it. |
| GET `/admin/assessments/:id/submissions?limit=10&cursor=` | Keyset-paginated summaries only: id/student name/email/status/time/revision, no answer/result payload. Default 10, maximum 25; same-assessment cursor validated. Response includes nextCursor. |
| GET `/admin/assessments/:id/submissions/:submissionId` | One selected answer/result; authenticated ADMIN only, assessment binding enforced, escaped inert UI rendering. |

## Checking and feedback

Coding checks: element existence/text/input value/attribute/computed CSS, named JavaScript function with JSON arguments/expected value, console output. Ordered click/input steps support DOM interactions. No arbitrary author checker program, source matching or browser-provided score. Each question runs in a fresh browser page; interaction steps/checks within it are sequential. All checks and all questions must pass. Private expected values remain in the execution host, not student API/preview.

Coding content stores `starter` as private ADMIN preview code unless `shareStarter` is explicitly true. Missing flags on historical revisions default private; student delivery substitutes empty HTML/CSS/JS. Sharing is deliberately labelled as starter-only, never a solution. Own previously saved drafts remain intact. Console output expectations are printed text: primitive numeric legacy expectations are normalized in the execution host, so expected `2` accepts `console.log(2)` but rejects `console.log(3)` or additional output. Function result checks retain strict JSON type comparison. Selecting Console output and entering `2` is sufficient; author code alone never defines correctness.

Limits: 10 questions/assessment, 20 checks/coding question, 10 interaction steps/check, 2–8 choices, 32,768 characters/source file, 200KB normalized aggregate content/answers, bounded selectors/arguments/expected values. These protect resources; they are not assignment deadlines or educational attempt limits.

Infrastructure errors return ERROR/CHECKING_UNAVAILABLE and permit retry; code/resource failures cannot earn a pass. Safe feedback includes per-question passed/total counts. The recipient-only realtime message is `{submissionId}` after durable completion; HTTP is authoritative and jittered polling repairs lost hints.

Required published assessments in earlier ordered lessons gate later lessons, including direct protected playback and renewal APIs. Optional/archived assessments do not gate. Rollout snapshots preserve established reach while applying requirements to subsequent progression. All subscription/publication/deletion checks still apply.


## PROGRAM preparation and immutable tests (2026-10-02)

Additive migration 20261002010000_m9_program_preparation introduces AssessmentPreparation: UUID id, cascading assessmentId, canonical draft contentHash, private content snapshot, PENDING/RUNNING/READY/FAILED, private result/error category, fenced lease and timestamps. Unique assessmentId/contentHash deduplicates preparation. Indexed due-job discovery repairs queue loss and stale leases; terminal snapshots expire after 180 days. Existing migrations are unchanged.

POST /admin/assessments/:id/prepare requires ADMIN/Origin/CSRF and returns 202 with a durable id/state. Global advisory-locked admission caps outstanding preparations at 32. GET /admin/assessments/:id/preparation returns the current draft's matching private state/tests only to ADMIN. Publishing PROGRAM requires a READY snapshot matching the exact normalized draft hash; otherwise 409 TESTS_NOT_READY. Published content removes reference/generator and freezes controller-validated test records. Student responses strip all private records while retaining input/output descriptions and samples. Changed drafts cannot reuse stale preparation; existing published versions and passes remain valid.

PROGRAM answers use the existing source/draft/submission contracts. Official feedback exposes only question correctness and counts. Each input executes on a fresh isolated page; no code runs in Express. Output checking uses tokens/exact/JSON; maximum 20 cases total, 8192 characters per input/output, 48k-character private preparation result and existing aggregate/launcher bounds. See [guide](m9-input-output-guide.md) for exact comparison semantics and generator format.
