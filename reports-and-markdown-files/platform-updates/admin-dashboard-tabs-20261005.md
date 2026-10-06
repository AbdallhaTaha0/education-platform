# ADMIN dashboard tabs — 2026-10-05

## Authorized scope

The owner requested clearer ADMIN dashboard tabs and clearly named editable sections. This delivery changes frontend navigation and layout, plus the isolated browser verification harness. It does not change permissions, platform architecture, database schema, recharge approval rules, subscriptions, or the independently deployed DRM service. It does not authorize deployment, milestone acceptance, or commit/push.

## Dashboard navigation

The ADMIN workspace now uses six bilingual navigation groups:

| Group | Management sections |
| --- | --- |
| Overview | Platform summary |
| Courses & packages | Courses, lessons, videos, assessments and packages |
| Students & practice | Student details and IDE Run limits |
| Recharge & payments | Recharge review and payment receiving settings |
| Platform settings | Support contacts, policy drafts and administrator creation |
| My account & inbox | Profile/password and notifications |

Each group has a short description and clearly named section links. The old ADMIN sidebar is removed; STUDENT navigation is preserved. Route navigation uses native links, keeps existing URLs and shows one active group. The responsive layout supports Arabic RTL and English.

## Editable sections

Recharge management has separate local tabs for request review, InstaPay receiving details, and Vodafone Cash receiving details. Payment forms remain mounted when switching these tabs, preserving unsaved drafts. Saving remains explicit and independent for each payment method; leaving the page retains the existing unsaved-change confirmation. Recharge review retains receipt verification and manual approval.

Course editing has four clearly named tabs: lessons/videos/assessments, course details, prices/subscription access, and publishing/archive/deletion. Descriptions explain each section and distinguish reversible archiving from permanent deletion. Existing course unsaved-change confirmation is retained before changing sections.

Reusable local tabs provide labelled tab/panel associations, one selected tab, keyboard arrows with RTL-aware direction, Home/End navigation, and visible focus. The overview remains read-only and points administrators to editable sections rather than repeating navigation links.

## Verification

- Docker frontend runtime build: TypeScript and Vite passed. The existing bundle-size warning remains.
- New isolated ADMIN dashboard browser flow: 27 checks passed, covering navigation groups and existing routes, course/payment panels, draft preservation, cancelled navigation, keyboard behavior, mobile Arabic layout, unchanged STUDENT navigation, ADMIN API authorization and browser errors.
- Payment browser regression: 27 checks passed, including receiving-settings persistence, both payment methods, STUDENT receiving instructions, recharge submission, verified approval, exact balance credit, notification acknowledgement and logout. Existing assertions are retained; the harness selects the new payment tabs before interacting with their fields.
- Desktop English and mobile Arabic screenshots were inspected; evidence stays in the ignored browser evidence directory.
- Disposable verification projects use guarded volumes and clean their containers, networks and volumes after each run. Owner preview data and real media are outside their scope.

Commands from the repository root, with Docker available through `DOCKER_EXE` if necessary:

```text
node docker/ide/modes-verify.mjs --admin-tabs-only
node docker/ide/modes-verify.mjs --wallet-browser-only
```

The payment regression reached 20 passing checks before failing to select the next panel. Diagnostics confirmed the tab remained unselected despite being enabled. The harness now scrolls that tab to the viewport center before clicking (clear of the fixed header) and waits for the field to become visible. Product checks were not removed or weakened.

## Preview and delivery state

The tested frontend is running at localhost:8080. Only the client and Nginx proxy were recreated after the retained-preview ownership guard passed. The prior frontend image is retained as `fayq-platform-client:before-admin-tabs-20261005`; the new image is `fayq-admin-tabs-client:20261005` (image ID `84b097292d82`), also assigned to the existing serving alias.

Platform server, grading controller, PostgreSQL, Redis and all four DRM service container identities are unchanged. Homepage and API readiness returned 200. A transient read-only Chromium smoke check of the retained website returned 200, rendered its heading and recorded zero browser errors; it created no account or course fixture.

Both final disposable verification runs reported zero remaining containers, networks and volumes. Total targeted browser verification: **54 passing checks** (27 dashboard + 27 payment). The nested DRM working tree remains clean. No backend migration or DRM maintenance was performed. Changes remain uncommitted for owner review.
