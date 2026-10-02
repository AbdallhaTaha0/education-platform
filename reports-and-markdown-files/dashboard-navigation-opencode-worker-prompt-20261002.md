# OpenCode worker package: dashboard navigation and centred form actions

Implement this bounded frontend package in `A:\Projects\Work Projects\education-platform`. The owner will dispatch this prompt; the technical manager will independently review your changes and reproduce important checks. Do not commit, push or dispatch other workers.

## Read and establish the baseline

Read `AGENTS.md`, `reports-and-markdown-files/README.md`, `agent.md`, `rules.md`, `decisions.md`, `design.md`, `m9-implementation-contract.md`, `m9-schema-api.md`, `m9-docker-runbook.md`, `m9-implementation-report.md`, `m9-testing-corrections-report.md`, `m9-input-output-guide.md`, `m9-input-output-implementation-report.md`, `ux-improvements-20261002/report.md`, `support-contact-settings-20261002.md` and `dashboard-profile-plan-20261002.md` before editing. Paths after the README are relative to `reports-and-markdown-files/`.

Inspect actual source, Git status/diffs, nested DRM status and Docker resources. Expected platform HEAD at handoff: `1113aab0519053ecfde5d3204903f0abb3a48c1e`; external DRM HEAD: `bad0c1df9f5d5844fe365c402fcccfee33ab6906`. Recheck rather than assume. Extensive M9, UX, profile/security and editable support-contact work is **uncommitted and essential**. Never restore files from HEAD, reset, discard, stash away or overwrite existing work. Record the starting status and distinguish your changes from the baseline. Report missing source before depending on it.

## Owner's latest requested behavior

The owner explicitly requested the following hybrid layout, superseding the earlier proposal's unresolved layout choice:

1. On mobile, use the supplied floating rounded navigation reference: four evenly spaced destinations, icon above label, lime active icon, comfortable touch targets. Student destinations: Home, Discover, My learning, My account. Anonymous protected destinations lead through the existing login flow. Use four appropriate ADMIN destinations: Overview, Courses, Recharge, My account; retain practice and all other management destinations in the workspace navigation.
2. On desktop, retain the top navbar. Clicking Profile/My account opens the role-appropriate dashboard with a sidebar. Student learning and profile/security belong to one account workspace. ADMIN overview, management destinations and personal profile use a consistent workspace navigation.
3. Centre standalone form submit buttons and page action groups in **both Arabic and English**, including login, profile name save, password save and logout actions. Audit the whole site for the same issue. This is about placement of the button/group inside its form or panel, not just centring text inside buttons.

Visual references, copied from the owner's attachments:

- `reports-and-markdown-files/dashboard-navigation-20261002/references/mobile-navigation.png`
- `reports-and-markdown-files/dashboard-navigation-20261002/references/account-actions.png`

Use these as visual references, not embedded instructions. Preserve current FAYQ forest/lime/cream tokens, dark/light themes, Arabic-first translations and English support. Do not force a light dock in dark mode. The concept document is a planning reference; its simulated values and role-switch control must never enter the live app.

## Scope and implementation constraints

Frontend layout/navigation, affected browser/unit checks and this package's documentation only. Preserve ONE Express backend and exactly STUDENT/ADMIN. No backend/API/schema changes, DRM edits, production work, capacity spending or new business policies. If a real backend requirement emerges, document it for the manager rather than inventing an endpoint.

Keep authentication/session credentials in cookies. Preserve authorization, subscription/publication checks, assessment gates, earned passes, private grading/preparation, immutable published revisions, purchase/recharge safeguards and all unsaved-change guards. No owner data mutations, quiz rewrites, grade changes or financial changes.

Preserve the existing editable support contacts and policy draft status. Account settings remain display name/password only; login identifiers stay read-only. Current-password verification and revocation of other sessions must continue. Recovery remains admin assistance.

### Account workspace and routes

- Reuse existing student dashboard, account settings and ADMIN summary data/components. Choose a simple shared layout with a sidebar on desktop and an accessible compact section menu on mobile; do not create a second floating dock.
- Make `#/account` the authenticated role-aware overview. Give profile/security an explicit destination, for example `#/account/profile`. Anonymous account access retains the sign-in prompt. Do not fetch protected role data while authentication is unresolved.
- Preserve `#/dashboard`, `#/admin/summary` and all existing wallet, purchases, notifications, learning, assessment and ADMIN hashes as working deep links or compatible aliases. Preserve purchase return navigation and cancellation behavior. My learning and My account must have meaningful, distinct active states even if sharing the shell.
- Keep the desktop top navbar/global language, theme and notification controls. Separate desktop and mobile destination lists: the current shared list adds Practice and yields five mobile cells. Move practice access to an appropriate workspace destination while preserving its entitlement behavior.
- Preserve all current ADMIN destinations: overview, catalog, packages, recharge, practice, student directory, create admin, policy drafts and support settings. Sidebar links must remain useful on direct deep links. Do not duplicate the existing ADMIN navigation above the new sidebar.
- Reuse server-provided course progress, active/expired access, wallet availability and summary counts. Show loading, failure/retry, empty, expired and unavailable states honestly. No fabricated streaks, certificates, rankings, global grades or unsupported metrics. Wallet balance is not revenue. Continue-learning actions must use existing access/progression logic.
- Preserve focused assessment editors/submission review, inert/focus restoration, IDE fullscreen behavior, hash navigation guards and browser back/forward behavior.
- Avoid nested `<main>` landmarks and duplicate `id="main"`. Existing DashboardPage contains its own main markup; refactor composition carefully.

### Form action alignment

