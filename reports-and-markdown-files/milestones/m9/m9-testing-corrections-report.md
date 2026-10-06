# M9 owner-testing corrections

2026-10-01. Direct implementation and same-agent verification of the owner's four reported issues. No milestone acceptance, commit/push, deployment or capacity qualification is inferred. Existing uncommitted M9 work is preserved; independent DRM and original design files are unchanged.

## Corrections

1. **ADMIN code privacy:** the admin editor now clearly identifies private code/preview. `shareStarter` defaults false, including historical revisions without a flag. Student APIs return empty HTML/CSS/JavaScript unless ADMIN deliberately checks the labelled starter-sharing option. Private tests and choice answers remain withheld. Student-authored saved drafts are preserved, rather than erased. Code in the admin preview alone does not define a correct answer.
2. **No duplicate course charge:** standalone purchases lock the student's wallet and re-check both idempotency and active ownership before debiting. A new key/another plan for an already active course returns 409 `COURSE_ALREADY_SUBSCRIBED`, including package-derived/indefinite access. Exact-key receipt replay is unchanged; after expiry a new purchase starts immediately. UI purchase review also refuses payment confirmation for owned courses. The latest owner instruction supersedes automatic active-access early renewal; explicitly approved package-overlap policy is unchanged. Historical purchases/ledger entries are retained without automatic refunds.
3. **Expected console output:** console messages are printed text. Numeric legacy expected values are converted to their printed form by the isolated execution host. Console expected `2` accepts `console.log(2)` and rejects wrong/additional output. Function checks retain strict JSON value/type comparison. Authoring defaults to Console output, treats text-based expected values as text, and explains entering the output rather than code. ADMIN must publish a saved revision for its checks to become effective.
4. **Bounded submission review:** ADMIN receives ten summaries/page (maximum API size 25), with student identity, timestamp, state and revision. Answers/results are absent from list payloads. Opening one selected answer fetches a separate assessment-bound ADMIN endpoint; details have bounded scroll height and escaped text. Previous/Next pages replace rows rather than append a long component list. A composite assessment/time/id index supports stable keyset pagination, including equal timestamps.

## Files and schema

- `server/src/modules/assessments/contracts.ts`, `routes.ts`: private source flag, summary/detail API and pagination validation.
- `server/execution/src/index.ts`: printed-output comparison; sandbox settings unchanged.
- `server/src/modules/wallet/purchase/service.ts`: wallet-serialized ownership protection.
- `client/src/features/assessments/AdminAssessmentPanel.tsx`, new `AdminSubmissionReview.tsx`, purchase page: clear authoring and bounded review/payment UI.
- Additive `20261001230000_m9_submission_browse` and matching Prisma index. Existing migration checksums are unchanged; no row backfill/deletion.
- Regression cases in M9 contracts/review, wallet purchase and academic integration tests; actual execution proof and Chromium flow extended. Previously shared academic fixtures now explicitly expire only their synthetic grants when a test needs a fresh purchase; overspending races use different courses and duplicate-ownership races use different plans for the same course.

## Docker evidence

`node docker/ide/verify.mjs --build`: **184/184 backend unit, 293/293 integration, 83/83 frontend unit, two DASH compatibility checks; both backend typechecks and frontend typecheck pass.** Disposable PostgreSQL/Redis are real. New cases cover privacy/default/opt-in, ten/ten/three stable pages, bounded/invalid cursors, selected detail ownership, concurrency with different keys/plans, one debit, expiry renewal and exact replay.

`node docker/ide/execution-proof.mjs`: **10/10** real isolated Chromium cases pass, including printed numeric output, wrong/extra output, strict function types, browser sandbox, no-network behavior, tampering and infinite source interruption. Every owned execution container is removed.

`node docker/ide/ui-review.mjs`: **46/46 Chromium flow assertions pass**, including private ADMIN answer authoring, a blank fresh student editor/API, expected-output `2` → actual isolated CORRECT result, compact ten-row summaries, one selected answer, actual row-id replacement on Next and exact restoration on Previous, mobile width, UI purchase refusal and API refusal with another key. The browser CLI also verifies page/navigation/error state and screenshots. Test containers/networks/volumes are confirmed zero after both failed and successful runs.

`node docker/ide/preview.mjs upgrade`: **exit 0**, protected backup `preview-before-m9-1790885975596.dump`, existing user/wallet/purchase/subscription/catalog/media fingerprints unchanged and preserved reach unchanged. Additive browse migration applied; corrected platform/client/controller images serve port 8080. A transient Docker browser independently confirms the retained page/navigation, no page errors and readiness HTTP 200 after upgrade. Real video data and DRM are unchanged.

Current rebuilt image identities (short Docker image IDs): server `de66a396d866`, client `bec75f5804d0`, migrate `5accab76cc55`, controller `72a047523fe6`, execution `a27185306b3f`. Images retain local 0.9 tags; no production release attestation is implied. Evidence is saved in ignored `docker/browser/evidence/m9/`; no credentials, cookie bodies, assertions or private owner content are included in this report.

