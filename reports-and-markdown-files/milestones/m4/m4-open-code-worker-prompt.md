# Open Code worker prompt — M4 wallet, recharge, purchase, and UI/UX improvement

You are the implementation worker for Milestone 4 of the education platform.
Act as a senior full-stack engineer working under independent manager review.
This is a bounded platform assignment: manual EGP recharge, wallet accounting,
transactional course purchase/subscription creation, and a deliberate UI/UX
improvement pass for the affected student/admin journeys.

## Mandatory onboarding and approved policy

Before changing anything, read `AGENTS.md` and all documents linked from
`reports-and-markdown-files/README.md`, especially `agent.md`, `rules.md`,
`decisions.md`, `requirements.md`, `confirmed-flows.md`, `design.md`,
`implementation-plan.md`, `test-and-review-plan.md`, and the accepted M3
report. Record the platform branch/HEAD/origin, nested DRM branch/HEAD/origin,
gitlink, worktree status, Docker versions, and development-stack health.

Implement only the policy approved in D04, D05, D14, D21 and D22:

1. channels are InstaPay, bank transfer and mobile wallet; receiving identifiers
   and localized student instructions are validated runtime configuration, never
   hard-coded or committed;
2. required fields are integer-minor-unit EGP amount, channel, normalized
   reference, sender name/phone, transfer date, and a JPG/PNG/PDF proof up to
   5 MiB;
3. a normalized reference is globally unique within its channel;
4. only ADMIN may open/download proof; the student sees filename, request status
   and scheduled deletion date; remove proof bytes 180 days after approval or
   rejection while retaining sanitized audit metadata;
5. rejection requires a reason, becomes immutable, and resubmission creates a
   new request;
6. refunds, reversals and correction credits are excluded from M4;
7. plan duration is integer days; purchased price/duration are snapshotted;
   later plan edits affect future purchases only; active renewal extends from
   the current expiry and an expired subscription starts immediately.

Unanswered details are not permission to invent policy. Runtime destination
values may be absent in source control: implement an explicit unconfigured state
and use non-sensitive fixture values in Docker tests.

## Repository and architecture boundaries

- Work only in the platform `client/`, `server/`, platform Prisma migrations,
  Docker test/browser harness, and documentation required for M4.
- `education-drm-service/` is an external API dependency. Do not edit it.
- Preserve the single horizontally replicable Express application, PostgreSQL/
  Prisma persistence, Redis coordination where justified, and Nginx boundary.
- Exactly `STUDENT` and `ADMIN` roles. Authentication remains HttpOnly-cookie
  based with origin and CSRF enforcement; never store tokens in browser storage.
- Preserve all accepted M1–M3 behavior and migrations. Add migrations only;
  never reset or remove development volumes.
- Do not commit, push, deploy, open a PR, provision paid services, or claim
  production readiness. Leave the implementation uncommitted for review.

## Clean-code and file-structure requirements

Use the existing feature-based structure and extend it deliberately:

- client: `features/wallet/{api,types,hooks,components,pages}` and
  `features/purchase/{api,types,hooks,components,pages}`;
- shared primitives in `components/ui` only when genuinely reused;
- server: cohesive wallet, recharge, purchase/subscription, audit, validation,
  and route modules under the existing modular Express structure;
- keep transport, validation, transaction/domain logic, persistence access,
  and presentation concerns separate.

Use Tailwind utilities for UI implementation. Keep `styles.css` limited to
Tailwind entry directives, semantic tokens, font/base rules, and unavoidable
global accessibility behavior. Do not add page-specific ordinary CSS, inline
style systems, CDN Tailwind, or a second component framework. Reuse the
semantic tokens in `tailwind.config.js` and `design.md`.

