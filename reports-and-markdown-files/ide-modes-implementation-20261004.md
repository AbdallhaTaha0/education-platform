# Three independent IDE modes — 2026-10-04

## Owner scope and delivery

The owner requested HTML/CSS/JavaScript, JavaScript-only and Python tabs, each
with independent quizzes, assignments and drafts. The owner confirmed one
shared practice allowance and approved Python input()/print() problems, private
reference solutions/generated tests, no external packages/network and isolated
Docker execution. This extends M9; it does not declare a new accepted milestone.

The platform remains one Express/TypeScript application. React/TypeScript uses
one reusable editor with explicit mode selection. The small CPython execution
image is a runtime for student Python, not another business API or replacement
backend. No external DRM source or database was accessed or modified.

## Student and admin use cases

1. An actively subscribed student opens Practice IDE and chooses one of three
   tabs. Each keeps its own editor files, input and console during tab changes.
   Server drafts are separate and survive reload. Historical JavaScript drafts
   remain in their original context.
2. JavaScript Run prints console output. Web Run combines HTML, CSS and
   JavaScript in an opaque-origin browser preview, including DOM manipulation.
   Python Run accepts stdin and displays stdout after a queued isolated job.
3. All accepted practice Runs consume the same existing quota. Defaults,
   Cairo-midnight scheduling, permanent per-student limits and administrator
   anchored recurring 24-hour resets retain their existing behavior.
4. Admin chooses a category before adding a quiz/assignment. Web assessments
   support private DOM/console/function checks and removable click/input steps.
   JavaScript retains its current generated input/output problem flow. Python
   uses private reference programs and integer/custom input generation.
5. The published assessment opens its matching editor automatically. Python
   uses input()/print(); JavaScript uses readline()/console.log(). Running an
   exercise does not charge practice allowance or award a pass. Submission
   checks private tests and supports unlimited educational retries.
6. Required/optional assessments retain existing progression semantics across
   categories. Earned passes, preserved lesson access, bilingual content and
   private-by-default starter code retain existing rules.

## Data and API

`content.ide` is `javascript`, `web` or `python`. Missing values remain historical
JavaScript and do not change old preparation hashes. Runtime binding is derived
server-side: a client cannot forge which grader executes a question. Python
supports PROGRAM and CHOICE; browser DOM checks are rejected for Python.

Practice endpoints accept `?mode=...`; contexts are `practice` (legacy JS),
`practice:web`, `practice:python`. Draft revisions still reject stale writes.

New endpoints:

| Endpoint | Contract |
| --- | --- |
| POST `/api/assessments/python/run` | Cookie auth, session CSRF, exact Origin; source, input, idempotencyKey, optional authorized Python assessmentId. 202 durable acceptance; one outstanding preview per user. |
| GET `/api/assessments/python/runs/:id` | Owner-only id/state/output/safe error; no source/input/private tests. |

`20261004140000_ide_modes_python` adds PythonRun and ownership/cascade indexes.
Admission uses the existing transactional M9 queue budget, shared with official
submissions. A full queue rolls back the practice charge. Exact retries do not
charge twice; reusing a key for different source/input/context is rejected.
Python source/input are nulled on terminal completion. Terminal preview output
expires after 24 hours; official submission retention remains 180 days and pass
records remain under the existing course/assessment lifecycle.

## Execution and capacity boundaries

Only the trusted execution-host controller mounts Docker's socket. Serving
replicas only persist jobs. Each Python input runs in a fresh non-root container:
network none, no host mounts or inherited platform credentials, read-only root,
bounded 16 MiB tmpfs, dropped capabilities, no-new-privileges, default seccomp,
192 MiB container RAM, one CPU, 32 PIDs and 6-second outer deadline. CPython adds
CPU/address-space/file/descriptor/process limits. Output is capped at 8 KiB.

