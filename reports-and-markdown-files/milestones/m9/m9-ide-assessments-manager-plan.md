# M9 — reusable JavaScript IDE, assignments and quizzes

**Supersession:** the owner subsequently authorized complete direct implementation and approved [the implementation contract](m9-implementation-contract.md). [The report](m9-implementation-report.md), [schema/API](m9-schema-api.md) and [runbook](m9-docker-runbook.md) govern implemented behavior and evidence. Planning-only language below describes the original request; it is not the current execution restriction. Original system design and external DRM boundaries remain unchanged.

2026-10-01. **Planning only; not approved for implementation.** The owner requested a new milestone, a ready plan, understood use cases, recommendations and clarification before any implementation. This document changes no application, database, Docker runtime or DRM behavior. Prior uncommitted local-refresh work is preserved. Deployment, commercial DRM, recovery/monitoring and capacity qualification remain deferred.

## Confirmed request and inherited constraints

| ID | Confirmed requirement |
| --- | --- |
| M9-R01 | Students can write and execute JavaScript in an in-platform IDE. |
| M9-R02 | The IDE is one reusable React/TypeScript component, usable by a separate IDE page and assignment/quiz pages. |
| M9-R03 | The separate IDE page requires at least one currently active course subscription, including indefinite access. Lock standalone practice once no active entitlement remains. Use existing finite/indefinite/package-derived coverage; no special eligible-course category is introduced. |
| M9-R04 | ADMIN can optionally add assignments and quizzes in the video/lesson authoring workflow. |
| M9-R05 | Students solve and submit exercises from that IDE. |
| M9-R06 | Prepare the milestone and clarify policies; do not implement or dispatch work yet. |
| M9-R07 | Owner clarification: normal browser JavaScript, HTML, CSS and DOM manipulation are required. Provide a web preview; console-only execution is insufficient. This reply answers runtime capabilities, not standalone entitlement or lesson unlocking. |
| M9-R08 | Default standalone practice allowance: **50 Run clicks per student per Cairo calendar day**, normally resetting at midnight Cairo time. An ADMIN reset explicitly starts a fresh 24-hour window for that student. Assignment/quiz solving and submissions are outside this practice allowance. |
| M9-R09 | Clicking Solve on a quiz/assignment opens the shared IDE in that exercise context; submission returns automatic correct/incorrect feedback using ADMIN-defined expected outputs and DOM checks, never source-text/pattern/model-snippet equality. |
| M9-R10 | Students have unlimited retries until they reach the correct answer, for education. No finite grading-attempt cap or ADMIN-configured retry cap may be introduced. Ordinary safety/concurrency controls must not be presented as a finite attempt allowance. Scores, feedback detail, any time policies and post-correct behavior remain pending. |
| M9-R11 | ADMIN can change the practice allowance for a specific student and reset it. Confirmed reset: a fresh **24-hour window from the ADMIN action**, not a refresh that still resets at that night's midnight. The student's custom limit persists until ADMIN changes it or restores default 50. These controls do not grant subscriptions or bypass active-entitlement checks. |
| M9-R12 | After an ADMIN reset, continue resetting in successive **24-hour windows anchored to that reset**, rather than returning to Cairo midnight. Changing/restoring the limit does not implicitly change this schedule. |
| M9-R13 | Quizzes support **both coding and multiple-choice questions**. Coding questions reuse the IDE; multiple-choice questions use answer controls. |
| M9-R14 | The owner accepted the recommendation of a visible **Checking** state and a bounded, fair grading queue while the IDE remains usable. No numeric result-time guarantee or worker count is approved. Design for 10,000 simultaneous IDE users; qualification requires later measured evidence. |
| M9-R15 | **Lock the next lesson until the current lesson's required assessments are passed. ADMIN marks each assessment required or optional.** Optional assessments do not block progression. Enforce prerequisites on the backend; exact quiz pass aggregation, course order and assessment-edit behavior require contracts. |
| M9-R16 | **Preserve lessons existing students have already reached when M9 launches.** Apply the new requirements to progression afterward. This preserves lesson unlocking, not access after subscription expiry or content removal. Define authoritative evidence of a reached lesson and the rollout snapshot before migration; do not fabricate assessment passes. |

