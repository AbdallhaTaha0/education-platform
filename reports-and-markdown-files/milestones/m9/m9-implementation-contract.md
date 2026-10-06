# M9 implementation contract

2026-10-01. The owner explicitly assigned complete direct implementation, superseding the earlier planning-only stop. All original platform and external DRM boundaries remain intact. No deployment or 10,000-user capacity certification is assigned.

Owner-approved first-release rules:

Owner testing follow-up (2026-10-01): ADMIN editor code is private by default; only an explicit `shareStarter: true` choice exposes it as starter code. Existing revisions without that flag also remain private. Student-authored drafts are preserved. Console checks compare printed output (expected `2` matches `console.log(2)`), while function results retain JSON value/type checks. ADMIN browses paginated submission summaries and opens one answer at a time. The owner also required preventing repeat course charges: standalone purchase is refused while finite/indefinite course access remains active, including different plans/request keys or package-derived ownership; exact receipt replay is unchanged and renewal becomes available after expiry. This latest instruction supersedes earlier automatic early-renewal/fixed-deadline-extension purchase behavior. Package overlap policy is unchanged. Historical charges are not automatically refunded or removed.

- HTML/CSS/browser JavaScript/DOM; reusable practice/exercise IDE; coding and multiple-choice quizzes.
- At least one active subscription for standalone practice. Default 50 official Run controls per Cairo day. ADMIN persistent overrides; manual reset starts recurring reset-anchored 24-hour windows. Lowering below usage leaves zero remaining. Accepted code errors count; duplicate/denied requests do not. External libraries/network disabled initially. Browser-local execution is not a restriction on code executed outside platform controls.
- Multiple assessments per lesson, authored independently of media upload; ADMIN explicitly chooses required/optional. All checks/questions must pass; no timers/deadlines. Unlimited intentional retries. Private checks with safe feedback. Earned passes survive later edits.
- Required assessments gate future lesson progression. Preserve previously reached lessons at launch; existing entitlement/publication checks remain mandatory.
- Server-saved drafts; submission history 180 days. Pass/unlock records retained until course deletion. Permanent course deletion cascades assessment code/drafts; financial/audit retention remains unchanged.
- Local isolated preview plus isolated Docker grading workers. Durable Checking receipts, fair bounded queue; execution jobs do not receive platform credentials or network access. One modular Express business application remains authoritative.

Implementation details within this contract: published content revisions are immutable; pending jobs evaluate the accepted revision. Draft revision conflicts return 409 rather than overwrite. A required/optional selection is explicit on authoring. Existing reached-lesson evidence is a platform progress or successful playback reference at migration time; a preserved unlock does not fabricate a pass. Ordering follows existing section/lesson positions. Instructors are not a role. Errors/timeouts do not produce fabricated success; backend capacity failures are separate from incorrect behavior.

Execution-host support and browser interruption are engineering gates, not excuses to weaken isolation. Production checking must fail closed if its required sandbox runtime is unavailable; Docker Desktop evidence is local evidence only. Keep Docker browser, queue, database and capacity evidence distinct. Verify and clean only owned test resources on completion, failure or stop; preserve the port-8080 preview, all existing data and independent DRM.

Implementation and focused verification follow the manager plan's packages. No commit/push until milestone acceptance. Later reports record actual deviations, measured results and remaining release limits.

The owner explicitly approved a grading-only profile based on Docker's default seccomp restrictions with clone/clone3/unshare/setns and then chroot for Chromium's namespace sandbox setup. No added container capabilities, job network, host mounts, writable root or relaxed resource limits. See [Docker runbook](m9-docker-runbook.md). The [schema/API](m9-schema-api.md) specifies immutable versions, durable receipts and retention; [the report](m9-implementation-report.md) records actual execution evidence. The old planning-only restriction is superseded; original architecture remains preserved.


## Owner JavaScript-only follow-up (2026-10-01)

The owner deferred HTML/CSS for now and requested a much larger console in the preview position. The reusable IDE now exposes one JavaScript editor, with a 460px-high scrollable console beside it on desktop and below it on mobile. Run executes JavaScript in the existing opaque sandbox, with empty HTML/CSS; existing saved HTML/CSS fields are retained, not erased. New source defaults to console.log("Hello!"). Clear console does not clear source or reset the practice allowance.

New ADMIN checks offer console output or function results, and new interactions cannot be added. Existing page checks/interactions remain visible with a conversion notice and removal controls; no published checker, historical pass or owner draft is silently rewritten. ADMIN must remove legacy DOM interactions/checks, save and publish a JavaScript revision where appropriate. Server grading retains compatibility with historical immutable revisions. No backend/schema/DRM change is needed for this UI scope.


## Starter reset, syntax colors and formatting (2026-10-02)

Owner-authorized editor additions: coding exercises expose Reset to starter with confirmation/cancel. Reset uses only the student-visible starter from the loaded immutable question revision (blank if ADMIN did not share starter), saves through the existing student draft path, stops local execution and clears local output. No private ADMIN solution is fetched, no submission/history/pass is deleted and no Run allowance is consumed. Standalone practice has no question-starter reset.

JavaScript syntax colors use theme variables for keywords, strings, literals, comments, functions and operators, with distinct light/dark palettes. Remove the old blanket token-ink override; retain the existing editor theme and RTL/LTR behavior.

Format code uses pinned Prettier 3.6.2 standalone with Babel/ESTree bundled in an on-demand browser worker. Formatting never executes source or sends it to an external service, does not reserve Run quota, is bounded to ten seconds, and preserves source on invalid syntax or if the student edits during formatting. Successful formatting is a normal undoable editor change saved through the existing draft mechanism. Formatting is explicitly requested rather than changing code during typing/submission.

Scope is frontend-only; backend, schema, grading policy and DRM remain unchanged. Docker tests and visual evidence are recorded below; no acceptance, deployment or commit/push is implied.


## Typed ADMIN check authoring (2026-10-02)

Owner request: simplify coding quiz/assignment answer and check setup. The existing console/function contract is retained. ADMIN selects explicit text/number/boolean/null values; function expectations/inputs also support recursively built objects and arrays with Add/Remove property/item controls. Check labels now describe printed output versus function return values and give concrete examples. Numeric parsing is finite/type-checked; duplicate or empty object property names and invalid JSON block saving. Deep nesting uses validated JSON and the existing expected-value limit stays intact. Existing values retain their type; no published content or owner data is auto-converted. Console keeps whole-output text matching; objects/arrays and strict types use function-return checks. No backend/API/schema/DRM change is required. [The admin guide](m9-admin-check-authoring-guide.md) gives examples.


## Input/output problem follow-up (2026-10-02)

The owner approved the proposed Codeforces-style JavaScript input/output workflow. New coding questions default to PROGRAM: public bilingual input/output descriptions and samples, a separate private reference solution, and integer-range or isolated custom input generation. Students use readline() and console.log(); local sample input never controls official grading. Save → prepare in restricted execution → review → publish freezes generated cases. The reference must match public samples and give identical output on two executions per input. Every frozen case must pass. Whole-output comparers are whitespace-separated tokens, normalized exact text or strict JSON. Existing CODING/function/console and CHOICE questions remain compatible, with unchanged passes/history/privacy/quota/progression. See [the input/output guide](m9-input-output-guide.md). This authorizes bounded local implementation, not DRM changes, deployment, capacity qualification or milestone acceptance.