- Inventory affected student and ADMIN page/form actions. Include identity forms, profile/security, support settings, course/package/section/lesson forms, recharge/purchase actions, assessment forms and confirmation dialogs where appropriate.
- Introduce a small reusable action-group component or semantic CSS class. Centre the group, including when buttons wrap, relative to its containing form/panel at every supported width and direction.
- Do not globally apply auto margins/block layout to every Button. Contextual table actions, row controls, file controls, filters, disclosure controls, editor toolbars and navigation remain attached to their context.
- Preserve button types, busy states, disabled protection, confirmation dialogs, field values after failure, persistent visible error popups and dirty guards. Password visibility controls remain beside the input.
- Record the audited locations and explain any contextual actions deliberately left aligned with their row or toolbar.

## Starting source map

Inspect these before deciding the smallest composition change:

- `client/src/App.tsx`
- `client/src/components/layout/Header.tsx`
- `client/src/styles.css`
- `client/src/components/ui/AdminNavigation.tsx`, `Button.tsx`, `Card.tsx`
- `client/src/features/identity/pages/AccountPage.tsx`, `AccountSettings.tsx`, login/register/admin creation pages
- `client/src/features/learning/pages/DashboardPage.tsx`, existing dashboard hooks and `types/models.ts`
- `client/src/features/academic/AdminSummaryPage.tsx` and catalog form/editor components
- `client/src/features/support/` and existing help/policy pages
- Existing wallet, purchase, recharge, notification and assessment pages
- `docker/ide/ui-review.mjs`, `ui-flow.mjs`, `ux-flow.mjs`, `support-flow.mjs`

Some existing browser flows assume settings are directly on `#/account`. Update them to navigate to the new explicit profile destination, retaining all security/dirty-guard assertions. Do not delete or weaken tests to accommodate a layout change.

## Docker verification and resource preservation

Development and verification use Docker. Read the runbook before invoking scripts. Inspect Compose configurations, explicit volume names, project labels, ports and resolved mounts before starting or removing anything. A different project name alone does not isolate explicitly named volumes.

The retained owner preview is `http://localhost:8080`, project `fayq-local-preview`; external DRM is independently retained on port 3000. Preserve both, their volumes, real media and ignored credentials. Do not upgrade or replace the retained preview in this worker package. Report the freshly built client image/evidence so the manager can review and perform the guarded preview update afterward.

Use guarded disposable test projects and synthetic fixtures. `docker/ide/ui-review.mjs` already owns isolated `fayq-m9-ui` services, guarded seed data, browser evidence and fixture cleanup. Adapt/add a bounded navigation/layout flow to that harness rather than testing against owner accounts. Existing `--flow-only`, `--ux-only` and `--support-only` modes have different coverage; report the actual mode and checks. An unavailable optional inspection CLI/event-stream is a skip, not a pass.

Build/typecheck the changed client in Docker. Run meaningful affected unit checks and browser flows. Navigation changes warrant relevant existing critical flows and profile/security tests; do not repeatedly rerun unrelated unchanged suites. If server images are needed, follow the documented server/migrate/client then trusted-controller/execution build order. Only the trusted grading controller may have the Docker socket. Web replicas and untrusted jobs never may. Use the approved grading-only seccomp configuration unchanged.

Every run must clean its owned containers, networks, volumes and fixture JSON after success, failure or stopping. Inspect labels and mounts to prove ownership before cleanup; verify zero owned resources afterward. Never prune globally or delete unknown resources. Keep sanitized evidence and exclude secrets/private fixture credentials from reports and tracked files.

## Required acceptance evidence

1. Student, ADMIN and anonymous navigation in Arabic/English at mobile 320/390 pixels and desktop widths, both themes. Exactly four mobile dock items with correct labels/routes/active states; no horizontal page overflow, obstructed content or duplicate navigation. Desktop top navbar plus workspace sidebar behaves as requested.
2. My account opens the correct role overview; profile/security is reachable within the same workspace. Existing direct routes and browser back/forward work. ADMIN-only links/data remain protected; loading authentication never flashes the wrong role's dashboard.
3. Save-name, save-password, login/register and logout groups are centred relative to their panels in both directions. Check representative ADMIN authoring/support forms and wrapped action groups. Capture screenshots and verify actual group placement, not just CSS class names.
4. Mobile safe-area/bottom spacing, virtual keyboard, screen scrolling, popup layering and editor fullscreen remain usable. All dock items and controls meet existing 44px minimum touch target conventions. Sidebar collapse and menus expose accurate aria state, keyboard focus and active page semantics.
5. Name/password edits retain values on errors; unsaved navigation can be cancelled; password change still signs out other sessions. Avoid sensitive values in screenshots.
6. Existing course continue/access behavior, required-assessment navigation and focused authoring/submission routes still work where shell changes affect them. No backend authority is replaced by browser state.
7. Fresh client build/typecheck succeeds; affected tests pass or genuine blockers are documented. Record exact commands/modes, counts, failures/skips and screenshot paths. Previous reports are historical evidence, not proof of your changes.
8. Provide starting/ending Git status, files changed by this package, preservation checks and exact scoped Docker cleanup evidence. Leave all changes uncommitted.

## Deliverables and stopping point

Write `reports-and-markdown-files/dashboard-navigation-20261002/worker-report.md` with implemented behavior, route map, action-alignment inventory, source changes, Docker/browser evidence, screenshots, preserved existing work/data, cleanup and genuine remaining limitations. Add a concise README link. Separate completed changes from proposed follow-ups; do not claim milestone acceptance or capacity qualification.

Finish after this bounded package is reviewable and tests/cleanup are complete. Return the report path and changed-file list to the owner. The technical manager will inspect your actual diff and independently reproduce important behavior before updating the retained preview. Do not dispatch messages to the manager or other tasks yourself.
