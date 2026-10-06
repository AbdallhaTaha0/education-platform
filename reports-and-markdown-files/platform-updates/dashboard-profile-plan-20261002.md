# Student and ADMIN dashboard/profile proposal — 2026-10-02

Subsequent owner decision: use the unified account workspace with a desktop top navbar/sidebar and four-item reference mobile dock. The owner stopped OpenCode and assigned direct completion. [Implementation and verification](dashboard-navigation-20261002/worker-report.md) are complete on localhost:8080; the planning-only paragraphs below are the historical proposal, not current restrictions.

Planning and visual review only. No live application change, database migration, acceptance, commit or push is authorized by this proposal.

## Current implementation

Student learning already exists at `#/dashboard`: active/expired subscriptions, progress and continue actions. `#/account` separately shows identity, editable display name/password and logout controls. Wallet, purchases and notifications are separate pages with account shortcuts. The student dashboard payload already includes wallet balance.

ADMIN overview exists at `#/admin/summary`: current counts, pending recharge work and management links. Existing ADMIN navigation includes courses, packages, recharge, student directory/practice controls, admin creation, policy drafts and editable support contacts. The current account page mixes personal information with management shortcuts. These are a navigation/layout opportunity, not evidence that the platform lacks dashboards.

## Recommended organization: one account workspace

Student entry: **My account → My dashboard**. Learning is the default tab; profile is one tab in the same shell. Desktop uses a compact RTL sidebar; mobile uses concise tabs/dock without two competing navigation bars.

| Student section | Content / existing source |
| --- | --- |
| My dashboard | Resume last available course; active-course count, completed lessons, wallet balance; selected course access terms and progress. Existing learning dashboard data; lesson access stays server-checked. |
| My courses | Active and expired access; unpublished/presale clarity; continue and review-offer actions. Existing subscription cards and learning route. |
| Wallet & purchases | Balance, recharge status, receipts and course identity. Keep protected existing wallet/purchase flows and immutable paid terms. |
| Activity & notifications | Existing inbox plus contextual links to assessments/history. Do not invent global scores or an assessment feed endpoint; start with the inbox and course-scoped assessment links. |
| Profile & security | Display-name editing, current-password verified change, read-only email/phone and existing session/logout actions. No identifier-edit or provider recovery policy change. |

ADMIN entry: **Management → Overview**. Use a task-first dashboard rather than a decorative analytics page. Pending recharge requests are the main action. Personal profile/security is an explicit “My account” destination in the same shell, distinct from site settings.

| ADMIN section | Content / existing destination |
| --- | --- |
| Overview | Pending recharge count and review link; existing student, published-course and draft-course counts; shortcuts into current management screens. |
| Courses & packages | Existing catalog, lesson/video workspaces, assessment preparation/publishing and package management. |
| Recharge review | Existing filtered manual-verification queue, selected proof and one-credit protections. Dashboard does not add approval controls. |
| Students & practice | Existing bounded student directory and allowance lookup/settings; no invented student financial or private-answer detail API. |
| Platform settings | Existing editable support contacts, policy draft review and Create admin. Policies remain drafts. |
| My account | Personal identity, name/password and logout controls, separate from business settings. |

The visual compares **Unified workspace** (recommended sidebar/tab model) and **Overview and profile card** (horizontal navigation with a compact profile card). Both show Student/Admin and Arabic/English views, with explicitly illustrative data. Preview role switching is a mockup control, never a public role selector. All contact/profile samples are fictional; the mockup sends no network requests or saves.

## Bounded implementation packages after owner selection

1. **Shared account shell and route compatibility.** Add role-aware account layout, single desktop/mobile navigation and active-state breadcrumbs. Retain old hashes as aliases/deep links so bookmarks, purchase return links and assessment links keep working. Default student login to learning overview, ADMIN login to management overview after existing authentication.
2. **Student overview and integrated profile.** Reuse existing dashboard/subscription and account settings components. Show loading/empty/expired/presale/error states, conditional practice access and meaningful continue action. Summaries use actual API data; a failed wallet read is unavailable, never silently zero. Preserve unsaved guards across shell tabs and profile failures.
3. **ADMIN overview and personal account.** Reuse existing summary API and links. Show work requiring review, data timestamp and refresh; preserve focused course/assessment workspaces. Do not label wallet balances as revenue, infer missing-video counts from incomplete catalog data or create unbounded global submission views.
4. **Independent Docker/browser review and retained preview.** Test Arabic/English, dark/light, 390-pixel mobile, keyboard navigation, student/admin/anonymous boundaries, old route links, unsaved navigation, course expiry and required-assessment gating. Check recharge approval and profile/session behavior only where affected. Use synthetic fixtures and clean inspected owned containers/networks/volumes/fixtures after success, failure or stop; preserve owner media/data and current preview. Upgrade only after checks with the existing backup/fingerprint procedure.

Prefer no schema change or new API for the first pass. A truly new aggregate or assessment feed needs a separate bounded contract if the owner requests it. No streaks, certificates, ranks, live schedules, automatic payments, new roles, DRM maintenance, production deployment or capacity spending are added.

## Review choice

Choose the sidebar account workspace or the horizontal/profile-card alternative, then refine visible sections and mobile labels before implementation. Owner selection of a layout authorizes no commit/push by itself. Representative student/admin task testing remains distinct from browser functional checks.

The local proposal passed 11 Docker browser checks for student/profile/ADMIN/queue interactions, Arabic/English direction, both layouts at 1024/736/390/320 pixels, light appearance and no page exceptions. Screenshots were visually reviewed; theme inheritance and mixed-direction summary numbers were corrected and the checks rerun. The disposable browser had only the task-owned visual/check/evidence mounts and removed itself; no test database, owner app change or live API request was used. These checks validate the mockup, not an implemented dashboard.
