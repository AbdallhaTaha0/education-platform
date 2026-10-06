# Wallet, InstaPay settings and logout follow-up — 2026-10-05

Owner requested: logout must replace the current page with login; make wallet recharge work; allow ADMIN changes to InstaPay; remove duplicate desktop navigation highlighting; center text below the login submit button. Owner supplied the current receiver: `+20 10 05344368`, `عبدالله طه عبدالله`.

## Result

- Logout and logout-all now reload `#/login` after a successful server response. This clears the old client view. Failure retains the existing error behavior. The owner's open learning tab still had an older bundle; after loading the correction, its actual logout was observed to replace the learning page with the login form at `http://localhost:8080/#/login`. The final updated login screen is loaded in that tab.
- Wallet previously had no configured receiving channels, so manual recharge was intentionally disabled. InstaPay is now enabled locally with normalized receiver number `+201005344368` and the supplied recipient name in both language instructions. No real transfer, test recharge or credit was made in the retained database.
- ADMIN can edit receiving phone/address, bilingual recipient/instructions, and enabled state from **Recharge review → InstaPay receiving settings** (`#/admin/recharge`). Settings persist in PostgreSQL and apply across backend replicas without rebuilding. Existing deployment-configured bank/mobile methods remain available. Until the settings row exists, the legacy configured InstaPay channel remains the fallback.
- Student wallet and recharge form display the receiving details. Recharge submission and admin review can refresh an expired access session once when authentication rejects the request before business logic. Network/server failures are not blindly replayed. Wallet refreshes on focus.
- Existing manual verification, EGP integer amounts, zero credit on submission, idempotency and exact-once approval remain. Disabling InstaPay prevents new submissions while retaining pending requests for review.
- Desktop Profile no longer highlights wallet pages at the same time as Wallet. Mobile Profile still represents its grouped account destinations. Login registration/recovery links and assistance text are centered beneath the submit button.

## Implementation and safeguards

Additive migration `20261005030000_instapay_settings` creates `InstaPaySettings`; existing tables/columns are unchanged. ADMIN settings reads require authentication and ADMIN role. Writes also require approved origin and session CSRF. Both translations are required when enabled, field sizes are bounded, unknown fields are rejected, and a version check fences concurrent/stale edits (including first creation). Rendering uses plaintext React content.

The one Express backend and external API-only DRM boundary remain. No nested DRM source or deployment change; no new payment gateway, production release, acceptance, commit or push.

## Verification

- Docker backend TypeScript build/Prisma generation and serving-runtime smoke checks passed; frontend TypeScript/Vite build passed (existing bundle warning).
- `node docker/ide/modes-verify.mjs --wallet-only`: 47 integration checks across payment settings, recharge submission/review, financial integrity, purchases and proof cleanup passed. Covers authorization/origin/CSRF, validation, shared persistence, concurrent/stale settings edits, disable behavior, credit and duplicate protections.
- 15 Docker browser checks passed using real authentication/API/database with synthetic recipients and receipt only. Covers ADMIN settings save/reload, student receiving details, single Wallet highlight, expired-cookie submission, pending/zero-credit, required receipt confirmation, exact 25 EGP verified approval, disable behavior, STUDENT/ADMIN logout replacing the page, centered login help and no browser errors. No real InstaPay money transfer was performed.
- Earlier harness attempts needed fresh admin-page loads to read the new queue and close the completed review dialog; final runner passes. Screenshots `wallet-student.png`, `wallet-admin.png`, `wallet-login.png` were inspected. Private ignored evidence: `docker/browser/evidence/ide-modes/wallet-integration.log` and `wallet-flow.log`.
- Disposable ownership/mount guards and cleanup confirmed zero test containers, networks or volumes. No global prune.

## Retained preview update and rollback

The guarded local upgrade created a protected PostgreSQL dump, repeated the additive migration safely, and proved all 24 checked existing table fingerprints unchanged before configuration. Readiness passed; DRM remained unchanged. The owner configuration helper uses platform service validation/version checks, refuses production/wrong database, and refuses to overwrite existing different admin settings. It writes only the receiving settings, never financial balances or DRM data.

Serving images: `fayq-wallet-server:20261005` (`sha256:39addfac9a35cf89bd8c8675158961e288e7ef08a0eac6fd9f5a764661e43001`) and `fayq-wallet-client:20261005` (`sha256:7fc502079ece45ef2b1aa19c8d673863c7667dbe9284d1ec613f81a62e23ce14`). Migration image: `fayq-wallet-migrate:20261005`.

Rollback images are preserved under `fayq-platform-server:before-wallet-fix-20261005`, `fayq-platform-client:before-wallet-fix-20261005`, and `fayq-platform-migrate:before-wallet-fix-20261005`. Retag these to their `0.9.0-m9` aliases, verify preview guards and recreate affected services/proxy using the retained Compose configuration. Keep the additive settings table and all volumes; the old backend uses deployment receiving configuration. To suspend the new receiving channel, ADMIN can disable it from its settings form without changing historical requests.