## Findings during verification

- The first backend run rejected old paid early-renewal expectations and shared already-owned academic fixtures; tests were updated to the explicit new owner policy without weakening financial checks.
- The overlapping-access fixture previously relied on early renewal to extend a 90-day grant past a fixed package deadline. It now explicitly creates a genuinely longer 730-day synthetic offer, preserving that independent overlap assertion.
- Frontend build caught unsupported `Array.at` under the client's existing target. Replaced with indexed access; no target/library changes.
- Initial browser submission-paging waits timed out even though the subsequent DOM diagnostic showed the expected Page 2 and ten rows, and the API returned 200. The test used default animation-frame polling and a selector that disappeared during loading. The final test brings the page forward, uses guarded explicit-interval polling, verifies new row IDs rather than only a page label, and verifies exact previous-page IDs; all 46 checks pass. This fixes the test's observation path without weakening pagination evidence. Failed transcripts/screenshots are preserved separately.

## Subsequent interaction-editor follow-up

The owner reported that the answer still failed and asked what interactions mean and for a remove control. Read-only inspection of the actual `test` quiz showed a published console check expecting literal `"2"` (including quotation marks) and a required click, while the submitted code was `console.log(2)` and HTML was empty. Both conditions correctly prevent passing. Later owner edits changed the expectation to plain `2` but added two interactions. A guarded attempted correction refused the changed revision before writing anything; the owner's concurrent edits and all historical submissions were preserved.

Each interaction now has a bilingual **Remove interaction** button, removing only that step and preserving the remaining controlled inputs. Authoring explains that interactions are optional actions before a check: clicking `#button` or typing into `#field` before asserting a result. A console-only exercise needs no interaction. A visible warning explains that quotation marks in a console expected-output field are literal; function-result JSON behavior remains unchanged. No checker rules were weakened, no failed history was rewritten, and no automatic pass was created.

For the owner's console-only test: remove its interactions, enter plain `2`, save/publish, then reload the student's assessment and resubmit. Editing a draft alone does not change the published checker; students submit an immutable revision. Own saved source remains intact.

Fresh Docker evidence: client production build/typecheck succeeds; full browser flow **49/49**, including quotation warning, removing the first of two steps without losing the second's selector, removing all steps, save/publish and actual correct grading. Real sandbox proof **11/11** includes rejection of the owner's original quoted-output and missing-click configurations, and acceptance of plain-output checks. Both disposable test projects and all owned execution containers are cleaned. Only the client/Nginx are refreshed on the retained preview; no backend, schema, DRM or owner-quiz mutation was performed in this follow-up. The guarded correction's refusal occurred before any save or publication.

## Preservation and rollback

Test wrappers validate project labels/mounts and remove only owned containers, networks, volumes and fixtures on success/failure. Owner preview remains port 8080 on its retained volumes; real video/DRM remain independent. Rebuilding images is not production deployment. Retained-preview upgrade takes an ignored protected database backup, verifies pre/post users/wallets/purchases/subscriptions/catalog/media fingerprints and preserved reach, applies only the additive index, then reloads platform/grading and Nginx.

Rollback: restore prior platform/client/controller/execution images using the same retained volumes. Leave the additive index/migrations and histories intact. Restore UI/source deliberately from a saved diff if needed; do not reset the owner's complete uncommitted M9 tree. No automatic database restore, ledger rewrite, volume prune or DRM rollback is performed.


## Owner JavaScript-only follow-up (2026-10-01)

The owner deferred HTML/CSS for now and requested a much larger console in the preview position. The reusable IDE now exposes one JavaScript editor, with a 460px-high scrollable console beside it on desktop and below it on mobile. Run executes JavaScript in the existing opaque sandbox, with empty HTML/CSS; existing saved HTML/CSS fields are retained, not erased. New source defaults to console.log("Hello!"). Clear console does not clear source or reset the practice allowance.

New ADMIN checks offer console output or function results, and new interactions cannot be added. Existing page checks/interactions remain visible with a conversion notice and removal controls; no published checker, historical pass or owner draft is silently rewritten. ADMIN must remove legacy DOM interactions/checks, save and publish a JavaScript revision where appropriate. Server grading retains compatibility with historical immutable revisions. No backend/schema/DRM change is needed for this UI scope.

Fresh JavaScript-only verification: client production build/typecheck passes; isolated Docker browser/queue flow **51/51** passes, including JavaScript output, enlarged console position/height, Clear console preserving source, mobile fit, opaque execution security, new console/function-only authoring and actual coding/multiple-choice grading. The initial Run observation timed out because the taller editor scrolled the target under the fixed header; the harness now centers the control before a real browser click and uses explicit interval polling. Failed evidence is retained. All isolated UI containers/networks/volumes were removed.