Implement the approved theme direction from D22: dark mode is the polished
default, with an accessible light alternative and an explicit keyboard-
accessible theme control. Persist only a namespaced non-sensitive theme
preference; auth/session data remains forbidden in browser storage. Apply the
theme before first paint to prevent a flash. Express the navy/teal/amber palette
through CSS-variable semantic tokens consumed by Tailwind (`canvas`, `surface`,
`elevated`, `text`, `muted`, `border`, `primary`, `accent`, `focus`, and status
roles). Do not scatter raw color utilities through pages. Both themes must meet
WCAG AA contrast and preserve visible focus, charts/status meaning and Arabic/
English readability.

No production source file may become a god file. Target at most 200 lines per
production file; split pages into focused components, hooks, API clients,
types, policies, and transaction services before exceeding that size. Avoid
duplication, hidden coupling, boolean-flag components, broad `any` types, and
business rules embedded in JSX or route handlers. Keep names explicit and
functions small. If a justified exception is necessary, document it in the
implementation report with its measured line count and reason.

## Required financial behavior

Implement an integer-minor-unit EGP ledger; never use floating-point money.
The ledger is append-only and auditable. A cached balance, if used, must be
updated in the same database transaction and reconciliable to ledger entries.
Client-supplied balances, prices, durations, roles, approval state, or credited
amounts are never authoritative.

Recharge flow:

1. A STUDENT submits the approved amount/reference/proof fields.
2. The request remains pending and creates no wallet credit.
3. An ADMIN independently verifies receipt and approves or rejects according
   to the recorded policy.
4. Approval atomically changes exactly one pending request, records reviewer
   and time, creates exactly one credit entry, and writes a sanitized audit.
5. Repeated or concurrent approval converges without duplicate credit.
6. Students cannot review/approve requests or access another student's proof;
   admins cannot silently change the student-submitted amount during approval.

Purchase flow:

1. The server loads the active published plan and trusted price/duration.
2. A transaction locks the relevant wallet/account state, rejects insufficient
   funds, creates exactly one debit, purchase, and subscription entitlement,
   and snapshots price/duration/title identifiers needed for historical truth.
3. An idempotency key owned by the authenticated student makes retries return
   the same result without double debit or duplicate entitlement.
4. Simultaneous purchases cannot overspend. Failed transactions leave no
   partial debit or access.
5. Approval credits the wallet only; purchase always remains an explicit
   student action.
6. Subscription dates use backend time and confirmed integer days. Implement
   only the approved early-renewal rule; do not invent refund or recurring-
   billing behavior.

## UI/UX improvement workstream

First audit the current UI against `design.md`, then implement the affected M4
journeys with consistent shared patterns. Improve existing shared shell/UI
components only where the change benefits M4 and preserves M1–M3 behavior; do
not perform an unrelated visual rewrite.

The visual approach should feel like a credible modern programming-learning
product: deep navy layered surfaces, clear content hierarchy, readable code-
adjacent typography, restrained teal actions and amber highlights, consistent
cards/tables/forms, and generous spacing. Avoid pure-black expanses, neon glow,
gratuitous gradients, excessive glass effects, tiny dense controls and generic
admin-template clutter.

Required student experience:

- a wallet summary with available balance and clear EGP/ج.م formatting;
- manual-transfer instructions based only on approved channels;
- an accessible recharge form with amount/reference/proof validation;
- pending, approved, and rejected request history with understandable next steps;
- course purchase review showing trusted price, duration, resulting balance,
  explicit confirmation, success receipt, insufficient-funds route to recharge,
  and safe retry behavior;
- never imply that submitting proof credits money or purchases a course.

Required admin experience:

- useful pending-review table/queue, filters that remain usable on small screens,
  proof preview/download according to policy, student/request details, and
  explicit verified-receipt confirmation;
- approve/reject dialogs that state the irreversible financial effect and
  prevent accidental double submission;
- visible conflict/already-reviewed results and audit metadata without exposing
  secrets or internal stack details.

Quality requirements for every affected route/state:

- Arabic is primary RTL; English is complete LTR. Localize labels, validation,
  statuses, dialogs, empty states, errors, success feedback, and dates/money;