Keep exactly STUDENT/ADMIN, Arabic-primary bilingual content, the existing FAYQ visual specification, cookie/session/CSRF security and one modular Express/TypeScript backend with PostgreSQL/Prisma. External DRM still owns video processing/security/watermarks. Assignments belong to platform learning content, not the DRM package. No DRM edit or new platform execution API/service is implicitly authorized.

## Existing integration points verified by source inspection

- `client/src/features/catalog/pages/LessonEditor.tsx` already composes lesson editing and `MediaUploader`; assessment authoring can be an additional lesson action rather than a replacement upload protocol.
- `client/src/features/learning/pages/CourseLearningPage.tsx` already hosts protected outline/player/progress; it can show published assessment links for the selected lesson.
- `server/src/modules/learning/access/service.ts` and `access/entitlement.ts` provide course/lesson binding, publication checks and finite/indefinite entitlement. New endpoints must reuse this authority, including package-derived access, rather than invent a second subscription system.
- `server/src/modules/learning/routes/index.ts` demonstrates existing cookie/session, Origin, CSRF and student-write patterns. STUDENT ownership and ADMIN review still need explicit checks on every new resource.
- Prisma has `User`, `Course`, `CourseSection`, `Lesson`, `Subscription`, progress and audit models, but no exercise, question, coding draft, submission or grade model. Only additive migrations will be considered after contracts are approved.

## Proposed user experience

**Standalone practice page:** student with at least one active course entitlement opens Practice IDE, sees the current allowance/remaining Runs and actual next-reset time, edits HTML/CSS/JavaScript, runs it, interacts with the resulting DOM in a live preview, reads console output/errors and resets the workspace. Default allowance is 50; a custom student limit persists until changed/restored. Standard reset is Cairo midnight; an ADMIN reset instead begins a fresh 24-hour window, so the UI must show its real ending time rather than always promising midnight. Run clicks consume the allowance; page openings and editing are not the quota unit. Once exhausted, further counted Runs are refused until reset or an authorized ADMIN action. Recommend preserving editing/saving and drafts. Failure/reservation details remain pending. Persistence across visits/devices is pending. There is no assessment submission or official score in free practice.

**Lesson assignment page:** student selects Solve on an available lesson exercise; the shared IDE opens with that exercise's instructions/starter files. The student runs a preview, then submits the source documents. The platform evaluates ADMIN-defined output/DOM checks and displays correct/incorrect. Incorrect work can be edited and submitted again without an attempt-count limit until correct. The containing page owns entitlement, draft persistence, submission and result display; the reusable editor does not infer those policies. Exercise work is outside the daily standalone practice allowance. Runtime/concurrency safety controls remain separate from educational retry counts.

**Quiz page:** quizzes support both coding and multiple-choice. Selecting Solve on a coding question opens the same IDE with that question and attempt context; Submit triggers automatic checking and correct/incorrect feedback. The containing page supplies questions and attempt state. Multiple-choice uses separate answer controls and authoritative server-side checking without a browser execution job. A mixed quiz can compose both presentations. Timers, numerical scoring, partial success, visible/hidden checks and whole-quiz submission rules remain undecided.

**Lesson progression:** ADMIN marks assessments required or optional; only required assessments block the next lesson. Completing their approved pass conditions unlocks progression; queued or incorrect work does not count as passed. Preserve already reached lessons for existing students at rollout and apply the new requirements afterward. Existing subscription and publication requirements still apply. An unlocked lesson never grants a subscription, and client video-progress events cannot forge an assessment pass. The [architecture review](m9-architecture-and-capacity-review.md) records prerequisite enforcement, the rollout snapshot and unresolved content-edit contracts.

**ADMIN authoring:** optional Assignments and Quizzes actions beside video/lesson authoring. ADMIN creates translated instructions/questions, defines the approved correctness checks, marks each assessment required or optional, configures approved policies, previews the student experience and publishes the assessment. The initial required/optional default is not inferred. Recommend allowing authoring before/during/after video upload; this is pending clarification. Saving an exercise must not restart video processing, register a new DRM asset or require a video re-upload.