Expected answers and comparisons remain in the trusted controller. The execution
container receives only one program/input, so printing forged grading JSON has
no authority. References are run twice for determinism and checked against
samples before private tests are frozen. Stdout decoding preserves split UTF-8
characters. CPython uses isolated mode and standard library only; see
[Python isolated mode documentation](https://docs.python.org/3.12/using/cmdline.html#cmdoption-I).

The controller adds one preview worker alongside one submission and one
preparation worker. Leases and deterministic job IDs recover durable pending or
stale-running jobs on periodic reconciliation. Accepted preview jobs continue
after the browser stops waiting or closes. The Stop action aborts browser
waiting, not an already accepted server job. Initially Python formatting was
not offered; the Python formatting follow-up below supersedes that limitation.
Prettier continues to format JS/HTML/CSS.

JS/web previews execute on student devices; 10,000 open editors do not create
10,000 server execution processes. Python and official grading use bounded
queues and per-user admission instead of unbounded spawning. Local concurrency
is deliberately small. **No 10,000-user throughput, queue latency, production
sandbox or capacity certification is claimed.** Production still refuses
execution without the existing approved `runsc` runtime; no bypass was added.

## Verification and defects found

Docker checks: server unit 260, client unit 137 plus 2 DASH compatibility tests,
33 real PostgreSQL/Redis integration checks, 18 real CPython isolation checks,
24 student browser checks and 11 admin browser checks. Backend/test typechecks
and production server/migration/client/controller builds pass. The existing
restricted JS/web execution proof also passes 18/18, including DOM interactions,
CSS, code limits and private generated-output grading. Retained-preview public
browser checks pass 8/8. The repeatable
runner reproduces integration and browser checks on a new disposable database.

Coverage includes shared quota initialization/concurrency/replay/queue rollback,
separate drafts, CSRF/entitlement/owner denial, private test preparation,
exercise exemption, cascade cleanup, real Python loop/output/network/filesystem
limits, hardcoded-sample rejection, correct retry/pass, web DOM/CSS preview,
admin category filtering, Arabic RTL/LTR editing and mobile overflow.

The first browser run found simultaneous first-visit quota initialization racing.
Quota creation now uses INSERT ON CONFLICT before row locking; 12 parallel
first reads verify one row and consistent allowance. Harness corrections include
using a real localhost secure context, refreshing disposable Nginx DNS after
replacement, and delivering synthetic fixtures over stdin to a non-root server.
Failed runs cleaned their disposable environment; evidence remains ignored.
Final fresh-run evidence records integration=33/33, student browser=24/24,
admin browser=11/11 and containers/networks/volumes=0. Explicit Python
sys.exit(0) preserves successful output; nonzero exit remains a code error.

## Local preview and retained data

`docker/ide/modes-preview.mjs` performs platform-only guards, protected pg_dump,
existing-column fingerprints, repeated additive migration and image replacement.
The transferred preview predated committed materials migrations, lacked its
required materials network, and forced an incomplete storage endpoint. The
network was restored without object-store creation. `compose.local.yml` now
reads the optional endpoint from the ignored env so all-or-none validation is
preserved. Complete storage credentials were not invented. Material storage
remains unconfigured where its existing ignored settings are absent.

The successful preview upgrade preserves fingerprints of 22 existing tables,
including accounts, money, subscriptions, courses, video mapping, quizzes,
drafts, submissions, passes and quota records. Migration was repeated without
data reset. Local readiness passes at http://localhost:8080. DRM and its
retained volumes/video are unchanged. Existing transferred old image layers
were unavailable on the first failed attempt; existing containers were
restarted, and no successful rollback-image claim is made for that attempt.

## Docker runbook

### Editor keyboard and badge follow-up

Owner requested Tab indentation and mode-specific badge colors. The reusable
CodeMirror editor now binds Tab/Shift+Tab for line or selected-line indentation:
two spaces in JS/HTML/CSS and four in Python. Esc then Tab preserves keyboard
escape from the editor, with bilingual help. JavaScript stays yellow, web uses
burnt orange and Python uses blue; icon/text ink follows the mode tokens.
The newly imported CodeMirror commands/view packages are declared directly at
their already locked versions; no dependency version upgrade is needed.

Docker frontend typecheck/build passes. Focused real-browser verification passes
28 checks across all five file editors: current/selected line indentation,
unindent, keyboard escape, distinct colors, WCAG text contrast and no quota
charge/runtime errors. `node docker/ide/modes-verify.mjs --editor-only` reproduces
this smaller gate and verifies owned containers/networks/volumes are removed.
The frontend-only localhost update retains the previous client image as
`fayq-platform-client:before-editor-keys-20261004`; no backend migration, account
change or DRM restart is required. Changes remain uncommitted.

### Python formatting follow-up

The owner requested Python formatting as well. The reusable IDE now offers
Format code in Python practice and assessment/reference editors. It uses pinned
[@wasm-fmt/ruff_fmt 0.15.20](https://github.com/wasm-fmt/ruff_fmt), bundled locally
and loaded on demand in the existing browser formatting worker. Prettier remains
the formatter for JS/HTML/CSS. Python uses four-space indentation, an 88-column
preferred width, LF endings and double quotes. No source is sent to an external
formatter, executed, submitted or charged against the shared Run allowance.

The existing ten-second worker timeout, termination, edit-during-format guard
and syntax-failure feedback remain; Python input/output is capped at 32,768
characters. Invalid Python remains unchanged. No backend, database, grading
controller, execution image or DRM change is required. Vite worker output uses
ES modules to support the lazy WASM chunk.

Docker build/typecheck passes. Focused formatter unit checks pass 3/3, alongside
2/2 existing DASH patch checks. Real Chromium checks pass 15/15: Python formatting,
idempotence, Unicode, invalid-source preservation, safe error feedback, no code
execution or Run consumption, JS/HTML/CSS regression checks, admin reference
formatting, no execution requests, no external host and no browser errors.
Reproduce with `node docker/ide/modes-verify.mjs --format-only`; its guarded
cleanup verified zero disposable containers, networks and volumes remaining.

The first build exposed Vite's default IIFE worker incompatibility with lazy
chunks; ES module output fixed it. Browser verification exposed the package's
`preview` type/runtime mismatch: its declared boolean option is rejected by the
WASM configuration parser. The option is omitted, retaining the default stable
formatting style. Test fixtures were also corrected to paste source without
CodeMirror auto-indentation, await worker/render completion, inspect global
error feedback and exercise meaningful multiline HTML indentation. Diagnostic
hooks were removed before the final passing run.

The verified frontend is installed in the retained localhost:8080 preview;
the previous client image is retained as
`fayq-platform-client:before-python-format-20261004`. Only client and Nginx are
recreated. No commit, push, deployment or milestone acceptance is inferred.

### Language syntax themes follow-up

Owner requested better HTML/CSS/Python code colors. The shared CodeMirror
highlighter now covers tags, attributes, properties, selectors, built-ins,
metadata, units and invalid syntax, alongside existing keywords, strings,
numbers, comments, functions and punctuation. Scoped editor tokens follow
the active file, including admin/reference editors and embedded HTML languages.
HTML uses warm tags, blue attributes and mint values; CSS uses rose selectors,
blue properties and warm numeric values; Python uses blue keywords, warm
functions, mint strings and violet built-ins. Light-theme variants keep dark
ink over the existing FAYQ surface. No new dependency or runtime/API change.

Docker build/typecheck passes. `node docker/ide/modes-verify.mjs --syntax-only`
passes 24 real-browser checks across HTML, CSS, Python and JavaScript in both
themes: distinct parser-generated token categories, separate key language
categories and at least 4.5:1 measured token contrast against normal/active-line
backgrounds, no Run consumption and no browser errors. Six ignored screenshots
are retained; HTML dark and Python light were visually inspected. Guarded
cleanup confirms zero owned test containers, networks or volumes remaining.

Frontend-only localhost:8080 update preserves backend, DRM and saved content.
Rollback alias: `fayq-platform-client:before-syntax-themes-20261004`. No commit,
push, production release or milestone acceptance is inferred.

### Complete modes verification

From repository root, build the Python image and isolated verification images:

```text
docker build -f server/python-execution/Dockerfile -t fayq-python-execution:0.10.0 .
docker build -f server/Dockerfile --target test -t fayq-ide-modes-server:test .
docker build -f docker/ide/modes-controller-test.Dockerfile -t fayq-ide-modes-controller:test .
docker build -f client/Dockerfile --target runtime -t fayq-ide-modes-client:preview .
node docker/ide/modes-verify.mjs
```

The browser vehicle `fayq-m9-browser:0.9.0` and existing JS execution image
`fayq-assessment-execution:0.9.0` are prerequisites from the M9 Docker runbook.
Set DOCKER_EXE to the local Docker CLI if it is not on PATH; never copy another
machine's absolute paths. The runner refuses an existing project; guarded
`node docker/ide/modes-verify.mjs cleanup` removes only that project's resources.
It verifies labels, all mounts, attached volume owners and network members.
Never use global prune or retained-preview `down -v`.

Preview update requires production runtime/migration/client/controller builds
under the existing local aliases, plus the Python image. Run
`node docker/ide/modes-preview.mjs check` then `upgrade`. Backup/image metadata
and browser evidence are ignored under `docker/browser/evidence/ide-modes/`.
On rollback keep the additive schema; restore available recorded serving image
aliases. Never drop owner tables, restore a database blindly, or delete volumes.
If historical layers are unavailable, rebuild the known prior Git revision in
a separate checkout before image rollback. No commit/push/owner acceptance or
deployment is inferred by this delivery.