The retained port-8080 preview was refreshed through the guarded client-only reload plus Nginx recreation. Backend, grading images, databases and independent DRM were not restarted or modified by this scope. Visual review confirms the console fills the former preview column; no commit/push or milestone acceptance is inferred.


## Starter reset, syntax colors and formatting (2026-10-02)

Owner-authorized editor additions: coding exercises expose Reset to starter with confirmation/cancel. Reset uses only the student-visible starter from the loaded immutable question revision (blank if ADMIN did not share starter), saves through the existing student draft path, stops local execution and clears local output. No private ADMIN solution is fetched, no submission/history/pass is deleted and no Run allowance is consumed. Standalone practice has no question-starter reset.

JavaScript syntax colors use theme variables for keywords, strings, literals, comments, functions and operators, with distinct light/dark palettes. Remove the old blanket token-ink override; retain the existing editor theme and RTL/LTR behavior.

Format code uses pinned Prettier 3.6.2 standalone with Babel/ESTree bundled in an on-demand browser worker. Formatting never executes source or sends it to an external service, does not reserve Run quota, is bounded to ten seconds, and preserves source on invalid syntax or if the student edits during formatting. Successful formatting is a normal undoable editor change saved through the existing draft mechanism. Formatting is explicitly requested rather than changing code during typing/submission.

Scope is frontend-only; backend, schema, grading policy and DRM remain unchanged. Docker tests and visual evidence are recorded below; no acceptance, deployment or commit/push is implied.

Fresh Docker verification: production client build/typecheck passes; **85 frontend unit tests plus 2 DASH compatibility checks** pass in a transient no-network container. **59 browser/queue checks** pass, including reset confirmation/cancel, blank private starter, explicit shared starter and reload persistence, no added submission/quota use, actual worker formatting, invalid-source preservation, contrast >=4.5 for distinct syntax colors in both themes, and existing coding/multiple-choice grading. The first browser attempt compared unfinished code against typed characters without accounting for CodeMirror bracket completion; the corrected assertion compares the actual editor before/after formatting, proving exact preservation. Failed evidence is retained. All isolated UI containers/networks/volumes were removed. Screenshots visually reviewed.

Prettier integration follows [official browser standalone guidance](https://prettier.io/docs/browser); bundled Babel and ESTree plugins are loaded only with the formatting worker. Only client and Nginx are refreshed on the guarded retained localhost:8080 preview; backend, grading, DRM and owner records remain unchanged. All work stays uncommitted for owner review.


## Typed ADMIN check authoring (2026-10-02)

Owner request: simplify coding quiz/assignment answer and check setup. The existing console/function contract is retained. ADMIN selects explicit text/number/boolean/null values; function expectations/inputs also support recursively built objects and arrays with Add/Remove property/item controls. Check labels now describe printed output versus function return values and give concrete examples. Numeric parsing is finite/type-checked; duplicate or empty object property names and invalid JSON block saving. Deep nesting uses validated JSON and the existing expected-value limit stays intact. Existing values retain their type; no published content or owner data is auto-converted. Console keeps whole-output text matching; objects/arrays and strict types use function-return checks. No backend/API/schema/DRM change is required. [The admin guide](m9-admin-check-authoring-guide.md) gives examples.

Fresh Docker evidence: production client build/typecheck passes; **88 frontend unit tests plus 2 DASH compatibility checks** pass. Full isolated browser/queue proof **65/65** passes, including typed numeric console authoring, invalid-number save refusal, property/array building without JSON, private expected values/inputs, rejection of string score where a number was expected, and acceptance of the complete nested object/array with reordered object keys through the real grader. No check flags or pass results are trusted from the browser. Visual authoring screenshot reviewed. Initial test attempts exposed a generated test using single-element $eval instead of collection $$eval (string replacement collapsed the dollar signs), then a missing wait for the refreshed assessment list before publishing. These harness defects were corrected; failed evidence remains saved. All disposable UI containers/networks/volumes were removed after every run.

Retained-preview refresh is client/Nginx only, guarded against volume mixups. Backend, grading and independent DRM are untouched. No owner assessment, historical attempt, wallet or subscription was mutated, and nothing is committed/pushed.


## Input/output follow-up (2026-10-02)

New PROGRAM questions now use private reference solutions and generated/frozen hidden input/output cases. The retained localhost:8080 preview is upgraded with the additive preparation migration and preserved-data backup/fingerprints. Final Docker evidence: 189 server unit + 300 integration, 88 frontend unit + 2 DASH checks, 18 restricted execution proofs, 74 browser/queue checks, final preview browser/health proof and zero owned test resources remaining. Existing assessment types/passes and the external DRM remain unchanged. See [the detailed report](m9-input-output-implementation-report.md) and [authoring guide](m9-input-output-guide.md). Work remains uncommitted; no production/capacity or owner milestone acceptance is inferred.