**ADMIN review:** browse owned-platform submissions by course/lesson/assessment/student, inspect submitted source as inert text, and provide feedback/grades if manual review is approved. Never evaluate submitted code in the ADMIN page's authenticated context.

**ADMIN practice controls:** on a specific student's management screen, show default/effective allowance, used/remaining counts, actual next reset and any override. ADMIN can set a persistent custom allowance, restore default 50, and invoke Reset to start a fresh 24-hour window with the effective allowance available. Audit changes/resets without erasing execution history. A quota change/reset never activates an expired subscription, credits a wallet, changes exercise attempts or discards drafts. Restoring the limit is not assumed to reset usage/time as well; that additional action needs an explicit contract.

## Understood use cases

| ID | Actor and trigger | Expected result | Confirmation still needed |
| --- | --- | --- | --- |
| UC01 | ADMIN creates/edits a lesson and chooses Add assignment | A lesson-linked coding exercise is authored without changing the media lifecycle | Attachment timing, multiplicity and publishing policy |
| UC02 | ADMIN chooses Add quiz | Coding and multiple-choice questions and approved grade settings are authored | Mixed-quiz aggregation and question/quiz submission rules |
| UC03 | ADMIN previews an exercise | Preview reuses the same IDE and question presentation | Whether ADMIN may execute preview code |
| UC04 | Entitled STUDENT opens a lesson assignment | Instructions/starter code appear with shared IDE | Required prerequisites and availability |
| UC05 | STUDENT presses Run | HTML/CSS/JS execute in a protected live preview; DOM interactions and console/errors are visible | Network/import capabilities and safe run controls |
| UC06 | STUDENT stops endless code or resets | Run is terminated; reset is explicit and does not silently lose a draft | Limits and reset confirmation UX |
| UC07 | STUDENT solves a coding quiz question | The same IDE is instantiated with that question's context | Multiple questions, timers, navigation and autosave |
| UC08 | STUDENT submits | Server validates identity/access/version, records the submission once, triggers output/DOM checks and returns correct/incorrect; unlimited incorrect-answer retries | Deadline/finality, detailed check rules and latency target |
| UC09 | STUDENT opens standalone IDE | At least one active course subscription required; default 50 or persistent per-student override and actual next reset shown | Practice persistence and quota reservation details |
| UC10 | STUDENT returns to unfinished work | Last saved draft can be restored if saving is approved | Cross-device storage and retention |
| UC11 | STUDENT views a result | Correct/incorrect follows trusted checks; incorrect work can be edited/retried indefinitely; infrastructure failure is reported separately | Feedback detail, score scale, history after expiry and post-correct behavior |
| UC12 | ADMIN reviews a submission | Submitted code/version stay unchanged; authorized feedback is recorded | Manual/automatic/hybrid review and grade edits |
| UC13 | Entitlement expires while editor is open | Backend rejects disallowed saves/submissions; unsaved code is not silently discarded | Read-only history/export and standalone behavior |
| UC14 | ADMIN edits a published assessment | Existing submissions retain the exact question/version answered | Treatment of drafts and already-started attempts |
| UC15 | A request is retried or submitted concurrently | One logical submission; no forged score or cross-student data access | Per-attempt finality rules |
| UC16 | ADMIN archives/deletes a lesson/course | Assessment access follows the approved lifecycle; no accidental new financial/DRM behavior | Submission/grade retention and cascade policy |
| UC17 | STUDENT reaches the daily standalone quota | Further practice Runs are refused consistently across tabs/devices until reset; exercise solving remains exempt and drafts are not discarded | Reservation/failure-counting and manual-reset semantics |
| UC18 | STUDENT repeatedly answers an exercise incorrectly | Each intentional new submission is checked without a lifetime retry cap; correcting the solution can eventually pass | Feedback visibility, safe submission pacing and post-correct behavior |
| UC19 | ADMIN changes a specific student's daily allowance | Only that student's effective allowance changes, persisting until changed/restored; other students' quotas remain unchanged | Allowed bounds and lowering below existing usage |
| UC20 | ADMIN resets a specific student's practice allowance | Effective allowance is refreshed; recurring 24-hour windows are anchored to that action, with no intervening midnight reset; durable/auditable across devices | Concurrent reservations and reset/default-limit contracts |
| UC21 | STUDENT tries the next lesson before passing required assessments | UI explains the prerequisite; direct API access cannot bypass it; optional assessments do not block | Ordering, quiz aggregation and edited assessment policy |
| UC22 | STUDENT passes the prerequisite assessments | The next lesson becomes accessible if its existing entitlement/publication checks also pass | Pass-version persistence and content changes |
| UC23 | Many students submit together | Accepted work has durable receipts, fair bounded checking and retrievable results; IDE editing remains available | Measured execution cost, admission limits and numeric service objectives |
| UC24 | ADMIN chooses required or optional | Only required assessments contribute to lesson prerequisites; optional exercises retain ordinary solving/submission behavior | Initial selection and required/optional edits after publication |
| UC25 | Existing STUDENT returns after M9 rollout | Already reached lessons remain unlocked; future progression applies the new required-assessment rules; entitlement/publication still enforced | Authoritative reached-lesson definition and rollout snapshot |

