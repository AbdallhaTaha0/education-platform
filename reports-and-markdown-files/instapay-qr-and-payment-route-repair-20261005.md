# Payment route repair and InstaPay QR upload — 2026-10-05

## Owner request and root cause

The owner reported 404 responses for InstaPay and Vodafone Cash settings at the ADMIN recharge page and requested an InstaPay QR image upload. Inspection of the retained backend's compiled wallet router confirmed `runtimePaymentRoutes=false`: the running backend image predates the existing payment-settings routes. The preceding dashboard refresh updated only the frontend; fresh isolated tests had current backend code but the owner preview still had the older backend. This delivery refreshes the backend too, rather than masking the 404 in the browser.

## Feature and boundaries

ADMIN can upload or replace a PNG/JPEG QR image in the InstaPay receiving-details tab, preview it after saving, and remove it with confirmation. Save receiving-details edits first; image changes are separate explicit actions. Selected unsaved files participate in the existing leave-page guard. QR controls are not added to Vodafone Cash.

Students see the saved QR in their wallet and recharge receiving instructions when InstaPay is enabled. The image caption reminds them to verify recipient and amount in InstaPay. A QR image is an owner-supplied receiving aid, not an automatic wallet-credit or proof-verification mechanism. Manual review and receipt verification remain unchanged. The platform does not claim to verify the encoded QR destination.

Images are limited to 128 KiB and dimensions of 1–2048 pixels per side. The backend validates canonical base64, PNG/JPEG MIME/filename pairing, signatures/minimal structure and bounded dimensions. SVG, HTML, PDF, empty and oversized files are rejected. Image reads require an authenticated user; disabled-method images remain available to ADMIN but return 404 to students. Writes retain exact-origin, cookie authentication, ADMIN, CSRF and rate-limit checks. Images have explicit MIME, `nosniff`, restrictive CSP and `no-store` responses.

The singleton image is persisted in platform PostgreSQL as nullable bytes/MIME fields through additive migration `20261005170000_instapay_qr`. This small bounded shared resource does not use DRM/video storage, a host upload directory, or per-replica files. Ordinary instruction responses include an image URL, never image bytes; receiving-details reads select metadata only. QR writes increment the same optimistic version as receiving edits, preventing stale overwrite. Removing an image clears its bytes and MIME without deleting the account instructions.

API additions:

- `POST /admin/payment-settings/instapay/qr`: image plus expected settings version.
- `DELETE /admin/payment-settings/instapay/qr`: expected version.
- `GET /admin/payment-settings/instapay/qr`: ADMIN preview.
- `GET /wallet/payment-settings/instapay/qr`: authenticated student display, enabled method only.

Nginx exposes these through the existing `/api/` prefix. No new service, external dependency, infrastructure, DRM edit or production deployment is involved.

## Verification

Docker backend/frontend builds and backend test typecheck passed. Real PostgreSQL/Redis wallet integration: **56/56 passed**, including five QR tests for authorization/CSRF/origin, invalid uploads, concurrent/stale version fencing, exact private image bytes, enabled-method visibility and removal preserving receiving details. Existing financial regressions remain included.

The initial build caught the generated Prisma byte-field type requiring a copied `Uint8Array`; corrected. The initial unauthenticated write test omitted Origin and correctly received origin-denial 403 before authentication; the probe now supplies an approved Origin to exercise 401. A browser fixture initially removed its temporary image before FileReader consumed it; the harness now retains it through the upload response. These test/build failures are not represented as product passes.

Real browser payment flow: **32/32 passed**, including QR upload/preview, persistence on reload, STUDENT image display, PNG-to-JPEG replacement, and removal preserving receiving instructions, alongside the existing approval/balance tests. ADMIN workspace regression: **27/27 passed**. Total targeted browser checks: **59**. The existing frontend bundle-size warning remains; this is not capacity qualification.

Final disposable runs reported zero remaining test containers, networks and volumes. Synthetic image files lived only in the transient browser container and were removed after use. The owner database/media are excluded from test fixtures. No commit/push or milestone acceptance is inferred.

## Local update and rollback

The retained-preview guard and protected PostgreSQL backup precede migration/application refresh. Existing financial/catalog/user/media fingerprints are compared before and after. Previous image aliases are retained before assigning tested server, migrate and client images. Rollback may restore those aliases while leaving additive nullable columns in place; do not drop the columns or delete owner data. Nested DRM and retained database volumes remain unchanged.

Completed local refresh: the guard passed, a protected database backup was created, and user/wallet/purchase/subscription/catalog/media fingerprints and existing reached-lesson preservation were unchanged. The tested server/migrate/client aliases are running at localhost:8080; previous aliases are retained as `fayq-platform-{server,migrate,client}:before-payment-qr-20261005`. The proxy was recreated to resolve refreshed service addresses. DRM source and all four DRM container identities are unchanged. No owner QR image or receiving destination was inserted by testing; upload the desired real QR through the ADMIN tab.
