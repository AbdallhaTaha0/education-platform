# Commit report — three IDE modes and student registration improvements

Report prepared: 2026-10-05, Africa/Cairo.

## Commit identity and scope

| Item | Value |
| --- | --- |
| Commit | `538a0f9da6b654f31a10aa2db457fda080bada19` |
| Commit title | Add three types of ide and enhance the register form data |
| Commit date | 2026-10-04 at 18:42:37, UTC+03:00 |
| Parent checkpoint | `2c0d11fc71ddb74553e701786de22b426520f751` |
| Change size | 85 files; 2,629 insertions and 193 deletions |

This commit delivers three independently usable IDE modes, Python execution and
grading, editor usability improvements, richer protected student profiles, and
two course-material fixes. The platform remains one modular Express/TypeScript
backend with React/TypeScript, Prisma/PostgreSQL and exactly STUDENT/ADMIN roles.
The Python container is an execution runtime, not a second business API. No
nested DRM source or gitlink change is included.

The commit contents and linked reports were inspected for this document. No
application test, Docker rebuild, runtime restart or deployment was performed
while preparing it. The working tree was clean before this report was added.

## Delivered student and ADMIN behavior

### Three independent IDE modes

- Practice offers JavaScript, HTML/CSS/JavaScript and Python tabs. Each keeps
  separate files, input, console state and server-saved drafts. Historical
  JavaScript drafts retain their original context.
- All three modes share the existing practice allowance: default 50 accepted
  Runs, existing Cairo-calendar reset behavior, and persistent student-specific
  ADMIN limits/anchored recurring 24-hour resets.
- ADMIN chooses the IDE category when authoring an assessment. Students open
  the matching editor when solving it. JavaScript keeps its input/output
  problems; web exercises support DOM/console/function checks; Python uses
  `input()`/`print()`, private reference solutions and generated tests.
- Exercise Runs remain outside the practice quota. Unlimited educational
  retries, required/optional progression, earned passes and existing access
  preservation remain in place. Local Run never awards an official pass.

Mode binding is derived on the backend. Clients cannot select a different
grader to bypass an assessment's execution contract.

### Python execution and grading

Python practice requests are durably queued with owner-only result polling,
idempotency checks and one outstanding preview per student. A full queue rolls
back the practice charge; exact retries do not charge twice. Preview admission
shares the existing bounded assessment queue budget.

Only the trusted controller accesses Docker's socket. Each Python input runs
in a fresh non-root container with no network, no host mounts or inherited
platform credentials, a read-only root, dropped capabilities,
`no-new-privileges`, 16 MiB tmpfs, 192 MiB RAM, one CPU, 32 PIDs and a six-second
outer deadline. CPython supplies additional process/resource restrictions;
output is capped at 8 KiB. External packages are disabled initially.

Expected answers and comparisons stay in the trusted controller. Private
references must match samples and produce deterministic output before cases
are frozen. Terminal previews clear source/input and retain output for 24
hours. Official submission history retains its existing 180-day policy.
Stopping browser waiting does not cancel an already accepted server job.

### Editor usability and interactive preview repair

- Tab/Shift+Tab indents/unindents code and selections: two spaces for
  JavaScript/HTML/CSS and four for Python. Esc then Tab allows keyboard escape.
- JavaScript badges remain yellow; web uses orange and Python blue. Expanded
  syntax colors distinguish HTML tags/attributes, CSS selectors/properties and
  Python keywords/functions/built-ins, with light/dark theme contrast checks.
- JavaScript/HTML/CSS use Prettier. Python formatting uses locally bundled
  Ruff WASM in the formatting worker. Formatting does not execute or submit
  code, send it to an external formatter, or consume a Run.
- Web preview no longer counts idle time against the execution deadline.
  Later clicks, input events and timers receive a fresh task budget, allowing
  the counter/live-text example to keep responding. Synchronous code and
  promise microtasks retain the two-second/200,000-step budget.

The opaque iframe and network-denying restrictions remain. External fonts and
resource URLs are deliberately unavailable in the sandbox. The browser guard
is a responsiveness defense, not an OS resource isolation guarantee.

### New student registration and private profiles

New students must supply full name, national ID, parent/guardian phone, school
year and governorate; school name is optional. School-year choices are only
**أولى ثانوي / First secondary** and **تانية ثانوي / Second secondary**, enforced
by frontend choices and backend validation.

National IDs are 14-digit strings with Arabic-Indic/Persian digit normalization.
Concurrent duplicate registration is rejected by a unique database constraint,
and user/profile/session creation is atomic. IDs are encrypted using
AES-256-GCM with user-bound authenticated data; a separate keyed HMAC-SHA256
fingerprint supports duplicate detection. Responses show only the masked last
four digits. This validates format; it does not verify government identity.

Existing students retain access and may complete missing details voluntarily.
Students edit guardian/education details and can initially provide a missing
ID. ADMIN handles corrections to an existing ID through an on-demand form in
the paginated directory. Version checks prevent stale overwrites; protected
views/changes are audited without private values. Guardian phone numbers may
be shared by siblings. Generic login/session responses and browser storage do
not acquire the new private data.