Examples for validation after approval: a lesson asks for a `sum(a, b)` function; a student tries visible examples in the IDE and submits the function. Another exercise asks for an HTML button, CSS styling and a JavaScript click counter: the student interacts with the actual preview and submits all three source documents. A coding quiz can ask for array filtering using the same component. A subscriber can open the standalone page to practice loops or DOM events without creating a course submission. These examples illustrate the feature; they are not new curriculum or scoring policies.

## Component and backend responsibilities

Proposed frontend organization, names subject to contract review:

- `client/src/features/ide/`: reusable `WebIDE`, HTML/CSS/JavaScript editor tabs, isolated live preview, editor adapter, console/output rendering, execution adapter, run state and accessibility/localization. Editor code remains LTR inside an Arabic RTL surrounding page. Lazy-load on IDE/exercise routes; do not load a full editor for every landing/video visit.
- `client/src/features/assessments/`: lesson assessment lists, instructions/questions, draft/attempt/submission state, results and ADMIN authoring/review wrappers.
- Shared IDE inputs: HTML/CSS/JavaScript source documents, change callbacks, starter files, read-only state, runtime capabilities, preview/output/run controls and contextual action slots. No wallet, subscription, routing or grading policy inside the generic component.
- The standalone page, assignment page, quiz coding question and ADMIN preview provide separate context/controllers while reusing the same component and runtime contract.
- `server/src/modules/assessments/`: internal Express module for authoring, versioned student delivery, drafts/attempts/submissions and approved grading. Reuse learning entitlement/role/session/audit primitives; database access stays through platform Prisma.
- Proposed API groups: ADMIN author/list/version/publish/review and per-student practice allowance/reset; STUDENT entitled list/detail/draft/attempt/submit/result and practice eligibility/usage. Route names and schemas are not finalized. A browser Run action must not send executable code into the existing Express process.

## Execution and grading recommendations — pending owner approval

