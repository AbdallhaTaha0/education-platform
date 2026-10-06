# Vodafone Cash, IDE naming and notification acknowledgement

Owner scope, 2026-10-05: add Vodafone Cash, use the same receiving number/name as InstaPay, call the programming workspace IDE in both languages, and clear old navbar notifications after entering the inbox.

## Implementation

- Independent singleton VodafoneCashSettings table and protected ADMIN GET/PUT /admin/payment-settings/vodafone-cash, with the existing origin/CSRF checks, validation and optimistic version fencing. Both receiving translations required when enabled.
- Vodafone Cash uses the existing MOBILE_WALLET recharge channel. Saved settings override its legacy deployment configuration. InstaPay and bank transfer are preserved; no new ledger semantics or automatic credit.
- Shared admin editor supports separate activation/receiving details for each method. Student wallet and recharge selector show Vodafone Cash. Existing concise field hints are preserved.
- Retained local receiver enabled through the platform settings service: +201005344368, عبدالله طه عبدالله. No financial rows changed by configuration.
- Student navbar, account links/sidebar and workspace title use IDE in Arabic/English.
- Opening the notification page requests server-confirmed read-all through the freshly loaded snapshot fence. New arrivals remain unread. Closing before loading cancels automatic acknowledgement; failed writes retain the badge and display the existing retry error. Opening an individual destination also marks that notice read. Notices remain in inbox history.

## Verification

Docker server/client builds pass. 51 wallet integration checks cover both receiving methods, authorization, CSRF, translated input validation, stale/concurrent updates, disabling, pending requests and existing financial integrity. Vodafone browser flow passes 22 checks before notification follow-up. Focused notification state suite passes 15 checks, including automatic acknowledgement failure and later arrivals, plus 2 DASH compatibility checks.

Guarded retained upgrade took an ignored private PostgreSQL backup, applied migrations twice and preserved fingerprints for 24 existing data tables. DRM and retained volumes unchanged. Isolated test cleanup reports zero owned containers/networks/volumes. Final notification browser verification pending below.

## Operations and boundaries

Builds: docker build -f server/Dockerfile --target test -t fayq-ide-modes-server:test .; --target runtime -t fayq-vodafone-server:20261005; --target migrate -t fayq-vodafone-migrate:20261005. Frontend runtime image fayq-notification-client:20261005. Verification: node docker/ide/modes-verify.mjs --wallet-only; Docker client test image runs the notification inbox suite. Local upgrade: node docker/ide/modes-preview.mjs upgrade. Receiver: configure-vodafone-local.mjs via stdin inside retained platform server.

Rollback images: fayq-platform-{server,client,migrate}:before-vodafone-20261005. Restore serving aliases and recreate corresponding services/proxy; retain additive settings table and data. No production release, commit/push, capacity claim or new DRM maintenance.

Verification iterations: initial browser attempts exposed test assumptions (select a payment method before expecting receiving details, wait for the logout reload, wait for asynchronous notification delivery before entering, and query a list of badge elements). Corrected the harness; no suppressed application error or weakened financial assertion. Each failed run cleaned its owned Docker resources.

Final Docker verification: 51 integration tests and 24 real-browser assertions pass, including persisted server acknowledgement and no repeated navbar badge after navigation/reload. Notification unit suite: 15 tests, plus 2 DASH checks. Disposable cleanup confirmed zero containers/networks/volumes. Final notification frontend-only update preserves the backend receiver settings. Rollback for this frontend follow-up: fayq-platform-client:before-notification-ack-20261005.

Desktop layout follow-up: wallet receiving methods use two columns at desktop widths (lg), with each card internally stacked; mobile retains one column. The recharge page retains its existing full-width receiving layout. Docker frontend build passes and 26 browser checks pass, including measured desktop card positions and mobile stacking/no horizontal overflow. Screenshot visually reviewed. Reused guarded browser-only verification avoids rerunning unchanged financial integration tests. Updated frontend: fayq-wallet-columns-client:20261005; rollback: fayq-platform-client:before-wallet-columns-20261005.

Payment logo follow-up: bundled official InstaPay header wordmark and Vodafone brand SVG beside localized method names in the shared receiving card (wallet and selected recharge method). Assets/provenance: client/src/assets/payments/README.md. Empty image alt avoids duplicate accessible headings. White InstaPay artwork uses a purple backing; Vodafone keeps its original red/white mark. Frontend Docker build passes. Initial browser asset check was corrected to accept Vite-inlined data images as bundled local assets; failed test resources were cleaned.

Logo verification final: 27 Docker browser assertions pass; mobile screenshot visually inspected. Both bundled logo images load and desktop/mobile layout remains correct. Test cleanup: zero owned containers/networks/volumes. Local frontend updated to fayq-payment-logos-client:20261005, rollback alias fayq-platform-client:before-payment-logos-20261005. Backend/receiver settings unchanged.