### Course-material fixes included in this commit

Caption text, resource downloads and opted-in material uploads/deletes now use
the same single-flight authentication refresh as JSON requests. A recognized
refreshable authentication failure permits at most one retry with the current
CSRF cookie. Network/5xx, revoked-session, CSRF and entitlement failures are
not automatically replayed.

WebVTT validation now parses optional cue positioning settings separately from
the end timestamp. Valid positioned bilingual captions are accepted; malformed,
duplicate and out-of-range settings are rejected. Invalid replacement uploads
preserve the existing bilingual caption pair.

## Schema, API and configuration changes

| Area | Addition |
| --- | --- |
| Migration `20261004140000_ide_modes_python` | PythonRun table, user/assessment cascades, idempotency and recovery indexes, existing admission trigger integration |
| Migration `20261004180000_student_profiles` | Nullable StudentProfile relation, encrypted-ID consistency constraint and unique fingerprint index; no invented historical data |
| Python Run API | POST `/api/assessments/python/run`; GET `/api/assessments/python/runs/:id` |
| Student profile API | GET/PATCH `/api/auth/student-profile` |
| ADMIN profile API | GET/PATCH `/api/admin/students/:studentId/profile` |
| Draft mode selection | Existing practice endpoints accept mode-specific contexts |
| Backend secrets | `STUDENT_DATA_ENCRYPTION_KEY_B64`, `STUDENT_DATA_INDEX_KEY_B64` |
| Execution image | `fayq-python-execution:0.10.0`, selected through controller configuration |

Both student-data keys must be distinct canonical Base64 32-byte keys, stored
outside Git. The local helper refuses silent replacement or a half-present
pair. Missing both keys leaves historical login/access available but disables
new registration and ID writes with 503; invalid/partial configuration refuses
startup. Key rotation requires a separate controlled re-encryption/re-indexing
procedure; simply changing the environment values is unsafe.

## Recorded verification evidence

These are prior implementation results recorded in the committed reports.
They represent different staged snapshots and overlapping focused suites;
they must not be summed into a single latest-commit regression count.

| Verification stage | Recorded result |
| --- | --- |
| Material fixes | 252 server unit; 134 client unit; 2 DASH checks; 75 PostgreSQL/Redis/material integration checks; typechecks/build passed |
| Initial IDE modes | 260 server unit; 137 client unit; 2 DASH checks; 33 integration; 18 real Python isolation; 24 student and 11 ADMIN browser checks |
| Existing restricted JS/web execution | 18/18 checks |
| Keyboard and mode badges | 28 browser checks |
| Python formatting | 3 focused unit, 2 DASH and 15 browser checks |
| Interactive web preview | 15 focused unit, 2 DASH and 14 browser checks |
| Syntax themes | 24 browser checks, including measured contrast |
| Student registration/profile | 271 server unit; 51 identity integration; 16 browser checks; backend app/test typecheck |
| Two-year restriction follow-up | Two accepted/four excluded values checked; 16 browser checks repeated; exact Arabic choices confirmed on localhost |

Isolated runners record zero owned test containers, networks and volumes after
cleanup. Protected dumps, transient logs and screenshots remain ignored and
are not committed. See the source reports below for defects found, corrected
harness failures and individual reproduction commands.

## Local preview, recovery and remaining boundaries

The recorded local delivery is on localhost:8080. Guarded upgrades retain
database backups and compare existing-column row fingerprints before/after
additive migration. The final school-year update preserved all 24 existing
tracked table fingerprints, repeated migration successfully and confirmed
the two Arabic choices with zero page errors. These are recorded results,
not a fresh health check on the report date.

Rollback must retain additive tables and new student data. Restore available
previous serving image aliases; never drop owner tables, blindly restore an
older database or delete preview volumes. Registration must be disabled if
rolling back to code that lacks the required-field/duplicate-ID policy. Back
up both student-data keys with protected recovery material.

Earlier source reports describe intermediate work as uncommitted or not yet
installed. The code is now in `538a0f9`; their historical commit-status wording
does not describe this latest checkpoint. This commit does not establish
formal milestone acceptance, production deployment, commercial DRM readiness
or 10,000-user throughput/latency qualification. Production execution still
requires its existing approved runtime. Configured material storage is also
required for material operations; complete credentials were not fabricated.

## Supporting reports

- [IDE modes, execution controls and Docker runbook](../ide-and-assessments/ide-modes-implementation-20261004.md)
- [Interactive preview fix](../ide-and-assessments/ide-interactive-preview-fix-20261004.md)
- [Student registration, privacy and school-year restriction](../platform-updates/student-registration-data-contract-20261004.md)
- [Material refresh and caption fixes](../course-learning/material-refresh-caption-fixes-20261004.md)
- [Historical teammate review motivating the material fixes](teammate-changes-review-20261004.md)

This reporting task adds this document and its index entry only. It does not
modify implementation code, create a new commit or push changes.
