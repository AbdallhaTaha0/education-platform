# Codex implementation prompt — M8-02: FAYQ youth shell and landing page

Execution follow-up, 2026-10-01: the owner directly assigned Codex to work on M8. [The shell/landing report](m8-02-shell-landing-report.md) records the implemented bounded package and same-agent verification. This saved prompt is the historical assignment template, not a request to repeat completed work; M7-05 independent review and later M8 feature contracts remain open.

Complete this package only and stop for manager review. This is a reusable prompt for the implementation executor; it has not been dispatched. Begin after the manager reviews the concurrent M7-04 server work and M7-05 client work and records the usable baseline. Preserve all their changes. No commits, pushes, deployment or package-03 implementation.

## Owner request and authority

FAYQ targets secondary students aged 15–18. The owner asked to redesign the whole website with that vision, adopt the supplied floating mobile bottom navigation, get/add the FAYQ logo, use dummy data for testing and make the landing page feel real. Student and admin areas are included. Report screens come first, CSV later. This package implements the shared visual foundation and landing experience; subsequent packages address the remaining pages and approved new features.

Read root AGENTS.md and the documentation index, agent.md, rules.md, decisions.md, current design.md, m8-product-and-ui-plan.md, m8-design/website-redesign-brief.md and m8-design/assets/README.md. Inspect every current route before changing the shared shell. The brief's source audit covers all 17 routes but is not current authenticated-browser proof.

Review both supplied references now stored in the repository:

- `reports-and-markdown-files/m8-design/reference/fayq-brand-board.png`.
- `reports-and-markdown-files/m8-design/reference/mobile-bottom-nav.png`.

Inspect `m8-design/preview.html` as an interactive direction prototype, not a React implementation source to copy indiscriminately. Its data, admin toggle and notifications/toasts are clearly labeled demo behavior. Do not put that fake role-switch or local demo action handling into production UI.

## Scope: build a distinctive real website foundation

The target is an inviting programming-learning brand with achievable outcomes, a clear course choice and a focused personal learning experience. Retain forest/lime/amber/cream/charcoal, approved slogans, self-hosted fonts, Arabic default/RTL, English/LTR and dark-default/light themes. Do not deliver a generic dashboard template, a blanket recoloring, endless identical cards or childish decoration.

Work in the platform client, existing shared components, identity strings/tokens and narrowly scoped Docker/browser/demo tooling. Backend/schema changes are excluded from this visual package. Do not edit DRM, dependencies/lockfiles, cookie/auth/access/money logic or media/session internals to make the UI work. If an API is missing for a future feature, omit that feature's live control and report the dependency; do not invent an endpoint or hardcode personalized records.

### A. Canonical logo and assets

Inspect the board's actual FAYQ wordmark, Q tail and rays against current `Wordmark.tsx`/`BrandMark.tsx`. Use a clean original vector if available. Otherwise produce a faithful editable reconstruction from the provided reference, explicitly identify it as reconstructed in the report and show its visual differences. The provided `fayq-wordmark-concept.svg` is a review approximation, not a certified original: compare and improve it rather than presenting it as an exact extracted asset.

Provide consistent dark/light/header/compact variants without reversing Latin FAYQ in RTL. Maintain one canonical component and accessible FAYQ naming; decorative rays/art have no duplicate screen-reader announcement. Place actual consumed assets under an intentional client path and update `client/Dockerfile` COPY only if required to include them. Do not use the entire board as a logo, remotely hotlink assets or leave application assets in Downloads/.codex paths. Keep approved slogan copy in accessible HTML.

Use `m8-design/assets/fayq-learning-hero.png` as generated marketing illustration, with appropriate accessible/decorative treatment. Optimize responsive derivatives through a documented image pipeline and record output sizes. The illustration is fictional, not a real student portrait. No marketing copy rasterized into it. Preserve existing self-hosted bilingual fonts and semantic theme tokens. Evaluate text contrast over the actual final image/overlay, not an assumed solid background.

### B. Shared responsive shell and mobile dock

Replace the overflowing/scrolled mobile top menu with a compact top bar and a four-destination floating bottom dock inspired by the supplied reference. Match the rounded geometry, labeled icons, active elevated circle and spacing using FAYQ colors. Do not recreate the screenshot's purple page or fake OS home indicator.

Student dock proposal: Home, Discover (courses), My learning (existing dashboard), Profile (existing account). Admin: Overview (existing admin), Courses, Recharges, Account. Map to real current routes and preserve active state for nested offer/learn/recharge routes. Anonymous learning/account routes provide login behavior instead of fake signed-in records. Wallet, purchase history and notifications remain reachable through existing authenticated navigation/account affordances; no existing task can become orphaned. Keep notifications accessible in the compact top bar.

Desktop uses a deliberate readable header and existing role-based destinations. Do not remove admin creation, logout/all-session controls or the course-management route. Any larger account/admin-home redesign belongs in later packages; add only necessary navigation links here.

Use safe-area inset, generous page bottom padding and scroll padding, 44px targets, visible labels/focus, aria-current, correct RTL mirroring and reduced-motion behavior. Verify docks do not cover final form actions, dialogs, toasts or video controls. Fullscreen must not display the global dock over video. Mobile keyboard behavior requires actual device/browser evidence if available; record emulator-only limits. Shared layout changes must preserve player/session lifetime.