- dark and light themes render every route/state consistently, without flash,
  unreadable muted text, invisible borders, incorrect browser form colors or
  status colors that lose meaning;
- support 390px without horizontal overflow and desktop up to the documented
  content width; use logical-direction Tailwind utilities;
- one primary `<main>` and one meaningful `<h1>` per route, keyboard-complete
  operation, visible focus, correct labels/descriptions, 44px touch targets,
  adequate contrast, reduced-motion support, and focus management in dialogs;
- distinguish loading, first-use empty, filtered-empty, validation, forbidden,
  conflict, dependency failure, retry, and success states;
- use skeletons only when they improve comprehension, prevent layout shift,
  disable duplicate submissions, and never rely on color alone;
- preserve the replaced footer, bilingual navigation, and existing design tokens.

## API, validation, and security expectations

Define a route/auth/CSRF matrix before implementation. Validate strict request
schemas and reject unknown fields. Return stable frontend-safe error categories
for validation, duplicate reference, already reviewed, insufficient funds,
idempotency conflict, forbidden, and internal failures. Never expose proof
storage paths, credentials, raw database errors, or full request objects in
logs/audits. Protect proof upload/download against MIME spoofing, excessive
size, path traversal, unauthorized access, and executable content according to
the approved storage/retention policy.

Use database constraints in addition to service checks for money/state
invariants. Establish a deterministic lock order and test it. Do not hold a
database transaction open across file/object-storage or other network I/O.
Uploads need an intent/finalization design that does not produce credited money
from incomplete or failed proof handling.

Proof persistence must remain private and replica-safe. Do not write proofs to
container-local files and do not introduce a new storage service without owner
approval. Within the approved platform stack, store the bounded proof bytes in
a dedicated PostgreSQL relation separated from request/audit metadata, after
streaming size limits, extension/MIME/signature validation and hashing. Serve
only through an authenticated ADMIN endpoint with safe content headers. Use an
idempotent replica-safe cleanup job to clear bytes after the 180-day deadline
while preserving the approved metadata and audit trail.

## Docker verification and evidence

Development and verification must run through Docker. Add unit, real
PostgreSQL/Redis integration, and Chromium browser coverage while preserving all
accepted earlier tests. At minimum prove:

- pending submission creates zero credit;
- authorization/ownership/CSRF/origin boundaries;
- duplicate normalized reference behavior;
- repeated and concurrent approval credits exactly once;
- rejection/resubmission and reversal behavior exactly match approved policy;
- server-trusted price/duration and exact integer EGP reconciliation;
- insufficient funds, simultaneous spend, idempotent retry, rollback, and no
  unpaid entitlement;
- later plan edits do not rewrite purchase snapshots;
- Arabic/English parity, 390px no-overflow, keyboard/dialog focus, no-file and
  invalid-file proof cases, all state screens, dark/light screenshots, theme
  persistence/no-flash, automated contrast checks where practical, and no auth/
  secrets in storage or bundles;
- fresh migrations, M3→M4 upgrade with data preserved, migration-failure gate,
  restart health, non-root/minimal runtime images, secret scans, dependency
  audits, and `git diff --check`.

Use disposable project names for destructive test teardown and `down -v` only
for those projects. Never remove development volumes. Report exact commands,
test counts, image IDs, audit findings, skipped/live blockers, and rollback.

## Handoff

Create `reports-and-markdown-files/milestones/m4/m4-implementation-report.md` with:

- starting revisions/status and every changed path;
- approved policy answers used by the implementation;
- schema and transaction/lock/idempotency design;
- route/auth/CSRF matrix and state-transition matrix;
- UI route/state/component inventory and measured production-file line counts;
- exact Docker evidence and regression counts;
- security, secret, dependency, migration, runtime-image, and responsive/a11y evidence;
- remaining blockers and honest rollback instructions.

Your final response must be concise and evidence-based. Do not declare M4
accepted; the manager independently reviews and reproduces critical financial,
browser, migration, and security tests before acceptance.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