The owner confirmed **HTML/CSS/browser JavaScript with DOM manipulation** and **automatic correct/incorrect feedback after submission**. Recommend three editor tabs, a real isolated web preview, a console and self-hosted editor dependencies. Earlier console-only and manual-review-first recommendations are superseded. Manual ADMIN feedback can be an optional future supplement, not a substitute for automatic checking. Candidate editor: CodeMirror 6 because its extension model fits a reusable wrapper; confirm preferred editor and evaluate accessibility/Arabic/mobile integration before choosing a dependency. Monaco remains an alternative if fuller IDE facilities are required. No package installed now. [CodeMirror system guide](https://codemirror.net/docs/guide/).

The real DOM preview must execute in a sandboxed context isolated from the authenticated application, with narrowly validated messages, run IDs, bounded source/output and fresh state per run. A Worker cannot directly manipulate the DOM, so it cannot be the sole runtime for this approved scope. Workers may support an optional console-only execution mode, but do not promise worker termination will stop code running in the preview DOM. The feasibility package must prove the chosen origin/process design can keep editor/Stop controls responsive under infinite-loop and memory-pressure cases; a same-process iframe does not automatically provide this guarantee.

Do not execute in the React window or give student code cookies, platform API clients, private data or unrestricted network/storage. A Worker alone is not a security boundary: workers can fetch and use storage. Review the preview/runner's own CSP and origin, not just the parent page. Do not combine scripts and same-origin privileges in a same-origin frame. Test browser compatibility for the chosen sandbox/runtime combination before fixing its hosting contract. A separate static sandbox origin or a proven opaque-origin frame is an architectural proposal, not an approved additional service. [MDN worker documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [MDN iframe sandbox guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe).

Browser timeout/output controls improve responsiveness but do not provide a hard per-student memory quota. Deliberate memory exhaustion and log/message flooding need acceptance cases; do not claim a timeout makes arbitrary code perfectly safe.

Visible practice tests and console output are **untrusted student-controlled feedback**. They cannot establish authoritative correctness. Automatic submission checking is now a required feature, so its isolated execution design is a prerequisite rather than an optional last package. Proposed design: the existing Express application authorizes/persists the submission and dispatches an immutable job; a separately isolated execution worker checks it and returns a bound result. HTML/CSS/DOM checks require a real browser environment. This worker is an execution boundary, not a second business backend, but its concrete Docker/isolation/queue arrangement still needs architectural review and approval before implementation.

Keep untrusted execution outside Express, with no secrets/database/DRM access, no host Docker socket, network denial, resource/process limits, controlled result channels and Redis-backed abuse/concurrency controls. The trusted job supervisor can obtain narrowly scoped inputs/results; executed student code must not inherit supervisor credentials. Results must be bound to student/submission/content/test version and cannot be supplied or marked correct by the client or its preview. A container alone is not the complete hostile-code isolation design. Review isolation/operating costs before implementation; do not silently change the owner's architecture. Node explicitly states that `node:vm` is not a security mechanism. [Node VM documentation](https://nodejs.org/api/vm.html).

The owner approved ADMIN-defined expected outputs and DOM checks, explicitly rejecting source-text/pattern/model-snippet comparison. Use behavior-based tests: function outputs for JavaScript; element presence, event interactions and resulting DOM state for web exercises. Two differently written valid solutions must both pass. Selected computed-style assertions for objective CSS requirements are a proposed extension to this contract, not a confirmed full visual grader. Subjective visual design cannot be inferred as a universal correct/incorrect rule.

Submit should show Checking while work runs, then Correct or Incorrect with approved feedback. The owner accepted this UX and a bounded, fair queue while the IDE remains usable. Queue/provider failure must show a retryable service error rather than Incorrect. The numeric response-time target, queue limits and whether per-question/all-tests passing means correct remain pending. Retries are unlimited until correct; this means no finite educational attempt cap, not unbounded simultaneous execution. Repeating the same network request creates no duplicate submission/job, while an intentional edited/new submission is a new immutable attempt. Exercise runs/submissions never consume the standalone quota. Read the [architecture and capacity review](m9-architecture-and-capacity-review.md) before selecting infrastructure or freezing these contracts.

## Daily practice quota — 50/day, per-student controls

The owner approved **50 Run clicks per student per day**, normally resetting at midnight in `Africa/Cairo`, with assignment/quiz work outside this allowance. Standard daily reset uses the actual Cairo calendar-day boundary, not a fixed UTC offset. Multiple course subscriptions do not imply multiple quotas. ADMIN can override the allowance for a specific student and reset it. No global ADMIN default-limit editor is requested; 50 remains the baseline unless the owner later assigns that feature.

**Confirmed manual-reset exception:** restore the effective allowance immediately and begin a new 24-hour window from backend-recorded reset time. Continue resetting every 24 hours from that anchor, as the owner subsequently confirmed; do not return to Cairo midnight or grant another allowance at an intervening midnight. **Confirmed override lifetime:** persist until ADMIN changes it or restores default 50; it does not expire at midnight. No return-to-calendar control has been requested. Decide allowed override bounds (including whether zero means block practice), and lowering below already-consumed usage; recommend remaining=max(0, effective limit minus counted usage) without deleting usage records.

Decide reservation timing, whether accepted syntax/runtime failures count, how pre-execution service failures are refunded, and in-progress behavior across reset. Recommended distinction: an accepted intentional practice Run consumes one count even if the student's code fails; denied/duplicate requests and service failures before execution do not consume another count. This detailed counting policy awaits approval.

Enforce counted platform actions using backend authority and atomic reservations shared across replicas/tabs/devices; do not use localStorage as the quota counter. Preserve durable usage across service/cache restarts if the intended limit requires it. An ordinary browser-only preview cannot make a local Run quota tamper-proof: students control their browser and can execute copied code elsewhere. Decide whether limiting the official platform controls is sufficient or whether all counted execution must be service-mediated. This distinction changes operating cost and runtime architecture and must be agreed before implementation.

ADMIN override/reset actions require existing ADMIN/session/Origin/CSRF checks, scoped idempotency and durable audit. Define a quota version/reset epoch so an in-flight Run reservation cannot race a reset/change into double counting or silently gain a second allowance. Keep historical execution facts; do not reset by deleting attempt/submission or usage/audit records. No quota action bypasses the required active course entitlement. Concrete transaction and Redis responsibilities remain for the contract package.

Multiple-choice is confirmed: correct answers/scoring rules stay server-side and ordinary answer scoring can be authoritative without executing student JavaScript. This does not solve secure grading of coding questions.

## Tentative conceptual data model

No Prisma/schema/SQL change is made by this plan. Final tables depend on answers and existing retention/deletion policies.

| Concept | Purpose |
| --- | --- |
| Assessment | Lesson/course ownership, assignment/quiz kind, lifecycle and author |
| AssessmentVersion | Immutable published content/policy version; translated instructions, starter code and required/optional status |
| Question / QuestionVersion | Confirmed coding and multiple-choice formats; mixed-quiz aggregation remains pending; private answers/tests never enter student delivery |
| CodingDraft | Student/context/question/version-bound HTML/CSS/JS source documents and revision for optimistic concurrency, if server autosave is approved |
| AssessmentAttempt | Version, student, backend start/submission times and state; unlimited intentional exercise resubmissions with immutable attempt history |
| SubmissionAnswer | Immutable submitted HTML/CSS/JS source snapshot or approved answer format associated with the attempt/question |
| AssessmentReview | ADMIN feedback/grade/review history, if manual or hybrid grading is approved |
| PlaygroundWorkspace | Optional saved free-practice workspace, separate from graded submissions |
| PracticeUsage / Reservation | Student/day-bucket consumption and idempotent counted actions, once quota policy and durability are approved |
| PracticeQuotaOverride / Adjustment | Persistent student-specific allowance, actual window start/end and schedule mode, plus ADMIN reset/change history and quota revision for concurrent reservations |
| GradingJob / Result | Submission/version-bound execution state and trusted correct/incorrect outcome, with failure categories separate from incorrect answers |
| AssessmentPass / LessonPrerequisite | Version-bound trusted pass facts and approved course progression requirements; cannot be derived from client progress alone |
| PreservedLessonUnlock | Student/lesson rollout exemption from the new prerequisite gate, based on approved reached-lesson evidence; not a fabricated grade or subscription |

Server supplies ownership, timestamps and scores; clients cannot select another student or claim a grade. Submission uses scoped idempotency and a transaction, then returns a durable receipt. Content/policy version and source snapshot are retained rather than mutating the question under a submitted answer. Unique constraints, limits, indexes, expiry races and delete/retention behavior must be specified in the contract. Never couple these models to external DRM tables.

## Decisions requested before dependent work

| ID | Question | Recommendation, not approved policy |
| --- | --- | --- |
| M9-D01 | **Core runtime CONFIRMED:** HTML, CSS, normal browser JavaScript and DOM. Are external libraries/imports/network requests allowed? | Three source tabs plus live preview and console; recommend no arbitrary network/package access initially. Node/npm has not been requested. |
| M9-D02 | **Coding plus multiple-choice CONFIRMED.** Per-question versus whole-quiz submission and aggregation remain open. | Separate answer controls from IDE questions; score multiple-choice on the server without browser jobs. No other question type inferred. |
| M9-D03 | **Automatic correct/incorrect using ADMIN-defined expected outputs and DOM checks CONFIRMED.** Visible/hidden checks, all-tests/partial success, scoring and feedback detail remain open. | No source/pattern/snippet matching or client-certified success. Review isolated grading design before implementation. |
| M9-D04 | **At least one currently active course subscription CONFIRMED**, including indefinite access; lock practice when none remain. | Reuse existing entitlement including package-derived coverage; no special course category or entitlement bypass through quota actions. |
| M9-D05 | **ADMIN-selected required/optional assessments and preservation of already reached lessons CONFIRMED.** Quiz pass aggregation, course ordering, reached-lesson evidence, rollout snapshot and content-edit behavior still need contracts. | Enforce required prerequisites on direct access; optional work does not block. Preserve existing reached lessons through a durable rollout unlock record, not synthetic passing grades; entitlement/publication still apply. |
| M9-D06 | **Unlimited exercise retries until correct CONFIRMED.** Deadlines/timed quizzes, version changes and post-correct submission behavior remain open. | No finite retry count or ADMIN attempt-cap setting. Draft/submission/history states explicit; do not assume timers or a numeric passing grade. |
| M9-D07 | Save drafts/free practice across visits/devices? Retain submissions/results after expiry/deletion for how long? | Server autosave with visible status/conflict handling if approved; retention requires owner choice |
| M9-D08 | One or several assessments per lesson? Lesson-only or course/section assessments? Author before/after upload? | Several optional lesson-linked assessments; editable outside upload timing |
| M9-D09 | Preferred editor/UI examples; code downloads, files, hints/model solutions, grading notifications? | Shared FAYQ tokens, LTR editor, visible console; keep extras outside the first scope unless selected |
| M9-D10 | **50 Run clicks/day, normal Cairo-midnight reset and exercise exemption CONFIRMED.** Failed-run/service-failure counting and durable reservation details remain open. | Shared per-student quota across tabs/devices; recommend consume accepted intentional Runs, not denied/duplicate/service-failed-before-execution requests. |
| M9-D11 | **ADMIN reset starts recurring, reset-anchored 24-hour windows; per-student override persists until changed/restored CONFIRMED.** Allowed bounds, lower-limit behavior and restore-default effects remain open. | Avoid an intervening midnight grant; recommend clamp remaining to zero if lowered below usage. Do not combine restoring default with a time/usage reset without an explicit rule. |
| M9-D12 | **Fair queue and Checking UX CONFIRMED; 10,000 concurrent IDE users required.** Numeric wait targets, runtime isolation and resource budget remain unqualified. | Client-side interactive previews plus trusted queued submission checking; independently scalable execution capacity. Architecture is a proposal, not measured capacity or paid provisioning approval. |

Owner answers must be recorded as confirmed decisions with date, affected documents and acceptance cases. A recommendation or this draft is not authorization. Do not freeze schema or issue an implementation prompt while its dependent policy remains unanswered.

## Proposed small work packages

| Package | Deliverable after explicit implementation authorization | Gate |
| --- | --- | --- |
| M9-00 | Resolve remaining decisions; finalize preview/grader/quota architecture, data/API/state contracts and UI flow | Owner-approved dependent policies and concrete execution boundary |
| M9-01 | Bounded HTML/CSS/JS preview/editor and trusted-grader feasibility prototypes in isolated Docker | Real DOM checking; malicious/looping-code isolation; responsive editor; bound trusted results; no application credentials in execution |
| M9-02 | Approved isolated automatic checking foundation and result contracts | Wrong/right solutions and DOM assertions; result forgery denied; service failure distinct from incorrect |
| M9-03 | Reusable IDE, active-entitlement standalone wrapper, 50/day quota and ADMIN per-student override/reset | Shared component; approved atomic reservations and adjustment/reset semantics; cross-tab/device handling; chosen save behavior |
| M9-04 | Additive assessment/version persistence and ADMIN authoring/tests/preview | Translated publish validation, private checks, role/privacy, existing media lifecycle preserved |
| M9-05 | Entitled student drafts/attempts, idempotent submissions and assessment prerequisite authority connected to checking | Expiry/deadline/progression decisions, immutable source/test versions, one authoritative result/pass per logical submission; no direct lesson bypass |
| M9-06 | Solve-in-IDE lesson/quiz wrappers and automatic right/wrong result UX | Same IDE reused; safe feedback; Checking/error states; approved resubmission and history |
| M9-07 | Focused end-to-end security/functional review, upgrade preservation, acceptance report | Actual evidence, no open blocking findings in approved scope, owner acceptance |

Automatic checking and daily practice limits are now in scope; their implementation remains blocked only by the dependent policy/isolation decisions, not a missing feature request. Schemas remain contingent on M9-00. Each worker gets one bounded prompt and stops for manager review. No worker is dispatched by this document.

## Verification plan for future implementation

- Run actual code in a real Docker-driven browser: normal output, thrown/syntax errors, Stop, endless loops, async work, reset, late messages, excessive output and malicious result messages. Check network/storage/parent/API access denial and independent run state; do not replace execution with a mock while claiming security.
- Reuse proof: the same editor/runner is used by standalone practice, assignment, quiz and approved ADMIN preview, with distinct drafts and no duplicated execution logic.
- Access cases: anonymous, unsubscribed, wrong course/student, expired finite access, indefinite access, package coverage, presale, unpublished/archived/deleting content, stale tab and revoked session.
- Persistence cases: exactly-once retried submission, concurrent attempt policy, stale assessment/draft revisions, immutable submitted source, deadline at backend time, review privacy, client-forged score, backend failure without false success.
- Quota cases after policy approval: final permitted action, first denied action, simultaneous tabs/devices/replicas, repeated reservation request, failed execution counting, cache restart and reset boundary; confirm exercise quota separation and do not silently lose drafts.
- Confirm standard midnight reset by Cairo calendar day (including timezone transitions), no extra allowance from multiple purchases, zero standalone usage consumption for exercises, and unlimited intentional exercise retries. Different valid implementations must pass identical behavior checks; do not introduce source-pattern requirements or a hidden finite retry ceiling.
- ADMIN allowance cases: defaults at 50; only the selected student changes; student/anonymous callers refused; persistent overrides and restoring default; recurring reset-anchored 24-hour windows cross midnight without extra grants; exact window ends and lowered-limit semantics; idempotent reset; reset/change racing simultaneous Runs; history/audit retained; expired entitlement remains denied after quota reset.
- Progression cases: trusted pass unlocks only eligible lessons; required/optional selection is authoritative and optional work never blocks; incorrect/queued/forged results cannot satisfy required checks; direct playback, renewal, outline and exercise requests apply the approved prerequisites. Rollout preserves existing reached lessons without invented grades or bypassing expiry/publication; future progression, content edits/reordering and deletion follow the reviewed transition contract.
- Trusted checking cases: different valid solutions both pass, genuinely wrong JS/DOM behavior fails, client-forged success cannot pass, no private-test/API credential leakage, retry/crash produces one logical result, service timeouts differ from wrong answers, and exact source/assessment/test version is checked.
- ADMIN cases: author without altering upload; bilingual content required; preview/publish/version edits; private solution/test material excluded from student API/bundles/logs; inert safe code rendering.
- UX cases: Arabic/English, dark/light, desktop/mobile, LTR code, keyboard editor/console controls, screen-reader labels, draft/submit error recovery and video/player behavior unchanged.
- Use additive migrations and a populated upgrade drill once schema is approved. Run targeted tests first and broader existing learning/identity/catalog regressions where changes justify them; no repetitive full-suite runs without a new change/failure.
- Preserve the port-8080 owner preview and real media. Use named disposable Docker projects, verify mounts/labels, and remove all owned test fixtures/containers/networks/volumes after success, failure or stop. Keep sanitized evidence. No global prune or production deployment.

## Milestone exit and next step

M9 is accepted only when the approved web runtime, eligible daily-limited standalone page, ADMIN authoring/checks, coding/multiple-choice quizzes, Solve-in-IDE submissions, trusted automatic right/wrong results and assessment-gated next-lesson access are implemented and verified; security, prerequisites, quotas and expiry cannot be replaced by frontend visibility. Deployment and 10,000-user qualification remain separate deferred work. Commit/push follows explicit owner acceptance under the standing instruction.

**Next step now:** receive the owner's answers, revise this draft and prepare the first short contracts/feasibility prompt for review. Do not install editor packages, create migrations, start execution services, modify DRM, restart Docker or implement the IDE before authorization.