### C. Real-looking landing page

Implement the brief's narrative: brand/hero → concise benefits → real featured published courses → achievable programming project/outcome story → correct learning/funding steps → useful FAQ → final working discovery action/footer.

Proposed headline: Arabic `افهم الفكرة. اكتب الكود. ابنِ حاجة ليك.`; English `Understand it. Code it. Build something yours.` Keep the approved slogans exactly. Copy is supportive, clear and teen-appropriate. Do not add an AI-assistant claim, testimonials, invented enrollment counts, star ratings, certification or employment promises, urgency timers, live classes or a payment gateway.

The primary button opens actual courses. Secondary how-it-works action must scroll to its section without breaking the current hash router; inspect the existing `#/...` handling and do not repeat the prototype's standalone hash behavior in the app. Real course cards come from the existing catalog API and keep bilingual content, accurate EGP units, plan duration and purchase routes. No protected lesson list or invented lesson-count field in public data. Outcomes/prerequisites require real available metadata; new admin-authored fields remain a later contract. Avoid advertising demo outcomes as existing published content.

Remove backend health/readiness cards from the marketing landing page, preserving the health endpoints and existing operator tools. Show meaningful API failure/empty/loading/retry states for the course section. Keep manual recharge separate from admin-approved credit and explicit wallet purchase in all copy. Footer links need working destinations; do not create fake contact/legal content.

## Dummy data: isolated and truthful

The owner explicitly requested dummy data for testing. Use `m8-design/demo-content.json` as illustrative bilingual seed content, not approved live pricing. Create uniquely scoped disposable demo fixtures through reviewed helpers/platform APIs, with run receipt/ownership and exact cleanup. Do not modify the existing preview DB or seed on normal startup.

Landing fixtures may include public published offers only if the actual platform's publication/media contracts permit them. Never forge a DRM-ready asset or relax publication checks to make a card appear. When legitimate published media fixtures are unavailable, use the visibly labeled design prototype for that layout case and record actual app catalog coverage as blocked/empty; keep the real catalog API intact. Contract doubles prove layout/platform handling, not real DRM security.

Use synthetic `.example.test` accounts and references, no real transfer destinations/PII. Pending/rejected/approved recharge fixtures must preserve wallet/ledger behavior. No production role-toggle, demo admin bypass, hardcoded live balance or fake statistics. Persist private fixture credentials only in ignored files and remove receipts after cleanup.

## Verification and evidence

All installation, build, execution and browser verification use Docker. Inspect resource labels, resolved config, ports and volumes before running a private project; project names alone do not isolate explicit shared volumes. Do not touch OpenCode's resources, the existing port-8082 preview, DRM containers or their data. No global prune, production migration or external stress run.

1. Record baseline hashes/revisions and exact edited files. No dependency drift. Run actual client typecheck, production build, all existing client tests and both dash.js patch guards. Preserve test assertions and counts; no skip/only or timing-bar relaxation.
2. Build the actual runtime image, inspect copied logo/hero/font assets and prove stylesheet/image/font requests succeed. Check actual dimensions/payload sizes and zero page/request errors. All buttons in the shipped landing/shell must perform their stated task.
3. Exercise Arabic/English × dark/light × desktop/mobile for landing, discovery, account/auth, learning, wallet, purchase and admin entry routes with appropriate owned fixtures. Capture all eight landing combinations and representative authenticated routes. Visually inspect them; screenshots alone do not establish behavior.
4. Assert bottom-dock active state/navigation, correct role destinations, session/logout transitions, keyboard focus, no overflow, 44px targets, safe-area/content padding, readable image-overlay text and preserved contrast thresholds. Test empty/loading/failure states, long Arabic titles, keyboard-open overlap and fullscreen/player controls where the environment permits.
5. Because the shell touches learning routes, demonstrate no unwanted player remount/grant during theme/nav-layout changes and preserve existing progress/expiry/renewal logic. Reuse legitimate API fixtures; report real-playback limits honestly. No new DRM edits.
6. Confirm original financial/authorization behavior through relevant existing checks if affected by actual route/UI changes. Do not certify finance from static sample cards or call all server suites passed when they were not run.
7. Retain meaningful machine-readable results and failed attempts. Inspect project ownership/attachments before removing only owned fixtures/containers/volumes. Verify preview health and pinned clean DRM afterwards. No broad delete or blanket reset of concurrent work.

## Deliverable, rollback and stop

Write `reports-and-markdown-files/m8-02-shell-landing-report.md`: exact diff, owner requirements, reconstructed-logo status/comparison, asset provenance/optimization, route mapping, demo seed/cleanup, actual Docker commands/image identities, language/theme/screen coverage, tests, visual evidence, failures/blocks and rollback.

Rollback reverts only this package's shell/landing/assets/tooling hunks; preserves M7 dependency changes and the prior accepted business logic. No database rollback for product code; demo rows/resources are owned and cleaned separately. Add the report index row only after checking the shared index's current content; do not overwrite another executor's changes.

Stop for manager review. Do not implement saved courses, new search APIs, reports, admin summary endpoints or the remaining whole-site page redesign in this same package. The linked plan assigns those as separate reviewed packages. Do not claim M8 accepted or the site deployed.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
